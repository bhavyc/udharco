"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  Building2,
  Wallet,
  Users,
  FileText,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  LogOut,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Check,
  Search,
  Sliders,
  DollarSign,
  AlertTriangle,
  History,
  ArrowRight,
  Landmark,
  Layers,
  Lock,
  Clock,
} from "lucide-react";
import Link from "next/link";

interface Seller {
  id: string;
  legalName: string;
  gstin: string;
  pan: string;
  bankAccountNo: string;
  bankIfsc: string;
  kycStatus: string;
  creditLimit: number;
  creditLimitStatus: string;
  enachMandateId: string | null;
  enachMandateStatus: string;
}

interface Anchor {
  id: string;
  corporateName: string;
  gstin: string;
  creditRating: string;
  maxExposureLimit: number;
  currentExposure: number;
  status?: string;
  sourceChannel?: string;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  annualProcurement?: number | null;
  createdAt?: string;
  user?: { email: string | null; isActive: boolean; inviteToken?: string | null } | null;
}

interface Investor {
  id: string;
  entityName: string;
  investorType: string;
  escrowBalance: number;
  user?: { email: string | null; isActive: boolean } | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  financialYear: string;
  totalAmount: number;
  advanceAmount?: number;
  tenureDays: number;
  status: string;
  ewayBillNo: string | null;
  irn: string | null;
  recourseType: string;
  disputeReason?: string | null;
  seller: { legalName: string; gstin: string; enachMandateId?: string | null };
  anchor: { corporateName: string };
}

interface EscrowTransaction {
  id: string;
  invoiceId: string;
  transactionType: string;
  amount: number;
  notes?: string | null;
  createdAt: string;
  invoice?: { invoiceNumber: string } | null;
}

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorRole?: string;
  actorId?: string | null;
  metadata?: string | null;
  timestamp: string;
}

interface AdminDashboardProps {
  adminEmail: string;
  initialSellers: Seller[];
  initialAnchors: Anchor[];
  initialInvestors: Investor[];
  initialInvoices: Invoice[];
  initialTransactions?: EscrowTransaction[];
  initialAuditLogs?: AuditLog[];
}

type TabType = "OVERVIEW" | "ANCHORS" | "INVESTORS" | "SELLERS" | "INVOICES" | "LEDGER" | "AUDIT";

const formatINR = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return "0";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(val);
};

export default function AdminDashboardClient({
  adminEmail,
  initialSellers,
  initialAnchors,
  initialInvestors,
  initialInvoices,
  initialTransactions = [],
  initialAuditLogs = [],
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("OVERVIEW");
  const [anchors, setAnchors] = useState<Anchor[]>(initialAnchors);
  const [investors, setInvestors] = useState<Investor[]>(initialInvestors);
  const [sellers, setSellers] = useState<Seller[]>(initialSellers);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [transactions, setTransactions] = useState<EscrowTransaction[]>(initialTransactions);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs);

  const [searchQuery, setSearchQuery] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState<"ALL" | "DISPUTED" | "FUNDED" | "SETTLED" | "PENDING">("ALL");

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Modals
  const [isAnchorModalOpen, setIsAnchorModalOpen] = useState(false);
  const [anchorForm, setAnchorForm] = useState({
    corporateName: "Reliance Retail Ltd",
    gstin: "27AAACR5532Q1ZP",
    creditRating: "AAA",
    maxExposureLimit: 100000000,
    email: "finance@relianceretail.com",
  });

  const [isInvestorModalOpen, setIsInvestorModalOpen] = useState(false);
  const [investorForm, setInvestorForm] = useState({
    entityName: "HDFC Credila NBFC",
    investorType: "NBFC",
    email: "treasury@hdfccredila.com",
    initialEscrow: 50000000,
  });

  const [editSellerModal, setEditSellerModal] = useState<Seller | null>(null);
  const [editSellerForm, setEditSellerForm] = useState({ creditLimit: 5000000, creditLimitStatus: "SANCTIONED", kycStatus: "VERIFIED" });

  const [editAnchorModal, setEditAnchorModal] = useState<Anchor | null>(null);
  const [editAnchorForm, setEditAnchorForm] = useState({ maxExposureLimit: 50000000, creditRating: "AAA" });

  const [anchorFilter, setAnchorFilter] = useState<"ALL" | "PENDING" | "ACTIVE">("ALL");
  const [reviewAnchorModal, setReviewAnchorModal] = useState<Anchor | null>(null);
  const [reviewAnchorForm, setReviewAnchorForm] = useState({ maxExposureLimit: 50000000, creditRating: "AAA" });

  const [topupInvestorModal, setTopupInvestorModal] = useState<Investor | null>(null);
  const [topupAmount, setTopupAmount] = useState<number>(10000000);

  const [recourseModalInvoice, setRecourseModalInvoice] = useState<Invoice | null>(null);

  const [generatedInvite, setGeneratedInvite] = useState<{
    type: string;
    email: string;
    inviteUrl: string;
  } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  };

  const handleLogout = async () => {
    try {
      await fetch("/admin/api/auth/logout", { method: "POST" });
      window.location.href = "/admin/login";
    } catch {
      window.location.href = "/admin/login";
    }
  };

  // 1. Provision Anchor
  const handleProvisionAnchor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction("provision-anchor");
    try {
      const res = await fetch("/admin/api/entities/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ANCHOR",
          email: anchorForm.email.trim(),
          entityData: {
            corporateName: anchorForm.corporateName.trim(),
            gstin: anchorForm.gstin.trim(),
            creditRating: anchorForm.creditRating,
            maxExposureLimit: Number(anchorForm.maxExposureLimit),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Provisioning failed.");

      showToast("success", `Anchor ${anchorForm.corporateName} provisioned!`);
      setIsAnchorModalOpen(false);
      setGeneratedInvite({
        type: "Corporate Anchor",
        email: anchorForm.email,
        inviteUrl: data.inviteUrl,
      });

      setAnchors((prev) => [
        {
          id: data.entityId,
          corporateName: anchorForm.corporateName,
          gstin: anchorForm.gstin,
          creditRating: anchorForm.creditRating,
          maxExposureLimit: Number(anchorForm.maxExposureLimit),
          currentExposure: 0,
          user: { email: anchorForm.email, isActive: false },
        },
        ...prev,
      ]);
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 2. Provision Investor
  const handleProvisionInvestor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction("provision-investor");
    try {
      const res = await fetch("/admin/api/entities/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "INVESTOR",
          email: investorForm.email.trim(),
          entityData: {
            entityName: investorForm.entityName.trim(),
            investorType: investorForm.investorType,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Provisioning failed.");

      showToast("success", `Investor ${investorForm.entityName} provisioned!`);
      setIsInvestorModalOpen(false);
      setGeneratedInvite({
        type: "Institutional Investor",
        email: investorForm.email,
        inviteUrl: data.inviteUrl,
      });

      setInvestors((prev) => [
        {
          id: data.entityId,
          entityName: investorForm.entityName,
          investorType: investorForm.investorType,
          escrowBalance: investorForm.initialEscrow,
          user: { email: investorForm.email, isActive: false },
        },
        ...prev,
      ]);
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 3. Edit Seller Facility Limit & KYC
  const handleUpdateSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSellerModal) return;
    setLoadingAction("update-seller");
    try {
      const res = await fetch(`/admin/api/sellers/${editSellerModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editSellerForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Update failed.");

      showToast("success", `Seller ${editSellerModal.legalName} facility updated.`);
      setSellers((prev) =>
        prev.map((s) => (s.id === editSellerModal.id ? { ...s, ...editSellerForm } : s))
      );
      setEditSellerModal(null);
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 4. Edit Anchor Exposure
  const handleUpdateAnchor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAnchorModal) return;
    setLoadingAction("update-anchor");
    try {
      const res = await fetch(`/admin/api/anchors/${editAnchorModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editAnchorForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Update failed.");

      showToast("success", `Anchor ${editAnchorModal.corporateName} exposure limit updated.`);
      setAnchors((prev) =>
        prev.map((a) => (a.id === editAnchorModal.id ? { ...a, ...editAnchorForm } : a))
      );
      setEditAnchorModal(null);
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 4b. Approve / Sanction Pending Anchor Application
  const handleApproveAnchor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewAnchorModal) return;
    setLoadingAction("approve-anchor");
    try {
      const res = await fetch(`/admin/api/anchors/${reviewAnchorModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "ACTIVE",
          maxExposureLimit: Number(reviewAnchorForm.maxExposureLimit),
          creditRating: reviewAnchorForm.creditRating,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Approval failed.");

      showToast("success", `Anchor ${reviewAnchorModal.corporateName} approved and limit sanctioned!`);
      setAnchors((prev) =>
        prev.map((a) => (a.id === reviewAnchorModal.id ? data.anchor : a))
      );
      if (data.inviteUrl) {
        setGeneratedInvite({
          type: "Approved Corporate Anchor",
          email: reviewAnchorModal.contactEmail || "Corporate Treasury",
          inviteUrl: data.inviteUrl,
        });
      }
      setReviewAnchorModal(null);
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 4c. Reject Anchor Application
  const handleRejectAnchor = async (anchor: Anchor) => {
    if (!confirm(`Are you sure you want to reject the application for ${anchor.corporateName}?`)) return;
    setLoadingAction(`reject-${anchor.id}`);
    try {
      const res = await fetch(`/admin/api/anchors/${anchor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Rejection failed.");

      showToast("success", `Anchor application for ${anchor.corporateName} marked as Rejected.`);
      setAnchors((prev) =>
        prev.map((a) => (a.id === anchor.id ? { ...a, status: "REJECTED" } : a))
      );
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 5. Topup Investor Escrow
  const handleTopupInvestor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topupInvestorModal) return;
    setLoadingAction("topup-investor");
    try {
      const res = await fetch(`/admin/api/investors/${topupInvestorModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addAmount: Number(topupAmount) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Topup failed.");

      showToast("success", `Added ₹${Number(topupAmount).toLocaleString()} to ${topupInvestorModal.entityName} Escrow.`);
      setInvestors((prev) =>
        prev.map((inv) =>
          inv.id === topupInvestorModal.id ? { ...inv, escrowBalance: data.investor.escrowBalance } : inv
        )
      );
      setTopupInvestorModal(null);
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 6. Execute e-NACH Recourse on Disputed Invoice
  const handleExecuteRecourse = async () => {
    if (!recourseModalInvoice) return;
    setLoadingAction("execute-recourse");
    try {
      const res = await fetch(`/admin/api/invoices/${recourseModalInvoice.id}/recourse`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Recourse execution failed.");

      showToast("success", data.message);
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === recourseModalInvoice.id ? { ...inv, status: "SETTLED" } : inv))
      );
      if (data.transaction) {
        setTransactions((prev) => [data.transaction, ...prev]);
      }
      setRecourseModalInvoice(null);
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // Metrics
  const totalFactored = invoices.reduce((acc, inv) => acc + (inv.status !== "REJECTED" ? inv.totalAmount : 0), 0);
  const totalEscrowPool = investors.reduce((acc, inv) => acc + inv.escrowBalance, 0);
  const disputedInvoices = invoices.filter((inv) => inv.status === "DISPUTED");

  // Filtering
  const filteredInvoices = invoices.filter((inv) => {
    const matchesQuery =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.seller.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.anchor.corporateName.toLowerCase().includes(searchQuery.toLowerCase());
    if (invoiceFilter === "DISPUTED") return matchesQuery && inv.status === "DISPUTED";
    if (invoiceFilter === "FUNDED") return matchesQuery && inv.status === "FUNDED";
    if (invoiceFilter === "SETTLED") return matchesQuery && inv.status === "SETTLED";
    if (invoiceFilter === "PENDING") return matchesQuery && (inv.status === "PENDING_VERIFICATION" || inv.status === "VERIFIED");
    return matchesQuery;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Admin Bar */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-slate-900 via-indigo-900 to-indigo-700 flex items-center justify-center font-black text-white text-base tracking-tight shadow-sm">
              AD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-slate-900">UdharCo Platform Admin</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  ROOT OPERATIONS
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Central Factoring Orchestration & Escrow Clearing House
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center gap-3 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                DB Live
              </span>
              <span className="flex items-center gap-1.5 text-sky-700">
                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                CERSAI Sync
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700">
              <span>{adminEmail}</span>
            </div>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <div className="bg-white border-b border-slate-200 relative z-10 px-6 overflow-x-auto shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center space-x-1.5 py-2.5">
          {[
            { id: "OVERVIEW", label: "Dashboard Overview", icon: TrendingUp },
            { id: "ANCHORS", label: `Corporate Anchors (${anchors.length})`, icon: Building2 },
            { id: "INVESTORS", label: `Investors / NBFCs (${investors.length})`, icon: Wallet },
            { id: "SELLERS", label: `MSME Sellers (${sellers.length})`, icon: Users },
            { id: "INVOICES", label: `Invoices (${invoices.length})`, icon: FileText, badge: disputedInvoices.length > 0 ? `${disputedInvoices.length} Dispute` : undefined },
            { id: "LEDGER", label: `Escrow Ledger (${transactions.length})`, icon: Landmark },
            { id: "AUDIT", label: `Audit Trail (${auditLogs.length})`, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 relative z-10 space-y-6">
        {/* Toast Alert */}
        {toast && (
          <div
            className={`p-4 rounded-xl border text-xs flex items-center justify-between shadow-lg ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                : "bg-red-50 border-red-300 text-red-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
              <span className="font-semibold">{toast.msg}</span>
            </div>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>
        )}

        {/* Invite Token Banner Modal */}
        {generatedInvite && (
          <div className="p-5 rounded-2xl bg-indigo-50 border border-indigo-200 shadow-sm relative">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block mb-1">
                  New Entity Provisioned Successfully
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Activation Token Generated for {generatedInvite.type} ({generatedInvite.email})
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Share this secure activation link with the corporate treasury/finance team:
                </p>
              </div>
              <button onClick={() => setGeneratedInvite(null)} className="text-slate-400 hover:text-slate-700 text-sm">✕</button>
            </div>

            <div className="mt-3 flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-300">
              <input
                type="text"
                readOnly
                value={generatedInvite.inviteUrl}
                className="bg-transparent text-xs text-slate-800 font-mono flex-1 outline-none px-2 font-medium"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedInvite.inviteUrl);
                  showToast("success", "Activation link copied to clipboard!");
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            TAB 1: OVERVIEW DASHBOARD
            ───────────────────────────────────────────────────────────────── */}
        {activeTab === "OVERVIEW" && (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Total Factored Volume</span>
                <div suppressHydrationWarning className="text-2xl font-black text-slate-900 font-mono">₹{formatINR(totalFactored)}</div>
                <span className="text-[11px] text-emerald-700 font-medium mt-1 block">Active Invoices across anchors</span>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Investor Escrow Liquidity</span>
                <div suppressHydrationWarning className="text-2xl font-black text-indigo-700 font-mono">₹{formatINR(totalEscrowPool)}</div>
                <span className="text-[11px] text-slate-500 mt-1 block">In Regulated Virtual Escrows</span>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Corporate Anchors</span>
                <div className="text-2xl font-black text-slate-900">{anchors.length} Corporates</div>
                <span className="text-[11px] text-slate-500 mt-1 block">Bilateral Factoring Lines Active</span>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Disputes / Recourse</span>
                <div className={`text-2xl font-black font-mono ${disputedInvoices.length > 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {disputedInvoices.length} Invoices
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {disputedInvoices.length > 0 ? "Requires e-NACH Clawback" : "Zero defaults currently"}
                </span>
              </div>
            </div>

            {/* Pending Corporate Applications Alert */}
            {anchors.filter((a) => a.status === "PENDING").length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {anchors.filter((a) => a.status === "PENDING").length} Corporate Application(s) Pending Underwriting
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      New enterprise buyers applied with verified GSTIN. Review and assign credit exposure limit.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setAnchorFilter("PENDING");
                    setActiveTab("ANCHORS");
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 transition cursor-pointer"
                >
                  Review Applications
                </button>
              </div>
            )}

            {/* Quick Actions & Protocol Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Provision Anchor Card */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="h-10 w-10 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center mb-3">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">Provision Corporate Anchor</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Onboard enterprise buyers (Tata Motors, Reliance, etc.) post bilateral agreement.
                  </p>
                </div>
                <button
                  onClick={() => setIsAnchorModalOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Provision Anchor</span>
                </button>
              </div>

              {/* Provision Investor Card */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center mb-3">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">Onboard Regulated Investor</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Provision NBFC or Bank treasury accounts with virtual escrow allocations.
                  </p>
                </div>
                <button
                  onClick={() => setIsInvestorModalOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Onboard Investor</span>
                </button>
              </div>

              {/* CERSAI & Factoring Compliance Card */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mb-3">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">Legal & Regulatory Engine</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Factoring Regulation Act 2011 • Section 2(j) Recourse • NPCI e-Mandate Engine Active.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("AUDIT")}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <History className="w-4 h-4" />
                  <span>View System Audit Trail</span>
                </button>
              </div>
            </div>
          </div>
        )}


        {/* ─────────────────────────────────────────────────────────────────
            TAB 2: CORPORATE ANCHORS
            ───────────────────────────────────────────────────────────────── */}
        {activeTab === "ANCHORS" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Corporate Anchors & Factoring Facilities</h3>
                <p className="text-xs text-slate-500">
                  Manage self-service applications, sanction credit lines, and govern bilateral exposure under FRA 2011.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/corporate/apply`;
                    navigator.clipboard.writeText(url);
                    showToast("success", "Public Application Link copied to clipboard!");
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  title="Share this link with corporate buyers to let them self-apply"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Copy Apply Link</span>
                </button>

                <button
                  onClick={() => setIsAnchorModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Manual Provision</span>
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                onClick={() => setAnchorFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  anchorFilter === "ALL"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                All Anchors ({anchors.length})
              </button>

              <button
                onClick={() => setAnchorFilter("PENDING")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  anchorFilter === "PENDING"
                    ? "bg-amber-100 text-amber-900 border border-amber-300 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <span>Pending Review</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  anchors.filter((a) => a.status === "PENDING").length > 0 ? "bg-amber-600 text-white font-bold" : "bg-slate-200 text-slate-600"
                }`}>
                  {anchors.filter((a) => a.status === "PENDING").length}
                </span>
              </button>

              <button
                onClick={() => setAnchorFilter("ACTIVE")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  anchorFilter === "ACTIVE"
                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Active Sanctioned ({anchors.filter((a) => a.status !== "PENDING" && a.status !== "REJECTED").length})
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Corporate Entity & Contact</th>
                    <th className="p-4">GSTIN</th>
                    <th className="p-4">Credit Rating</th>
                    <th className="p-4">Sanctioned Limit</th>
                    <th className="p-4">Current Exposure</th>
                    <th className="p-4">Facility Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {anchors
                    .filter((a) => {
                      if (anchorFilter === "PENDING") return a.status === "PENDING";
                      if (anchorFilter === "ACTIVE") return a.status !== "PENDING" && a.status !== "REJECTED";
                      return true;
                    })
                    .map((a) => (
                      <tr key={a.id} className={`hover:bg-slate-50 transition ${a.status === "PENDING" ? "bg-amber-50/50" : ""}`}>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{a.corporateName}</span>
                            {a.sourceChannel === "VENDOR_PUSH" ? (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Channel 1: Vendor Push (High Scrutiny)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Channel 2: Enterprise Sales (Verified)
                              </span>
                            )}
                          </div>
                          {a.contactPerson ? (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {a.contactPerson} • <span className="font-mono text-indigo-700">{a.contactEmail}</span>
                            </div>
                          ) : (
                            a.user?.email && (
                              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">{a.user.email}</div>
                            )
                          )}
                        </td>
                        <td className="p-4 font-mono font-medium text-slate-800">{a.gstin}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-mono font-bold text-[11px]">
                            {a.creditRating}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-900">
                          ₹{a.maxExposureLimit.toLocaleString()}
                        </td>
                        <td className="p-4 font-mono font-medium text-slate-700">₹{a.currentExposure.toLocaleString()}</td>
                        <td className="p-4">
                          {a.status === "PENDING" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 w-max">
                              <Clock className="w-3 h-3" />
                              <span>PENDING SANCTION</span>
                            </span>
                          ) : a.status === "REJECTED" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                              REJECTED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              ACTIVE SANCTIONED
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {a.status === "PENDING" ? (
                              <>
                                <button
                                  onClick={() => {
                                    setReviewAnchorModal(a);
                                    setReviewAnchorForm({
                                      maxExposureLimit: a.annualProcurement ? Math.round(a.annualProcurement * 0.2) : 50000000,
                                      creditRating: a.creditRating && a.creditRating !== "UNRATED" ? a.creditRating : "AAA",
                                    });
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                                >
                                  Review & Sanction
                                </button>
                                <button
                                  onClick={() => handleRejectAnchor(a)}
                                  disabled={loadingAction === `reject-${a.id}`}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-xs text-slate-600 transition cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditAnchorModal(a);
                                    setEditAnchorForm({ maxExposureLimit: a.maxExposureLimit, creditRating: a.creditRating });
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
                                >
                                  Edit Limit
                                </button>

                                {a.user?.inviteToken && (
                                  <button
                                    onClick={() => {
                                      const url = `${window.location.origin}/login?invite=${a.user?.inviteToken}`;
                                      navigator.clipboard.writeText(url);
                                      showToast("success", `Invite link for ${a.corporateName} copied!`);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold transition cursor-pointer"
                                    title="Copy Activation Link"
                                  >
                                    Copy Invite
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {anchors.filter((a) => {
                if (anchorFilter === "PENDING") return a.status === "PENDING";
                if (anchorFilter === "ACTIVE") return a.status !== "PENDING" && a.status !== "REJECTED";
                return true;
              }).length === 0 && (
                <div className="p-8 text-center text-xs text-slate-500">
                  No anchors found matching the selected filter.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            TAB 3: INVESTORS / NBFCS
            ───────────────────────────────────────────────────────────────── */}
        {activeTab === "INVESTORS" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Institutional Investors & NBFCs</h3>
                <p className="text-xs text-slate-500">Regulated lenders funding invoices and earning factoring yields.</p>
              </div>
              <button
                onClick={() => setIsInvestorModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Onboard New Investor</span>
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Investor / Entity Name</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Escrow Pool Balance</th>
                    <th className="p-4">Login Email</th>
                    <th className="p-4">Portal Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {investors.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-bold text-slate-900">{inv.entityName}</td>
                      <td className="p-4 font-mono font-medium text-slate-700">{inv.investorType}</td>
                      <td className="p-4 font-mono text-purple-700 font-bold">₹{inv.escrowBalance.toLocaleString()}</td>
                      <td className="p-4 font-mono text-slate-500">{inv.user?.email || "Not linked"}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          inv.user?.isActive ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}>
                          {inv.user?.isActive ? "ACTIVE PORTAL" : "PENDING INVITE"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            setTopupInvestorModal(inv);
                            setTopupAmount(10000000);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-semibold text-xs transition cursor-pointer"
                        >
                          + Top Up Escrow
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            TAB 4: MSME SELLERS
            ───────────────────────────────────────────────────────────────── */}
        {activeTab === "SELLERS" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Registered MSME Sellers</h3>
                <p className="text-xs text-slate-500">Verified MSMEs with GSTIN, Penny Drop bank accounts, and e-NACH mandates.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Legal Business Name</th>
                    <th className="p-4">GSTIN & PAN</th>
                    <th className="p-4">Payout Account</th>
                    <th className="p-4">e-NACH Mandate</th>
                    <th className="p-4">Sanctioned Limit</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {sellers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-bold text-slate-900">{s.legalName}</td>
                      <td className="p-4 font-mono text-slate-600">
                        <div className="font-semibold text-slate-800">{s.gstin}</div>
                        <div className="text-[10px] text-slate-500">PAN: {s.pan}</div>
                      </td>
                      <td className="p-4 font-mono text-slate-600">
                        <div className="text-slate-800 font-medium">{s.bankAccountNo}</div>
                        <div className="text-[10px] text-slate-500">{s.bankIfsc}</div>
                      </td>
                      <td className="p-4 font-mono">
                        <span className="text-emerald-700 font-medium">{s.enachMandateId || "MND-NPCI-882910"}</span>
                        <div className="text-[10px] text-slate-500">{s.enachMandateStatus}</div>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-900">₹{s.creditLimit.toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          s.creditLimitStatus === "SANCTIONED" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
                        }`}>
                          {s.creditLimitStatus}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            setEditSellerModal(s);
                            setEditSellerForm({ creditLimit: s.creditLimit, creditLimitStatus: s.creditLimitStatus, kycStatus: s.kycStatus });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
                        >
                          Manage Limit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            TAB 5: INVOICES & DISPUTE RECOURSE
            ───────────────────────────────────────────────────────────────── */}
        {activeTab === "INVOICES" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Central Invoice & Dispute Ledger</h3>
                <p className="text-xs text-slate-500">Monitor invoice lifecycles, IRN checks, and execute e-NACH recourse on disputed bills.</p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search invoice or party..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 outline-none shadow-xs"
                />
                <select
                  value={invoiceFilter}
                  onChange={(e: any) => setInvoiceFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 outline-none shadow-xs font-medium"
                >
                  <option value="ALL">All Invoices</option>
                  <option value="DISPUTED">Disputed Invoices (Recourse)</option>
                  <option value="FUNDED">Funded</option>
                  <option value="SETTLED">Settled</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Invoice No</th>
                    <th className="p-4">MSME Seller</th>
                    <th className="p-4">Corporate Anchor</th>
                    <th className="p-4">Bill Amount</th>
                    <th className="p-4">Tenure</th>
                    <th className="p-4">Status & Details</th>
                    <th className="p-4 text-right">Recourse Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                      <td className="p-4 font-medium text-slate-800">{inv.seller.legalName}</td>
                      <td className="p-4 text-indigo-700 font-semibold">{inv.anchor.corporateName}</td>
                      <td className="p-4 font-mono font-bold text-slate-900">₹{inv.totalAmount.toLocaleString()}</td>
                      <td className="p-4 font-mono text-slate-600">{inv.tenureDays} Days</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === "DISPUTED"
                            ? "bg-rose-50 text-rose-800 border border-rose-200"
                            : inv.status === "SETTLED"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : inv.status === "FUNDED"
                            ? "bg-sky-50 text-sky-800 border border-sky-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}>
                          {inv.status}
                        </span>
                        {inv.disputeReason && (
                          <div className="text-[10px] text-rose-700 font-medium mt-1 truncate max-w-xs">{inv.disputeReason}</div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {inv.status === "DISPUTED" && (
                          <button
                            onClick={() => setRecourseModalInvoice(inv)}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 ml-auto shadow-xs transition cursor-pointer"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Trigger e-NACH</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            TAB 6: ESCROW LEDGER
            ───────────────────────────────────────────────────────────────── */}
        {activeTab === "LEDGER" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Escrow Clearing House Ledger</h3>
              <p className="text-xs text-slate-500">Immutable ledger of disbursements, buyer settlements, and recourse recoveries.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Transaction Type</th>
                    <th className="p-4">Invoice Ref</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Audit Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-mono text-slate-600">{new Date(t.createdAt).toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          t.transactionType === "RECOURSE_RECOVERY"
                            ? "bg-rose-50 text-rose-800 border border-rose-200"
                            : t.transactionType === "BUYER_SETTLEMENT"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-sky-50 text-sky-800 border border-sky-200"
                        }`}>
                          {t.transactionType}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-900">{t.invoice?.invoiceNumber || "PLATFORM"}</td>
                      <td className="p-4 font-mono font-bold text-slate-900">₹{t.amount.toLocaleString()}</td>
                      <td className="p-4 text-slate-600 text-[11px] max-w-md">{t.notes || "Escrow Automated Clearing"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            TAB 7: AUDIT TRAIL
            ───────────────────────────────────────────────────────────────── */}
        {activeTab === "AUDIT" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">System Audit Log & CERSAI Events</h3>
              <p className="text-xs text-slate-500">Cryptographically verifiable immutable audit trail of all platform operations.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Entity Type</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Entity ID</th>
                    <th className="p-4">Log Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-mono text-slate-600">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="p-4 font-mono text-indigo-700 font-semibold">{log.entityType}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-mono text-[10px] font-semibold">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-[10px] text-slate-500">{log.entityId}</td>
                      <td className="p-4 font-mono text-[11px] text-slate-600 max-w-lg truncate">
                        {log.metadata || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            MODALS
            ───────────────────────────────────────────────────────────────── */}

        {/* 1. Provision Anchor Modal */}
        {isAnchorModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Provision Corporate Anchor</h3>
              <form onSubmit={handleProvisionAnchor} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Corporate Name</label>
                  <input
                    type="text"
                    required
                    value={anchorForm.corporateName}
                    onChange={(e) => setAnchorForm({ ...anchorForm, corporateName: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">GSTIN</label>
                  <input
                    type="text"
                    required
                    value={anchorForm.gstin}
                    onChange={(e) => setAnchorForm({ ...anchorForm, gstin: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono outline-none focus:bg-white focus:border-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Authorized Treasury Email</label>
                  <input
                    type="email"
                    required
                    value={anchorForm.email}
                    onChange={(e) => setAnchorForm({ ...anchorForm, email: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Sanctioned Max Exposure Limit (₹)</label>
                  <input
                    type="number"
                    required
                    value={anchorForm.maxExposureLimit}
                    onChange={(e) => setAnchorForm({ ...anchorForm, maxExposureLimit: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono outline-none focus:bg-white focus:border-indigo-500 font-medium"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAnchorModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loadingAction === "provision-anchor"}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition cursor-pointer shadow-xs"
                  >
                    {loadingAction === "provision-anchor" ? "Generating..." : "Generate Invite Token"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 2. Provision Investor Modal */}
        {isInvestorModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Onboard Regulated Investor / NBFC</h3>
              <form onSubmit={handleProvisionInvestor} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Entity Name</label>
                  <input
                    type="text"
                    required
                    value={investorForm.entityName}
                    onChange={(e) => setInvestorForm({ ...investorForm, entityName: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Authorized Treasury Email</label>
                  <input
                    type="email"
                    required
                    value={investorForm.email}
                    onChange={(e) => setInvestorForm({ ...investorForm, email: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Entity Type</label>
                  <select
                    value={investorForm.investorType}
                    onChange={(e) => setInvestorForm({ ...investorForm, investorType: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 font-medium"
                  >
                    <option value="NBFC">RBI Regulated NBFC</option>
                    <option value="BANK">Scheduled Commercial Bank</option>
                    <option value="AIF">Alternative Investment Fund (AIF)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Initial Escrow Allocation (₹)</label>
                  <input
                    type="number"
                    required
                    value={investorForm.initialEscrow}
                    onChange={(e) => setInvestorForm({ ...investorForm, initialEscrow: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono outline-none focus:bg-white focus:border-indigo-500 font-medium"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInvestorModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loadingAction === "provision-investor"}
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition cursor-pointer shadow-xs"
                  >
                    {loadingAction === "provision-investor" ? "Generating..." : "Generate Invite Token"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 3. Manage Seller Limit Modal */}
        {editSellerModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Manage Seller Facility: {editSellerModal.legalName}</h3>
              <form onSubmit={handleUpdateSeller} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Sanctioned Limit (₹)</label>
                  <input
                    type="number"
                    required
                    value={editSellerForm.creditLimit}
                    onChange={(e) => setEditSellerForm({ ...editSellerForm, creditLimit: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono outline-none focus:bg-white focus:border-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Facility Status</label>
                  <select
                    value={editSellerForm.creditLimitStatus}
                    onChange={(e) => setEditSellerForm({ ...editSellerForm, creditLimitStatus: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 font-medium"
                  >
                    <option value="SANCTIONED">SANCTIONED (Active for Factoring)</option>
                    <option value="UNDER_REVIEW">UNDER_REVIEW (Hold Disbursals)</option>
                    <option value="SUSPENDED">SUSPENDED (Frozen)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">KYC Status</label>
                  <select
                    value={editSellerForm.kycStatus}
                    onChange={(e) => setEditSellerForm({ ...editSellerForm, kycStatus: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 outline-none focus:bg-white focus:border-indigo-500 font-medium"
                  >
                    <option value="VERIFIED">VERIFIED</option>
                    <option value="PENDING">PENDING</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditSellerModal(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loadingAction === "update-seller"}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition cursor-pointer shadow-xs"
                  >
                    {loadingAction === "update-seller" ? "Saving..." : "Save Facility Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 4. Topup Investor Escrow Modal */}
        {topupInvestorModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Topup Virtual Escrow: {topupInvestorModal.entityName}</h3>
              <p className="text-xs text-slate-600">
                Current Balance: <span className="text-slate-900 font-mono font-bold">₹{topupInvestorModal.escrowBalance.toLocaleString()}</span>
              </p>
              <form onSubmit={handleTopupInvestor} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Additional Escrow Capital (₹)</label>
                  <input
                    type="number"
                    required
                    min={100000}
                    step={100000}
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono outline-none focus:bg-white focus:border-indigo-500 font-medium"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTopupInvestorModal(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loadingAction === "topup-investor"}
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition cursor-pointer shadow-xs"
                  >
                    {loadingAction === "topup-investor" ? "Crediting..." : "Credit Escrow Pool"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 5. e-NACH Recourse Execution Modal */}
        {recourseModalInvoice && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white border border-rose-200 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2.5 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-lg font-bold text-slate-900">Execute NPCI e-NACH Recourse</h3>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice Ref:</span>
                  <span className="font-mono text-slate-900 font-bold">{recourseModalInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Seller Entity:</span>
                  <span className="text-slate-900 font-medium">{recourseModalInvoice.seller.legalName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">e-NACH Mandate:</span>
                  <span className="font-mono text-emerald-700 font-semibold">{recourseModalInvoice.seller.enachMandateId || "MND-NPCI-882910"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Recovery Amount:</span>
                  <span className="font-mono text-rose-700 font-bold">
                    ₹{(recourseModalInvoice.advanceAmount || Math.round(recourseModalInvoice.totalAmount * 0.84)).toLocaleString()}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Under Section 2(j) of the Factoring Regulation Act 2011, this executes an automated auto-debit against the MSME&apos;s verified bank account to recover outstanding investor principal.
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRecourseModalInvoice(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteRecourse}
                  disabled={loadingAction === "execute-recourse"}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                >
                  {loadingAction === "execute-recourse" ? "Executing..." : "Confirm & Execute Recourse"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. Review & Sanction Anchor Modal */}
        {reviewAnchorModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2.5 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="text-lg font-bold text-slate-900">Review & Sanction Factoring Facility</h3>
              </div>

              {/* Applicant Profile Summary */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2 text-slate-700">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">Corporate Entity:</span>
                  <span className="text-slate-900 font-bold">{reviewAnchorModal.corporateName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">GSTIN:</span>
                  <span className="font-mono text-indigo-700 font-semibold">{reviewAnchorModal.gstin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Authorized Treasury Contact:</span>
                  <span className="text-slate-900 font-medium">
                    {reviewAnchorModal.contactPerson || "Officer"} ({reviewAnchorModal.contactEmail || "N/A"})
                  </span>
                </div>
                {reviewAnchorModal.contactPhone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Official Mobile:</span>
                    <span className="font-mono text-slate-800">{reviewAnchorModal.contactPhone}</span>
                  </div>
                )}
                {reviewAnchorModal.annualProcurement ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Annual MSME Procurement:</span>
                    <span className="font-mono text-purple-700 font-bold">
                      ₹{reviewAnchorModal.annualProcurement.toLocaleString()} (₹{(reviewAnchorModal.annualProcurement / 10000000).toFixed(2)} Cr)
                    </span>
                  </div>
                ) : null}
              </div>

              <form onSubmit={handleApproveAnchor} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Verified Credit Rating</label>
                  <select
                    value={reviewAnchorForm.creditRating}
                    onChange={(e) => setReviewAnchorForm({ ...reviewAnchorForm, creditRating: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono outline-none focus:bg-white focus:border-emerald-500 font-medium"
                  >
                    <option value="AAA">CRISIL / ICRA AAA (Prime High Grade)</option>
                    <option value="AA+">CRISIL / ICRA AA+ (High Grade)</option>
                    <option value="AA">CRISIL / ICRA AA (Quality)</option>
                    <option value="A">CRISIL / ICRA A (Upper Medium)</option>
                    <option value="BBB">CRISIL / ICRA BBB (Investment Grade)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">
                    Approved Max Bilateral Exposure Limit (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min={1000000}
                    step={1000000}
                    value={reviewAnchorForm.maxExposureLimit}
                    onChange={(e) => setReviewAnchorForm({ ...reviewAnchorForm, maxExposureLimit: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono outline-none focus:bg-white focus:border-emerald-500 font-medium"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Sanctioned Line: ₹{(reviewAnchorForm.maxExposureLimit / 10000000).toFixed(2)} Crores
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Approving this application transitions status to <strong>ACTIVE</strong> and generates a secure activation token dispatchable to the corporate treasury officer.
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReviewAnchorModal(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loadingAction === "approve-anchor"}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition cursor-pointer shadow-xs"
                  >
                    {loadingAction === "approve-anchor" ? "Sanctioning & Generating..." : "Sanction & Approve"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
