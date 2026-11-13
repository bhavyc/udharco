"use client";

import { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Building2,
  FileText,
  Clock,
  ArrowRight,
  ExternalLink,
  Lock,
  Calendar,
  IndianRupee,
  BadgeCheck,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

interface NoticeProps {
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    invoiceDate: string;
    dueDate: string;
    tenureDays: number;
    status: string;
    poNumber: string | null;
    ewayBillNo: string | null;
    irn: string | null;
    invoiceDocumentUrl: string | null;
    invoiceDocumentName: string | null;
    anchorConfirmedAt: string | null;
    disputeReason: string | null;
    virtualAccountNumber: string;
    verificationToken?: string;
  };
  seller: {
    legalName: string;
    gstin: string;
    bankAccountNo: string;
    bankIfsc: string;
  };
  anchor: {
    id: string;
    corporateName: string;
    gstin: string;
    contactEmail: string | null;
    contactPerson: string | null;
    status: string;
    creditRating: string;
    maxExposureLimit: number;
    inviteToken?: string | null;
  };
}

export default function NoticeClient({ invoice, seller, anchor }: NoticeProps) {
  const [isConfirmed, setIsConfirmed] = useState(!!invoice.anchorConfirmedAt);
  const [isDisputed, setIsDisputed] = useState(invoice.status === "DISPUTED");
  const [disputeReason, setDisputeReason] = useState(invoice.disputeReason || "");
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeInput, setDisputeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const formatINR = (amt: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amt);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/v1/invoices/${invoice.id}/notice-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CONFIRM", token: invoice.verificationToken }),
      });
      const data = await res.json();
      if (data.success) {
        setIsConfirmed(true);
        setStatusMessage(data.message);
      } else {
        alert(data.error || "Confirmation failed.");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeInput.trim()) {
      alert("Please enter a valid dispute or discrepancy reason.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/invoices/${invoice.id}/notice-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DISPUTE", disputeReason: disputeInput, token: invoice.verificationToken }),
      });
      const data = await res.json();
      if (data.success) {
        setIsDisputed(true);
        setDisputeReason(disputeInput);
        setShowDisputeModal(false);
      } else {
        alert(data.error || "Failed to submit dispute.");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-white relative">
      {/* Background vibrant aurora ambient lights for dark glass */}
      <div className="aurora-blob-1 fixed -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-emerald-500/25 via-teal-500/15 to-transparent blur-[140px] pointer-events-none -z-10" />
      <div className="aurora-blob-2 fixed -bottom-32 right-10 w-[650px] h-[650px] rounded-full bg-gradient-to-tl from-indigo-600/25 via-purple-500/15 to-transparent blur-[140px] pointer-events-none -z-10" />
      <div className="aurora-blob-3 fixed top-1/2 -left-20 w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-cyan-500/15 to-transparent blur-[120px] pointer-events-none -z-10" />

      {/* Top Bar */}
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-base shadow-xs backdrop-blur-xs">
            U
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <span>UDHARCO</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 backdrop-blur-xs text-emerald-400 border border-emerald-800/80">
                STATUTORY FACTORING PORTAL
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Governed under the Factoring Regulation Act, 2011 & RBI Digital Lending Directions
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Section 13 Compliant NOA</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Statutory Directive Card */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-white/10 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -z-10" />
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 backdrop-blur-xs border border-amber-500/30 text-amber-400 shrink-0 mt-0.5 shadow-2xs">
              <FileText className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-mono font-bold tracking-wider uppercase text-amber-400">
                Official Commercial Notice
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Tripartite Notice of Assignment & Goods Delivery Verification
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Notice is hereby served to the Accounts Payable / Corporate Treasury department of{" "}
                <strong className="text-white underline decoration-emerald-500 underline-offset-2">
                  {anchor.corporateName}
                </strong>{" "}
                that your MSME registered vendor has submitted the tax invoice below for supply-chain early settlement.
              </p>
            </div>
          </div>
        </div>

        {/* Confirmation State Banner */}
        {isConfirmed ? (
          <div className="p-5 rounded-2xl bg-emerald-950/40 backdrop-blur-xl border border-emerald-500/30 text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg ring-1 ring-emerald-500/20">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-white text-base">Commercial Delivery Acknowledged</h3>
                <p className="text-xs text-emerald-300/90 mt-0.5">
                  Goods receipt verified. This invoice debt is assigned to the designated virtual escrow account for settlement on{" "}
                  <strong className="text-white">{formatDate(invoice.dueDate)}</strong>.
                </p>
                {statusMessage && (
                  <div className="text-[11px] font-mono text-emerald-400 mt-2 bg-emerald-900/40 px-2.5 py-1 rounded-lg border border-emerald-700/50 w-max">
                    {statusMessage}
                  </div>
                )}
              </div>
            </div>
            <Link
              href="/login"
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition shrink-0"
            >
              <span>Corporate Portal Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : isDisputed ? (
          <div className="p-5 rounded-2xl bg-rose-950/40 backdrop-blur-xl border border-rose-500/30 text-rose-200 flex items-start gap-3 shadow-lg ring-1 ring-rose-500/20">
            <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-white text-base">Invoice Disputed / Delivery Rejected</h3>
              <p className="text-xs text-rose-300 mt-1">
                A commercial dispute was logged: <em className="text-white font-mono">"{disputeReason}"</em>.
                Per RBI Factoring Regulations, early funding has been halted.
              </p>
            </div>
          </div>
        ) : null}

        {/* Invoice Summary Box */}
        <div className="rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-white/10 divide-y divide-white/10 shadow-2xl overflow-hidden ring-1 ring-white/5">
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/40 backdrop-blur-xs">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-mono">Total Invoice Value</div>
              <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-mono mt-1">
                {formatINR(invoice.totalAmount)}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-800/80 backdrop-blur-xs text-slate-300 border border-slate-700/80 shadow-2xs">
                Invoice #{invoice.invoiceNumber}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-950/80 backdrop-blur-xs text-indigo-300 border border-indigo-800/80 shadow-2xs">
                Tenure: {invoice.tenureDays} Days
              </span>
              {anchor.status === "PENDING" && (
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-950/80 backdrop-blur-xs text-amber-300 border border-amber-800/80 flex items-center gap-1 shadow-2xs">
                  <Clock className="w-3 h-3" />
                  <span>Corporate Underwriting In Progress (Cap ₹50L)</span>
                </span>
              )}
            </div>
          </div>

          {/* Key Parties Grid */}
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Seller */}
            <div className="p-4 rounded-2xl bg-slate-950/60 backdrop-blur-xs border border-white/5 space-y-2 shadow-2xs">
              <div className="text-[10px] font-mono font-bold tracking-wider uppercase text-emerald-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>Assignor (MSME Seller)</span>
              </div>
              <div className="text-base font-bold text-white">{seller.legalName}</div>
              <div className="text-xs text-slate-400 font-mono">
                GSTIN: <span className="text-slate-200">{seller.gstin}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Bank IFSC: {seller.bankIfsc} • A/C: ••••{seller.bankAccountNo.slice(-4)}
              </div>
            </div>

            {/* Corporate Buyer */}
            <div className="p-4 rounded-2xl bg-slate-950/60 backdrop-blur-xs border border-white/5 space-y-2 shadow-2xs">
              <div className="text-[10px] font-mono font-bold tracking-wider uppercase text-sky-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>Debtor (Corporate Buyer)</span>
              </div>
              <div className="text-base font-bold text-white">{anchor.corporateName}</div>
              <div className="text-xs text-slate-400 font-mono">
                GSTIN: <span className="text-slate-200">{anchor.gstin}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Treasury Notice Sent To: <span className="text-indigo-400">{anchor.contactEmail || "finance-desk"}</span>
              </div>
            </div>
          </div>

          {/* Line Item Data */}
          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <div className="text-slate-500">Invoice Date</div>
              <div className="font-bold text-slate-200 mt-0.5">{formatDate(invoice.invoiceDate)}</div>
            </div>
            <div>
              <div className="text-slate-500">Due Payment Date</div>
              <div className="font-bold text-amber-400 mt-0.5">{formatDate(invoice.dueDate)}</div>
            </div>
            <div>
              <div className="text-slate-500">Purchase Order (PO)</div>
              <div className="font-bold text-slate-200 mt-0.5">{invoice.poNumber || "Direct PO"}</div>
            </div>
            <div>
              <div className="text-slate-500">E-Way Bill</div>
              <div className="font-bold text-slate-200 mt-0.5">{invoice.ewayBillNo || "Local Delivery"}</div>
            </div>
          </div>

          {/* IRN & Escrow Directive */}
          <div className="p-5 bg-slate-950/40 backdrop-blur-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">NIC Govt e-Invoice IRN Hash:</span>
              <span className="font-mono text-slate-300 text-[11px] truncate max-w-[280px]">
                {invoice.irn || "IRN-AUTHENTICATED"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Designated Virtual Escrow Account (VAN):</span>
              <span className="font-mono text-emerald-400 font-bold bg-emerald-950/60 backdrop-blur-xs px-2.5 py-0.5 rounded-lg border border-emerald-800">
                {invoice.virtualAccountNumber}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls for Corporate AP */}
        {!isConfirmed && !isDisputed && (
          <div className="p-6 rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-white/10 space-y-4 shadow-2xl ring-1 ring-white/5">
            <div className="space-y-1">
              <h3 className="font-bold text-white text-base">Corporate Buyer Action Required</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Please verify that the goods/services specified in Invoice #{invoice.invoiceNumber} have been duly delivered
                to your warehouse/premises. By confirming, you acknowledge that payment will be remitted to the virtual escrow account on or before {formatDate(invoice.dueDate)}.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Goods Receipt & Acknowledge Payment Date</span>
              </button>

              <button
                onClick={() => setShowDisputeModal(true)}
                disabled={loading}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-800/80 border border-slate-700/80 text-slate-300 font-semibold text-xs transition cursor-pointer"
              >
                Raise Dispute / Material Discrepancy
              </button>
            </div>
          </div>
        )}

        {/* Statutory Legal Disclaimer */}
        <div className="p-4 rounded-2xl bg-slate-900/30 backdrop-blur-xl border border-white/5 text-[11px] text-slate-400 space-y-1.5 leading-relaxed font-mono shadow-xs">
          <div className="font-bold text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>LEGAL RECOURSE & FACTORING REGULATION ACT, 2011 NOTICE</span>
          </div>
          <p>
            Pursuant to the provisions of the Factoring Regulation Act, 2011, this Notice of Assignment operates as an
            irrevocable directive to settle the specified invoice amount exclusively into the designated Virtual Escrow
            Account. Payments made to any alternate account will not discharge the debtor's commercial liability.
          </p>
        </div>
      </main>

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl ring-1 ring-white/10">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-white text-base">Raise Commercial Dispute</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              If the goods have not been received, are damaged, or the bill value is contested, specify the details below. Early funding will be blocked immediately.
            </p>
            <textarea
              rows={4}
              required
              value={disputeInput}
              onChange={(e) => setDisputeInput(e.target.value)}
              placeholder="e.g. Goods damaged in transit / Rate discrepancy against Purchase Order #..."
              className="w-full bg-slate-950/80 backdrop-blur-xs border border-white/10 rounded-2xl p-3 text-xs text-slate-100 placeholder:text-slate-600 focus:border-rose-500 outline-none shadow-inner"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDisputeModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDispute}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white transition shadow-sm"
              >
                Submit Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
