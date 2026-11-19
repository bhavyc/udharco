import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { backendFetch } from "@/lib/backend";
import DashboardClient from "@/components/DashboardClient";
import Link from "next/link";
import { ShieldCheck, LogOut, Building2, User, Wallet } from "lucide-react";

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Load tenant-isolated data from the 100% Go Backend Engine
  let entityName = "Verified Participant";
  let sellers: any[] = [];
  let anchors: any[] = [];
  let investors: any[] = [];
  let invoices: any[] = [];

  try {
    const res = await backendFetch("/api/v1/dashboard");
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        entityName = data.entityName || entityName;
        sellers = data.sellers || [];
        anchors = data.anchors || [];
        investors = data.investors || [];
        invoices = data.invoices || [];
      }
    }
  } catch (e) {
    console.error("Failed to fetch dashboard data from Go backend:", e);
  }

  const currentUser = {
    userId: session.userId,
    role: session.role,
    entityId: session.entityId,
    email: session.email,
    mobile: session.mobile,
    entityName,
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-900 font-sans">
      {/* Top Navigation Bar: Executive Stripe / Mercury Institutional Header */}
      <header className="bg-white/95 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200/90 shadow-2xs transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center font-black text-white text-base tracking-tight shadow-sm ring-1 ring-slate-800">
              UD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                  UdharCo
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  RBI Regulated Escrow
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Instant B2B Invoice Cash & Escrow Network
              </p>
            </div>
          </div>

          {/* User Badge & Authentication Controls */}
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-slate-900 block truncate max-w-[220px]">{entityName}</span>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-md mt-0.5 border ${
                  session.role === "SELLER"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : session.role === "ANCHOR"
                    ? "bg-sky-50 text-sky-800 border-sky-200"
                    : "bg-purple-50 text-purple-800 border-purple-200"
                }`}
              >
                {session.role === "SELLER" ? (
                  <>
                    <User className="w-3 h-3 text-emerald-600" />
                    MSME Seller Portal
                  </>
                ) : session.role === "ANCHOR" ? (
                  <>
                    <Building2 className="w-3 h-3 text-sky-600" />
                    Corporate Buyer Portal
                  </>
                ) : (
                  <>
                    <Wallet className="w-3 h-3 text-purple-600" />
                    Institutional Investor
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs hover:shadow-xs transition"
                title="Switch demo account"
              >
                Switch Account
              </Link>
              <form action="/api/v1/auth/logout" method="POST">
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 shadow-2xs hover:shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-600" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Interactive App Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <React.Suspense fallback={<div className="text-slate-500 text-sm py-12 text-center">Loading dashboard...</div>}>
          <DashboardClient
            currentUser={currentUser}
            initialSellers={JSON.parse(JSON.stringify(sellers))}
            initialAnchors={JSON.parse(JSON.stringify(anchors))}
            initialInvestors={JSON.parse(JSON.stringify(investors))}
            initialInvoices={JSON.parse(JSON.stringify(invoices))}
          />
        </React.Suspense>
      </main>
    </div>
  );
}
