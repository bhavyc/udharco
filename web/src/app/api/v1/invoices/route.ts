import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FraudService } from "@/lib/services/fraudService";
import { RiskService } from "@/lib/services/riskService";
import { requireAuth } from "@/lib/auth";

// GET /api/v1/invoices - List invoices scoped to the logged-in user's role:
//   SELLER → only their own invoices
//   ANCHOR → invoices where anchor = their entity
//   INVESTOR → all funded/listed invoices they have bids on
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    // Build role-scoped filter
    let whereClause = {};
    if (auth.role === "SELLER") {
      whereClause = { sellerId: auth.entityId };
    } else if (auth.role === "ANCHOR") {
      whereClause = { anchorId: auth.entityId };
    } else if (auth.role === "INVESTOR") {
      whereClause = {
        fundingBids: { some: { investorId: auth.entityId } },
      };
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        seller: { select: { id: true, legalName: true, gstin: true, kycStatus: true, bankAccountNo: true, bankIfsc: true } },
        anchor: { select: { id: true, corporateName: true, gstin: true, creditRating: true, maxExposureLimit: true, currentExposure: true } },
        fundingBids: { include: { investor: { select: { entityName: true, investorType: true } } } },
        escrowTransactions: { orderBy: { createdAt: "desc" } },
        settlementRecord: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, count: invoices.length, data: invoices });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST /api/v1/invoices - Upload an Invoice (Sellers only).
// The sellerId is taken from the session — it cannot be spoofed via request body.
export async function POST(request: Request) {
  // Only SELLER role can create invoices
  const auth = await requireAuth("SELLER");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      anchorId,
      invoiceNumber,
      financialYear = "2026-27",
      totalAmount,
      tenureDays = 90,
      poNumber,
      ewayBillNo,
      irn,
      recourseType = "RECOURSE",
      pricingModel = "NET_DISBURSED",
      invoiceDocumentUrl,
      invoiceDocumentName,
    } = body;

    // sellerId always comes from the authenticated session — never trust client input
    const sellerId = auth.entityId;

    const effectiveFY = (financialYear && String(financialYear).trim()) || RiskService.getCurrentFinancialYear();

    // 1. Basic Validations
    if (!anchorId || !invoiceNumber || !totalAmount) {
      return NextResponse.json(
        { success: false, error: "anchorId, invoiceNumber, and totalAmount are required." },
        { status: 400 }
      );
    }

    const amount = Number(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "totalAmount must be a positive number greater than 0." },
        { status: 400 }
      );
    }

    // 2. Fetch Seller & Anchor
    const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) {
      return NextResponse.json({ success: false, error: "Seller MSME not found." }, { status: 404 });
    }

    // Security Gate: Enforce KYC Verified before invoice discounting
    if (seller.kycStatus !== "VERIFIED") {
      return NextResponse.json(
        {
          success: false,
          error: "SELLER_KYC_PENDING",
          message: `Seller '${seller.legalName}' has KYC status '${seller.kycStatus}'. Please complete KYC verification before discounting invoices.`,
        },
        { status: 403 }
      );
    }

    const anchor = await prisma.anchor.findUnique({ where: { id: anchorId } });
    if (!anchor) {
      return NextResponse.json({ success: false, error: "Corporate Anchor not found." }, { status: 404 });
    }

    // Security Gate: Enforce Anchor Credit Underwriting
    if (anchor.creditRating === "UNRATED" || anchor.maxExposureLimit <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ANCHOR_UNDERWRITING_PENDING",
          message: `Corporate Anchor '${anchor.corporateName}' has not completed credit risk underwriting (Rating: ${anchor.creditRating}, Limit: ₹${anchor.maxExposureLimit}). Credit assessment required before onboarding bills.`,
        },
        { status: 400 }
      );
    }

    // Security Gate: Enforce Seller Sanctioned Credit Limit
    if (seller.creditLimit > 0 && amount > seller.creditLimit) {
      return NextResponse.json(
        {
          success: false,
          error: "SELLER_CREDIT_LIMIT_EXCEEDED",
          message: `Invoice amount ₹${amount.toLocaleString("en-IN")} exceeds your sanctioned invoice discounting line of ₹${seller.creditLimit.toLocaleString("en-IN")}. Maximum allowed is ₹${seller.creditLimit.toLocaleString("en-IN")}.`,
        },
        { status: 400 }
      );
    }

    // 3. CRITICAL FINTECH GATE: Double-Financing Fraud Registry Check
    const invoiceHash = FraudService.generateInvoiceHash(seller.gstin, invoiceNumber, effectiveFY);
    const fraudCheck = await FraudService.checkDuplicateFinancing(invoiceHash);

    if (fraudCheck.isDuplicate) {
      return NextResponse.json(
        {
          success: false,
          error: "DOUBLE_FINANCING_FRAUD_DETECTED",
          message: fraudCheck.message,
          details: fraudCheck,
        },
        { status: 409 } // 409 Conflict
      );
    }

    // 4. Anchor Concentration Risk & Exposure Cap Verification
    const concentration = RiskService.evaluateConcentrationRisk(anchor.currentExposure, anchor.maxExposureLimit, amount);
    if (concentration.isExceeded) {
      return NextResponse.json(
        {
          success: false,
          error: "ANCHOR_EXPOSURE_LIMIT_EXCEEDED",
          message: `Invoice amount ₹${amount.toLocaleString()} exceeds Anchor's approved limit of ₹${anchor.maxExposureLimit.toLocaleString()}. Utilization would reach ${concentration.utilizationPct}%.`,
          details: concentration,
        },
        { status: 400 }
      );
    }

    // Evaluate Collusion Risk (New Seller + New Buyer + Large Ticket > ₹2L)
    const collusionCheck = await FraudService.evaluateCollusionRisk(sellerId, anchorId, amount);
    if (collusionCheck.isSuspicious) {
      return NextResponse.json(
        {
          success: false,
          error: "FRAUD_RISK_COLLUSION_FLAGGED",
          message: collusionCheck.flagReason,
          riskScore: collusionCheck.riskScore,
        },
        { status: 403 }
      );
    }

    // Classify Buyer Track (ENTERPRISE vs SME_COMMERCIAL)
    const buyerClassification = RiskService.classifyBuyerTrack(anchor);

    // Section 5: Recourse Mandate Enforcement
    // SME Buyers are ALWAYS mandatory RECOURSE backed by seller's verified e-NACH mandate
    const recourseEvaluation = RiskService.determineMandatoryRecourse(anchor.creditRating, concentration.utilizationPct);
    const finalRecourseType = buyerClassification.track === "SME_COMMERCIAL"
      ? "RECOURSE"
      : (recourseEvaluation.mandatoryRecourse ? "RECOURSE" : recourseType.toUpperCase());

    // Fetch settled history for this anchor to determine probation status
    const buyerSettledCount = await prisma.invoice.count({
      where: { anchorId, status: "SETTLED" },
    });

    // 5. Dynamic Pricing & Graduated Ramp-Up Disbursement Math
    const discountRatePa = RiskService.getDiscountRateByRating(anchor.creditRating);
    const breakdown = RiskService.calculateRampUpDisbursement(
      amount,
      buyerClassification.track,
      buyerSettledCount
    );
    const spreadBreakdown = RiskService.calculateInterestSpreadBreakdown(
      breakdown.upfrontDisbursedAmount,
      discountRatePa,
      Math.max(10.0, discountRatePa - 2.0),
      Number(tenureDays)
    );

    // Fintech Blind Spot #1: e-Invoice (IRN) Verification
    const irnResult = FraudService.verifyIRN(irn, seller.gstin, invoiceNumber, effectiveFY);
    if (!irnResult.isValid) {
      return NextResponse.json(
        { success: false, error: "INVALID_IRN", message: irnResult.error },
        { status: 400 }
      );
    }

    // Calculate Due Date based on tenure (default 90 days)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + Number(tenureDays));

    // 6. Create Invoice in Database
    const newInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceNumber.trim().toUpperCase(),
        financialYear: effectiveFY,
        totalAmount: amount,
        tenureDays: Number(tenureDays),
        dueDate,
        marginHoldPct: breakdown.marginHoldPct,
        marginHeldAmount: breakdown.marginHeldAmount,
        upfrontDisbursedAmount: breakdown.upfrontDisbursedAmount,
        platformFeePct: breakdown.platformFeePct,
        discountRatePa,
        pricingModel: "NET_DISBURSED",
        recourseType: finalRecourseType,
        status: "UPLOADED",
        poNumber: poNumber?.trim() || null,
        ewayBillNo: ewayBillNo?.trim() || null,
        invoiceDocumentUrl: invoiceDocumentUrl || null,
        invoiceDocumentName: invoiceDocumentName?.trim() || null,
        irn: irnResult.irn,
        irnVerified: true,
        virtualAccountNumber: `UDHAR-${invoiceNumber.trim().toUpperCase()}`,
        invoiceHash,
        sellerId: seller.id,
        anchorId: anchor.id,
      },
      include: {
        seller: { select: { legalName: true, gstin: true } },
        anchor: { select: { corporateName: true, creditRating: true } },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Invoice submitted and passed fraud registry validation.",
        data: newInvoice,
        financialBreakdown: {
          totalInvoiceValue: amount,
          upfrontDisbursementToSeller: breakdown.upfrontDisbursedAmount,
          marginHoldRetainedInEscrow: breakdown.marginHeldAmount,
          platformFeeAmount: breakdown.platformFeeAmount,
          annualDiscountRate: `${discountRatePa}% p.a.`,
          recourseModel: newInvoice.recourseType,
          recourseJustification: recourseEvaluation.reason,
        },
        revenueModel: {
          sellerRatePa: `${discountRatePa}% p.a.`,
          investorYieldRatePa: `${spreadBreakdown.rates.investorYieldRatePa}% p.a.`,
          platformNetInterestSpreadPa: `${spreadBreakdown.rates.platformSpreadRatePa}% p.a.`,
          projectedPlatformSpreadEarned: `₹${spreadBreakdown.payouts.platformSpreadEarned.toLocaleString()}`,
        },
        concentrationRisk: {
          utilizationPct: `${concentration.utilizationPct}%`,
          riskTier: concentration.riskTier,
          recommendation: concentration.recommendation,
          remainingCorporateHeadroom: `₹${concentration.remainingHeadroom.toLocaleString()}`,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
