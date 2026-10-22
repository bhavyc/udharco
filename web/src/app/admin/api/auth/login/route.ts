import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { TOTP } from "otplib";
import { createAdminSession } from "@/lib/session";

// POST /admin/api/auth/login
// Admin-only login with email + password + TOTP 2FA.
// Completely separate from the Seller/Anchor/Investor user flow.
// This route is intentionally under /admin/* and not linked anywhere in the
// public-facing app.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, totpCode } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const admin = await prisma.adminUser.findUnique({ where: { email } });

    if (!admin || !admin.isActive) {
      // Constant-time-safe: still check password even if admin not found
      await bcrypt.compare("dummy", "$2b$12$dummyhashfortimingattackprevention");
      return NextResponse.json(
        { success: false, error: "Invalid credentials." },
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials." },
        { status: 401 }
      );
    }

    // 2FA check — required if the admin has TOTP enabled
    if (admin.twoFactorEnabled) {
      if (!totpCode) {
        return NextResponse.json(
          {
            success: false,
            requiresTwoFactor: true,
            error: "Two-factor authentication code required.",
          },
          { status: 200 } // 200 so the client knows to show the 2FA prompt
        );
      }

      if (!admin.twoFactorSecret) {
        return NextResponse.json(
          {
            success: false,
            error: "2FA is enabled but not configured. Contact support.",
          },
          { status: 500 }
        );
      }

      const totp = new TOTP({ secret: admin.twoFactorSecret });
      const result = await totp.verify(totpCode);

      if (!result.valid) {
        return NextResponse.json(
          { success: false, error: "Invalid 2FA code." },
          { status: 401 }
        );
      }
    }

    // Update last login timestamp
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    await createAdminSession({
      adminId: admin.id,
      email: admin.email,
      role: "ADMIN",
    });

    return NextResponse.json({
      success: true,
      message: "Admin login successful.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
