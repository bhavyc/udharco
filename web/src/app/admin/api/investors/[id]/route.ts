import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized admin access." }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { escrowBalance, addAmount } = body;

    let updatedInvestor;
    if (typeof addAmount === "number" && addAmount > 0) {
      updatedInvestor = await prisma.investor.update({
        where: { id },
        data: { escrowBalance: { increment: addAmount } },
      });
    } else if (typeof escrowBalance === "number") {
      updatedInvestor = await prisma.investor.update({
        where: { id },
        data: { escrowBalance },
      });
    } else {
      return NextResponse.json({ success: false, error: "escrowBalance or addAmount is required." }, { status: 400 });
    }

    // Write to audit log
    await prisma.auditLog.create({
      data: {
        entityType: "INVESTOR",
        entityId: id,
        action: "ADMIN_TOPUP_ESCROW",
        actorRole: "ADMIN",
        actorId: session.email,
        metadata: JSON.stringify({
          updatedBy: session.email,
          previousBalance: updatedInvestor.escrowBalance - (addAmount || 0),
          newBalance: updatedInvestor.escrowBalance,
        }),
      },
    });

    return NextResponse.json({ success: true, investor: updatedInvestor });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
