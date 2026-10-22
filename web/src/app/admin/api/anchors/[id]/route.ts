import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

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
    const { maxExposureLimit, creditRating, status } = body;

    const currentAnchor = await prisma.anchor.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!currentAnchor) {
      return NextResponse.json({ success: false, error: "Anchor not found." }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (typeof maxExposureLimit === "number") dataToUpdate.maxExposureLimit = maxExposureLimit;
    if (creditRating) dataToUpdate.creditRating = creditRating;
    if (status) dataToUpdate.status = status;

    let generatedInviteUrl: string | null = null;
    let inviteToken: string | null = null;

    // If approving a PENDING anchor, generate an invite token so they can activate their Treasury portal
    if (status === "ACTIVE" && (currentAnchor.status === "PENDING" || !currentAnchor.user)) {
      inviteToken = crypto.randomBytes(32).toString("hex");
      const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const targetEmail = currentAnchor.contactEmail || `treasury@${currentAnchor.corporateName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;

      await prisma.user.upsert({
        where: { email: targetEmail },
        update: {
          anchorId: id,
          inviteToken,
          inviteExpiry,
          isActive: false,
        },
        create: {
          email: targetEmail,
          role: "ANCHOR",
          anchorId: id,
          inviteToken,
          inviteExpiry,
          isActive: false,
        },
      });

      const origin = request.headers.get("origin") || "http://localhost:3000";
      generatedInviteUrl = `${origin}/login?invite=${inviteToken}`;
    }

    const updatedAnchor = await prisma.anchor.update({
      where: { id },
      data: dataToUpdate,
      include: {
        user: { select: { email: true, isActive: true, inviteToken: true } },
      },
    });

    // Write to audit log
    await prisma.auditLog.create({
      data: {
        entityType: "ANCHOR",
        entityId: id,
        action: status === "ACTIVE" ? "ADMIN_APPROVE_ANCHOR" : "ADMIN_UPDATE_EXPOSURE",
        actorRole: "ADMIN",
        actorId: session.email,
        metadata: JSON.stringify({
          updatedBy: session.email,
          previousStatus: currentAnchor.status,
          newStatus: updatedAnchor.status,
          sanctionedLimit: updatedAnchor.maxExposureLimit,
          creditRating: updatedAnchor.creditRating,
          inviteGenerated: !!inviteToken,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      anchor: updatedAnchor,
      inviteToken,
      inviteUrl: generatedInviteUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
