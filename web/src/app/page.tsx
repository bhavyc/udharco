import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import DashboardClient from "@/components/DashboardClient";
import Link from "next/link";
import { ShieldCheck, LogOut, Building2, User, Wallet } from "lucide-react";

export const instant = false;

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Load tenant-isolated data based on authenticated role & entityId
  let entityName = "Verified Participant";
  let invoicesWhere = {};

  if (session.role === "SELLER") {
    const seller = await prisma.seller.findUnique({
      where: { id: session.entityId },
    });
    if (seller) entityName = seller.legalName;
    invoicesWhere = { sellerId: session.entityId };
  } else if (session.role === "ANCHOR") {
    const anchor = await prisma.anchor.findUnique({
      where: { id: session.entityId },
    });
    if (anchor) entityName = anchor.corporateName;
    invoicesWhere = { anchorId: session.entityId };
  } else if (session.role === "INVESTOR") {
    const investor = await prisma.investor.findUnique({
      where: { id: session.entityId },
    });
    if (investor) entityName = investor.entityName;
    invoicesWhere = {
      OR: [
        { status: "LISTED" },
        { fundingBids: { some: { investorId: session.entityId } } },
      ],
    };
  }

  const [sellers, anchors, investors, invoices] = await Promise.all([
    prisma.seller.findMany(),
    prisma.anchor.findMany(),
    prisma.investor.findMany(),
    prisma.invoice.findMany({
      where: invoicesWhere,
      include: {
        seller: true,
        anchor: true,
        escrowTransactions: { orderBy: { createdAt: "desc" } },
        settlementRecord: true,
        fundingBids: { include: { investor: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

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
      {/* Top Navigation Bar: Apple Liquid Glass */}
      <header className="glass-3d-header sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 font-black text-white text-lg tracking-tight ring-1 ring-white/60">
              UD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-slate-900">
                  UdharCo
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-800 border border-emerald-500/30 backdrop-blur-md shadow-2xs">
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
          <div className="flex items-center space-x-3.5">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-slate-900 block truncate max-w-[200px]">{entityName}</span>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full mt-0.5 border backdrop-blur-md shadow-2xs ${
                  session.role === "SELLER"
                    ? "bg-emerald-500/15 text-emerald-800 border-emerald-500/30"
                    : session.role === "ANCHOR"
                    ? "bg-sky-500/15 text-sky-800 border-sky-500/30"
                    : "bg-purple-500/15 text-purple-800 border-purple-500/30"
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
                className="px-3 py-1.5 rounded-xl border border-white/80 bg-white/70 hover:bg-white/95 text-xs font-bold text-slate-700 backdrop-blur-md shadow-xs hover:shadow transition-all duration-200"
                title="Switch demo account"
              >
                Switch Account
              </Link>
              <form action="/api/v1/auth/logout" method="POST">
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl border border-red-200/80 bg-red-500/10 hover:bg-red-500/20 text-xs font-bold text-red-700 backdrop-blur-md shadow-xs hover:shadow transition-all duration-200 flex items-center gap-1.5 cursor-pointer"
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
