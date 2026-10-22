import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import DashboardClient from "@/components/DashboardClient";
import Link from "next/link";
import { ShieldCheck, LogOut, Building2, User, Wallet } from "lucide-react";

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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-emerald-500 flex items-center justify-center shadow-md shadow-indigo-500/10 font-black text-white text-lg tracking-tight">
              UD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  UdharCo
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
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
              <span className="text-xs font-bold text-slate-900 block truncate max-w-[200px]">{entityName}</span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md mt-0.5 ${
                  session.role === "SELLER"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : session.role === "ANCHOR"
                    ? "bg-sky-50 text-sky-700 border border-sky-200"
                    : "bg-purple-50 text-purple-700 border border-purple-200"
                }`}
              >
                {session.role === "SELLER" ? (
                  <>
                    <User className="w-3 h-3" />
                    MSME Seller Portal
                  </>
                ) : session.role === "ANCHOR" ? (
                  <>
                    <Building2 className="w-3 h-3" />
                    Corporate Buyer Portal
                  </>
                ) : (
                  <>
                    <Wallet className="w-3 h-3" />
                    Institutional Investor
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition"
                title="Switch demo account"
              >
                Switch Account
              </Link>
              <form action="/api/v1/auth/logout" method="POST">
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg border border-red-200 hover:border-red-300 bg-red-50 hover:bg-red-100 text-xs font-medium text-red-700 transition flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
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
