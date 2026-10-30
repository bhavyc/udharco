import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      seller: {
        select: {
          legalName: true,
          gstin: true,
          bankAccountNo: true,
          bankIfsc: true,
        },
      },
      anchor: {
        select: {
          id: true,
          corporateName: true,
          gstin: true,
          contactEmail: true,
          contactPerson: true,
          status: true,
          creditRating: true,
          maxExposureLimit: true,
          user: {
            select: {
              inviteToken: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  return (
    <NoticeClient
      invoice={{
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        invoiceDate: invoice.invoiceDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        tenureDays: invoice.tenureDays,
        status: invoice.status,
        poNumber: invoice.poNumber,
        ewayBillNo: invoice.ewayBillNo,
        irn: invoice.irn,
        invoiceDocumentUrl: invoice.invoiceDocumentUrl,
        invoiceDocumentName: invoice.invoiceDocumentName,
        anchorConfirmedAt: invoice.anchorConfirmedAt?.toISOString() || null,
        disputeReason: invoice.disputeReason,
        virtualAccountNumber: invoice.virtualAccountNumber || `UDHAR-${invoice.invoiceNumber}`,
      }}
      seller={invoice.seller}
      anchor={{
        id: invoice.anchor.id,
        corporateName: invoice.anchor.corporateName,
        gstin: invoice.anchor.gstin,
        contactEmail: invoice.anchor.contactEmail,
        contactPerson: invoice.anchor.contactPerson,
        status: invoice.anchor.status,
        creditRating: invoice.anchor.creditRating,
        maxExposureLimit: invoice.anchor.maxExposureLimit,
        inviteToken: invoice.anchor.user?.inviteToken || null,
      }}
    />
  );
}
