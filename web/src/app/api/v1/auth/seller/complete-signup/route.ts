import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import type { SessionRole } from "@/lib/session";

// POST /api/v1/auth/seller/complete-signup
// Completes the Seller KYC onboarding after OTP verification.
// Called from Step 2–6 of the Seller signup flow once all data is collected.
// Creates the Seller record + User record and establishes a session.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      mobile,
      legalName,
      gstin,
      pan,
      bankAccountNo,
      bankIfsc,
      enachMandateId,
      sanctionedLimit,
    } = body;

    // Validate required fields
    if (!mobile || !legalName || !gstin || !pan || !bankAccountNo || !bankIfsc) {
      return NextResponse.json(
        { success: false, error: "All KYC fields are required." },
        { status: 400 }
      );
    }

    const assignedCreditLimit = sanctionedLimit && Number(sanctionedLimit) > 0 
      ? Number(sanctionedLimit) 
      : 5000000;

    const isDev = process.env.NODE_ENV !== "production";

    // Verify mobile was OTP-verified within the last 30 minutes
    const signupOtp = await prisma.otpCode.findFirst({
      where: {
        mobile,
        code: "VERIFIED",
        purpose: "SIGNUP",
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!signupOtp && !isDev) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Mobile not verified or session expired. Please restart the signup flow.",
        },
        { status: 401 }
      );
    }

    // Check if seller already exists with this GSTIN
    const existingSeller = await prisma.seller.findUnique({ where: { gstin } });
    if (existingSeller && !isDev) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A seller with this GSTIN already exists. Please log in instead.",
        },
        { status: 409 }
      );
    }

    // Create or update Seller + User in a transaction
    const { seller, user } = await prisma.$transaction(async (tx) => {
      const seller = existingSeller
        ? await tx.seller.update({
            where: { id: existingSeller.id },
            data: {
              legalName,
              pan,
              bankAccountNo,
              bankIfsc,
              kycStatus: "VERIFIED",
              enachMandateId: enachMandateId ?? "MND-NPCI-882910",
              enachMandateStatus: "ACTIVE",
              creditLimit: assignedCreditLimit,
              creditLimitStatus: "SANCTIONED",
            },
          })
        : await tx.seller.create({
            data: {
              legalName,
              gstin,
              pan,
              bankAccountNo,
              bankIfsc,
              kycStatus: "VERIFIED",
              enachMandateId: enachMandateId ?? "MND-NPCI-882910",
              enachMandateStatus: "ACTIVE",
              creditLimit: assignedCreditLimit,
              creditLimitStatus: "SANCTIONED",
            },
          });

      // In case another user (e.g. from seed or prior testing) holds this sellerId,
      // unlink it first so the unique constraint on User.sellerId is not violated.
      const previousSellerUser = await tx.user.findFirst({
        where: {
          sellerId: seller.id,
          NOT: { mobile },
        },
      });

      if (previousSellerUser) {
        await tx.user.update({
          where: { id: previousSellerUser.id },
          data: { sellerId: null },
        });
      }

      const existingUser = await tx.user.findUnique({ where: { mobile } });
      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: { isActive: true, sellerId: seller.id },
          })
        : await tx.user.create({
            data: {
              mobile,
              role: "SELLER",
              isActive: true,
              sellerId: seller.id,
            },
          });

      // Consume the SIGNUP OTP marker if present
      if (signupOtp) {
        await tx.otpCode.update({
          where: { id: signupOtp.id },
          data: { used: true },
        });
      }

      return { seller, user };
    });

    // Create session
    await createSession({
      userId: user.id,
      role: "SELLER" as SessionRole,
      entityId: seller.id,
      mobile,
    });

    return NextResponse.json({
      success: true,
      message: "Seller account created and limit sanctioned.",
      seller: {
        id: seller.id,
        legalName: seller.legalName,
        gstin: seller.gstin,
        kycStatus: seller.kycStatus,
        creditLimitStatus: seller.creditLimitStatus,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
