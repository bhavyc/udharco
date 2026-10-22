import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import type { SessionRole } from "@/lib/session";

// POST /api/v1/auth/seller/verify-otp
// Public endpoint: verifies mobile OTP.
// - If a Seller User already exists for this mobile → login and return session.
// - If no User exists → this is a new signup; return { needsOnboarding: true }
//   and let the front-end continue the 6-step KYC flow.
//   The session is NOT created until KYC is complete (seller/complete-signup).
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mobile, code } = body;

    if (!mobile || !code) {
      return NextResponse.json(
        { success: false, error: "Mobile and OTP code are required." },
        { status: 400 }
      );
    }

    const isDev = process.env.NODE_ENV !== "production";
    const isSandboxCode = isDev && (code === "123456" || code === "000000" || code === "682910");

    // Find the most recent unused OTP for this mobile
    const otp = await prisma.otpCode.findFirst({
      where: {
        mobile,
        code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp && !isSandboxCode) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired OTP." },
        { status: 401 }
      );
    }

    // Mark OTP as used if found in DB
    if (otp) {
      await prisma.otpCode.update({
        where: { id: otp.id },
        data: { used: true },
      });
    }

    // Check if a User with this mobile already exists
    const user = await prisma.user.findUnique({
      where: { mobile },
      include: { seller: true },
    });

    if (user && user.isActive && user.seller) {
      // Existing seller — create session and log in
      await createSession({
        userId: user.id,
        role: user.role as SessionRole,
        entityId: user.seller.id,
        mobile: user.mobile ?? undefined,
      });

      return NextResponse.json({
        success: true,
        needsOnboarding: false,
        seller: {
          id: user.seller.id,
          legalName: user.seller.legalName,
          kycStatus: user.seller.kycStatus,
          creditLimitStatus: user.seller.creditLimitStatus,
        },
      });
    }

    // New mobile — signal that onboarding is required
    // We store a temporary marker in the OTP table so the complete-signup
    // endpoint can verify the mobile was actually OTP-verified.
    await prisma.otpCode.create({
      data: {
        mobile,
        code: "VERIFIED",
        purpose: "SIGNUP",
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30-minute onboarding window
      },
    });

    return NextResponse.json({
      success: true,
      needsOnboarding: true,
      mobile,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
