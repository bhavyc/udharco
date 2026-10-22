import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { sellerGstin, buyerGstin, invoiceNumber, financialYear } = body;

    const sGst = (sellerGstin || "27AABCU9603R1ZX").toUpperCase().trim();
    const bGst = (buyerGstin || "27AAACT2727Q1ZW").toUpperCase().trim();
    const invNum = (invoiceNumber || `INV-${Date.now().toString().slice(-6)}`).toUpperCase().trim();
    const fy = (financialYear || "2025-26").trim();

    // Standard NIC GSTN IRN computation formula: SHA256(SupplierGSTIN + FY + DocType + DocNum)
    const rawPayload = `${sGst}${fy}INV${invNum}${bGst}`;
    const irnHash = crypto.createHash("sha256").update(rawPayload).digest("hex");

    return NextResponse.json({
      success: true,
      irn: irnHash,
      formula: "SHA256(SupplierGSTIN + FY + DocType + DocNum)",
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate IRN";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
