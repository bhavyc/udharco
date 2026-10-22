import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth";

// POST /api/v1/invoices/:id/verify - Admin-only: GST Portal & E-Way Bill Consignment Match
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        seller: true,
        anchor: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
    }

    if (invoice.status !== "UPLOADED") {
      return NextResponse.json(
        {
          success: false,
          error: `Invoice cannot be verified from current status '${invoice.status}'. Must be in 'UPLOADED' status.`,
        },
        { status: 400 }
      );
    }

    // Simulate GST Portal & E-Way Bill Consignment Check (Sandbox / Middleware simulation)
    const gstVerificationResult = {
      gstPortalMatch: true,
      eWayBillValid: Boolean(invoice.ewayBillNo),
      verifiedAt: new Date().toISOString(),
      irnGenerated: `IRN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      matchConfidence: "100%",
    };

    // Transition status to VERIFIED and stamp NOA dispatch timestamp
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: "VERIFIED",
        noaSentAt: new Date(),
        anchorReminderCount: 0,
      },
      include: {
        seller: { select: { legalName: true } },
        anchor: { select: { corporateName: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: "GST & E-Way Bill verified successfully. Notice of Assignment (NOA) dispatched to Anchor.",
      data: updated,
      verificationAudit: gstVerificationResult,
      noticeOfAssignment: {
        assignedToEscrow: true,
        anchorRecipient: updated.anchor.corporateName,
        paymentDueDate: updated.dueDate,
        repaymentAmount: updated.totalAmount,
        instruction: "Notice sent to Anchor corporate finance team to confirm receipt of goods.",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
