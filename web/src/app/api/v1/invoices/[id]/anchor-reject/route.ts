import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// POST /api/v1/invoices/:id/anchor-reject
// Anchor corporate rejects goods/bill due to dispute or mismatch
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("ANCHOR");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { disputeReason = "Quantity mismatch or damaged goods delivered." } = body;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { anchor: true },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
    }

    if (invoice.anchorId !== auth.entityId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You can only reject invoices addressed to your corporate entity." },
        { status: 403 }
      );
    }

    if (invoice.status !== "VERIFIED") {
      return NextResponse.json(
        {
          success: false,
          error: `Invoice cannot be rejected from current status '${invoice.status}'. Must be in 'VERIFIED' status.`,
        },
        { status: 400 }
      );
    }

    const [updated] = await prisma.$transaction([
      prisma.invoice.update({
        where: { id },
        data: {
          status: "DISPUTED",
          disputeReason: disputeReason.trim(),
        },
        include: {
          seller: { select: { legalName: true } },
          anchor: { select: { corporateName: true } },
        },
      }),
      prisma.auditLog.create({
        data: {
          entityType: "INVOICE",
          entityId: invoice.id,
          action: "ANCHOR_DISPUTE",
          actorRole: "ANCHOR",
          actorId: auth.userId,
          previousState: invoice.status,
          newState: "DISPUTED",
          metadata: JSON.stringify({ disputeReason }),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Invoice marked DISPUTED by ${invoice.anchor.corporateName}. Financing halted.`,
      disputeReason,
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
