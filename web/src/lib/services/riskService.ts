import { prisma } from "@/lib/prisma";

export class RiskService {
  /**
   * Dynamic Discount Rate (p.a.) based on Anchor corporate credit rating.
   * Lower risk corporate = lower discount rate for the seller.
   */
  static getDiscountRateByRating(rating: string): number {
    switch (rating.toUpperCase()) {
      case "AAA":
        return 11.0; // 11% p.a. for Tata Motors, Reliance
      case "AA+":
        return 12.0;
      case "AA":
        return 12.5;
      case "A":
        return 14.0;
      case "BBB":
        return 16.0;
      default:
        return 15.0;
    }
  }

  /**
   * Enforces Anchor Exposure Limit (Concentration Risk Cap).
   * E.g. Tata Motors has a max cap of ₹5 Cr. If active debt + new bill > ₹5 Cr, reject.
   */
  static async checkAnchorExposureLimit(anchorId: string, newInvoiceAmount: number) {
    const anchor = await prisma.anchor.findUnique({
      where: { id: anchorId },
    });

    if (!anchor) {
      throw new Error(`Anchor corporate with ID '${anchorId}' not found.`);
    }

    const projectedExposure = anchor.currentExposure + newInvoiceAmount;
    const isExceeded = projectedExposure > anchor.maxExposureLimit;

    return {
      anchor,
      isExceeded,
      currentExposure: anchor.currentExposure,
      maxExposureLimit: anchor.maxExposureLimit,
      projectedExposure,
      availableLimit: Math.max(0, anchor.maxExposureLimit - anchor.currentExposure),
    };
  }

  /**
   * Calculates Upfront Disbursement and Margin Hold amounts (85/15 Rule).
   */
  static calculateDisbursementBreakdown(
    totalAmount: number,
    marginHoldPct = 15.0,
    platformFeePct = 1.0
  ) {
    const marginHeldAmount = Number(((totalAmount * marginHoldPct) / 100).toFixed(2));
    const platformFeeAmount = Number(((totalAmount * platformFeePct) / 100).toFixed(2));
    const upfrontDisbursedAmount = Number((totalAmount - marginHeldAmount - platformFeeAmount).toFixed(2));

    return {
      totalAmount,
      marginHoldPct,
      marginHeldAmount,
      platformFeePct,
      platformFeeAmount,
      upfrontDisbursedAmount,
    };
  }

  /**
   * Section 6 Revenue Model: Interest Spread Engine.
   * E.g. Seller pays 14% p.a., Investor earns 12% p.a. -> Platform realizes 2% net annual interest spread.
   */
  static calculateInterestSpreadBreakdown(
    fundedPrincipal: number,
    sellerDiscountRatePa = 14.0,
    investorYieldRatePa = 12.0,
    tenureDays = 90
  ) {
    const platformSpreadRatePa = Math.max(0, sellerDiscountRatePa - investorYieldRatePa);

    const totalInterestCharged = Number(
      ((fundedPrincipal * (sellerDiscountRatePa / 100) * tenureDays) / 365).toFixed(2)
    );
    const investorYieldAccrued = Number(
      ((fundedPrincipal * (investorYieldRatePa / 100) * tenureDays) / 365).toFixed(2)
    );
    const platformSpreadEarned = Number(
      ((fundedPrincipal * (platformSpreadRatePa / 100) * tenureDays) / 365).toFixed(2)
    );

    return {
      fundedPrincipal,
      tenureDays,
      rates: {
        sellerDiscountRatePa,
        investorYieldRatePa,
        platformSpreadRatePa,
      },
      payouts: {
        totalInterestCharged,
        investorYieldAccrued,
        platformSpreadEarned,
      },
    };
  }

  /**
   * Evaluates Anchor Concentration Risk & assigns a risk posture.
   * Prevents excessive capital exposure to a single corporate buyer.
   */
  static evaluateConcentrationRisk(currentExposure: number, maxExposureLimit: number, newAmount = 0) {
    const totalProjected = currentExposure + newAmount;
    const utilizationPct = Number(((totalProjected / maxExposureLimit) * 100).toFixed(1));

    let riskTier: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
    let recommendation: string;

    if (utilizationPct > 100) {
      riskTier = "CRITICAL";
      recommendation = "REJECT: Approved credit ceiling breached.";
    } else if (utilizationPct > 80) {
      riskTier = "HIGH";
      recommendation = "APPROVE_WITH_RECOURSE: Mandatory RECOURSE required due to high exposure concentration (>80%).";
    } else if (utilizationPct > 50) {
      riskTier = "MODERATE";
      recommendation = "APPROVE: Healthy utilization. Standard underwriting terms apply.";
    } else {
      riskTier = "LOW";
      recommendation = "APPROVE: Prime corporate capacity available.";
    }

    return {
      utilizationPct,
      riskTier,
      recommendation,
      isExceeded: utilizationPct > 100,
      remainingHeadroom: Math.max(0, maxExposureLimit - totalProjected),
    };
  }

  /**
   * Section 5: Decides whether an invoice MUST require RECOURSE.
   * Rules:
   * 1. If Anchor rating is BBB or A -> Mandatory RECOURSE
   * 2. If Anchor concentration is > 80% -> Mandatory RECOURSE
   * 3. Otherwise -> Non-recourse permitted for AAA anchors.
   */
  static determineMandatoryRecourse(creditRating: string, exposureUtilizationPct: number): {
    mandatoryRecourse: boolean;
    reason: string;
  } {
    const upperRating = creditRating.toUpperCase();
    if (upperRating === "BBB" || upperRating === "A") {
      return {
        mandatoryRecourse: true,
        reason: `Corporate credit rating '${upperRating}' requires mandatory seller recourse.`,
      };
    }

    if (exposureUtilizationPct > 80) {
      return {
        mandatoryRecourse: true,
        reason: `Anchor concentration utilization (${exposureUtilizationPct}%) exceeds 80% safety cap.`,
      };
    }

    return {
      mandatoryRecourse: false,
      reason: `Anchor is prime rated (${upperRating}) with low concentration. Non-recourse acceptable.`,
    };
  }

  /**
   * Deterministic Buyer Track Classifier:
   * Decides whether an Anchor is on the ENTERPRISE track vs SME_COMMERCIAL track.
   * Rules:
   * 1. Prime Credit Rating ('AAA', 'AA+', 'AA', 'A') OR
   * 2. Approved Exposure Ceiling >= ₹5 Crore (₹50,000,000) OR
   * 3. Annual MSME Procurement >= ₹50 Crore
   * -> ENTERPRISE Track (full advance, institutional NOA)
   *
   * Otherwise -> SME_COMMERCIAL Track (Mandatory Recourse + Ramp-up advance cap).
   */
  static classifyBuyerTrack(anchor: {
    corporateName: string;
    creditRating: string;
    maxExposureLimit: number;
    annualProcurement?: number | null;
  }): {
    track: "ENTERPRISE" | "SME_COMMERCIAL";
    reason: string;
    isEnterprise: boolean;
  } {
    const rating = anchor.creditRating?.toUpperCase() || "UNRATED";
    const isPrimeRated = ["AAA", "AA+", "AA", "A"].includes(rating);
    const hasLargeCeiling = anchor.maxExposureLimit >= 50000000;
    const hasHighProcurement = (anchor.annualProcurement || 0) >= 500000000;

    if (isPrimeRated || hasLargeCeiling || hasHighProcurement) {
      return {
        track: "ENTERPRISE",
        isEnterprise: true,
        reason: `Corporate matches Enterprise threshold (Rating: ${rating}, Sanctioned Limit: ₹${anchor.maxExposureLimit.toLocaleString()}).`,
      };
    }

    return {
      track: "SME_COMMERCIAL",
      isEnterprise: false,
      reason: "Mid-market/SME Buyer: Subject to mandatory recourse, ramp-up advance limits, and automated WhatsApp/OTP consent.",
    };
  }

  /**
   * Ramp-Up / Graduated Funding Cap for SME Buyers:
   * Protects against empty bank account fraud:
   * - First 3 invoices against an unproven SME buyer: Cap at 60% advance (max ₹2 Lakhs).
   * - After >= 3 successfully settled invoices: Standard 84% advance unlocked!
   */
  static calculateRampUpDisbursement(
    totalAmount: number,
    buyerTrack: "ENTERPRISE" | "SME_COMMERCIAL",
    settledInvoicesCount = 0
  ) {
    if (buyerTrack === "ENTERPRISE" || settledInvoicesCount >= 3) {
      return this.calculateDisbursementBreakdown(totalAmount, 15.0, 1.0);
    }

    // SME Buyer in probation period (< 3 settled invoices)
    // 60% advance, 39% margin hold (released upon buyer payment), 1% fee.
    // Absolute cash advance capped at ₹2,00,000 to limit fraud exposure.
    const standardAdv = totalAmount * 0.60;
    const cappedAdv = Math.min(200000, standardAdv);
    const upfrontDisbursedAmount = Number(cappedAdv.toFixed(2));
    const platformFeeAmount = Number(((totalAmount * 1.0) / 100).toFixed(2));
    const marginHeldAmount = Number((totalAmount - upfrontDisbursedAmount - platformFeeAmount).toFixed(2));
    const marginHoldPct = Number(((marginHeldAmount / totalAmount) * 100).toFixed(1));

    return {
      totalAmount,
      marginHoldPct,
      marginHeldAmount,
      platformFeePct: 1.0,
      platformFeeAmount,
      upfrontDisbursedAmount,
      isRampUpCapped: true,
      probationReason: `SME Buyer probation (< 3 settlements). Advance capped at 60% (max ₹2L). Full 84% unlocks after 3 clean settlements.`,
    };
  }

  /**
   * Dynamically calculates Indian Financial Year (April 1 to March 31).
   * E.g. Date in Oct 2026 -> "2026-27"
   * E.g. Date in Feb 2027 -> "2026-27"
   * E.g. Date in May 2027 -> "2027-28"
   */
  static getCurrentFinancialYear(date: Date = new Date()): string {
    const month = date.getMonth(); // 0-indexed: 3 = April
    const fullYear = date.getFullYear();

    if (month >= 3) {
      const nextYearShort = String((fullYear + 1) % 100).padStart(2, "0");
      return `${fullYear}-${nextYearShort}`;
    } else {
      const currentYearShort = String(fullYear % 100).padStart(2, "0");
      return `${fullYear - 1}-${currentYearShort}`;
    }
  }
}

