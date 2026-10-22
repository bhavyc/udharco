import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomInt } from "crypto";

// POST /api/v1/auth/seller/request-otp
// Public endpoint: generates a 6-digit OTP for Seller mobile auth.
// In production this calls an SMS gateway (Kaleyra / MSG91 / Exotel).
// During development the OTP is returned in the response body for testing.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mobile } = body;

    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      return NextResponse.json(
        { success: false, error: "Invalid Indian mobile number." },
        { status: 400 }
      );
    }

    // Invalidate any existing unused OTPs for this mobile
    await prisma.otpCode.updateMany({
      where: { mobile, used: false },
      data: { used: true },
    });

    const isDev = process.env.NODE_ENV === "development";
    const code = isDev ? "123456" : String(randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.otpCode.create({
      data: { mobile, code, purpose: "LOGIN", expiresAt },
    });

    // ── Production: send SMS here ─────────────────────────────────────────
    // await smsGateway.send({ to: mobile, message: `Your UdharCo OTP is ${code}. Valid for 10 minutes.` });
    // ─────────────────────────────────────────────────────────────────────

    return NextResponse.json({
      success: true,
      message: `OTP sent to ${mobile}.`,
      // Only expose OTP in non-production environments to prevent leakage
      ...(isDev && { otp: code }),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
