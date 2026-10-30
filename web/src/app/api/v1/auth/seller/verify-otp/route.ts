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
// In-memory rate limiting and attempt tracker for OTP brute-force defense
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

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

    // ── BRUTE-FORCE RATE-LIMITING SHIELD ──
    const attemptRecord = failedAttempts.get(mobile);
    const now = Date.now();
    if (attemptRecord && attemptRecord.lockedUntil > now) {
      const waitSeconds = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: `TOO_MANY_FAILED_ATTEMPTS: Mobile number is temporarily locked due to 5 consecutive invalid guesses. Please retry after ${waitSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    const isDev = process.env.NODE_ENV !== "production";
    const isSandboxCode = isDev && (code === "123456" || code === "000000" || code === "682910");

    // Find the most recent unused OTP for this mobile
    const activeOtp = await prisma.otpCode.findFirst({
      where: {
        mobile,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    const isMatch = (activeOtp && activeOtp.code === code) || isSandboxCode;

    if (!isMatch) {
      const currentFailures = (attemptRecord?.count || 0) + 1;
      if (currentFailures >= 5) {
        // Burn the OTP in DB immediately so it cannot be guessed further
        await prisma.otpCode.updateMany({
          where: { mobile, used: false },
          data: { used: true },
        });
        failedAttempts.set(mobile, { count: 0, lockedUntil: now + 10 * 60 * 1000 }); // 10 min lock
        return NextResponse.json(
          {
            success: false,
            error: "Maximum OTP attempts exceeded (5/5). Your OTP has been invalidated for security. Please request a new OTP after 10 minutes.",
          },
          { status: 429 }
        );
      } else {
        failedAttempts.set(mobile, { count: currentFailures, lockedUntil: 0 });
        const remaining = 5 - currentFailures;
        return NextResponse.json(
          {
            success: false,
            error: `Invalid OTP code. ${remaining} attempt(s) remaining before account lockout.`,
          },
          { status: 401 }
        );
      }
    }

    // Valid code verified: clear failure tracking
    failedAttempts.delete(mobile);

    // Mark OTP as used if found in DB
    if (activeOtp) {
      await prisma.otpCode.update({
        where: { id: activeOtp.id },
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
