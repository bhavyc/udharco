import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized admin access." }, { status: 401 });
    }

    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        seller: true,
        anchor: true,
        fundingBids: { where: { status: "CONFIRMED" }, include: { investor: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
    }

    if (!["FUNDED", "DISPUTED", "DEFAULTED"].includes(invoice.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot execute e-NACH recourse against invoice in '${invoice.status}' status. Recourse can only be triggered on FUNDED, DISPUTED, or DEFAULTED bills.`,
        },
        { status: 400 }
      );
    }

    const mandateId = invoice.seller.enachMandateId || "MND-NPCI-882910";
    const recoveryAmount = invoice.upfrontDisbursedAmount || Math.round(invoice.totalAmount * 0.84);

    // Run transaction: Create Escrow Recourse Recovery record + refund Investor escrow + update invoice status to SETTLED + AuditLog
    const [transactionRecord, updatedInvoice, audit] = await prisma.$transaction(async (tx) => {
      const txRecord = await tx.escrowTransaction.create({
        data: {
          invoiceId: invoice.id,
          transactionType: "RECOURSE_RECOVERY",
          amount: recoveryAmount,
          notes: `ADMIN TRIGGERED NPCI e-NACH RECOURSE: ₹${recoveryAmount.toLocaleString()} auto-debited from ${invoice.seller.legalName} (${mandateId}) due to buyer dispute/default.`,
        },
      });

      // Credit recovered principal back into the funding Investor's escrow wallet
      if (invoice.fundingBids.length > 0) {
        const investorId = invoice.fundingBids[0].investorId;
        await tx.investor.update({
          where: { id: investorId },
          data: { escrowBalance: { increment: recoveryAmount } },
        });
      }

      const updInv = await tx.invoice.update({
        where: { id },
        data: {
          status: "SETTLED",
          disputeReason: `RECOURSE EXECUTED: ₹${recoveryAmount.toLocaleString()} recovered via e-NACH ${mandateId}`,
          settledAt: new Date(),
        },
      });

      const auditLog = await tx.auditLog.create({
        data: {
          entityType: "INVOICE",
          entityId: id,
          action: "RECOURSE_EXECUTED",
          actorRole: "ADMIN",
          actorId: session.email,
          metadata: JSON.stringify({
            adminEmail: session.email,
            recoveryAmount,
            mandateId,
            sellerId: invoice.sellerId,
            investorReimbursed: invoice.fundingBids[0]?.investorId || null,
          }),
        },
      });

      return [txRecord, updInv, auditLog];
    });

    return NextResponse.json({
      success: true,
      message: `e-NACH Recourse executed successfully for ₹${recoveryAmount.toLocaleString()}`,
      transaction: transactionRecord,
      invoice: updatedInvoice,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
