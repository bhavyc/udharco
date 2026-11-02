import { NextResponse } from "next/server";
import { FraudService } from "@/lib/services/fraudService";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { irn, invoiceAmount, buyerGstin } = body;

    if (!irn || typeof irn !== "string" || !irn.trim()) {
      return NextResponse.json(
        {
          success: true,
          isExempt: true,
          message: "No IRN provided. Eligible for Small MSME Exemption (< ₹5 Cr Turnover).",
        },
        { status: 200 }
      );
    }

    const verification = await FraudService.verifyIRN(
      irn.trim(),
      undefined,
      undefined,
      undefined,
      invoiceAmount ? Number(invoiceAmount) : undefined,
      buyerGstin
    );

    if (!verification.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: verification.error || "INVALID_IRN",
          message: verification.message,
          verification,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: verification.message,
      verification,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "IRN verification failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

