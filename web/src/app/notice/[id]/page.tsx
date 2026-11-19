import { notFound } from "next/navigation";
import { backendFetch } from "@/lib/backend";
import NoticeClient from "./NoticeClient";

export const metadata = {
  title: "Tripartite Notice of Assignment & Commercial Delivery Verification | Udharco",
  description: "Statutory Notice of Assignment and delivery acknowledgement under Factoring Regulation Act, 2011",
};

export default async function NoticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let invoice: any = null;
  try {
    const res = await backendFetch(`/api/v1/invoices/${id}/noa`);
    if (res.ok) {
      const data = await res.json();
      invoice = data.data;
    }
  } catch (e) {
    console.error("Failed to fetch NOA from Go backend:", e);
  }

  if (!invoice) {
    notFound();
  }

  // Financial PII Defense: Mask bank account number for public Notice portal
  const bankAcc = invoice.seller?.bankAccountNo || "";
  const maskedBankAccount = bankAcc.length > 4
    ? `••••••••${bankAcc.slice(-4)}`
    : "••••••••";

  return (
    <NoticeClient
      invoice={{
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        invoiceDate: invoice.invoiceDate || new Date().toISOString(),
        dueDate: invoice.dueDate || new Date().toISOString(),
        tenureDays: invoice.tenureDays,
        status: invoice.status,
        poNumber: invoice.poNumber,
        ewayBillNo: invoice.ewayBillNo,
        irn: invoice.irn,
        invoiceDocumentUrl: invoice.invoiceDocumentUrl,
        invoiceDocumentName: invoice.invoiceDocumentName,
        anchorConfirmedAt: invoice.anchorConfirmedAt || null,
        disputeReason: invoice.disputeReason,
        virtualAccountNumber: invoice.virtualAccountNumber || `UDHAR-${invoice.invoiceNumber}`,
        verificationToken: invoice.invoiceHash,
      }}
      seller={{
        legalName: invoice.seller?.legalName || "Verified Vendor",
        gstin: invoice.seller?.gstin || "Verified",
        bankAccountNo: maskedBankAccount,
        bankIfsc: invoice.seller?.bankIfsc || "HDFC0001234",
      }}
      anchor={{
        id: invoice.anchor?.id || "",
        corporateName: invoice.anchor?.corporateName || "Corporate Buyer",
        gstin: invoice.anchor?.gstin || "Verified",
        contactEmail: invoice.anchor?.contactEmail,
        contactPerson: invoice.anchor?.contactPerson,
        status: invoice.anchor?.status,
        creditRating: invoice.anchor?.creditRating || "AAA",
        maxExposureLimit: invoice.anchor?.maxExposureLimit || 50000000,
      }}
    />
  );
}
