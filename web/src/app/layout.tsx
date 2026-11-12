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
      <body suppressHydrationWarning className="min-h-full flex flex-col relative bg-slate-50 selection:bg-emerald-500 selection:text-white">
        {/* Ambient Glassmorphic Mesh Lighting (Subtle brand glow in Indigo, Emerald & Sky) */}
        <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute -top-32 -left-20 w-[450px] h-[450px] rounded-full bg-gradient-to-br from-indigo-500/12 via-indigo-400/8 to-transparent blur-3xl" />
          <div className="absolute top-24 -right-20 w-[480px] h-[480px] rounded-full bg-gradient-to-bl from-emerald-500/12 via-teal-400/8 to-transparent blur-3xl" />
          <div className="absolute bottom-10 left-1/3 w-[550px] h-[380px] rounded-full bg-gradient-to-tr from-sky-500/10 via-indigo-400/8 to-transparent blur-3xl" />
        </div>
        {children}
      </body>
    </html>
  );
}
