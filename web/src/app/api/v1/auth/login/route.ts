import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/session";
import type { SessionRole } from "@/lib/session";

// POST /api/v1/auth/login
// Invite-based login for Anchor and Investor accounts.
//
// Two flows:
//  1. First-time invite: { inviteToken, newPassword }
//     → validates token, sets password, activates account, creates session.
//  2. Regular login: { email, password }
//     → validates credentials, creates session.
//
// Admin login is a completely separate endpoint at /admin/api/auth/login.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { inviteToken, email, password, newPassword } = body;

    // ── Flow 1: First-time invite token activation ─────────────────────────
    if (inviteToken) {
      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json(
          {
            success: false,
            error: "Password must be at least 8 characters.",
          },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { inviteToken },
        include: { anchor: true, investor: true },
      });

      if (!user || !user.inviteExpiry || user.inviteExpiry < new Date()) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired invite link." },
          { status: 401 }
        );
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          inviteToken: null,
          inviteExpiry: null,
          isActive: true,
        },
      });

      const entityId = user.anchor?.id ?? user.investor?.id ?? "";

      await createSession({
        userId: user.id,
        role: user.role as SessionRole,
        entityId,
        email: user.email ?? undefined,
      });

      return NextResponse.json({
        success: true,
        message: "Account activated. Welcome to UdharCo.",
        role: user.role,
        entityId,
      });
    }

    // ── Flow 2: Regular email + password login ─────────────────────────────
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { anchor: true, investor: true },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials." },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Account is not active. Please use your invite link to set a password first.",
        },
        { status: 403 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials." },
        { status: 401 }
      );
    }

    const entityId = user.anchor?.id ?? user.investor?.id ?? "";

    await createSession({
      userId: user.id,
      role: user.role as SessionRole,
      entityId,
      email: user.email ?? undefined,
    });

    return NextResponse.json({
      success: true,
      role: user.role,
      entityId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
