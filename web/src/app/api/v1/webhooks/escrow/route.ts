import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SettlementService } from "@/lib/services/settlementService";

// POST /api/v1/webhooks/escrow
// Bank Virtual Escrow Webhook Handler (ICICI CIB / Yes Bank / RazorpayX format)
// Simulates incoming RTGS/NEFT credit alert from Corporate Anchor to Virtual Account Number (VAN)
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
    }

    const {
      event = "virtual_account.credited",
      eventId,
      provider = "ICICI_ESCROW",
      data = {},
    } = payload;

    const {
      virtualAccountNumber,
      invoiceId,
      invoiceNumber,
      amount,
      bankReferenceNumber,
      remitterName,
      paymentMode = "RTGS",
    } = data;

    const idempotencyKey = eventId || bankReferenceNumber || `UTR-${Date.now()}`;

    // 1. CRITICAL FINTECH IDEMPOTENCY CHECK
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { idempotencyKey },
    });

    if (existingEvent) {
      return NextResponse.json({
        success: true,
        message: `Idempotent replay: Webhook event '${idempotencyKey}' was already processed. Duplicate payout blocked.`,
        status: "DUPLICATE_SKIPPED",
        eventId: existingEvent.id,
      });
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid payment amount in bank event payload." },
        { status: 400 }
      );
    }

    // 2. Locate Invoice by Virtual Account Number (VAN), ID, or Invoice Number
    let invoice = null;
    if (virtualAccountNumber) {
      invoice = await prisma.invoice.findFirst({
        where: { virtualAccountNumber },
        include: {
          seller: true,
          anchor: true,
          fundingBids: { where: { status: "CONFIRMED" }, include: { investor: true } },
        },
      });
    }

    if (!invoice && invoiceId) {
      invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          seller: true,
          anchor: true,
          fundingBids: { where: { status: "CONFIRMED" }, include: { investor: true } },
        },
      });
    }

    if (!invoice && invoiceNumber) {
      invoice = await prisma.invoice.findFirst({
        where: { invoiceNumber },
        include: {
          seller: true,
          anchor: true,
          fundingBids: { where: { status: "CONFIRMED" }, include: { investor: true } },
        },
      });
    }

    if (!invoice) {
      // Log unmapped event
      await prisma.webhookEvent.create({
        data: {
          idempotencyKey,
          provider,
          eventType: event,
          payload: rawBody,
          status: "FAILED",
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: "UNMAPPED_VIRTUAL_ACCOUNT",
          message: `No active invoice found for Virtual Account '${virtualAccountNumber || invoiceNumber || invoiceId}'.`,
        },
        { status: 404 }
      );
    }

    if (invoice.status !== "FUNDED") {
      return NextResponse.json(
        {
          success: false,
          error: `Invoice #${invoice.invoiceNumber} is not in FUNDED status (Current: '${invoice.status}'). Cannot process repayment.`,
        },
        { status: 400 }
      );
    }

    const fundingBid = invoice.fundingBids[0];
    if (!fundingBid) {
      return NextResponse.json(
        { success: false, error: "No confirmed investor funding bid found on this invoice." },
        { status: 400 }
      );
    }

    const repaymentAmount = Number(amount);
    const flatPlatformFee = Number(
      ((invoice.totalAmount * invoice.platformFeePct) / 100).toFixed(2)
    );

    // Section 7 Net Disbursed Principal Model:
    // Platform earns upfront commission + 1% net annual interest spread upon repayment
    const interestSpreadRate = 1.0;
    const platformSpreadAmount = Number(
      ((fundingBid.fundedAmount * (interestSpreadRate / 100) * invoice.tenureDays) / 365).toFixed(2)
    );
    const platformFeeAmount = Number((flatPlatformFee + platformSpreadAmount).toFixed(2));

    // 3. Run Escrow Waterfall Calculation Engine
    const waterfall = SettlementService.calculateWaterfall({
      totalInvoiceAmount: invoice.totalAmount,
      repaymentAmount,
      fundedPrincipal: fundingBid.fundedAmount,
      expectedInvestorYield: fundingBid.expectedReturn,
      platformFeeAmount,
      recourseType: invoice.recourseType,
    });

    const now = new Date();
    const newStatus = waterfall.outcome === "DEFAULT" ? "DEFAULTED" : "SETTLED";

    // 4. ATOMIC BANK ESCROW SETTLEMENT TRANSACTION
    const transactionOperations: any[] = [];

    // A. Log Incoming Bank RTGS/NEFT Escrow Credit
    transactionOperations.push(
      prisma.escrowTransaction.create({
        data: {
          invoiceId: invoice.id,
          transactionType: "BUYER_REPAYMENT",
          amount: repaymentAmount,
          notes: `INCOMING BANK ESCROW CREDIT: ₹${repaymentAmount.toLocaleString()} received via ${paymentMode} from ${remitterName || invoice.anchor.corporateName} (Bank Ref/UTR: ${idempotencyKey}).`,
        },
      })
    );

    // B. Priority #1: Investor Principal + Yield Payout
    if (waterfall.investorTotalPayout > 0) {
      transactionOperations.push(
        prisma.investor.update({
          where: { id: fundingBid.investorId },
          data: {
            escrowBalance: { increment: waterfall.investorTotalPayout },
          },
        })
      );

      transactionOperations.push(
        prisma.escrowTransaction.create({
          data: {
            invoiceId: invoice.id,
            transactionType: "INVESTOR_PAYOUT",
            amount: waterfall.investorTotalPayout,
            notes: `Investor ${fundingBid.investor.entityName} received ₹${waterfall.investorTotalPayout.toLocaleString()} (Principal: ₹${waterfall.investorPrincipalPaid.toLocaleString()}, Yield: ₹${waterfall.investorInterestPaid.toLocaleString()}) via Escrow waterfall.`,
          },
        })
      );
    }

    // C. Priority #2: Platform Fee
    if (waterfall.platformFeeDeducted > 0) {
      transactionOperations.push(
        prisma.escrowTransaction.create({
          data: {
            invoiceId: invoice.id,
            transactionType: "PLATFORM_FEE",
            amount: waterfall.platformFeeDeducted,
            notes: `PLATFORM_FEE_SWEEP: ₹${waterfall.platformFeeDeducted.toLocaleString()} swept to UdharCo commission account.`,
          },
        })
      );
    }

    // D. Priority #3: Seller Residual Margin Release
    if (waterfall.sellerMarginReturned > 0) {
      transactionOperations.push(
        prisma.escrowTransaction.create({
          data: {
            invoiceId: invoice.id,
            transactionType: "SELLER_MARGIN_RELEASE",
            amount: waterfall.sellerMarginReturned,
            notes: `Residual margin of ₹${waterfall.sellerMarginReturned.toLocaleString()} released to MSME Seller ${invoice.seller.legalName} (A/C: ${invoice.seller.bankAccountNo}).`,
          },
        })
      );
    }

    // E. Shortfall Recourse Trigger (with e-NACH auto-debit)
    if (waterfall.recourseTriggered && waterfall.recourseRecoveryDemand > 0) {
      const mandateId = invoice.seller.enachMandateId || "MND-NPCI-882910";
      const hasActiveEnach = invoice.seller.enachMandateStatus === "ACTIVE";

      const recourseNotes = hasActiveEnach
        ? `NPCI e-NACH AUTO-DEBIT EXECUTED: ₹${waterfall.recourseRecoveryDemand.toLocaleString()} automatically debited from MSME Seller ${invoice.seller.legalName} bank account (Mandate: ${mandateId}) to cover buyer shortfall.`
        : `RECOURSE DEMAND ISSUED: Legal shortfall demand notice of ₹${waterfall.recourseRecoveryDemand.toLocaleString()} raised against MSME Seller ${invoice.seller.legalName}.`;

      transactionOperations.push(
        prisma.escrowTransaction.create({
          data: {
            invoiceId: invoice.id,
            transactionType: "RECOURSE_RECOVERY",
            amount: waterfall.recourseRecoveryDemand,
            notes: recourseNotes,
          },
        })
      );
    }

    // F. Decrement Corporate Exposure
    transactionOperations.push(
      prisma.anchor.update({
        where: { id: invoice.anchorId },
        data: {
          currentExposure: { decrement: invoice.totalAmount },
        },
      })
    );

    // G. Create Settlement Record
    transactionOperations.push(
      prisma.settlementRecord.create({
        data: {
          invoiceId: invoice.id,
          totalReceived: waterfall.totalReceived,
          investorPrincipalPaid: waterfall.investorPrincipalPaid,
          investorInterestPaid: waterfall.investorInterestPaid,
          platformFeeDeducted: waterfall.platformFeeDeducted,
          sellerMarginReturned: waterfall.sellerMarginReturned,
          shortfallAmount: waterfall.shortfallAmount,
          recourseTriggered: waterfall.recourseTriggered,
          settledAt: now,
        },
      })
    );

    // H. Mark Invoice as SETTLED
    transactionOperations.push(
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: newStatus,
          settledAt: now,
        },
      })
    );

    // I. Record Webhook Event for Audit & Idempotency
    transactionOperations.push(
      prisma.webhookEvent.create({
        data: {
          idempotencyKey,
          provider,
          eventType: event,
          payload: rawBody,
          status: "PROCESSED",
          processedAt: now,
        },
      })
    );

    // Execute atomic batch
    await prisma.$transaction(transactionOperations);

    return NextResponse.json({
      success: true,
      message: `Bank Escrow Webhook processed successfully. Invoice #${invoice.invoiceNumber} transitioned to '${newStatus}'.`,
      bankAudit: {
        idempotencyKey,
        provider,
        paymentMode,
        remitterName: remitterName || invoice.anchor.corporateName,
        creditedVirtualAccount: virtualAccountNumber || invoice.virtualAccountNumber || "DEFAULT_ESCROW",
        amountReceived: `₹${repaymentAmount.toLocaleString()}`,
      },
      waterfallSummary: {
        outcome: waterfall.outcome,
        investorPayout: `₹${waterfall.investorTotalPayout.toLocaleString()}`,
        platformCommission: `₹${waterfall.platformFeeDeducted.toLocaleString()}`,
        sellerMarginReleased: `₹${waterfall.sellerMarginReturned.toLocaleString()}`,
        shortfallAmount: `₹${waterfall.shortfallAmount.toLocaleString()}`,
        recourseTriggered: waterfall.recourseTriggered,
        recourseRecoveryDemand: `₹${waterfall.recourseRecoveryDemand.toLocaleString()}`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
