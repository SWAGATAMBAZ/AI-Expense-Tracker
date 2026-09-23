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
