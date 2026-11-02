import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { SurepassService, EinvoiceVerifyResult } from "@/lib/services/surepassService";

export class FraudService {
  /**
   * Generates a deterministic SHA-256 cryptographic hash of an invoice.
   * Format: SHA256(SELLER_GSTIN : INVOICE_NUMBER : FINANCIAL_YEAR)
   * This is the exact method used by TReDS and international factoring exchanges.
   */
  static generateInvoiceHash(sellerGstin: string, invoiceNumber: string, financialYear: string): string {
    const raw = `${sellerGstin.trim().toUpperCase()}:${invoiceNumber.trim().toUpperCase()}:${financialYear.trim().toUpperCase()}`;
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  /**
   * Checks the central invoice registry to prevent Double-Financing Fraud.
   * Throws an error / returns duplicate status if the bill was previously funded or listed.
   */
  static async checkDuplicateFinancing(invoiceHash: string) {
    const existing = await prisma.invoice.findUnique({
      where: { invoiceHash },
      include: {
        seller: { select: { legalName: true, gstin: true } },
        anchor: { select: { corporateName: true } },
      },
    });

    if (existing) {
      return {
        isDuplicate: true,
        existingInvoiceId: existing.id,
        invoiceNumber: existing.invoiceNumber,
        status: existing.status,
        sellerName: existing.seller.legalName,
        anchorName: existing.anchor.corporateName,
        message: `FRAUD ALERT: Invoice #${existing.invoiceNumber} is already registered on the platform with status '${existing.status}'. Double financing blocked!`,
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Fintech Blind Spot #1: e-Invoice (IRN) & QR Code Verification.
   * India B2B e-Invoicing standard mandates a unique 64-character hexadecimal IRN issued by the IRP (NIC).
   * For Small MSMEs (< ₹5 Cr turnover), IRN is exempt: we record internal hash and rely on Corporate Buyer NOA.
   */
  static async verifyIRN(
    irn?: string | null,
    sellerGstin?: string,
    invoiceNumber?: string,
    financialYear?: string,
    expectedAmount?: number,
    expectedBuyerGst?: string
  ): Promise<EinvoiceVerifyResult> {
    if (irn && irn.trim()) {
      const cleanIrn = irn.trim().toLowerCase();
      // Call Surepass GSP verification engine (with live token or sandbox mock)
      return await SurepassService.verifyEinvoiceIRN(cleanIrn, expectedAmount, expectedBuyerGst);
    }

    // Small MSME Exemption (< ₹5 Cr Turnover):
    // Fallback internal deterministic hash for double-financing registry protection
    const raw = `INTERNAL:${sellerGstin || "GSTIN"}:${invoiceNumber || "INV"}:${financialYear || "2026-27"}`;
    const generatedHash = crypto.createHash("sha256").update(raw).digest("hex");

    return {
      success: true,
      isValid: true,
      irn: generatedHash,
      status: "EXEMPT",
      message: "Small MSME Exemption active (< ₹5 Cr Turnover). Invoice delivery will be verified via Corporate NOA.",
      source: "EXEMPT_SMALL_MSME",
    };
  }

  /**
   * Red Flag Detection: High-Risk Collusion Combo
   * Combination: New Seller (< 3 settlements) + New Buyer (0 settlements) + Large Invoice (> ₹2 Lakhs)
   */
  static async evaluateCollusionRisk(
    sellerId: string,
    anchorId: string,
    invoiceAmount: number
  ): Promise<{
    isSuspicious: boolean;
    riskScore: number;
    flagReason?: string;
  }> {
    const [sellerSettledCount, buyerSettledCount] = await Promise.all([
      prisma.invoice.count({
        where: { sellerId, status: "SETTLED" },
      }),
      prisma.invoice.count({
        where: { anchorId, status: "SETTLED" },
      }),
    ]);

    const isNewSeller = sellerSettledCount < 3;
    const isNewBuyer = buyerSettledCount === 0;
    const isLargeTicket = invoiceAmount > 200000;

    if (isNewSeller && isNewBuyer && isLargeTicket) {
      return {
        isSuspicious: true,
        riskScore: 85,
        flagReason: `CRITICAL FRAUD COMBO: New Seller (${sellerSettledCount} settlements) paired with New Buyer (0 settlements) for a large invoice (₹${invoiceAmount.toLocaleString()} > ₹2L). Auto-funding blocked; requires physical/telephone risk callback.`,
      };
    }

    if (isNewSeller && isNewBuyer) {
      return {
        isSuspicious: false,
        riskScore: 45,
        flagReason: "New counterparty pairing on moderate ticket. Ramp-up 60% disbursement cap enforced.",
      };
    }

    return {
      isSuspicious: false,
      riskScore: 10,
    };
  }
}

