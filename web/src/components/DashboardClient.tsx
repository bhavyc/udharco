"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Building2,
  Wallet,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FileText,
  PlusCircle,
  RefreshCw,
  Coins,
  Receipt,
  XCircle,
  Sparkles,
  Layers,
  ChevronRight,
  UploadCloud,
  FileCheck,
  Paperclip,
  QrCode,
  Truck,
  Check,
  FileUp,
  UserCheck,
  Eye,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

interface Seller {
  id: string;
  legalName: string;
  gstin: string;
  bankAccountNo: string;
  bankIfsc: string;
  enachMandateId?: string;
  enachMandateStatus?: string;
  creditLimit?: number;
  creditLimitStatus?: string;
}

interface Anchor {
  id: string;
  corporateName: string;
  gstin: string;
  creditRating: string;
  maxExposureLimit: number;
  currentExposure: number;
  status?: string;
}

interface Investor {
  id: string;
  entityName: string;
  investorType: string;
  escrowBalance: number;
}

interface EscrowTx {
  id: string;
  transactionType: string;
  amount: number;
  notes: string | null;
  createdAt: string;
}

interface SettlementRecord {
  id: string;
  totalReceived: number;
  investorPrincipalPaid: number;
  investorInterestPaid: number;
  platformFeeDeducted: number;
  sellerMarginReturned: number;
  shortfallAmount: number;
  recourseTriggered: boolean;
  settledAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  financialYear: string;
  totalAmount: number;
  tenureDays: number;
  marginHoldPct: number;
  marginHeldAmount: number;
  upfrontDisbursedAmount: number;
  platformFeePct: number;
  discountRatePa: number;
  recourseType: string;
  status: string;
  poNumber: string | null;
  ewayBillNo: string | null;
  invoiceDocumentUrl?: string | null;
  invoiceDocumentName?: string | null;
  pricingModel?: string;
  irn?: string;
  irnVerified?: boolean;
  cersaiSecurityId?: string;
  cersaiStatus?: string;
  noaSentAt?: string;
  anchorReminderCount?: number;
  lastReminderSentAt?: string;
  invoiceHash: string;
  seller: Seller;
  anchor: Anchor;
  escrowTransactions?: EscrowTx[];
  settlementRecord?: SettlementRecord | null;
  createdAt: string;
}

export interface CurrentUser {
  userId: string;
  role: "SELLER" | "ANCHOR" | "INVESTOR";
  entityId: string;
  email?: string;
  mobile?: string;
  entityName?: string;
}

interface Props {
  currentUser?: CurrentUser;
  initialSellers: Seller[];
  initialAnchors: Anchor[];
  initialInvestors: Investor[];
  initialInvoices: Invoice[];
}

const formatINR = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return "0";
  return Math.round(val).toLocaleString("en-IN");
};

export default function DashboardClient({
  currentUser,
  initialSellers,
  initialAnchors,
  initialInvestors,
  initialInvoices,
}: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [sellers] = useState<Seller[]>(initialSellers);
  const [anchors, setAnchors] = useState<Anchor[]>(initialAnchors);
  const [investors, setInvestors] = useState<Investor[]>(initialInvestors);

  const [filter, setFilter] = useState<string>("ALL");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    size: string;
    dataUrl?: string;
  } | null>(null);

  const [uploadForm, setUploadForm] = useState({
    invoiceNumber: "",
    sellerId: currentUser?.role === "SELLER" ? currentUser.entityId : initialSellers[0]?.id || "",
    anchorId: initialAnchors[0]?.id || "",
    totalAmount: 0,
    tenureDays: 90,
    poNumber: "",
    ewayBillNo: "",
    irn: "",
    pricingModel: "NET_DISBURSED",
    recourseType: "RECOURSE",
    financialYear: "",
  });

  const generateCompliantIRN = async () => {
    try {
      const selectedSeller = sellers.find((s) => s.id === uploadForm.sellerId);
      const selectedAnchor = anchors.find((a) => a.id === uploadForm.anchorId);
      const res = await fetch("/api/v1/invoices/generate-irn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerGstin: selectedSeller?.gstin,
          buyerGstin: selectedAnchor?.gstin,
          invoiceNumber: uploadForm.invoiceNumber,
          financialYear: uploadForm.financialYear,
        }),
      });
      const data = await res.json();
      if (data.success && data.irn) {
        setUploadForm((prev) => ({ ...prev, irn: data.irn }));
      }
    } catch (e) {
      console.error("IRN fetch failed:", e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeStr = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`;
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFile({
          name: file.name,
          size: sizeStr,
          dataUrl: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Settle Modal State
  const [settleInvoice, setSettleInvoice] = useState<Invoice | null>(null);
  const [repaymentType, setRepaymentType] = useState<"FULL" | "PARTIAL" | "DEFAULT">("FULL");
  const [partialAmount, setPartialAmount] = useState<number>(0);

  // Phase 4: Seller Offer Review & Aadhaar e-Sign Modal State
  const [esignInvoice, setEsignInvoice] = useState<Invoice | null>(null);
  const [aadhaarOtp, setAadhaarOtp] = useState<string>("");
  const [isAgreedTerms, setIsAgreedTerms] = useState<boolean>(false);

  // Audit Modal State
  const [auditInvoice, setAuditInvoice] = useState<Invoice | null>(null);

  const refreshInvoices = async () => {
    try {
      const res = await fetch("/api/v1/invoices");
      const data = await res.json();
      if (data.data) {
        setInvoices(data.data);
      }
    } catch (e) {
      console.error("Refresh failed:", e);
    }
  };

  const showToast = (type: "success" | "error" | "info", msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 6000);
  };

  // 1. Submit Invoice
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.totalAmount || uploadForm.totalAmount <= 0) {
      showToast("error", "Please enter a valid invoice bill amount.");
      return;
    }
    if (isUploadAmountExceeded) {
      showToast("error", `Invoice amount exceeds maximum allowed credit line of ₹${formatINR(effectiveMaxLimit)}.`);
      return;
    }
    if (!attachedFile) {
      showToast("error", "Please upload a Tax Invoice document (PDF/Image) as proof.");
      return;
    }
    if (!uploadForm.irn || uploadForm.irn.length !== 64) {
      showToast("error", "A valid 64-character GSTN IRN hash is required for anti-fraud shield.");
      return;
    }

    setLoadingAction("upload");
    try {
      const payload = {
        ...uploadForm,
        invoiceDocumentName: attachedFile.name,
        invoiceDocumentUrl: attachedFile.dataUrl || `local-upload://${attachedFile.name}`,
      };
      const res = await fetch("/api/v1/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.message || data.error || "Invoice submission failed.");
      } else {
        showToast("success", `Invoice #${uploadForm.invoiceNumber} uploaded with IRN shield & attached document.`);
        setIsUploadOpen(false);
        setUploadForm((prev) => ({
          ...prev,
          invoiceNumber: "",
          irn: "",
          totalAmount: 0,
          poNumber: "",
          ewayBillNo: "",
        }));
        await refreshInvoices();
      }
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 2. Step 1: Verify & Generate NOA
  const handleVerify = async (inv: Invoice) => {
    setLoadingAction(`verify-${inv.id}`);
    try {
      const res = await fetch(`/api/v1/invoices/${inv.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: "GST and E-Way bill verified via government API." }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error || "Verification failed.");
      } else {
        showToast("success", `Invoice #${inv.invoiceNumber} verified! Notice of Assignment (NOA) issued to Anchor.`);
        await refreshInvoices();
      }
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 3. Step 2: Anchor Approve NOA
  const handleAnchorConfirm = async (inv: Invoice) => {
    setLoadingAction(`anchor-${inv.id}`);
    try {
      const res = await fetch(`/api/v1/invoices/${inv.id}/anchor-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedBy: "Authorized Supply Chain Officer" }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.message || data.error || "Anchor confirmation failed.");
      } else {
        showToast("success", `Anchor accepted NOA! Exposure allocated & Invoice listed for investor funding.`);
        await refreshInvoices();
      }
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 4. Step 3: Investor Fund
  const handleFund = async (inv: Invoice) => {
    setLoadingAction(`fund-${inv.id}`);
    try {
      const investorId = investors[0]?.id;
      const res = await fetch(`/api/v1/invoices/${inv.id}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investorId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.message || data.error || "Funding failed.");
      } else {
        showToast("success", `Disbursement complete! ₹${formatINR(inv.upfrontDisbursedAmount)} credited to MSME bank account.`);
        await refreshInvoices();
      }
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  // 5. Step 4: Settle Waterfall
  const handleSettleSubmit = async () => {
    if (!settleInvoice) return;
    setLoadingAction(`settle-${settleInvoice.id}`);
    try {
      const repaymentAmount =
        repaymentType === "FULL"
          ? settleInvoice.totalAmount
          : repaymentType === "PARTIAL"
          ? partialAmount
          : 0;

      const res = await fetch(`/api/v1/invoices/${settleInvoice.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repaymentAmount,
          isDefault: repaymentType === "DEFAULT",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error || "Settlement failed.");
      } else {
        showToast(
          "success",
          `Waterfall executed! Investor paid: ${data.waterfallSummary.investorPayout.totalCredited}. ${data.waterfallSummary.notes}`
        );
        setSettleInvoice(null);
        await refreshInvoices();
      }
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (filter === "ALL") return true;
    return inv.status === filter;
  });

  const totalEscrow = investors.reduce((sum, inv) => sum + inv.escrowBalance, 0);
  const totalVolume = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const activeExposure = anchors.reduce((sum, a) => sum + a.currentExposure, 0);

  // Dynamic Upload Limit Calculations
  const selectedUploadSeller = sellers.find((s) => s.id === uploadForm.sellerId) || sellers[0];
  const selectedUploadAnchor = anchors.find((a) => a.id === uploadForm.anchorId) || anchors[0];

  const sellerLimit = selectedUploadSeller?.creditLimit && selectedUploadSeller.creditLimit > 0
    ? selectedUploadSeller.creditLimit
    : 2000000;

  const anchorExposureAvailable = selectedUploadAnchor?.maxExposureLimit && selectedUploadAnchor.maxExposureLimit > 0
    ? Math.max(0, selectedUploadAnchor.maxExposureLimit - (selectedUploadAnchor.currentExposure || 0))
    : 5000000;

  const effectiveMaxLimit = Math.min(sellerLimit, anchorExposureAvailable > 0 ? anchorExposureAvailable : sellerLimit);
  const isUploadAmountExceeded = uploadForm.totalAmount > effectiveMaxLimit;

  return (
    <div className="space-y-8 font-sans">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-xl shadow-xl border flex items-start gap-3 transition-all animate-in slide-in-from-bottom duration-300 ${
            notification.type === "success"
              ? "bg-white text-emerald-900 border-emerald-300 shadow-emerald-500/10"
              : notification.type === "error"
              ? "bg-white text-red-900 border-red-300 shadow-red-500/10"
              : "bg-white text-sky-900 border-sky-300 shadow-sky-500/10"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : notification.type === "error" ? (
            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          )}
          <div className="text-xs leading-relaxed font-semibold">{notification.msg}</div>
        </div>
      )}

      {/* 3-Step Visual Lifecycle Guide ("Kaam Kaise Karta Hai") */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              How UdharCo Works (Simple 3-Step Process)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              MSMEs unlock up to 84% upfront capital once the corporate buyer confirms the invoice.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Up to 84% Advance Disbursal
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
              1
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Step 1: Upload Invoice</div>
              <div className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                Vendor uploads invoice with E-Way Bill & IRN. System verifies against duplicate registry.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="h-8 w-8 rounded-lg bg-sky-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
              2
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Step 2: Buyer Approves</div>
              <div className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                Corporate Anchor approves on portal, or SME buyer confirms with 30s WhatsApp OTP.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
              3
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Step 3: Instant Cash in Bank</div>
              <div className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                Escrow deposits 84% cash immediately into seller's bank account. Remaining 15% released on buyer payment.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Top Metrics Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active MSME Sellers</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{sellers.length}</div>
          <div className="text-xs text-slate-500 mt-1">Verified Suppliers Onboarded</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Anchor Buyer Exposure</span>
            <Layers className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            ₹{(activeExposure / 100000).toFixed(1)} Lakhs
          </div>
          <div className="text-xs text-slate-500 mt-1">Cap: ₹{(anchors[0]?.maxExposureLimit / 10000000).toFixed(1)} Cr</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Investor Escrow Liquidity</span>
            <Wallet className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-2 font-mono">
            ₹{(totalEscrow / 10000000).toFixed(2)} Cr
          </div>
          <div className="text-xs text-slate-500 mt-1">Available in Virtual Escrow</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Invoices Volume</span>
            <Coins className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            ₹{(totalVolume / 100000).toFixed(1)} Lakhs
          </div>
          <div className="text-xs text-emerald-600 mt-1 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> 100% CERSAI Registered
          </div>
        </div>
      </section>

      {/* Main Table Section */}
      <section className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              Live Invoice Discounting Ledger
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review invoices, approve supplier deliveries, or disburse cash advances in real-time.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={async () => {
                setLoadingAction("reminders");
                try {
                  const res = await fetch("/api/v1/invoices/process-anchor-reminders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ simulatedDaysElapsed: 3 }),
                  });
                  const data = await res.json();
                  showToast("info", `Anchor Engine: ${data.message} ${data.actions?.[0]?.message || ""}`);
                  await refreshInvoices();
                } catch (e: any) {
                  showToast("error", e.message);
                } finally {
                  setLoadingAction(null);
                }
              }}
              disabled={loadingAction === "reminders"}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition cursor-pointer"
              title="Auto-triggers follow-up reminders or timeout handling"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAction === "reminders" ? "animate-spin" : ""}`} />
              Auto Follow-up Engine
            </button>
            {(!currentUser || currentUser.role === "SELLER") && (
              <button
                onClick={() => setIsUploadOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs tracking-wide shadow-sm hover:shadow transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Upload New Invoice
              </button>
            )}
            <button
              onClick={refreshInvoices}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition cursor-pointer"
              title="Refresh ledger"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {["ALL", "UPLOADED", "VERIFIED", "LISTED", "FUNDED", "SETTLED"].map((f) => {
            const count = invoices.filter((i) => (f === "ALL" ? true : i.status === f)).length;
            const labelMap: Record<string, string> = {
              ALL: "All Invoices",
              UPLOADED: "New Uploads",
              VERIFIED: "Awaiting Buyer Approval",
              LISTED: "Ready for Funding",
              FUNDED: "Cash Disbursed",
              SETTLED: "Fully Settled",
            };
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer text-xs ${
                  filter === f
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                {labelMap[f] || f} ({count})
              </button>
            );
          })}
        </div>

        {/* Invoices Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-600 border-b border-slate-200 tracking-wider">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Seller MSME</th>
                <th className="py-3 px-4">Buyer Entity</th>
                <th className="py-3 px-4">Bill Amount</th>
                <th className="py-3 px-4">Upfront 84% Cash</th>
                <th className="py-3 px-4">Escrow Margin 15%</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Action Required</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-sans text-xs">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-medium">
                    No invoices found for filter &quot;{filter}&quot;
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span>{inv.invoiceNumber}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-sans font-semibold">
                          {inv.recourseType === "RECOURSE" ? "REC" : "NON-REC"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-normal mt-0.5">PO: {inv.poNumber || "N/A"}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{inv.seller.legalName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{inv.seller.gstin}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-sky-800">{inv.anchor.corporateName}</div>
                      <div className="text-[11px] text-sky-600 font-medium">Rating: {inv.anchor.creditRating}</div>
                    </td>
                    <td suppressHydrationWarning className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                      ₹{formatINR(inv.totalAmount)}
                    </td>
                    <td suppressHydrationWarning className="py-3.5 px-4 font-bold text-emerald-700 font-mono">
                      ₹{formatINR(inv.upfrontDisbursedAmount)}
                    </td>
                    <td suppressHydrationWarning className="py-3.5 px-4 font-semibold text-amber-700 font-mono">
                      ₹{formatINR(inv.marginHeldAmount)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full border ${
                          inv.status === "SETTLED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : inv.status === "FUNDED"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : inv.status === "LISTED"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : inv.status === "VERIFIED"
                            ? "bg-sky-50 text-sky-700 border-sky-200"
                            : inv.status === "DEFAULTED"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {inv.status === "SETTLED"
                          ? "✓ Settled & Complete"
                          : inv.status === "FUNDED"
                          ? "Cash Disbursed"
                          : inv.status === "LISTED"
                          ? "Ready for Bank"
                          : inv.status === "VERIFIED"
                          ? "Awaiting Buyer"
                          : inv.status === "UPLOADED"
                          ? "Uploaded (Pending)"
                          : inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {/* Step 1: UPLOADED ➔ Verify */}
                      {inv.status === "UPLOADED" && (
                        currentUser?.role === "SELLER" ? (
                          <span className="text-xs text-slate-500 font-medium">
                            Pending Verification
                          </span>
                        ) : (
                          <button
                            disabled={loadingAction === `verify-${inv.id}`}
                            onClick={() => handleVerify(inv)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 mx-auto"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Verify & Issue NOA
                          </button>
                        )
                      )}

                      {/* Step 2: VERIFIED ➔ Anchor Confirm */}
                      {inv.status === "VERIFIED" && (
                        currentUser?.role === "ANCHOR" ? (
                          <div className="flex items-center gap-1.5 justify-center">
                            <button
                              disabled={loadingAction === `anchor-${inv.id}`}
                              onClick={() => handleAnchorConfirm(inv)}
                              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1"
                            >
                              <Building2 className="w-3.5 h-3.5" />
                              Approve Delivery
                            </button>
                            <button
                              disabled={loadingAction === `anchor-${inv.id}`}
                              onClick={async () => {
                                setLoadingAction(`anchor-${inv.id}`);
                                try {
                                  const res = await fetch(`/api/v1/invoices/${inv.id}/anchor-reject`, { method: "POST" });
                                  const d = await res.json();
                                  if (!res.ok) throw new Error(d.error || "Rejection failed");
                                  showToast("info", "Invoice rejected by Anchor.");
                                  await refreshInvoices();
                                } catch (e: any) {
                                  showToast("error", e.message);
                                } finally {
                                  setLoadingAction(null);
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs border border-red-200 transition cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-sky-700">
                            Waiting for Buyer
                          </span>
                        )
                      )}

                      {/* Step 3: LISTED ➔ Investor Fund or Seller Review */}
                      {inv.status === "LISTED" && (
                        currentUser?.role === "INVESTOR" ? (
                          <button
                            disabled={loadingAction === `fund-${inv.id}`}
                            onClick={() => handleFund(inv)}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 mx-auto"
                          >
                            <Wallet className="w-3.5 h-3.5" />
                            Fund from Escrow
                          </button>
                        ) : currentUser?.role === "SELLER" ? (
                          <button
                            disabled={loadingAction === `fund-${inv.id}`}
                            onClick={() => {
                              setEsignInvoice(inv);
                              setAadhaarOtp("682910");
                              setIsAgreedTerms(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 mx-auto"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Accept & e-Sign Cash Offer
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-purple-700">
                            Ready for Funding
                          </span>
                        )
                      )}

                      {/* Step 4: FUNDED ➔ Settle Waterfall */}
                      {inv.status === "FUNDED" && (
                        currentUser?.role === "SELLER" ? (
                          <span className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Cash Disbursed ✓
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setSettleInvoice(inv);
                              setPartialAmount(Math.round(inv.totalAmount * 0.6));
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 mx-auto"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            Waterfall Settle
                          </button>
                        )
                      )}

                      {/* Step 5: SETTLED / DEFAULTED ➔ Audit Details */}
                      {(inv.status === "SETTLED" || inv.status === "DEFAULTED") && (
                        <button
                          onClick={() => setAuditInvoice(inv)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition cursor-pointer flex items-center gap-1.5 mx-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Audit
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>


      {/* 3 Main Players Showcase Cards (Dynamic to Active Session) */}
      {(() => {
        const activeSeller =
          (currentUser?.role === "SELLER" && currentUser.entityId
            ? sellers.find((s) => s.id === currentUser.entityId)
            : null) || sellers[sellers.length - 1] || sellers[0];

        const activeAnchor =
          (currentUser?.role === "ANCHOR" && currentUser.entityId
            ? anchors.find((a) => a.id === currentUser.entityId)
            : null) || anchors[0];

        const activeInvestor =
          (currentUser?.role === "INVESTOR" && currentUser.entityId
            ? investors.find((i) => i.id === currentUser.entityId)
            : null) || investors[0];

        return (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
                Fintech Ecosystem Participants
              </h2>
              <span className="text-xs text-slate-500 font-medium">Factoring Regulation Act 2011 Architecture</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Player 1: MSME Seller */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                    1. MSME Vendor
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {currentUser?.role === "SELLER" ? "Your Company" : "Verified Seller"}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{activeSeller?.legalName || "Your Registered MSME"}</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">GSTIN: {activeSeller?.gstin || "Pending"}</p>
                </div>
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-2">
                  <div className="flex justify-between">
                    <span>Disbursement Rule:</span>
                    <span className="font-bold text-emerald-700">84% upfront cash</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Margin Release:</span>
                    <span className="font-semibold text-amber-700">15% in Escrow</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Verified Account:</span>
                    <span className="font-mono text-slate-700">{activeSeller?.bankAccountNo || "Verified"}</span>
                  </div>
                </div>
              </div>

              {/* Player 2: Corporate Anchor */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase bg-sky-50 text-sky-800 border border-sky-200">
                    2. Corporate Buyer
                  </span>
                  <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                    Rating: {activeAnchor?.creditRating || "AAA"}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{activeAnchor?.corporateName || "Approved Corporate Buyer"}</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">GSTIN: {activeAnchor?.gstin || "Verified"}</p>
                </div>
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-2">
                  <div className="flex justify-between">
                    <span>Sanctioned Limit:</span>
                    <span className="font-bold text-slate-900">
                      ₹{activeAnchor ? (activeAnchor.maxExposureLimit / 10000000).toFixed(1) : "5.0"} Cr
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Exposure:</span>
                    <span className="font-semibold text-sky-700">
                      ₹{activeAnchor ? (activeAnchor.currentExposure / 100000).toFixed(1) : "0.0"} Lakhs
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Approval Mode:</span>
                    <span className="text-slate-700">Official Portal / WhatsApp</span>
                  </div>
                </div>
              </div>

              {/* Player 3: NBFC Investor */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase bg-purple-50 text-purple-800 border border-purple-200">
                    3. NBFC / Bank
                  </span>
                  <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    11% - 14% p.a.
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{activeInvestor?.entityName || "Institutional Escrow Funder"}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">ICICI Nodal Virtual Escrow</p>
                </div>
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-2">
                  <div className="flex justify-between">
                    <span>Escrow Balance:</span>
                    <span className="font-bold text-indigo-700 font-mono">
                      ₹{activeInvestor ? (activeInvestor.escrowBalance / 10000000).toFixed(2) : "2.50"} Cr
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Seniority:</span>
                    <span className="text-slate-800 font-bold">Priority #1 (Senior Debt)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payout Method:</span>
                    <span className="text-slate-700">Direct Escrow Split</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* MODAL 1: Upload Invoice Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-slate-900">Upload New Invoice for Instant Discounting</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Attach your GST invoice copy & verified IRN hash to receive 84% instant advance.
                </p>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* 1. SELLER IDENTITY SECTION */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Seller Entity (MSME Vendor)
                  </span>
                </div>

                <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {sellers.find((s) => s.id === uploadForm.sellerId)?.legalName || sellers[0]?.legalName || "MSME Seller Pvt Ltd"}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      GSTIN: {sellers.find((s) => s.id === uploadForm.sellerId)?.gstin || sellers[0]?.gstin} • Bank Account Verified
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      KYC VERIFIED
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                      e-NACH ACTIVE
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      LINE: ₹{formatINR(sellerLimit)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. INVOICE DOCUMENT UPLOAD FIELD */}
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Invoice Document Proof (PDF / Image) *</span>
                  </span>
                  <span className="text-[11px] text-slate-400">Required under Factoring Act 2011</span>
                </label>

                <input
                  id="invoice-document-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {attachedFile ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>{attachedFile.name}</span>
                          <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100/60 px-1.5 py-0.2 rounded">
                            {attachedFile.size}
                          </span>
                        </div>
                        <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                          ✓ Signed Tax Invoice Attached & Ready for Verification
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="invoice-document-file"
                        className="px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-[11px] text-slate-700 border border-slate-300 font-semibold transition cursor-pointer"
                      >
                        Change
                      </label>
                      <button
                        type="button"
                        onClick={() => setAttachedFile(null)}
                        className="text-slate-400 hover:text-red-600 text-xs font-bold p-1 cursor-pointer"
                        title="Remove file"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="invoice-document-file"
                    className="flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/20 transition cursor-pointer text-center group"
                  >
                    <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-emerald-600 mb-1.5 transition" />
                    <div className="text-xs font-bold text-slate-700 group-hover:text-slate-900">
                      Click to Browse or Drag & Drop Tax Invoice Copy
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Supports PDF, PNG, JPG (Original digitally signed GST tax invoice, max 15MB)
                    </div>
                  </label>
                )}
              </div>

              {/* 3. INVOICE CORE DETAILS: Number, Anchor, Face Value */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Invoice Number *</label>
                  <input
                    type="text"
                    required
                    value={uploadForm.invoiceNumber}
                    onChange={(e) => setUploadForm({ ...uploadForm, invoiceNumber: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                    placeholder="INV/2026/0891"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700">Corporate Buyer *</label>
                    <a
                      href="/corporate/apply"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-sky-700 hover:underline flex items-center gap-0.5 font-semibold"
                    >
                      <span>+ New Corporate</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <select
                    value={uploadForm.anchorId}
                    onChange={(e) => setUploadForm({ ...uploadForm, anchorId: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                  >
                    {anchors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.corporateName} ({a.creditRating}) {a.maxExposureLimit <= 0 ? "• Limit ₹0 (Underwriting Pending)" : `• Limit: ₹${(a.maxExposureLimit / 10000000).toFixed(1)} Cr`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700">Total Bill Value (₹) *</label>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                      isUploadAmountExceeded
                        ? "text-red-700 bg-red-50 border-red-200"
                        : "text-emerald-700 bg-emerald-50 border-emerald-200"
                    }`}>
                      {isUploadAmountExceeded
                        ? `Exceeds Max Cap: ₹${formatINR(effectiveMaxLimit)}`
                        : uploadForm.totalAmount > 0
                        ? (uploadForm.totalAmount >= 10000000
                            ? `₹${(uploadForm.totalAmount / 10000000).toFixed(2)} Cr`
                            : uploadForm.totalAmount >= 100000
                            ? `₹${(uploadForm.totalAmount / 100000).toFixed(2)} Lakh`
                            : `₹${uploadForm.totalAmount.toLocaleString("en-IN")}`)
                        : `Max Line: ₹${formatINR(effectiveMaxLimit)}`}
                    </span>
                  </div>
                  <input
                    type="number"
                    required
                    min={10000}
                    max={effectiveMaxLimit}
                    step={10000}
                    value={uploadForm.totalAmount || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      if (val.length <= 10) {
                        setUploadForm({ ...uploadForm, totalAmount: val ? Number(val) : 0 });
                      }
                    }}
                    placeholder={`e.g. 1000000 (Max ₹${formatINR(effectiveMaxLimit)})`}
                    className={`w-full bg-white border rounded-lg px-3 py-2 text-xs text-slate-900 font-mono outline-none transition ${
                      isUploadAmountExceeded
                        ? "border-red-500 focus:border-red-500 ring-2 ring-red-100 text-red-900"
                        : "border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    }`}
                  />
                  {isUploadAmountExceeded && (
                    <div className="mt-1.5 p-2 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700 font-medium flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />
                      <div>
                        <strong>Amount exceeds your sanctioned credit line!</strong>
                        <div className="text-[10px] text-red-600 mt-0.5">
                          Maximum you can discount for this invoice is <strong>₹{formatINR(effectiveMaxLimit)}</strong> (Seller line: ₹{formatINR(sellerLimit)}, Buyer facility: ₹{formatINR(anchorExposureAvailable)}).
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. e-INVOICE 64-CHAR IRN HASH */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Government e-Invoice IRN Hash *</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateCompliantIRN}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>⚡ Auto-Generate Govt IRN</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    value={uploadForm.irn}
                    onChange={(e) => setUploadForm({ ...uploadForm, irn: e.target.value.trim().toLowerCase() })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[11px] text-slate-900 font-mono focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none pr-10"
                    placeholder="64-character hexadecimal IRN generated by NIC GST Portal"
                  />
                  <div className="absolute right-3 top-2.5">
                    {uploadForm.irn.length === 64 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className={uploadForm.irn.length === 64 ? "text-emerald-700 font-semibold" : "text-amber-700 font-medium"}>
                    {uploadForm.irn.length} / 64 characters {uploadForm.irn.length === 64 ? "(Valid SHA-256)" : "(Incomplete)"}
                  </span>
                  <span className="text-slate-500">Validated against GSTN & Anti-Fraud Registry</span>
                </div>
              </div>

              {/* 5. PURCHASE ORDER (PO) & CREDIT TENURE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Purchase Order (PO) Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={uploadForm.poNumber}
                    onChange={(e) => setUploadForm({ ...uploadForm, poNumber: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                    placeholder="PO-AUTO-9021"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Payment Tenure (Credit Period)</label>
                  <select
                    value={uploadForm.tenureDays}
                    onChange={(e) => setUploadForm({ ...uploadForm, tenureDays: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 outline-none font-medium cursor-pointer"
                  >
                    <option value={30}>30 Days Credit Period</option>
                    <option value={60}>60 Days Credit Period</option>
                    <option value={90}>90 Days Credit Period</option>
                    <option value={120}>120 Days Credit Period</option>
                  </select>
                </div>
              </div>

              {/* 7. LIVE 84/15/1 DISBURSEMENT MATH PREVIEW */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2 text-xs">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Cash Advance Breakdown:</span>
                  <span className="text-emerald-800 font-semibold text-[11px]">11.0% p.a. Benchmark</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5 border-t border-emerald-200/80 font-mono">
                  <div className="min-w-0 bg-white/90 p-2.5 rounded-lg border border-emerald-200/60 overflow-hidden">
                    <div className="text-slate-600 text-[10px] font-sans font-medium uppercase tracking-wider">Instant 84% Advance</div>
                    <div
                      suppressHydrationWarning
                      className="text-emerald-800 font-black text-sm truncate mt-0.5"
                      title={`₹${formatINR(Math.round(uploadForm.totalAmount * 0.84))}`}
                    >
                      ₹{formatINR(Math.round(uploadForm.totalAmount * 0.84))}
                    </div>
                    {uploadForm.totalAmount >= 100000 && (
                      <div className="text-[10px] text-emerald-700 font-sans font-semibold mt-0.5 truncate">
                        {uploadForm.totalAmount * 0.84 >= 10000000
                          ? `≈ ₹${((uploadForm.totalAmount * 0.84) / 10000000).toFixed(2)} Cr`
                          : `≈ ₹${((uploadForm.totalAmount * 0.84) / 100000).toFixed(2)} Lakh`}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 bg-white/90 p-2.5 rounded-lg border border-emerald-200/60 overflow-hidden">
                    <div className="text-slate-600 text-[10px] font-sans font-medium uppercase tracking-wider">15% Escrow Margin</div>
                    <div
                      suppressHydrationWarning
                      className="text-amber-800 font-bold text-sm truncate mt-0.5"
                      title={`₹${formatINR(Math.round(uploadForm.totalAmount * 0.15))}`}
                    >
                      ₹{formatINR(Math.round(uploadForm.totalAmount * 0.15))}
                    </div>
                    {uploadForm.totalAmount >= 100000 && (
                      <div className="text-[10px] text-amber-700 font-sans font-semibold mt-0.5 truncate">
                        {uploadForm.totalAmount * 0.15 >= 10000000
                          ? `≈ ₹${((uploadForm.totalAmount * 0.15) / 10000000).toFixed(2)} Cr`
                          : `≈ ₹${((uploadForm.totalAmount * 0.15) / 100000).toFixed(2)} Lakh`}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 bg-white/90 p-2.5 rounded-lg border border-emerald-200/60 overflow-hidden">
                    <div className="text-slate-600 text-[10px] font-sans font-medium uppercase tracking-wider">1% Platform Fee</div>
                    <div
                      suppressHydrationWarning
                      className="text-slate-700 font-bold text-sm truncate mt-0.5"
                      title={`₹${formatINR(Math.round(uploadForm.totalAmount * 0.01))}`}
                    >
                      ₹{formatINR(Math.round(uploadForm.totalAmount * 0.01))}
                    </div>
                    {uploadForm.totalAmount >= 100000 && (
                      <div className="text-[10px] text-slate-500 font-sans font-semibold mt-0.5 truncate">
                        {uploadForm.totalAmount * 0.01 >= 10000000
                          ? `≈ ₹${((uploadForm.totalAmount * 0.01) / 10000000).toFixed(2)} Cr`
                          : `≈ ₹${((uploadForm.totalAmount * 0.01) / 100000).toFixed(2)} Lakh`}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 8. LEGAL RECOURSE & e-NACH DISCLOSURE (RBI Transparency) */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800">With-Recourse Factoring: </span>
                  This invoice is discounted under your Master Factoring Agreement backed by your Step 4 e-NACH mandate. If the corporate buyer raises an unresolved commercial dispute, recourse applies per RBI Factoring Regulation Act, 2011.
                </div>
              </div>

              {/* 9. ACTIONS */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingAction === "upload" || isUploadAmountExceeded || !uploadForm.totalAmount || uploadForm.totalAmount <= 0}
                  className={`px-5 py-2.5 rounded-lg text-white text-xs font-bold shadow-xs transition flex items-center gap-2 ${
                    isUploadAmountExceeded || !uploadForm.totalAmount || uploadForm.totalAmount <= 0
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 hover:shadow cursor-pointer"
                  }`}
                >
                  {loadingAction === "upload" ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Validating & Uploading...</span>
                    </>
                  ) : isUploadAmountExceeded ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Exceeds Sanctioned Limit (Max ₹{formatINR(effectiveMaxLimit)})</span>
                    </>
                  ) : (
                    <>
                      <FileUp className="w-3.5 h-3.5" />
                      <span>Upload & Issue Notice of Assignment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Phase 4 Seller Offer Review & Aadhaar e-Sign Modal */}
      {esignInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Review Factoring Offer & e-Sign</h3>
                  <p className="text-[11px] text-slate-500">Buyer approved • e-Sign agreement to disburse cash immediately</p>
                </div>
              </div>
              <button
                onClick={() => setEsignInvoice(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Calculated Offer Breakdown */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Invoice Number:</span>
                  <span className="font-mono text-slate-900 font-bold">{esignInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Corporate Buyer:</span>
                  <span className="font-semibold text-sky-800">{esignInvoice.anchor.corporateName} (Rating: {esignInvoice.anchor.creditRating})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Invoice Face Value:</span>
                  <span suppressHydrationWarning className="font-mono text-slate-900 font-bold">₹{formatINR(esignInvoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Due in:</span>
                  <span className="font-mono text-slate-700">{esignInvoice.tenureDays} Days</span>
                </div>
                <div className="border-t border-slate-200 pt-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Escrow Margin Retained (15%):</span>
                    <span suppressHydrationWarning className="font-mono text-amber-700 font-bold">₹{formatINR(esignInvoice.marginHeldAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Platform Listing Fee (1%):</span>
                    <span suppressHydrationWarning className="font-mono text-slate-700 font-bold">₹{formatINR(esignInvoice.totalAmount * 0.01)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-slate-200">
                    <span className="text-emerald-800 font-black text-sm">NET CASH ADVANCE (84%):</span>
                    <span suppressHydrationWarning className="font-mono text-emerald-700 font-black text-base">₹{formatINR(esignInvoice.upfrontDisbursedAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Aadhaar e-Sign Box */}
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" /> Aadhaar Digital Signature
                  </span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                    UIDAI Certified
                  </span>
                </div>
                <div className="text-[11px] text-slate-700">
                  Aadhaar Linked: <span className="font-mono font-bold text-slate-900">XXXX-XXXX-8921</span> (Authorized Signatory: <span className="font-bold text-slate-900">{esignInvoice.seller.legalName}</span>)
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={aadhaarOtp}
                    onChange={(e) => setAadhaarOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono focus:border-blue-500 outline-none"
                    maxLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setAadhaarOtp("682910")}
                    className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs rounded-lg font-semibold transition cursor-pointer"
                  >
                    Autofill
                  </button>
                </div>
              </div>

              {/* Legal Undertaking Checkbox */}
              <label className="flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAgreedTerms}
                  onChange={(e) => setIsAgreedTerms(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-0 mt-0.5"
                />
                <span>
                  I hereby irrevocably assign receivables under Invoice #{esignInvoice.invoiceNumber} to the Escrow Trustee pursuant to the Factoring Regulation Act, 2011.
                </span>
              </label>

              {/* Submit & Disburse Button */}
              <button
                disabled={!isAgreedTerms || !aadhaarOtp || loadingAction === `fund-${esignInvoice.id}`}
                onClick={async () => {
                  const target = esignInvoice;
                  setEsignInvoice(null);
                  await handleFund(target);
                }}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm hover:shadow disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Sign & Disburse ₹{formatINR(esignInvoice.upfrontDisbursedAmount)} Cash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Waterfall Settlement Simulation Modal */}
      {settleInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Execute Escrow Waterfall Settlement</h3>
              </div>
              <button
                onClick={() => setSettleInvoice(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Invoice:</span>
                  <span className="font-mono text-slate-900 font-bold">{settleInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Buyer Entity:</span>
                  <span className="font-semibold text-sky-800">{settleInvoice.anchor.corporateName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Invoice Value:</span>
                  <span suppressHydrationWarning className="font-mono text-slate-900 font-bold">₹{formatINR(settleInvoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Recourse:</span>
                  <span className="font-semibold text-amber-800">{settleInvoice.recourseType}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">Simulate Buyer Repayment Scenario:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRepaymentType("FULL")}
                    className={`p-3 rounded-xl border text-xs font-bold transition text-left cursor-pointer ${
                      repaymentType === "FULL"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div>100% Repay</div>
                    <div className="text-[10px] font-normal mt-0.5 text-slate-500">On-time payment</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRepaymentType("PARTIAL")}
                    className={`p-3 rounded-xl border text-xs font-bold transition text-left cursor-pointer ${
                      repaymentType === "PARTIAL"
                        ? "bg-amber-50 border-amber-500 text-amber-800"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div>Partial Repay</div>
                    <div className="text-[10px] font-normal mt-0.5 text-slate-500">Disputed Shortfall</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRepaymentType("DEFAULT")}
                    className={`p-3 rounded-xl border text-xs font-bold transition text-left cursor-pointer ${
                      repaymentType === "DEFAULT"
                        ? "bg-red-50 border-red-500 text-red-800"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div>Full Default</div>
                    <div className="text-[10px] font-normal mt-0.5 text-slate-500">0 Repayment</div>
                  </button>
                </div>
              </div>

              {repaymentType === "PARTIAL" && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Repayment Amount Received from Buyer (₹)
                  </label>
                  <input
                    type="number"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(Number(e.target.value))}
                    max={settleInvoice.totalAmount}
                    step={50000}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono focus:border-amber-500 outline-none"
                  />
                  <p suppressHydrationWarning className="text-[11px] text-amber-700 mt-1">
                    Shortfall of ₹{formatINR(settleInvoice.totalAmount - partialAmount)} will trigger e-NACH recourse against MSME seller.
                  </p>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1 text-slate-600">
                <div className="font-bold text-slate-800">Escrow Distribution Waterfall:</div>
                <div>1. <b>Priority #1:</b> Investor Principal & Accrued Yield returned to Escrow</div>
                <div>2. <b>Priority #2:</b> Platform Commission fee collected</div>
                <div>3. <b>Residual:</b> Balance 15% Margin released to MSME bank account</div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSettleInvoice(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSettleSubmit}
                  disabled={loadingAction?.startsWith("settle-")}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  {loadingAction?.startsWith("settle-") ? "Distributing..." : "Execute Settlement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Audit Trail Modal */}
      {auditInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Invoice Escrow Audit Trail</h3>
              </div>
              <button
                onClick={() => setAuditInvoice(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Invoice:</span>
                  <span className="font-mono text-slate-900 font-bold">{auditInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Seller MSME:</span>
                  <span className="text-slate-800 font-semibold">{auditInvoice.seller.legalName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Buyer Entity:</span>
                  <span className="text-sky-800 font-semibold">{auditInvoice.anchor.corporateName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Face Value:</span>
                  <span suppressHydrationWarning className="font-mono text-slate-900 font-bold">
                    ₹{formatINR(auditInvoice.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Current Status:</span>
                  <span className="font-bold text-emerald-700">{auditInvoice.status}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-600">Attached Proof:</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>{auditInvoice.invoiceDocumentName || "INV_Verified_Proof.pdf"}</span>
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Escrow Transactions:</h4>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {auditInvoice.escrowTransactions && auditInvoice.escrowTransactions.length > 0 ? (
                    auditInvoice.escrowTransactions.map((tx, idx) => (
                      <div
                        key={tx.id || idx}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-800">
                            {tx.transactionType}
                          </span>
                          <span suppressHydrationWarning className="font-bold text-slate-900">₹{formatINR(tx.amount)}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{tx.notes}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 py-3 text-center">
                      No escrow transactions recorded yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setAuditInvoice(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

