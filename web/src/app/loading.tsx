import React from "react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-center relative overflow-hidden font-sans">
      <div className="glass-3d-card p-8 rounded-3xl shadow-2xl ring-1 ring-white/80 flex flex-col items-center max-w-sm w-full">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 font-black text-white text-2xl animate-pulse mb-4 ring-1 ring-white/40">
          UD
        </div>
        <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
          <span>Loading UdharCo Workspace</span>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        </div>
        <p className="text-xs text-slate-500 mt-1.5">
          Authenticating institutional escrow session...
        </p>
      </div>
    </div>
  );
}
