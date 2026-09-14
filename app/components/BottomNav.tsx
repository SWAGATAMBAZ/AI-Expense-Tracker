"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Hidden only on pre-auth/one-time-setup pages; visible everywhere else in
// the authenticated app (including form/detail sub-pages) so it's always
// reachable, per the product decision to make it a persistent app-wide nav.
const HIDDEN_PATH_PREFIXES = ["/login", "/register", "/onboarding"];

function isHidden(pathname: string): boolean {
  if (pathname === "/") return true;
  return HIDDEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

const NAV_ITEMS = [
  {
    href: "/transactions",
    label: "Transactions",
    icon: (
      <path
        d="M3 4.5h12M3 9h12M3 13.5h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    ),
  },
  {
    href: "/recurring/new",
    label: "Add recurring expense",
    icon: (
      <path
        d="M3 9a6 6 0 0 1 10.2-4.3M15 9a6 6 0 0 1-10.2 4.3M13.2 2.7v2.3h-2.3M4.8 15.3V13h2.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/profile",
    label: "Account",
    icon: (
      <path
        d="M9 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 15c.7-2.8 3-4.5 5.5-4.5s4.8 1.7 5.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  if (isHidden(pathname)) return null;

  const [transactions, recurring, account] = NAV_ITEMS;
  const transactionsActive =
    pathname === transactions.href ||
    (pathname.startsWith(`${transactions.href}/`) && pathname !== "/transactions/new");
  const recurringActive = pathname === "/recurring" || pathname.startsWith("/recurring/");

  return (
    <nav
      aria-label="Quick actions"
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <NavButton item={transactions} active={transactionsActive} />
        <NavButton item={recurring} active={recurringActive} />

        <Link
          href="/ai"
          aria-label="AI feature"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-md"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              d="M11 2.5l1.8 4.9 4.9 1.8-4.9 1.8-1.8 4.9-1.8-4.9-4.9-1.8 4.9-1.8L11 2.5z"
              fill="currentColor"
            />
          </svg>
        </Link>

        <NavButton
          item={{ href: "/transactions/new", label: "Add expense", icon: <PlusIcon /> }}
          active={pathname === "/transactions/new"}
        />
        <NavButton item={account} active={pathname === account.href} />
      </div>
    </nav>
  );
}

function PlusIcon() {
  return (
    <path
      d="M9 3.5v11M3.5 9h11"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  );
}

function NavButton({
  item,
  active,
}: {
  item: { href: string; label: string; icon: React.ReactNode };
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
        active
          ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_8%,white)] text-[var(--color-primary)]"
          : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        {item.icon}
      </svg>
    </Link>
  );
}
