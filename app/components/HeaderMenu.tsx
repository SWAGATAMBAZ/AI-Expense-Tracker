"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";

const MENU_LINKS = [
  { href: "/home", label: "Home" },
  { href: "/transactions", label: "Transactions" },
  { href: "/recurring", label: "Recurring expenses" },
  { href: "/cards", label: "Credit cards" },
  { href: "/ai", label: "AI assistant" },
  { href: "/profile", label: "Profile" },
] as const;

/**
 * The header's right-side menu trigger + slide-in side pane. Lives in the
 * global TopHeader now (was home-page-only before), so every link here
 * needs to make sense from anywhere in the app - "Home" included, unlike
 * the old home-page dropdown which didn't need to link to itself.
 */
export function HeaderMenu({ isDemoMode = false }: { isDemoMode?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M2.5 4.5h13M2.5 9h13M2.5 13.5h13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/30"
          />
          <div
            className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col gap-1 bg-[var(--color-surface)] p-4 shadow-lg"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-lg font-semibold tracking-tight">Menu</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3.5 3.5l9 9M12.5 3.5l-9 9"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {MENU_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)]"
              >
                {link.label}
              </Link>
            ))}

            {/* In demo mode, signing out would only bounce the visitor right
                back into the shared demo account via the proxy - hide it
                rather than offer an action that appears to do nothing. */}
            {isDemoMode ? null : (
              <form action={signOut} className="mt-auto border-t border-[var(--color-border)] pt-2">
                <button
                  type="submit"
                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-surface-muted)]"
                >
                  Sign out
                </button>
              </form>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
