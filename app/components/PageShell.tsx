"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// The AI chat is the one page that needs to own its own scrolling (only the
// message list scrolls, header + input bar stay put) instead of the whole
// page scrolling - see app/ai/ChatPanel.tsx.
const FULL_SCREEN_PATHS = new Set(["/ai"]);

// The 5 bottom-nav destinations (see BottomNav.tsx) - the app's "home base"
// screens a user can jump to directly at any point. The phone back button
// from any of these should always land on the dashboard, not wherever the
// user happened to have come from (a transaction detail, an edit form,
// nested a few pages deep) - see the popstate guard below.
const BACK_TO_HOME_PATHS = new Set(["/transactions", "/recurring/new", "/ai", "/transactions/new", "/cards"]);

export function PageShell({
  children,
  isDemoMode,
}: {
  children: React.ReactNode;
  isDemoMode: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isFullScreen = FULL_SCREEN_PATHS.has(pathname);

  useEffect(() => {
    if (!BACK_TO_HOME_PATHS.has(pathname)) return;
    // Silently duplicate the current history entry the moment we land here
    // (however we got here - a bottom-nav tap, or stepping back through a
    // deeper stack). The *next* back press pops that duplicate (same URL,
    // no visible change) and fires popstate, which we catch here and swap
    // in /home via replace - so the real back-off point is always the
    // dashboard, and it doesn't leave an extra "back to here" entry behind.
    window.history.pushState(null, "", window.location.href);
    function handlePopState() {
      router.replace("/home");
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [pathname, router]);

  // Owned here (not rendered separately in layout.tsx) so its height is
  // included in the flex column's own layout math, not stacked on top of a
  // hardcoded 100dvh and pushing the page past the viewport. `truncate`
  // (not letting it wrap) is deliberate - single line, thinner than the
  // header above it, per the product ask.
  const banner = isDemoMode ? (
    <p className="shrink-0 truncate bg-[var(--color-primary)] px-4 py-1 text-center text-[11px] font-medium text-white">
      Public demo — shared data, no login
    </p>
  ) : null;

  if (isFullScreen) {
    return (
      <div
        className="mx-auto flex w-full max-w-md flex-col overflow-hidden"
        style={{ height: "100dvh", paddingTop: "var(--top-header-height)" }}
      >
        {banner}
        <div className="flex min-h-0 flex-1 flex-col px-4" style={{ paddingTop: "var(--content-gap)" }}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col"
      style={{ paddingTop: "var(--top-header-height)" }}
    >
      {banner}
      <div className="flex flex-1 flex-col px-4 pb-24" style={{ paddingTop: "var(--content-gap)" }}>
        {children}
      </div>
    </div>
  );
}
