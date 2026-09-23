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
    href: "/cards",
    label: "Credit cards",
    icon: (
      <>
        <rect x="2" y="4" width="14" height="10" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M2 7.5h14" stroke="currentColor" strokeWidth="1.6" />
      </>
    ),
  },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  if (isHidden(pathname)) return null;

  const [transactions, recurring, cards] = NAV_ITEMS;
  const transactionsActive =
    pathname === transactions.href ||
    (pathname.startsWith(`${transactions.href}/`) && pathname !== "/transactions/new");
  const recurringActive = pathname === "/recurring" || pathname.startsWith("/recurring/");
  const cardsActive = pathname === cards.href;

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
          {/* A main sparkle plus two smaller accent sparkles - the common
              "AI/magic" glyph (as in Gemini/Notion AI), rather than a single
              plain diamond. */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
              fill="currentColor"
            />
            <path
              d="M18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"
              fill="currentColor"
              opacity="0.85"
            />
            <path
              d="M16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
              fill="currentColor"
              opacity="0.85"
            />
          </svg>
        </Link>

        <NavButton
          item={{ href: "/transactions/new", label: "Add expense", icon: <PlusIcon /> }}
          active={pathname === "/transactions/new"}
        />
        <NavButton item={cards} active={cardsActive} />
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
