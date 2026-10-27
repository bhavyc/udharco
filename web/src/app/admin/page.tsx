import React from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AdminDashboardClient from "./AdminDashboardClient";

export const instant = false;

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const [sellers, anchors, investors, invoices, transactions, auditLogs] = await Promise.all([
    prisma.seller.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.anchor.findMany({
      include: { user: { select: { email: true, isActive: true, inviteToken: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.investor.findMany({
      include: { user: { select: { email: true, isActive: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.findMany({
      include: {
        seller: { select: { legalName: true, gstin: true, enachMandateId: true } },
        anchor: { select: { corporateName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.escrowTransaction.findMany({
      include: {
        invoice: { select: { invoiceNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 100,
    }),
  ]);

  return (
    <AdminDashboardClient
      adminEmail={session.email}
      initialSellers={JSON.parse(JSON.stringify(sellers))}
      initialAnchors={JSON.parse(JSON.stringify(anchors))}
      initialInvestors={JSON.parse(JSON.stringify(investors))}
      initialInvoices={JSON.parse(JSON.stringify(invoices))}
      initialTransactions={JSON.parse(JSON.stringify(transactions))}
      initialAuditLogs={JSON.parse(JSON.stringify(auditLogs))}
    />
  );
}
