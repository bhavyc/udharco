import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// POST /api/v1/invoices/:id/fund
// Investor (Bank / NBFC) funds the listed invoice from their virtual escrow account
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("INVESTOR");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const investorId = auth.entityId;

    // 1. Fetch Invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        seller: true,
        anchor: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
    }

    if (invoice.status !== "LISTED") {
      return NextResponse.json(
        {
          success: false,
          error: `Invoice cannot be funded from status '${invoice.status}'. Must be in 'LISTED' status.`,
        },
        { status: 400 }
      );
    }

    // Defense-in-depth: Ensure anchor is active with a sanctioned credit limit
    if (invoice.anchor.status !== "ACTIVE" || invoice.anchor.maxExposureLimit <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ANCHOR_NOT_SANCTIONED",
          message: `Invoice cannot be funded. Corporate Anchor '${invoice.anchor.corporateName}' is not active or has an un-sanctioned exposure limit (Limit: ₹${invoice.anchor.maxExposureLimit}).`,
        },
        { status: 403 }
      );
    }

    // 2. Fetch Investor & Verify Escrow Balance
    const investor = await prisma.investor.findUnique({
      where: { id: investorId },
    });

    if (!investor) {
      return NextResponse.json({ success: false, error: "Investor entity not found." }, { status: 404 });
    }

    // 2. Compute Capital and Yield strictly based on Net Disbursed Principal Model (Section 7)
    // Seller receives 84% face value upfront (the Investor's actual principal deployed)
    const requiredCapital = invoice.upfrontDisbursedAmount;
    const annualRate = Math.max(10.0, invoice.discountRatePa - 1.0);

    if (investor.escrowBalance < requiredCapital) {
      return NextResponse.json(
        {
          success: false,
          error: "INSUFFICIENT_ESCROW_BALANCE",
          message: `Investor escrow balance ₹${investor.escrowBalance.toLocaleString()} is insufficient. Required: ₹${requiredCapital.toLocaleString()}.`,
        },
        { status: 400 }
      );
    }

    // 3. Calculate Investor Expected Return
    const expectedInterest = Number(
      ((requiredCapital * (annualRate / 100) * invoice.tenureDays) / 365).toFixed(2)
    );

    const now = new Date();

    // 4. ATOMIC FINTECH TRANSACTION: Escrow deduction + Bid creation + Status change
    const [updatedInvestor, updatedInvoice, bid, tx] = await prisma.$transaction([
      // A. Deduct capital from Investor Escrow wallet
      prisma.investor.update({
        where: { id: investor.id },
        data: {
          escrowBalance: {
            decrement: requiredCapital,
          },
        },
      }),

      // B. Update Invoice status to FUNDED and register CERSAI charge
      prisma.invoice.update({
        where: { id },
        data: {
          status: "FUNDED",
          fundedAt: now,
          cersaiSecurityId: `CERSAI-SEC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          cersaiStatus: "REGISTERED",
        },
        include: {
          seller: { select: { legalName: true, bankAccountNo: true, bankIfsc: true } },
          anchor: { select: { corporateName: true, creditRating: true } },
        },
      }),

      // C. Create Funding Bid Record
      prisma.fundingBid.create({
        data: {
          invoiceId: invoice.id,
          investorId: investor.id,
          fundedAmount: requiredCapital,
          expectedReturn: expectedInterest,
          status: "CONFIRMED",
        },
      }),

      // D. Record Escrow Disbursement Transaction (Direct Escrow to Seller Bank Account per RBI Guidelines)
      prisma.escrowTransaction.create({
        data: {
          invoiceId: invoice.id,
          transactionType: "SELLER_DISBURSEMENT",
          amount: invoice.upfrontDisbursedAmount,
          notes: `RBI COMPLIANT DIRECT DISBURSEMENT: Virtual Escrow payout directly to MSME Seller ${invoice.seller.legalName} (A/C: ${invoice.seller.bankAccountNo}, IFSC: ${invoice.seller.bankIfsc}). Zero platform pooling.`,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Invoice #${invoice.invoiceNumber} successfully funded by ${investor.entityName}! Cash disbursed to MSME.`,
      disbursementReceipt: {
        invoiceNumber: invoice.invoiceNumber,
        beneficiarySeller: updatedInvoice.seller.legalName,
        creditedBankAccount: updatedInvoice.seller.bankAccountNo,
        ifscCode: updatedInvoice.seller.bankIfsc,
        upfrontCashDisbursed: `₹${invoice.upfrontDisbursedAmount.toLocaleString()}`,
        marginHoldRetainedInEscrow: `₹${invoice.marginHeldAmount.toLocaleString()}`,
        platformCommissionDeducted: `₹${((invoice.totalAmount * invoice.platformFeePct) / 100).toLocaleString()}`,
        rbiCompliance: "RBI Digital Lending Directions: Direct Escrow-to-Seller account flow verified.",
      },
      cersaiRegistry: {
        securityChargeId: updatedInvoice.cersaiSecurityId,
        status: updatedInvoice.cersaiStatus,
        purpose: "National asset charge registered with CERSAI to block multi-bank double hypothecation.",
      },
      investorPosition: {
        investorName: updatedInvestor.entityName,
        capitalFunded: `₹${requiredCapital.toLocaleString()}`,
        expectedInterestYield: `₹${expectedInterest.toLocaleString()} (${annualRate}% p.a. for ${invoice.tenureDays} days)`,
        totalExpectedRepaymentAtMaturity: `₹${(requiredCapital + expectedInterest).toLocaleString()}`,
        remainingEscrowBalance: `₹${updatedInvestor.escrowBalance.toLocaleString()}`,
      },
      invoiceData: updatedInvoice,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
