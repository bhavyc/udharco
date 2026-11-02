import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/v1/entities/anchors/:id/pending - Invoices pending Anchor confirmation (BOLA Protected)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    // Strict Object-Level Authorization: Only this Corporate Anchor or an Admin can inspect pending invoices
    if (auth.role === "ANCHOR" && auth.entityId !== id) {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN: You do not have authorization to view pending receivables for another corporate entity." },
        { status: 403 }
      );
    }

    if (auth.role === "SELLER") {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN: MSME Sellers cannot inspect anchor pending queues directly." },
        { status: 403 }
      );
    }

    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        anchorId: id,
        status: "VERIFIED",
      },
      include: {
        seller: { select: { legalName: true, gstin: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      anchorId: id,
      pendingCount: pendingInvoices.length,
      data: pendingInvoices,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
