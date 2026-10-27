import React from "react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 font-black text-white text-xl animate-pulse mb-4">
        UD
      </div>
      <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
        <span>Loading UdharCo Workspace</span>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
      </div>
      <p className="text-xs text-slate-500 mt-1">
        Authenticating institutional escrow session...
      </p>
    </div>
  );
}
