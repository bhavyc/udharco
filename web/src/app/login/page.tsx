"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Building2,
  Wallet,
  Smartphone,
  ArrowRight,
  Sparkles,
  Lock,
  Mail,
  CheckCircle2,
  AlertCircle,
  Shield,
  User,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";

type LoginTab = "SELLER" | "ANCHOR" | "INVESTOR";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteParam = searchParams.get("invite");

  const [activeTab, setActiveTab] = useState<LoginTab>(inviteParam ? "ANCHOR" : "SELLER");

  // Seller Mobile OTP state
  const [mobile, setMobile] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  // Anchor & Investor Email + Password / Invite state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteToken, setInviteToken] = useState(inviteParam || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifyingInvite, setVerifyingInvite] = useState(false);
  const [inviteDetails, setInviteDetails] = useState<{
    role: string;
    email: string | null;
    anchor?: {
      id: string;
      corporateName: string;
      gstin: string;
      maxExposureLimit: number;
      status: string;
    } | null;
    investor?: {
      id: string;
      entityName: string;
      investorType: string;
    } | null;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (inviteParam) {
      setInviteToken(inviteParam);
      setVerifyingInvite(true);
      fetch(`/api/v1/auth/invite?token=${encodeURIComponent(inviteParam.trim())}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setInviteDetails(data);
            if (data.role === "INVESTOR") {
              setActiveTab("INVESTOR");
            } else {
              setActiveTab("ANCHOR");
            }
          } else {
            setErrorMsg(data.error || "Invalid or expired invite link.");
          }
        })
        .catch((err) => {
          setErrorMsg("Could not verify invite token: " + err.message);
        })
        .finally(() => {
          setVerifyingInvite(false);
        });
    }
  }, [inviteParam]);

  // Tab switch helpers
  const handleTabSwitch = (tab: LoginTab) => {
    setActiveTab(tab);
    setErrorMsg(null);
    setSuccessMsg(null);
    setMobile("");
    setOtpSent(false);
    setOtpCode("");
    setEmail("");
    setPassword("");
  };

  // 1. Seller Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!mobile || !/^[6-9]\d{9}$/.test(mobile.trim())) {
      setErrorMsg("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/seller/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: mobile.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send OTP.");
      }
      setOtpSent(true);
      setSuccessMsg(`OTP successfully sent to +91 ${mobile.trim()}`);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Seller Verify OTP & Login
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!otpCode || otpCode.trim().length !== 6) {
      setErrorMsg("Please enter the 6-digit OTP code.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/seller/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: mobile.trim(), code: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "OTP verification failed.");
      }

      if (data.needsOnboarding) {
        router.push("/signup");
      } else {
        setSuccessMsg("Authentication successful. Redirecting to workspace...");
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Anchor & Investor Email/Password or Invite Login
  const handleEntityLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (inviteToken) {
      if (!newPassword || newPassword.length < 8) {
        setErrorMsg("Treasury password must be at least 8 characters.");
        return;
      }
      if (confirmPassword && newPassword !== confirmPassword) {
        setErrorMsg("Passwords do not match. Please re-enter.");
        return;
      }
    }

    setLoading(true);
    try {
      const payload: any = {};
      if (inviteToken) {
        payload.inviteToken = inviteToken.trim();
        payload.newPassword = newPassword;
      } else {
        payload.email = email.trim();
        payload.password = password;
      }

      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Authentication failed.");
      }

      setSuccessMsg("Account activated & verified. Loading corporate portal...");
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-indigo-500 selection:text-white font-sans">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-10 shadow-xs">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center shadow-md font-black text-white text-lg tracking-tight">
              UD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  UdharCo
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  RBI Regulated Escrow
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Early Working Capital on Verified B2B Invoices
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/signup"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg shadow-2xs transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Register New MSME</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/admin/login"
              className="text-xs font-medium text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 bg-white px-3 py-1.5 rounded-lg shadow-2xs transition"
            >
              Admin Portal →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-10 flex flex-col justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {inviteToken && inviteDetails?.anchor
                ? "Activate Corporate Treasury Portal"
                : inviteToken && inviteDetails?.investor
                ? "Activate Institutional Funder Portal"
                : "Sign In to Your Workspace"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {inviteToken && (inviteDetails?.anchor || inviteDetails?.investor)
                ? "Set your corporate master password to access sanctioned factoring facilities."
                : "Select your role to access your personalized invoice and escrow portal."}
            </p>
          </div>

          {/* Role Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => handleTabSwitch("SELLER")}
              className={`py-2 px-2 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 transition ${
                activeTab === "SELLER"
                  ? "bg-white text-emerald-700 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>MSME Seller</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch("ANCHOR")}
              className={`py-2 px-2 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 transition ${
                activeTab === "ANCHOR"
                  ? "bg-white text-sky-700 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Corporate Buyer</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch("INVESTOR")}
              className={`py-2 px-2 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 transition ${
                activeTab === "INVESTOR"
                  ? "bg-white text-purple-700 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Investor / Bank</span>
            </button>
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: SELLER MOBILE OTP LOGIN */}
          {activeTab === "SELLER" && (
            <div>
              <div className="p-3 mb-5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-900 flex items-center justify-between">
                <span>⚡ <strong>MSME Working Capital:</strong> Discount verified invoices upon corporate buyer confirmation.</span>
              </div>

              {!otpSent ? (
                <form onSubmit={handleRequestOtp} autoComplete="off" className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Registered Mobile Number
                    </label>
                    <div className="flex rounded-xl border border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 overflow-hidden bg-white">
                      <span className="px-3.5 py-2.5 bg-slate-50 border-r border-slate-200 text-xs font-bold text-slate-600 flex items-center">
                        +91
                      </span>
                      <input
                        type="tel"
                        maxLength={10}
                        value={mobile}
                        autoComplete="off"
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="Enter 10-digit mobile number"
                        className="w-full px-3.5 py-2.5 text-slate-900 text-sm outline-none font-medium placeholder:text-slate-400 bg-white"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm hover:shadow cursor-pointer disabled:opacity-50"
                  >
                    {loading ? "Sending OTP..." : "Get OTP on Mobile"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} autoComplete="off" className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Enter 6-Digit Verification Code
                      </label>
                      <button
                        type="button"
                        onClick={() => setOtpSent(false)}
                        className="text-[11px] text-emerald-700 hover:underline font-semibold"
                      >
                        Change Number
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      autoComplete="off"
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-slate-900 font-mono text-center tracking-widest text-lg font-bold outline-none placeholder:text-slate-400 bg-white"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {loading ? "Verifying..." : "Verify & Open Seller Dashboard"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Registration Link for New MSME Seller */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">New MSME supplier?</span>
                <Link
                  href="/signup"
                  className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
                >
                  <span>Register & Apply for Facility</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* TAB 2: CORPORATE BUYER LOGIN */}
          {activeTab === "ANCHOR" && (
            <div>
              {inviteToken ? (
                <div>
                  {verifyingInvite ? (
                    <div className="py-8 text-center space-y-2">
                      <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs font-semibold text-slate-600">Verifying enterprise invite link...</p>
                    </div>
                  ) : inviteDetails?.anchor ? (
                    <div className="space-y-4">
                      {/* Verified Corporate Highlight Card */}
                      <div className="p-4 rounded-xl bg-gradient-to-br from-sky-50 to-indigo-50/40 border border-sky-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-600 text-white flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Verified Corporate Buyer Invite
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Credit Line Sanctioned
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 leading-tight">
                          {inviteDetails.anchor.corporateName}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                          <span>GSTIN: <strong className="font-semibold text-slate-800">{inviteDetails.anchor.gstin}</strong></span>
                          <span>•</span>
                          <span>Sanctioned Limit: <strong className="font-bold text-emerald-700">
                            {inviteDetails.anchor.maxExposureLimit >= 10000000
                              ? `₹${(inviteDetails.anchor.maxExposureLimit / 10000000).toFixed(2)} Cr`
                              : `₹${(inviteDetails.anchor.maxExposureLimit / 100000).toFixed(2)} Lakhs`}
                          </strong></span>
                        </div>
                        {inviteDetails.email && (
                          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 bg-white/70 px-2.5 py-1 rounded-lg border border-slate-200/60">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>Official Email: <strong>{inviteDetails.email}</strong></span>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 leading-relaxed">
                        Your enterprise factoring line is sanctioned. Please create a permanent treasury password to activate your corporate portal and approve vendor invoices.
                      </div>

                      <form onSubmit={handleEntityLogin} autoComplete="off" className="space-y-3.5">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Create Treasury Password
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                              <Lock className="w-4 h-4" />
                            </div>
                            <input
                              type="password"
                              value={newPassword}
                              autoComplete="new-password"
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Minimum 8 characters"
                              minLength={8}
                              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-slate-900 text-sm outline-none font-medium placeholder:text-slate-400 bg-white"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Confirm Treasury Password
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                              <Lock className="w-4 h-4" />
                            </div>
                            <input
                              type="password"
                              value={confirmPassword}
                              autoComplete="new-password"
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Re-enter same password"
                              minLength={8}
                              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-slate-900 text-sm outline-none font-medium placeholder:text-slate-400 bg-white"
                              required
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                          className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm hover:shadow cursor-pointer disabled:opacity-50"
                        >
                          {loading ? "Activating Corporate Account..." : "Set Password & Launch Corporate Portal"}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </form>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Already set your password?</span>
                        <button
                          type="button"
                          onClick={() => setInviteToken("")}
                          className="font-bold text-sky-700 hover:text-sky-800 hover:underline cursor-pointer"
                        >
                          Sign in with email →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-semibold">Invite Token Expired or Not Found</strong>
                          <span>This link might have already been used, expired, or was entered incorrectly. You can sign in directly or contact support.</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setInviteToken("");
                          setErrorMsg(null);
                        }}
                        className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm cursor-pointer"
                      >
                        Proceed to Standard Email Sign In
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="p-3 mb-5 rounded-xl bg-sky-50/70 border border-sky-100 text-xs text-sky-900">
                    🏢 <strong>Corporate Treasury Portal:</strong> Review & approve bills uploaded by your suppliers.
                  </div>

                  <form onSubmit={handleEntityLogin} autoComplete="off" className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Official Corporate Email
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          value={email}
                          autoComplete="off"
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="corporate.email@company.com"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-slate-900 text-sm outline-none font-medium placeholder:text-slate-400 bg-white"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type="password"
                          value={password}
                          autoComplete="new-password"
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter password"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-slate-900 text-sm outline-none font-medium placeholder:text-slate-400 bg-white"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {loading ? "Authenticating..." : "Sign In to Corporate Portal"}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>

                  <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                    <Link
                      href="/corporate/apply"
                      className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:text-sky-800"
                    >
                      Apply for Enterprise Credit Line (GST Auto-Fill) →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INSTITUTIONAL INVESTOR LOGIN */}
          {activeTab === "INVESTOR" && (
            <div>
              {inviteToken && inviteDetails?.investor ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50/40 border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        Verified Institutional Funder Invite
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {inviteDetails.investor.entityName}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span>Type: <strong className="font-semibold text-slate-800">{inviteDetails.investor.investorType}</strong></span>
                    </div>
                    {inviteDetails.email && (
                      <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 bg-white/70 px-2.5 py-1 rounded-lg border border-slate-200/60">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>Official Email: <strong>{inviteDetails.email}</strong></span>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleEntityLogin} autoComplete="off" className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Create Funder Account Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type="password"
                          value={newPassword}
                          autoComplete="new-password"
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minimum 8 characters"
                          minLength={8}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 text-slate-900 text-sm outline-none font-medium placeholder:text-slate-400 bg-white"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type="password"
                          value={confirmPassword}
                          autoComplete="new-password"
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter same password"
                          minLength={8}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 text-slate-900 text-sm outline-none font-medium placeholder:text-slate-400 bg-white"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                      className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {loading ? "Activating Funder Account..." : "Set Password & Launch Portal"}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              ) : (
                <div>
                  <div className="p-3 mb-5 rounded-xl bg-purple-50/70 border border-purple-100 text-xs text-purple-900">
                    🏦 <strong>Institutional Funder Access:</strong> Deploy capital into RBI-compliant escrow factoring assets.
                  </div>

                  <form onSubmit={handleEntityLogin} autoComplete="off" className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Treasury / NBFC Email
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          value={email}
                          autoComplete="off"
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="treasury@nbfc-or-bank.com"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 text-slate-900 text-sm outline-none font-medium placeholder:text-slate-400 bg-white"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type="password"
                          value={password}
                          autoComplete="new-password"
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 text-slate-900 text-sm outline-none font-medium placeholder:text-slate-400 bg-white"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {loading ? "Authenticating..." : "Sign In to Investor Portal"}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 UdharCo Factoring Platform • Regulated under Factoring Regulation Act, 2011</p>
          <div className="flex items-center space-x-4 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              CERSAI Registry Active
            </span>
            <span className="flex items-center gap-1.5 text-sky-700">
              <span className="h-2 w-2 rounded-full bg-sky-500"></span>
              NPCI e-NACH Connected
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm">
          Loading portal...
        </div>
      }
    >
      <LoginContent />
    </React.Suspense>
  );
}
