"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  ShieldCheck,
  Search,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileCheck,
  AlertCircle,
  Clock,
  Briefcase,
  HelpCircle,
  ExternalLink,
} from "lucide-react";

import { validateCorporateEmail } from "@/lib/utils/domainValidation";

export default function CorporateApplyPage() {
  const [gstin, setGstin] = useState("");
  const [corporateName, setCorporateName] = useState("");
  const [pan, setPan] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [isGstVerified, setIsGstVerified] = useState(false);
  const [gstLoading, setGstLoading] = useState(false);
  const [gstError, setGstError] = useState<string | null>(null);

  // Form Fields
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [creditRating, setCreditRating] = useState("AAA");
  const [requestedLimit, setRequestedLimit] = useState(50000000); // ₹5 Cr default
  const [annualProcurement, setAnnualProcurement] = useState(250000000); // ₹25 Cr default
  const [standardPaymentTerms, setStandardPaymentTerms] = useState<number>(30); // 30 days default MSME cycle

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<{
    applicationId: string;
    corporateName: string;
    status: string;
  } | null>(null);

  const emailValidation = contactEmail ? validateCorporateEmail(contactEmail) : null;

  const handleVerifyGst = async () => {
    const cleanGst = gstin.trim().toUpperCase();
    if (cleanGst.length !== 15) {
      setGstError("Please enter a valid 15-character GSTIN (e.g. 27AAACT2727Q1ZW).");
      return;
    }

    setGstLoading(true);
    setGstError(null);

    try {
      const res = await fetch("/api/v1/kyc/gst-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gstin: cleanGst }),
      });
      const data = await res.json();

      if (data.success) {
        setIsGstVerified(true);
        setCorporateName(data.legalName || data.tradeName || "Enterprise Corporate Entity");
        setPan(data.pan || cleanGst.substring(2, 12));
        setStateCode(data.state || cleanGst.substring(0, 2));
      } else {
        setGstError(data.error || "GSTIN lookup failed. Please verify the number.");
      }
    } catch (err: any) {
      setGstError(err.message || "Network error while connecting to GST portal.");
    } finally {
      setGstLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGstVerified) {
      setSubmitError("Please verify your GSTIN before submitting.");
      return;
    }

    if (emailValidation && !emailValidation.isValid) {
      setSubmitError(emailValidation.error || "Please enter an official corporate email domain.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/v1/corporate/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gstin: gstin.trim().toUpperCase(),
          corporateName,
          contactPerson,
          contactEmail,
          contactPhone,
          creditRating,
          requestedExposureLimit: Number(requestedLimit),
          annualProcurement: Number(annualProcurement),
          standardPaymentTerms: Number(standardPaymentTerms),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmittedData({
          applicationId: data.applicationId,
          corporateName: data.corporateName,
          status: data.status,
        });
      } else {
        setSubmitError(data.error || "Failed to submit application. Please check inputs.");
      }
    } catch (err: any) {
      setSubmitError(err.message || "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between font-sans">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-xs">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-600 flex items-center justify-center text-white font-black shadow-xs">
            U
          </div>
          <span className="font-extrabold text-lg tracking-tight text-slate-900">
            UdharCo<span className="text-indigo-600 font-medium text-xs ml-1.5 px-2 py-0.5 bg-indigo-50 rounded-md border border-indigo-200">Corporate Gateway</span>
          </span>
        </Link>

        <div className="flex items-center gap-4 text-xs font-medium">
          <span className="text-slate-500 hidden sm:inline">Already an approved Anchor?</span>
          <Link
            href="/login"
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-semibold transition"
          >
            Corporate Login
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-10 space-y-8">
        {submittedData ? (
          /* Success Screen */
          <div className="p-8 md:p-12 rounded-3xl bg-white border border-emerald-200 text-center space-y-6 shadow-sm animate-in fade-in zoom-in-95 duration-300">
            <div className="h-16 w-16 mx-auto rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-800 font-bold px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 inline-block">
                Application Received • Under Risk Review
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">
                Factoring Onboarding Request Submitted
              </h2>
              <p className="text-sm text-slate-600 max-w-lg mx-auto">
                Thank you, <strong className="text-slate-900">{submittedData.corporateName}</strong>. Your corporate factoring facility application is registered under ID:
              </p>
              <div className="font-mono text-xs bg-slate-100 p-2.5 rounded-xl border border-slate-200 text-indigo-700 font-bold inline-block">
                {submittedData.applicationId}
              </div>
            </div>

            {/* Protocol Flow Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-2xl mx-auto pt-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-700 text-xs font-bold">
                  <ShieldCheck className="w-4 h-4" /> Step 1: Verification
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  GSTIN & MCA compliance verified automatically via public registry.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 text-purple-700 text-xs font-bold">
                  <Clock className="w-4 h-4" /> Step 2: Risk Sanction
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  UdharCo Risk Committee sanctions bilateral exposure limit within 2-4 hours.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold">
                  <FileCheck className="w-4 h-4" /> Step 3: Activation Link
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Secure treasury activation token dispatched directly to <span className="text-slate-900 font-mono font-bold">{contactEmail}</span>.
                </p>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
              <Link
                href="/"
                className="px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-semibold transition"
              >
                Return to UdharCo Home
              </Link>
              <button
                onClick={() => {
                  setSubmittedData(null);
                  setGstin("");
                  setIsGstVerified(false);
                }}
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Submit Another Entity
              </button>
            </div>
          </div>
        ) : (
          /* Application Form */
          <div className="space-y-8">
            {/* Page Title & Intro */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Zero-Friction Enterprise Supply Chain Finance</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                Corporate Anchor Application
              </h1>
              <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
                Connect your MSME vendor ecosystem to multi-bank institutional liquidity under the Factoring Regulation Act 2011. Enter your corporate GSTIN to auto-fill business credentials.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* STEP 1: GSTIN Auto-Fill Card */}
              <div className="p-6 md:p-8 rounded-3xl bg-white border border-slate-200 space-y-6 shadow-xs">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                  <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
                    01
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">GSTIN & Entity Auto-Detection</h3>
                    <p className="text-xs text-slate-500">Public registry lookup eliminates manual data entry</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Enterprise GSTIN (15 Characters) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          required
                          maxLength={15}
                          value={gstin}
                          placeholder="e.g. 27AAACT2727Q1ZW"
                          onChange={(e) => {
                            setGstin(e.target.value.toUpperCase());
                            setIsGstVerified(false);
                            setGstError(null);
                          }}
                          className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 font-mono text-sm uppercase placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                        />
                        {isGstVerified && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 flex items-center gap-1 text-xs font-semibold">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Verified</span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleVerifyGst}
                        disabled={gstLoading || gstin.trim().length !== 15}
                        className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 transition shadow-xs cursor-pointer"
                      >
                        {gstLoading ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Fetching...</span>
                          </>
                        ) : (
                          <>
                            <Search className="w-3.5 h-3.5" />
                            <span>Auto-Fill Details</span>
                          </>
                        )}
                      </button>
                    </div>
                    {gstError && (
                      <p className="text-xs text-rose-600 mt-2 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" /> {gstError}
                      </p>
                    )}
                  </div>

                  {/* Auto-filled details display */}
                  {isGstVerified && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-emerald-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs animate-in fade-in duration-200">
                      <div>
                        <span className="text-slate-500 block mb-0.5">Corporate Legal Entity:</span>
                        <span className="font-bold text-slate-900 block">{corporateName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5">Tax Identifier (PAN):</span>
                        <span className="font-mono text-indigo-700 font-semibold">{pan}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5">State Jurisdiction:</span>
                        <span className="font-mono text-purple-700 font-semibold">{stateCode} (Active)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 2: Procurement & Exposure Requirements */}
              <div className="p-6 md:p-8 rounded-3xl bg-white border border-slate-200 space-y-6 shadow-xs">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                  <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs border border-purple-200">
                    02
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Credit Profile & Liquidity Requirement</h3>
                    <p className="text-xs text-slate-500">Defines maximum multi-bank factoring exposure</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-slate-700 block mb-1.5 font-semibold">
                      Public Credit Rating <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={creditRating}
                      onChange={(e) => setCreditRating(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 font-mono outline-none focus:bg-white focus:border-indigo-600 font-medium"
                    >
                      <option value="AAA">CRISIL / ICRA AAA (Prime High Grade)</option>
                      <option value="AA+">CRISIL / ICRA AA+ (High Grade)</option>
                      <option value="AA">CRISIL / ICRA AA (Quality)</option>
                      <option value="A">CRISIL / ICRA A (Upper Medium)</option>
                      <option value="BBB">CRISIL / ICRA BBB (Investment Grade)</option>
                      <option value="UNRATED">Unrated / In Process</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1.5 font-semibold">
                      Requested Exposure Facility (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={1000000}
                      step={500000}
                      value={requestedLimit}
                      onChange={(e) => setRequestedLimit(Number(e.target.value))}
                      className="w-full px-3.5 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 font-mono outline-none focus:bg-white focus:border-indigo-600 font-medium"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      ₹{(requestedLimit / 10000000).toFixed(2)} Crores
                    </span>
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1.5 font-semibold">
                      Est. Annual MSME Procurement (₹)
                    </label>
                    <input
                      type="number"
                      min={5000000}
                      step={1000000}
                      value={annualProcurement}
                      onChange={(e) => setAnnualProcurement(Number(e.target.value))}
                      className="w-full px-3.5 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 font-mono outline-none focus:bg-white focus:border-indigo-600 font-medium"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      ₹{(annualProcurement / 10000000).toFixed(2)} Crores
                    </span>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-slate-700 block mb-1.5 font-semibold">
                      Typical Vendor Payment Cycle (Standard Terms)
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                      {[
                        { days: 30, label: "30 Days", desc: "MSME Standard" },
                        { days: 45, label: "45 Days", desc: "MSMED Act Cap" },
                        { days: 60, label: "60 Days", desc: "Industrial Regular" },
                        { days: 90, label: "90 Days", desc: "Extended Trade" },
                      ].map((t) => (
                        <button
                          key={t.days}
                          type="button"
                          onClick={() => setStandardPaymentTerms(t.days)}
                          className={`p-2.5 rounded-2xl border text-left transition cursor-pointer ${
                            standardPaymentTerms === t.days
                              ? "bg-indigo-50 border-indigo-600 text-indigo-900 shadow-xs"
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className="text-xs font-bold font-mono">{t.label}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{t.desc}</div>
                        </button>
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1.5 block">
                      💡 Self-declared typical payment terms to MSME suppliers. Used as an onboarding estimate for initial credit line calculation. Individual invoices are always funded & settled per their actual bill due-dates.
                    </span>
                  </div>
                </div>
              </div>

              {/* STEP 3: Authorized Treasury Contact */}
              <div className="p-6 md:p-8 rounded-3xl bg-white border border-slate-200 space-y-6 shadow-xs">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                  <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200">
                    03
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Authorized Treasury / Procurement Signatory</h3>
                    <p className="text-xs text-slate-500">Account invite token will be dispatched to this corporate email</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-slate-700 block mb-1.5 font-semibold">
                      Authorized Officer Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Vikramaditya Singhania"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 outline-none focus:bg-white focus:border-indigo-600 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1.5 font-semibold">
                      Corporate Work Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="treasury@tatamotors.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className={`w-full px-3.5 py-3 rounded-2xl bg-slate-50 border text-slate-900 font-mono outline-none transition ${
                        emailValidation && !emailValidation.isValid
                          ? "border-rose-400 focus:border-rose-500"
                          : emailValidation?.isValid
                          ? "border-emerald-500 focus:border-emerald-600"
                          : "border-slate-300 focus:bg-white focus:border-indigo-600"
                      }`}
                    />
                    {emailValidation && !emailValidation.isValid ? (
                      <span className="text-[11px] text-rose-600 mt-1.5 flex items-center gap-1 font-sans">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{emailValidation.error}</span>
                      </span>
                    ) : emailValidation?.isValid ? (
                      <span className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-sans">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Corporate domain verified (@{emailValidation.domain})</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Must be company domain (@company.com). Free email providers (@gmail, etc.) strictly prohibited.
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1.5 font-semibold">
                      Official Phone / Mobile <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={12}
                      placeholder="e.g. 9820012345"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 font-mono outline-none focus:bg-white focus:border-indigo-600 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {submitError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Submit CTA */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Governed under Factoring Regulation Act 2011 & RBI Core Principles.</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !isGstVerified}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Submitting Application...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Corporate Factoring Application</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-500 bg-white">
        © 2026 UdharCo Financial Technologies Ltd. Regulated Supply Chain Finance Clearing Infrastructure.
      </footer>
    </div>
  );
}
