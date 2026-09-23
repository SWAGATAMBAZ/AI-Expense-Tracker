import Image from "next/image";
import Link from "next/link";
import { HeaderMenu } from "./HeaderMenu";

/**
 * The brand header - a fixed white bar (same visual family as BottomNav)
 * with the Spendify logo centered and the menu trigger on the right, shown
 * on every page. Unlike BottomNav (app navigation, which makes sense to
 * hide pre-auth) this is pure branding + the menu, so there's no per-route
 * hiding logic here.
 */
export function TopHeader({ isDemoMode }: { isDemoMode: boolean }) {
  return (
    <header
      className="fixed inset-x-0 top-0 z-30 flex justify-center border-b border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="relative flex h-12 w-full max-w-md items-center justify-center px-4">
        <div className="absolute left-4">
          <Link
            href="/inbox"
            aria-label="Inbox"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="4" width="14" height="10" rx="1.6" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M2.5 4.8 9 10l6.5-5.2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
        <Link href="/home" aria-label="Spendify home">
          <Image
            src="/brand/spendify-logo.png"
            alt="Spendify"
            width={272}
            height={91}
            priority
            className="h-9 w-auto"
          />
        </Link>
        <div className="absolute right-4">
          <HeaderMenu isDemoMode={isDemoMode} />
        </div>
      </div>
    </header>
  );
}
