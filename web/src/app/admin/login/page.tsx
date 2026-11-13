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
    <div className="min-h-screen bg-transparent text-slate-900 flex flex-col justify-between selection:bg-indigo-500 selection:text-white font-sans">
      {/* Header */}
      <header className="glass-3d-header sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-slate-900 to-indigo-700 flex items-center justify-center font-black text-white text-lg tracking-tight shadow-md ring-1 ring-white/40">
              UD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  UdharCo Admin
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-800 border border-indigo-500/30 backdrop-blur-md shadow-2xs">
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
            className="text-xs font-semibold text-slate-700 hover:text-indigo-600 border border-white/80 hover:border-indigo-300 bg-white/70 hover:bg-white backdrop-blur-md px-3.5 py-2 rounded-xl shadow-xs transition"
          >
            ← Back to User Login
          </Link>
        </div>
      </header>

      {/* Login Card */}
      <main className="flex-1 max-w-md w-full mx-auto px-6 py-10 flex flex-col justify-center">
        <div className="glass-3d-card p-8 sm:p-9 rounded-3xl shadow-2xl ring-1 ring-white/80">
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 backdrop-blur-md text-amber-900 border border-amber-500/30 mb-3 shadow-2xs">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              Restricted Operations Desk
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Admin Authentication
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Sign in with authorized administrator credentials.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-red-50/80 backdrop-blur-xs border border-red-200 text-red-700 text-xs flex items-start gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-50/80 backdrop-blur-xs border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 shadow-2xs">
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900 text-sm outline-none font-medium placeholder:text-slate-400 bg-white/80 backdrop-blur-xs focus:bg-white shadow-2xs transition"
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900 text-sm outline-none font-medium placeholder:text-slate-400 bg-white/80 backdrop-blur-xs focus:bg-white shadow-2xs transition"
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono tracking-widest text-slate-900 text-sm outline-none font-bold bg-white/80 backdrop-blur-xs focus:bg-white shadow-2xs"
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-md hover:shadow-lg cursor-pointer disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Sign In to Operations Desk"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      <footer className="border-t border-white/60 bg-white/60 backdrop-blur-xl py-4 text-center text-xs text-slate-500 shadow-xs">
        UdharCo Platform Admin • Confidential Operational Workspace
      </footer>
    </div>
  );
}
