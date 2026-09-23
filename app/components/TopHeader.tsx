import Image from "next/image";

/**
 * The brand header - a fixed white bar (same visual family as BottomNav)
 * with the Spendify logo centered, shown on every page. Unlike BottomNav
 * (app navigation, which makes sense to hide pre-auth) this is pure
 * branding, so there's no per-route hiding logic here.
 */
export function TopHeader() {
  return (
    <header
      className="fixed inset-x-0 top-0 z-30 flex justify-center border-b border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-14 w-full max-w-md items-center justify-center px-4">
        <Image
          src="/brand/spendify-logo.png"
          alt="Spendify"
          width={272}
          height={91}
          priority
          className="h-7 w-auto"
        />
      </div>
    </header>
  );
}
