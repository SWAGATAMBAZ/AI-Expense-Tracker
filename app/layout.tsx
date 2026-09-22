import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNav } from "./components/BottomNav";

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
        {isDemoMode ? (
          <p className="bg-[var(--color-primary)] px-4 py-1.5 text-center text-xs font-medium text-white">
            Public demo — shared data, no login. Anyone with this link can add/edit/delete.
          </p>
        ) : null}
        <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6 pb-24">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
