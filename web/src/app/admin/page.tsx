import React from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { backendFetch } from "@/lib/backend";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  let sellers: any[] = [];
  let anchors: any[] = [];
  let investors: any[] = [];
  let invoices: any[] = [];
  let transactions: any[] = [];
  let auditLogs: any[] = [];

  try {
    const res = await backendFetch("/admin/api/overview");
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        sellers = data.sellers || [];
        anchors = data.anchors || [];
        investors = data.investors || [];
        invoices = data.invoices || [];
        transactions = data.transactions || [];
        auditLogs = data.auditLogs || [];
      }
    }
  } catch (e) {
    console.error("Failed to fetch admin overview from Go backend:", e);
  }

  return (
    <AdminDashboardClient
      adminEmail={session.email}
      initialSellers={sellers}
      initialAnchors={anchors}
      initialInvestors={investors}
      initialInvoices={invoices}
      initialTransactions={transactions}
      initialAuditLogs={auditLogs}
    />
  );
}
