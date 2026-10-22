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
    const { creditLimit, creditLimitStatus, kycStatus } = body;

    const dataToUpdate: any = {};
    if (typeof creditLimit === "number") dataToUpdate.creditLimit = creditLimit;
    if (creditLimitStatus) dataToUpdate.creditLimitStatus = creditLimitStatus;
    if (kycStatus) dataToUpdate.kycStatus = kycStatus;

    const updatedSeller = await prisma.seller.update({
      where: { id },
      data: dataToUpdate,
    });

    // Write to audit log
    await prisma.auditLog.create({
      data: {
        entityType: "SELLER",
        entityId: id,
        action: "ADMIN_UPDATE_FACILITY",
        actorRole: "ADMIN",
        actorId: session.email,
        metadata: JSON.stringify({
          updatedBy: session.email,
          changes: dataToUpdate,
        }),
      },
    });

    return NextResponse.json({ success: true, seller: updatedSeller });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
