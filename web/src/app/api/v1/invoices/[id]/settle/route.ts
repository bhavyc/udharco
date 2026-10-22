import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SettlementService } from "@/lib/services/settlementService";
import { requireAuth } from "@/lib/auth";

// POST /api/v1/invoices/:id/settle
// Executes the Escrow Waterfall Settlement when corporate Anchor repays (or defaults)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { repaymentAmount = 0, isDefault = false } = body;

    // 1. Fetch Invoice with relations
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        seller: true,
        anchor: true,
        fundingBids: {
          where: { status: "CONFIRMED" },
          include: { investor: true },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
    }

    if (invoice.status !== "FUNDED") {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot settle invoice with status '${invoice.status}'. Must be in 'FUNDED' status.`,
        },
        { status: 400 }
      );
    }

    const fundingBid = invoice.fundingBids[0];
    if (!fundingBid) {
      return NextResponse.json(
        {
          success: false,
          error: "No active investor funding bid found for this funded invoice.",
        },
        { status: 400 }
      );
    }

    const effectiveRepayment = isDefault ? 0 : Number(repaymentAmount);
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

    // 2. Run Escrow Waterfall Calculation Engine
    const waterfall = SettlementService.calculateWaterfall({
      totalInvoiceAmount: invoice.totalAmount,
      repaymentAmount: effectiveRepayment,
      fundedPrincipal: fundingBid.fundedAmount,
      expectedInvestorYield: fundingBid.expectedReturn,
      platformFeeAmount,
      recourseType: invoice.recourseType,
    });

    const now = new Date();
    const newStatus = waterfall.outcome === "DEFAULT" ? "DEFAULTED" : "SETTLED";

    // 3. ATOMIC FINTECH TRANSACTION
    const transactionOperations: any[] = [];

    // A. Credit Investor virtual Escrow wallet with their waterfall payout
    if (waterfall.investorTotalPayout > 0) {
      transactionOperations.push(
        prisma.investor.update({
          where: { id: fundingBid.investorId },
          data: {
            escrowBalance: {
              increment: waterfall.investorTotalPayout,
            },
          },
        })
      );

      transactionOperations.push(
        prisma.escrowTransaction.create({
          data: {
            invoiceId: invoice.id,
            transactionType: "INVESTOR_PAYOUT",
            amount: waterfall.investorTotalPayout,
            notes: `Investor ${fundingBid.investor.entityName} received ₹${waterfall.investorTotalPayout.toLocaleString()} (Principal: ₹${waterfall.investorPrincipalPaid.toLocaleString()}, Interest Yield: ₹${waterfall.investorInterestPaid.toLocaleString()}) via Escrow waterfall.`,
          },
        })
      );
    }

    // B. Record Platform Fee Escrow Deduction
    if (waterfall.platformFeeDeducted > 0) {
      transactionOperations.push(
        prisma.escrowTransaction.create({
          data: {
            invoiceId: invoice.id,
            transactionType: "PLATFORM_FEE",
            amount: waterfall.platformFeeDeducted,
            notes: `UdharCo Platform fee of ₹${waterfall.platformFeeDeducted.toLocaleString()} successfully swept to treasury.`,
          },
        })
      );
    }

    // C. Record Seller Margin Release
    if (waterfall.sellerMarginReturned > 0) {
      transactionOperations.push(
        prisma.escrowTransaction.create({
          data: {
            invoiceId: invoice.id,
            transactionType: "SELLER_MARGIN_RELEASE",
            amount: waterfall.sellerMarginReturned,
            notes: `Residual margin reserve of ₹${waterfall.sellerMarginReturned.toLocaleString()} released and credited to MSME Seller ${invoice.seller.legalName} (A/C: ${invoice.seller.bankAccountNo}).`,
          },
        })
      );
    }

    // D. If Shortfall & Recourse: Record Recourse Recovery (via e-NACH Auto-Debit Mandate)
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

    // E. Decrement Anchor Corporate Exposure
    transactionOperations.push(
      prisma.anchor.update({
        where: { id: invoice.anchorId },
        data: {
          currentExposure: {
            decrement: invoice.totalAmount,
          },
        },
      })
    );

    // F. Create Settlement Record
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

    // G. Mark Invoice as SETTLED or DEFAULTED
    transactionOperations.push(
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: newStatus,
          settledAt: now,
        },
      })
    );

    // Execute atomic batch
    await prisma.$transaction(transactionOperations);

    // Fetch updated invoice with all relations for response
    const finalInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        seller: true,
        anchor: true,
        settlementRecord: true,
        escrowTransactions: { orderBy: { createdAt: "desc" } },
        fundingBids: { include: { investor: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Invoice #${invoice.invoiceNumber} waterfall settlement processed. Status: ${newStatus}`,
      waterfallSummary: {
        outcome: waterfall.outcome,
        totalInvoiceAmount: `₹${invoice.totalAmount.toLocaleString()}`,
        repaymentReceived: `₹${waterfall.totalReceived.toLocaleString()}`,
        investorPayout: {
          investor: fundingBid.investor.entityName,
          principalPaid: `₹${waterfall.investorPrincipalPaid.toLocaleString()}`,
          interestYieldPaid: `₹${waterfall.investorInterestPaid.toLocaleString()}`,
          totalCredited: `₹${waterfall.investorTotalPayout.toLocaleString()}`,
        },
        platformFeeSwept: `₹${waterfall.platformFeeDeducted.toLocaleString()}`,
        sellerMarginReleased: `₹${waterfall.sellerMarginReturned.toLocaleString()}`,
        shortfallAmount: `₹${waterfall.shortfallAmount.toLocaleString()}`,
        recourseTriggered: waterfall.recourseTriggered,
        recourseRecoveryDemand: `₹${waterfall.recourseRecoveryDemand.toLocaleString()}`,
        notes: waterfall.notes,
      },
      invoice: finalInvoice,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
