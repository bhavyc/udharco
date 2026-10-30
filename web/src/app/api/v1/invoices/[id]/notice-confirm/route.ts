import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// POST /api/v1/invoices/:id/notice-confirm
// Enables Corporate Accounts Payable to review & digitally acknowledge Notice of Assignment (Factoring Act 2011)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { action = "CONFIRM", disputeReason, token } = body;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        anchor: {
          include: {
            user: { select: { id: true, inviteToken: true, email: true } },
          },
        },
        seller: { select: { id: true, legalName: true, gstin: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
    }

    // ── IDOR & ACCESS VERIFICATION ──
    const session = await getSession();
    const isLoggedAsAnchor = session && session.role === "ANCHOR" && session.entityId === invoice.anchorId;
    const isInviteTokenValid = token && invoice.anchor.user?.inviteToken && token === invoice.anchor.user.inviteToken;
    const isDev = process.env.NODE_ENV !== "production";

    if (!isLoggedAsAnchor && !isInviteTokenValid && !isDev) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED_NOTICE_CONFIRMATION: Invalid security token or unauthenticated session. Please use the verified Notice link sent to Corporate Accounts Payable.",
        },
        { status: 401 }
      );
    }

    const now = new Date();

    // 1. Handle Dispute Action
    if (action === "DISPUTE") {
      const reason = disputeReason?.trim() || "Commercial dispute raised by Corporate Buyer during delivery review.";
      await prisma.invoice.update({
        where: { id },
        data: {
          status: "DISPUTED",
          disputeReason: reason,
        },
      });

      await prisma.auditLog.create({
        data: {
          entityType: "INVOICE",
          entityId: id,
          action: "INVOICE_DISPUTED_BY_BUYER",
          actorRole: "ANCHOR",
          actorId: invoice.anchor.contactEmail || invoice.anchor.corporateName,
          metadata: `Corporate ${invoice.anchor.corporateName} disputed Invoice #${invoice.invoiceNumber}. Reason: ${reason}. Funding permanently blocked.`,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Invoice marked as DISPUTED. Early funding is halted per Factoring Regulation Act.",
        disputeReason: reason,
      });
    }

    // 2. Handle Commercial Delivery Confirmation
    if (invoice.anchorConfirmedAt) {
      return NextResponse.json({
        success: true,
        message: "Invoice delivery and Notice of Assignment have already been acknowledged.",
        alreadyConfirmed: true,
        confirmedAt: invoice.anchorConfirmedAt,
        anchorStatus: invoice.anchor.status,
        inviteToken: invoice.anchor.user?.inviteToken,
      });
    }

    // CASE A: Corporate Anchor is ACTIVE with an approved limit
    // Execute atomic conditional exposure update and transition to LISTED
    if (invoice.anchor.status === "ACTIVE" && invoice.anchor.maxExposureLimit > 0) {
      await prisma.$transaction(async (tx) => {
        // Atomic conditional SQL UPDATE at database write-lock
        const affectedRows = await tx.$executeRaw`
          UPDATE "anchors"
          SET "currentExposure" = "currentExposure" + ${invoice.totalAmount}
          WHERE "id" = ${invoice.anchorId}
            AND "status" = 'ACTIVE'
            AND ("currentExposure" + ${invoice.totalAmount}) <= "maxExposureLimit"
        `;

        if (affectedRows === 0) {
          const fresh = await tx.anchor.findUnique({ where: { id: invoice.anchorId } });
          const avail = fresh ? Math.max(0, fresh.maxExposureLimit - fresh.currentExposure) : 0;
          throw new Error(
            `ANCHOR_EXPOSURE_EXCEEDED: Available facility headroom is ₹${avail.toLocaleString()}, but invoice requires ₹${invoice.totalAmount.toLocaleString()}.`
          );
        }

        await tx.invoice.update({
          where: { id },
          data: {
            status: "LISTED",
            anchorConfirmedAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            entityType: "INVOICE",
            entityId: id,
            action: "ANCHOR_CONFIRMED_AND_LISTED",
            actorRole: "ANCHOR",
            actorId: invoice.anchor.contactEmail || invoice.anchor.corporateName,
            metadata: `Corporate ${invoice.anchor.corporateName} confirmed Notice of Assignment. Exposure atomically reserved (₹${invoice.totalAmount.toLocaleString()}). Invoice is now LISTED for investor funding.`,
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: "Commercial delivery confirmed! Invoice is now approved and listed on marketplace for investor bidding.",
        anchorStatus: "ACTIVE",
        invoiceStatus: "LISTED",
        inviteToken: invoice.anchor.user?.inviteToken,
      });
    }

    // CASE B: Corporate Anchor is PENDING (Vendor-Push un-onboarded buyer)
    // Fail-Closed Rule: Record commercial goods acceptance, but keep limit ₹0 and status PENDING.
    // Alert Admin to run the Procurement Reality Meter!
    await prisma.invoice.update({
      where: { id },
      data: {
        anchorConfirmedAt: now,
        status: "VERIFIED", // Awaiting Admin Sanction before it can become LISTED
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "ANCHOR",
        entityId: invoice.anchorId,
        action: "BUYER_DELIVERY_CONFIRMED_AWAITING_ADMIN_SANCTION",
        actorRole: "ANCHOR",
        actorId: invoice.anchor.contactEmail || invoice.anchor.corporateName,
        metadata: `Corporate ${invoice.anchor.corporateName} confirmed receipt of goods for Invoice #${invoice.invoiceNumber} (₹${invoice.totalAmount.toLocaleString()}). Awaiting Admin Procurement Reality Meter limit sanction (capped at ₹50L).`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Commercial delivery acknowledged! A copy has been logged to the statutory audit trail. Platform Admin will complete facility underwriting before funding unlocks.",
      anchorStatus: "PENDING",
      invoiceStatus: "VERIFIED",
      inviteToken: invoice.anchor.user?.inviteToken,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
