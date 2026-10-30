import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/v1/auth/invite?token=...
// Validates an Anchor or Investor invite token and returns details for account activation UI.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Invite token is required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { inviteToken: token.trim() },
      include: {
        anchor: {
          select: {
            id: true,
            corporateName: true,
            gstin: true,
            maxExposureLimit: true,
            status: true,
          },
        },
        investor: {
          select: {
            id: true,
            entityName: true,
            investorType: true,
          },
        },
      },
    });

    if (!user || !user.inviteExpiry || user.inviteExpiry < new Date()) {
      return NextResponse.json(
        { success: false, error: "This invite link is invalid or has expired." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      role: user.role,
      email: user.email,
      anchor: user.anchor,
      investor: user.investor,
      expiresAt: user.inviteExpiry,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to inspect invite." },
      { status: 500 }
    );
  }
}
