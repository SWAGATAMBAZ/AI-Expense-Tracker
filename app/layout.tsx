import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNav } from "./components/BottomNav";
import { PageShell } from "./components/PageShell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "AI Expense Tracker",
  description: "Track your expenses and income with AI-assisted entry.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Expense Tracker",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4338ca",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const isDemoMode = Boolean(process.env.DEMO_USER_EMAIL);

  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh bg-[var(--color-surface-muted)] font-sans text-[var(--color-text-primary)] antialiased">
        <PageShell isDemoMode={isDemoMode}>{children}</PageShell>
        <BottomNav />
      </body>
    </html>
  );
}
