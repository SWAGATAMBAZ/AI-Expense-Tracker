"use client";

import { useState } from "react";

export function AIFabPlaceholder({ className }: { className?: string }) {
  const [showHint, setShowHint] = useState(false);

  return (
    <div className={className}>
      {showHint ? (
        <div className="absolute bottom-full right-0 mb-2 w-40 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-secondary)] shadow-sm">
          AI assistant coming soon
        </div>
      ) : null}
      <button
        type="button"
        aria-label="AI assistant (coming soon)"
        onClick={() => setShowHint((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-md"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path
            d="M11 2.5l1.8 4.9 4.9 1.8-4.9 1.8-1.8 4.9-1.8-4.9-4.9-1.8 4.9-1.8L11 2.5z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  );
}
