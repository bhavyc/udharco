export interface WaterfallInput {
  totalInvoiceAmount: number;
  repaymentAmount: number;
  fundedPrincipal: number;
  expectedInvestorYield: number;
  platformFeeAmount: number;
  recourseType: string; // RECOURSE vs NON_RECOURSE
}

export interface WaterfallOutput {
  outcome: "FULL_PAYMENT" | "PARTIAL_PAYMENT" | "DEFAULT";
  totalReceived: number;
  investorPrincipalPaid: number;
  investorInterestPaid: number;
  investorTotalPayout: number;
  platformFeeDeducted: number;
  sellerMarginReturned: number;
  shortfallAmount: number;
  recourseTriggered: boolean;
  recourseRecoveryDemand: number;
  notes: string;
}

export class SettlementService {
  /**
   * Calculates the exact Waterfall Payout order:
   * 1. Investor Principal & Interest (Priority 1)
   * 2. Platform Commission (Priority 2)
   * 3. Seller Margin Release (Residual)
   * 
   * Also determines Recourse liability on shortfalls.
   */
  static calculateWaterfall(input: WaterfallInput): WaterfallOutput {
    const {
      totalInvoiceAmount,
      repaymentAmount,
      fundedPrincipal,
      expectedInvestorYield,
      platformFeeAmount,
      recourseType,
    } = input;

    const investorDue = fundedPrincipal + expectedInvestorYield;
    const shortfall = Math.max(0, totalInvoiceAmount - repaymentAmount);

    // CASE 1: Full Payment on Time (Happy Path)
    if (repaymentAmount >= totalInvoiceAmount) {
      const investorTotalPayout = Number(investorDue.toFixed(2));
      const platformFee = Number(platformFeeAmount.toFixed(2));
      const sellerMarginReturned = Number(
        (repaymentAmount - investorTotalPayout - platformFee).toFixed(2)
      );

      return {
        outcome: "FULL_PAYMENT",
        totalReceived: repaymentAmount,
        investorPrincipalPaid: fundedPrincipal,
        investorInterestPaid: expectedInvestorYield,
        investorTotalPayout,
        platformFeeDeducted: platformFee,
        sellerMarginReturned: Math.max(0, sellerMarginReturned),
        shortfallAmount: 0,
        recourseTriggered: false,
        recourseRecoveryDemand: 0,
        notes: "Full payment received on due date. Investor, Platform, and Seller margin settled sequentially via Escrow waterfall.",
      };
    }

    // CASE 2: Full Default (Zero Payment)
    if (repaymentAmount <= 0) {
      const isRecourse = recourseType === "RECOURSE";
      return {
        outcome: "DEFAULT",
        totalReceived: 0,
        investorPrincipalPaid: 0,
        investorInterestPaid: 0,
        investorTotalPayout: 0,
        platformFeeDeducted: 0,
        sellerMarginReturned: 0,
        shortfallAmount: totalInvoiceAmount,
        recourseTriggered: isRecourse,
        recourseRecoveryDemand: isRecourse ? investorDue : 0,
        notes: isRecourse
          ? `Buyer defaulted. RECOURSE triggered: Demand notice of ₹${investorDue.toLocaleString()} issued to MSME Seller.`
          : "Buyer defaulted. NON-RECOURSE model: Investor absorbs credit write-off loss.",
      };
    }

    // CASE 3: Partial Payment (Shortfall / Dispute)
    // Waterfall: Pay investor first as much as possible
    const availableForInvestor = Math.min(repaymentAmount, investorDue);
    const investorPrincipalPaid = Math.min(availableForInvestor, fundedPrincipal);
    const investorInterestPaid = Math.max(0, availableForInvestor - investorPrincipalPaid);
    const remainingAfterInvestor = Math.max(0, repaymentAmount - availableForInvestor);
    const platformFeeDeducted = Math.min(remainingAfterInvestor, platformFeeAmount);
    const sellerMarginReturned = Math.max(0, remainingAfterInvestor - platformFeeDeducted);

    const investorShortfall = Math.max(0, investorDue - availableForInvestor);
    const isRecourse = recourseType === "RECOURSE";

    return {
      outcome: "PARTIAL_PAYMENT",
      totalReceived: repaymentAmount,
      investorPrincipalPaid: Number(investorPrincipalPaid.toFixed(2)),
      investorInterestPaid: Number(investorInterestPaid.toFixed(2)),
      investorTotalPayout: Number(availableForInvestor.toFixed(2)),
      platformFeeDeducted: Number(platformFeeDeducted.toFixed(2)),
      sellerMarginReturned: Number(sellerMarginReturned.toFixed(2)),
      shortfallAmount: Number(shortfall.toFixed(2)),
      recourseTriggered: isRecourse && investorShortfall > 0,
      recourseRecoveryDemand: isRecourse ? Number(investorShortfall.toFixed(2)) : 0,
      notes: isRecourse
        ? `Partial settlement of ₹${repaymentAmount.toLocaleString()}. Shortfall of ₹${shortfall.toLocaleString()} with RECOURSE recovery of ₹${investorShortfall.toLocaleString()} from Seller.`
        : `Partial settlement of ₹${repaymentAmount.toLocaleString()}. Non-recourse shortfall absorbed by investor.`,
    };
  }
}
