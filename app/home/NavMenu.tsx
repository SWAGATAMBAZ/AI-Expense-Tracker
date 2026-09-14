"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";

export function NavMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen((v) => !v)}
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
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-full z-20 mt-2 flex w-48 flex-col gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-sm">
            <Link
              href="/transactions"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)]"
            >
              Transactions
            </Link>
            <Link
              href="/recurring"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)]"
            >
              Recurring expenses
            </Link>
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)]"
            >
              Profile
            </Link>
            <form action={signOut} className="border-t border-[var(--color-border)] pt-1">
              <button
                type="submit"
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--color-danger)] hover:bg-[var(--color-surface-muted)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}
