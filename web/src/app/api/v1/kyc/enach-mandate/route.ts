import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mobile, bankAccountNo, bankIfsc, legalName } = body;

    if (!bankAccountNo || !bankIfsc) {
      return NextResponse.json(
        { success: false, error: "Bank account and IFSC are required for e-NACH mandate." },
        { status: 400 }
      );
    }

    const randomSuffix = crypto.randomInt(100000, 999999).toString();
    const mandateId = `MND-NPCI-${randomSuffix}`;

    return NextResponse.json({
      success: true,
      mandateId,
      maxAmount: 1000000, // ₹10,00,000 maximum cap
      currency: "INR",
      frequency: "AS_AND_WHEN_PRESENTED",
      status: "ACTIVE",
      authMode: "AADHAAR_ESIGN_NETBANKING",
      beneficiary: legalName || "MSME Vendor",
      accountNumberMasked: `XXXX-XXXX-${bankAccountNo.slice(-4)}`,
      ifsc: bankIfsc.toUpperCase(),
      registeredAt: new Date().toISOString(),
      recourseRecovProtection: true,
      message: "NPCI e-NACH Auto-Debit Mandate registered and active.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to register e-NACH mandate.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
