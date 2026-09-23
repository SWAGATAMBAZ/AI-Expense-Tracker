"use client";

import { usePathname } from "next/navigation";

// The AI chat is the one page that needs to own its own scrolling (only the
// message list scrolls, header + input bar stay put) instead of the whole
// page scrolling - see app/ai/ChatPanel.tsx.
const FULL_SCREEN_PATHS = new Set(["/ai"]);

export function PageShell({
  children,
  isDemoMode,
}: {
  children: React.ReactNode;
  isDemoMode: boolean;
}) {
  const pathname = usePathname();
  const isFullScreen = FULL_SCREEN_PATHS.has(pathname);

  // Owned here (not rendered separately in layout.tsx) so its real height -
  // it can wrap to 2 lines on a narrow phone - is included in the flex
  // column's own layout math, not stacked on top of a hardcoded 100dvh and
  // pushing the page past the viewport.
  const banner = isDemoMode ? (
    <p className="shrink-0 bg-[var(--color-primary)] px-4 py-1.5 text-center text-xs font-medium text-white">
      Public demo — shared data, no login. Anyone with this link can add/edit/delete.
    </p>
  ) : null;

  if (isFullScreen) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col overflow-hidden" style={{ height: "100dvh" }}>
        {banner}
        <div
          className="flex min-h-0 flex-1 flex-col px-4"
          style={{ paddingTop: "var(--content-top-padding)" }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {banner}
      <div className="flex flex-1 flex-col px-4 pb-24" style={{ paddingTop: "var(--content-top-padding)" }}>
        {children}
      </div>
    </div>
  );
}
