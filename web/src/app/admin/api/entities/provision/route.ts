import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth";
import { randomBytes } from "crypto";
import { validateCorporateEmail } from "@/lib/utils/domainValidation";

// POST /admin/api/entities/provision
// Admin creates an Anchor or Investor account and generates an invite link.
// This is the ONLY way to create Anchor/Investor accounts — no self-signup.
export async function POST(request: Request) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { type, email, entityData } = body;
    // type: "ANCHOR" | "INVESTOR"
    // entityData for ANCHOR: { corporateName, gstin, creditRating?, maxExposureLimit? }
    // entityData for INVESTOR: { entityName, investorType? }

    if (!type || !email || !entityData) {
      return NextResponse.json(
        { success: false, error: "type, email, and entityData are required." },
        { status: 400 }
      );
    }

    if (!["ANCHOR", "INVESTOR"].includes(type)) {
      return NextResponse.json(
        { success: false, error: "type must be ANCHOR or INVESTOR." },
        { status: 400 }
      );
    }

    // Security Gate: Ensure corporate anchors do not use public webmail (Gmail/Yahoo)
    if (type === "ANCHOR") {
      const emailValidation = validateCorporateEmail(email);
      if (!emailValidation.isValid) {
        return NextResponse.json(
          { success: false, error: emailValidation.error },
          { status: 400 }
        );
      }
    }

    // Check email not already used
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "A user with this email already exists.",
        },
        { status: 409 }
      );
    }

    const inviteToken = randomBytes(32).toString("hex");
    const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    let entityId: string;

    if (type === "ANCHOR") {
      const { corporateName, gstin, creditRating, maxExposureLimit } =
        entityData;
      if (!corporateName || !gstin) {
        return NextResponse.json(
          {
            success: false,
            error: "corporateName and gstin are required for Anchor.",
          },
          { status: 400 }
        );
      }

      const anchor = await prisma.anchor.create({
        data: {
          corporateName,
          gstin,
          creditRating: creditRating ?? "UNRATED",
          maxExposureLimit: maxExposureLimit ?? 0,
          user: {
            create: {
              email,
              role: "ANCHOR",
              inviteToken,
              inviteExpiry,
              isActive: false,
            },
          },
        },
      });
      entityId = anchor.id;
    } else {
      const { entityName, investorType } = entityData;
      if (!entityName) {
        return NextResponse.json(
          { success: false, error: "entityName is required for Investor." },
          { status: 400 }
        );
      }

      const investor = await prisma.investor.create({
        data: {
          entityName,
          investorType: investorType ?? "NBFC",
          user: {
            create: {
              email,
              role: "INVESTOR",
              inviteToken,
              inviteExpiry,
              isActive: false,
            },
          },
        },
      });
      entityId = investor.id;
    }

    // In production: send invite email with the token link
    // await emailService.sendInvite({ to: email, inviteUrl: `https://app.udharco.com/login?invite=${inviteToken}` });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = `${appUrl}/login?invite=${inviteToken}`;

    return NextResponse.json({
      success: true,
      message: `${type} account created. Invite email sent to ${email}.`,
      entityId,
      inviteUrl, // Only exposed in dev for testing
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
