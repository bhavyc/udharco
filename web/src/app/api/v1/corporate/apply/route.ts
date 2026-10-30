import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateCorporateEmail } from "@/lib/utils/domainValidation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      gstin,
      corporateName,
      contactPerson,
      contactEmail,
      contactPhone,
      creditRating,
      requestedExposureLimit,
      annualProcurement,
      standardPaymentTerms,
    } = body;

    if (!gstin || typeof gstin !== "string" || gstin.trim().length !== 15) {
      return NextResponse.json(
        { success: false, error: "A valid 15-character GSTIN is required." },
        { status: 400 }
      );
    }

    if (!corporateName || typeof corporateName !== "string") {
      return NextResponse.json(
        { success: false, error: "Corporate Entity Name is required." },
        { status: 400 }
      );
    }

    if (!contactEmail || typeof contactEmail !== "string") {
      return NextResponse.json(
        { success: false, error: "Corporate Treasury Email is required." },
        { status: 400 }
      );
    }

    // Strict Anti-Fraud Gate: Block public free email providers (Gmail, Yahoo, etc.)
    const emailValidation = validateCorporateEmail(contactEmail);
    if (!emailValidation.isValid) {
      return NextResponse.json(
        { success: false, error: emailValidation.error },
        { status: 400 }
      );
    }

    const cleanGst = gstin.toUpperCase().trim();
    const existingAnchor = await prisma.anchor.findUnique({
      where: { gstin: cleanGst },
    });

    if (existingAnchor) {
      if (existingAnchor.status === "ACTIVE") {
        return NextResponse.json(
          {
            success: false,
            error: `Corporate Anchor "${existingAnchor.corporateName}" is already registered and active. Please proceed to login.`,
          },
          { status: 409 }
        );
      }
      if (existingAnchor.status === "PENDING") {
        return NextResponse.json({
          success: true,
          message: "Application is already submitted and currently under risk committee review.",
          applicationId: existingAnchor.id,
          status: "PENDING",
          corporateName: existingAnchor.corporateName,
        });
      }
    }

    // Create the Anchor in PENDING state (maker-checker pattern)
    const newAnchor = await prisma.anchor.create({
      data: {
        gstin: cleanGst,
        corporateName: corporateName.trim(),
        creditRating: creditRating || "UNRATED",
        maxExposureLimit: 0, // Remains ₹0 until formal admin sanction
        status: "PENDING",
        sourceChannel: "VENDOR_PUSH",
        contactPerson: contactPerson?.trim() || null,
        contactEmail: contactEmail.toLowerCase().trim(),
        contactPhone: contactPhone?.trim() || null,
        annualProcurement: typeof annualProcurement === "number" ? annualProcurement : null,
        standardPaymentTerms: typeof standardPaymentTerms === "number" ? Number(standardPaymentTerms) : 30,
      },
    });

    // Write to immutable audit trail
    await prisma.auditLog.create({
      data: {
        entityType: "ANCHOR",
        entityId: newAnchor.id,
        action: "APPLICATION_SUBMITTED",
        actorRole: "SYSTEM",
        actorId: contactEmail.toLowerCase().trim(),
        metadata: JSON.stringify({
          corporateName: newAnchor.corporateName,
          gstin: cleanGst,
          requestedExposureLimit: requestedExposureLimit || 0,
          annualProcurement: annualProcurement || null,
          standardPaymentTerms: standardPaymentTerms || 30,
          creditRating: creditRating || "UNRATED",
          contactPerson: contactPerson || "",
          contactEmail: contactEmail || "",
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Corporate Factoring Application submitted successfully.",
      applicationId: newAnchor.id,
      status: "PENDING",
      corporateName: newAnchor.corporateName,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error during application.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
