"use client";

import { useState } from "react";
import Link from "next/link";
import type { ChatSessionSummary } from "@/app/actions/ai";

/**
 * Top-right trigger + slide-in right pane listing the user's chat sessions
 * (product ask: "a drawer of all the old messages session"). Each entry is
 * a plain Link to /ai?session=<id> - switching sessions is a normal Next.js
 * navigation (the server component reloads that session's messages), the
 * same pattern as every other drawer/menu in this app, rather than a
 * separate client-side chat-switching state machine.
 */
export function SessionsDrawer({
  sessions,
  activeSessionId,
}: {
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Chat history"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M2.5 9a6.5 6.5 0 1 1 2 4.7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M2.3 13.2 2 9.5l3.7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 5.5V9l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close chat history"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/30"
          />
          <div
            className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col gap-1 bg-[var(--color-surface)] p-4 shadow-lg"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-lg font-semibold tracking-tight">Chat history</span>
              <button
                type="button"
                aria-label="Close chat history"
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

            {sessions.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">No saved chats yet.</p>
            ) : (
              <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <Link
                      href={`/ai?session=${session.id}`}
                      onClick={() => setOpen(false)}
                      className={`block truncate rounded-lg px-3 py-2.5 text-sm font-medium ${
                        session.id === activeSessionId
                          ? "bg-[var(--color-primary)] text-white"
                          : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)]"
                      }`}
                    >
                      {session.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
