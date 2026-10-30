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

    // ATOMIC FINTECH TRANSACTION: Re-check anchor limit inside transaction lock to prevent race conditions
    const { updatedInvoice, updatedAnchor } = await prisma.$transaction(async (tx) => {
      // Re-fetch Anchor within transaction lock to get real-time exposure
      const freshAnchor = await tx.anchor.findUnique({
        where: { id: invoice.anchorId },
      });

      if (!freshAnchor) {
        throw new Error("Corporate Anchor record not found.");
      }

      if (freshAnchor.status !== "ACTIVE" || freshAnchor.maxExposureLimit <= 0) {
        throw new Error(`Corporate Anchor '${freshAnchor.corporateName}' facility is not active or approved.`);
      }

      const totalProjected = freshAnchor.currentExposure + invoice.totalAmount;
      if (totalProjected > freshAnchor.maxExposureLimit) {
        const excess = totalProjected - freshAnchor.maxExposureLimit;
        throw new Error(
          `ANCHOR_EXPOSURE_EXCEEDED: Cannot confirm invoice. Total exposure (₹${totalProjected.toLocaleString()}) would exceed anchor's approved limit of ₹${freshAnchor.maxExposureLimit.toLocaleString()} by ₹${excess.toLocaleString()}.`
        );
      }

      // 1. Update invoice to LISTED status
      const updInv = await tx.invoice.update({
        where: { id },
        data: {
          status: "LISTED",
          anchorConfirmedAt: now,
        },
        include: {
          seller: { select: { legalName: true, gstin: true } },
          anchor: { select: { corporateName: true, creditRating: true } },
        },
      });

      // 2. Increment Anchor's active exposure atomically
      const updAnc = await tx.anchor.update({
        where: { id: invoice.anchorId },
        data: {
          currentExposure: {
            increment: invoice.totalAmount,
          },
        },
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
