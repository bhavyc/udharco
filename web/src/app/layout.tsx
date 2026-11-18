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
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col relative bg-[#f4f7fb] text-slate-900 selection:bg-emerald-600 selection:text-white font-sans overflow-x-hidden"
      >
        {/* Dynamic Vibrant Aurora Mesh Canvas (Apple macOS 3D Liquid Glass Engine) */}
        <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          {/* Top-Left Indigo-Violet Aurora Glow */}
          <div className="aurora-blob-1 absolute -top-36 -left-24 w-[740px] h-[740px] rounded-full bg-gradient-to-br from-indigo-500/25 via-violet-400/20 to-pink-500/12 blur-[130px]" />
          
          {/* Top-Right Emerald-Teal Aurora Glow */}
          <div className="aurora-blob-2 absolute -top-20 -right-24 w-[700px] h-[700px] rounded-full bg-gradient-to-bl from-emerald-400/26 via-teal-300/22 to-cyan-400/16 blur-[130px]" />
          
          {/* Bottom-Center Electric Sky-Sapphire Glow */}
          <div className="aurora-blob-3 absolute -bottom-20 left-1/4 w-[860px] h-[640px] rounded-full bg-gradient-to-tr from-cyan-400/22 via-blue-500/18 to-indigo-600/15 blur-[140px]" />
          
          {/* Center Amber / Coral Light Refraction Core */}
          <div className="aurora-blob-1 absolute top-1/3 left-1/2 -translate-x-1/2 w-[540px] h-[540px] rounded-full bg-gradient-to-r from-amber-400/14 via-rose-300/12 to-violet-400/10 blur-[130px]" />
          
          {/* Fine Subtle Mesh Dot Texture Overlay */}
          <div 
            className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
            style={{
              backgroundImage: "radial-gradient(#0f172a 1px, transparent 1px)",
              backgroundSize: "24px 24px"
            }}
          />
        </div>

        {children}
      </body>
    </html>
  );
}
