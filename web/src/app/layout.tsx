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
        className="min-h-full flex flex-col relative bg-[#f8fafc] text-slate-900 selection:bg-emerald-600 selection:text-white font-sans overflow-x-hidden"
      >
        {/* Crisp Executive Architectural Grid (Spotless Light Theme, Zero Smudge/Blobs) */}
        <div aria-hidden="true" className="fixed inset-0 pointer-events-none -z-10 bg-[#f8fafc]">
          {/* Subtle Precision Grid Background */}
          <div 
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: "linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)",
              backgroundSize: "48px 48px"
            }}
          />
          {/* Executive Top Horizon Gradient (Soft Platinum to Slate) */}
          <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-slate-100/90 via-slate-50/50 to-transparent pointer-events-none" />
        </div>

        {children}
      </body>
    </html>
  );
}
