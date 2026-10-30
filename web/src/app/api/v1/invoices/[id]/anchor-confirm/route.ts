import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// POST /api/v1/invoices/:id/anchor-confirm
// Anchor corporate finance officer confirms goods receipt & accepts Notice of Assignment (NOA)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("ANCHOR");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        anchor: true,
        seller: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
    }

    if (invoice.anchorId !== auth.entityId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You can only confirm invoices addressed to your corporate entity." },
        { status: 403 }
      );
    }

    if (invoice.status !== "VERIFIED") {
      return NextResponse.json(
        {
          success: false,
          error: `Invoice cannot be confirmed by Anchor from status '${invoice.status}'. Must be in 'VERIFIED' status.`,
        },
        { status: 400 }
      );
    }

    // Anti-Fraud & Risk Gate: Enforce Anchor Sanctioned Limit & Active Status
    if (invoice.anchor.status !== "ACTIVE" || invoice.anchor.maxExposureLimit <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ANCHOR_NOT_SANCTIONED",
          message: `Corporate Anchor '${invoice.anchor.corporateName}' has not been sanctioned with an approved exposure limit (Status: ${invoice.anchor.status}, Limit: ₹${invoice.anchor.maxExposureLimit}). Invoices cannot be confirmed or listed for investor funding until Admin/NBFC sanctions the credit facility.`,
        },
        { status: 403 }
      );
    }

    const now = new Date();

    // ATOMIC FINTECH TRANSACTION: Single Atomic Conditional SQL UPDATE
    // Evaluated at the database engine level with exclusive row-level lock.
    // Prevents race conditions / double-allocation regardless of transaction isolation level.
    const { updatedInvoice, updatedAnchor } = await prisma.$transaction(async (tx) => {
      // 1. Atomically increment exposure ONLY IF (currentExposure + invoiceAmount <= maxExposureLimit)
      const affectedRows = await tx.$executeRaw`
        UPDATE "anchors"
        SET "currentExposure" = "currentExposure" + ${invoice.totalAmount}
        WHERE "id" = ${invoice.anchorId}
          AND "status" = 'ACTIVE'
          AND ("currentExposure" + ${invoice.totalAmount}) <= "maxExposureLimit"
      `;

      if (affectedRows === 0) {
        const currentAnchor = await tx.anchor.findUnique({ where: { id: invoice.anchorId } });
        if (!currentAnchor || currentAnchor.status !== "ACTIVE" || currentAnchor.maxExposureLimit <= 0) {
          throw new Error("ANCHOR_NOT_SANCTIONED: Corporate Anchor facility is inactive or underwriting is pending.");
        }
        const available = Math.max(0, currentAnchor.maxExposureLimit - currentAnchor.currentExposure);
        throw new Error(
          `ANCHOR_EXPOSURE_EXCEEDED: Available facility headroom is ₹${available.toLocaleString()}, but invoice requires ₹${invoice.totalAmount.toLocaleString()}. Concurrent or limit-exceeding allocation blocked at database lock.`
        );
      }

      // 2. Atomically transition invoice from VERIFIED to LISTED status
      const invoiceUpdated = await tx.$executeRaw`
        UPDATE "invoices"
        SET "status" = 'LISTED',
            "anchorConfirmedAt" = ${now}
        WHERE "id" = ${id}
          AND "status" = 'VERIFIED'
      `;

      if (invoiceUpdated === 0) {
        throw new Error("INVOICE_ALREADY_PROCESSED: Invoice is not in 'VERIFIED' status or was already confirmed concurrently.");
      }

      const updInv = await tx.invoice.findUniqueOrThrow({
        where: { id },
        include: {
          seller: { select: { legalName: true, gstin: true } },
          anchor: { select: { corporateName: true, creditRating: true } },
        },
      });

      const updAnc = await tx.anchor.findUniqueOrThrow({
        where: { id: invoice.anchorId },
      });

      return { updatedInvoice: updInv, updatedAnchor: updAnc };
    });

    return NextResponse.json({
      success: true,
      message: `Notice of Assignment (NOA) accepted by ${invoice.anchor.corporateName}. Invoice is now LISTED on the investor marketplace!`,
      data: updatedInvoice,
      anchorExposureUpdated: {
        corporateName: updatedAnchor.corporateName,
        newActiveExposure: updatedAnchor.currentExposure,
        maxExposureCap: updatedAnchor.maxExposureLimit,
        exposureUtilizationPct: `${((updatedAnchor.currentExposure / updatedAnchor.maxExposureLimit) * 100).toFixed(1)}%`,
      },
      marketplaceStatus: {
        isListed: true,
        availableToInvestors: true,
        yieldRatePa: `${updatedInvoice.discountRatePa}% p.a.`,
        dueInDays: updatedInvoice.tenureDays,
      },
    });
  } catch (error: any) {
    const errorMsg = error.message || "Anchor confirmation failed.";
    const status = errorMsg.includes("ANCHOR_EXPOSURE_EXCEEDED") ? 400 : 500;
    return NextResponse.json({ success: false, error: errorMsg }, { status });
  }
}
