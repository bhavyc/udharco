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

    if (invoice.anchor.currentExposure + invoice.totalAmount > invoice.anchor.maxExposureLimit) {
      return NextResponse.json(
        {
          success: false,
          error: "ANCHOR_EXPOSURE_EXCEEDED",
          message: `Cannot confirm invoice. Total exposure (₹${(invoice.anchor.currentExposure + invoice.totalAmount).toLocaleString()}) would exceed anchor's approved limit of ₹${invoice.anchor.maxExposureLimit.toLocaleString()}.`,
        },
        { status: 400 }
      );
    }

    const now = new Date();

    // 1. Update Anchor's active exposure debt & 2. Transition invoice to LISTED (open for funding)
    const [updatedInvoice, updatedAnchor] = await prisma.$transaction([
      prisma.invoice.update({
        where: { id },
        data: {
          status: "LISTED", // Open for investor bidding
          anchorConfirmedAt: now,
        },
        include: {
          seller: { select: { legalName: true, gstin: true } },
          anchor: { select: { corporateName: true, creditRating: true } },
        },
      }),
      prisma.anchor.update({
        where: { id: invoice.anchorId },
        data: {
          currentExposure: {
            increment: invoice.totalAmount,
          },
        },
      }),
    ]);

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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
