import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/v1/entities/anchors/:id/pending - Invoices pending Anchor confirmation
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
