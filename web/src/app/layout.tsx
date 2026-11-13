import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UdharCo — Institutional Invoice Discounting & Escrow Engine",
  description: "Governed B2B Factoring & Invoice Discounting Platform for MSMEs and Corporate Anchors.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col relative bg-[#f4f7fb] selection:bg-emerald-500 selection:text-white">
        {/* Dynamic Vibrant Aurora Mesh Canvas (Apple macOS / iOS 3D Liquid Glass Engine) */}
        <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          {/* Top-Left Indigo-Violet Aurora Glow */}
          <div className="aurora-blob-1 absolute -top-40 -left-20 w-[720px] h-[720px] rounded-full bg-gradient-to-br from-indigo-600/28 via-violet-500/22 to-pink-500/14 blur-[130px]" />
          
          {/* Top-Right Emerald-Teal Aurora Glow */}
          <div className="aurora-blob-2 absolute -top-20 -right-24 w-[680px] h-[680px] rounded-full bg-gradient-to-bl from-emerald-400/30 via-teal-400/24 to-cyan-400/18 blur-[130px]" />
          
          {/* Bottom-Center Electric Sky-Sapphire Aurora Glow */}
          <div className="aurora-blob-3 absolute bottom-0 left-1/4 w-[850px] h-[600px] rounded-full bg-gradient-to-tr from-cyan-400/25 via-blue-500/22 to-indigo-600/18 blur-[140px]" />
          
          {/* Warm Coral / Amber Core Flare */}
          <div className="aurora-blob-1 absolute top-1/3 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-gradient-to-r from-amber-400/16 via-rose-400/14 to-violet-400/10 blur-[130px]" />
        </div>
        {children}
      </body>
    </html>
  );
}
