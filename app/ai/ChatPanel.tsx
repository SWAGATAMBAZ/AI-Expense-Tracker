"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { interpretMessage, type PendingIntent } from "@/app/actions/ai";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  href?: string;
}

const GREETING: ChatMessage = {
  role: "assistant",
  text: 'Tell me about an expense (e.g. "Spent 500 on lunch"), or ask me to edit/delete a recent one, add a recurring expense, pay a card bill, or answer things like "How much have I spent on food?" or "Should I buy earphones for 3000?".',
};

export function ChatPanel({
  initialMessages = [],
  sessionId,
}: {
  initialMessages?: ChatMessage[];
  sessionId?: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages.length > 0 ? initialMessages : [GREETING]
  );
  const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(null);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const messageListRef = useRef<HTMLDivElement>(null);

  // Jump to the latest message on load (persisted history can be long) and
  // after every new message, rather than showing the oldest history first.
  useEffect(() => {
    const el = messageListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isPending]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isPending) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");

    startTransition(async () => {
      try {
        const result = await interpretMessage(text, pendingIntent, sessionId ?? undefined);
        if (result.kind === "clarify") {
          setPendingIntent(result.pending);
          setMessages((prev) => [...prev, { role: "assistant", text: result.text }]);
        } else if (result.kind === "confirmation") {
          setPendingIntent(null);
          setMessages((prev) => [...prev, { role: "assistant", text: result.text, href: result.href }]);
        } else {
          setPendingIntent(null);
          setMessages((prev) => [...prev, { role: "assistant", text: result.text }]);
        }
      } catch {
        setPendingIntent(null);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "Something went wrong. Please try again." },
        ]);
      }
    });
  }

  return (
    // min-h-0: lets this actually shrink to fit the remaining space in
    // page.tsx's bounded column (PageShell makes /ai's outer container
    // exactly viewport-height with no scroll of its own) instead of
    // growing past it and causing a second, outer scrollbar.
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={messageListRef}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                message.role === "user"
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-surface-muted)] text-[var(--color-text-primary)]"
              }`}
            >
              {message.text}
              {message.href ? (
                <Link href={message.href} className="mt-1 block text-xs font-medium underline">
                  View
                </Link>
              ) : null}
            </div>
          </div>
        ))}
        {isPending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
              Thinking…
            </div>
          </div>
        ) : null}
      </div>

      {/* Fixed above the app-wide bottom nav (see --bottom-nav-height) so the
          input/send row stays reachable regardless of message-list length or
          on-screen keyboard, instead of scrolling with the page. "Back home"
          lives in this same docked row (not in normal page flow below it) -
          there's no free space between this bar and the bottom nav for a
          separate link to sit in without one covering the other. */}
      <div
        className="fixed inset-x-0 z-20 flex justify-center border-t border-[var(--color-border)] bg-[var(--color-surface)]"
        style={{ bottom: "var(--bottom-nav-height)" }}
      >
        <form onSubmit={handleSubmit} className="flex w-full max-w-md items-center gap-2 px-4 py-3">
          <Link
            href="/home"
            aria-label="Back home"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 3.5 5 8l5 4.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="e.g. Spent 500 on lunch"
            disabled={isPending}
            aria-label="Message"
            className="input-field flex-1"
          />
          <button
            type="submit"
            disabled={isPending || !input.trim()}
            className="btn-primary !w-auto shrink-0 px-4"
          >
            {isPending ? "…" : "Send"}
          </button>
        </form>
      </div>
      {/* Spacer reserving the space the now-fixed input bar no longer takes
          in normal flow, so it doesn't hide whatever comes after ChatPanel.
          shrink-0: a flex child shrinks by default, which would let this
          get squeezed thinner than the input bar it's meant to reserve
          room for on a very short viewport. */}
      <div aria-hidden className="shrink-0" style={{ height: "76px" }} />
    </div>
  );
}
