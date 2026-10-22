"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  Lock,
  Mail,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [show2Fa, setShow2Fa] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    setLoading(true);
    try {
      const res = await fetch("/admin/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          totpCode: totpCode.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.requiresTwoFactor) {
          setShow2Fa(true);
          setSuccessMsg("Primary credentials verified. Enter your 6-digit TOTP code.");
          return;
        }
        throw new Error(data.error || "Admin authentication failed.");
      }

      setSuccessMsg("Admin verified. Loading operations center...");
      setTimeout(() => {
        window.location.href = "/admin";
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
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-slate-900 to-indigo-700 flex items-center justify-center font-black text-white text-lg tracking-tight shadow-md">
              UD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  UdharCo Admin
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Operations Console
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Central Factoring Orchestration & Risk Underwriting
              </p>
            </div>
          </div>

          <Link
            href="/login"
            className="text-xs font-semibold text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 bg-white px-3 py-1.5 rounded-lg shadow-2xs transition"
          >
            ← Back to User Login
          </Link>
        </div>
      </header>

      {/* Login Card */}
      <main className="flex-1 max-w-md w-full mx-auto px-6 py-10 flex flex-col justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xl p-8">
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 mb-3">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              Restricted Operations Desk
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Admin Authentication
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Sign in with authorized administrator credentials.
            </p>
          </div>

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

          <form onSubmit={handleAdminLogin} autoComplete="off" className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Admin Email Identifier
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
                  placeholder="admin@udharco.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900 text-sm outline-none font-medium placeholder:text-slate-400 bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Admin Password
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900 text-sm outline-none font-medium placeholder:text-slate-400 bg-white"
                  required
                />
              </div>
            </div>

            {show2Fa && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  6-Digit Authenticator (TOTP)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="000000"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono tracking-widest text-slate-900 text-sm outline-none font-bold"
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Sign In to Operations Desk"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        UdharCo Platform Admin • Confidential Operational Workspace
      </footer>
    </div>
  );
}
