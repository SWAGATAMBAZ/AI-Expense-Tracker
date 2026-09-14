"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { interpretMessage, type PendingIntent } from "@/app/actions/ai";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  href?: string;
}

const GREETING: ChatMessage = {
  role: "assistant",
  text: 'Tell me about an expense — e.g. "Spent 500 on lunch" — or ask me to edit/delete a recent one, or add a recurring expense.',
};

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(null);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isPending) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");

    startTransition(async () => {
      try {
        const result = await interpretMessage(text, pendingIntent);
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
    <div className="flex flex-col gap-3">
      <div
        className="flex flex-col gap-2 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
        style={{ maxHeight: 420 }}
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
          on-screen keyboard, instead of scrolling with the page. */}
      <div
        className="fixed inset-x-0 z-20 flex justify-center border-t border-[var(--color-border)] bg-[var(--color-surface)]"
        style={{ bottom: "var(--bottom-nav-height)" }}
      >
        <form onSubmit={handleSubmit} className="flex w-full max-w-md gap-2 px-4 py-3">
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
          in normal flow, so later page content (e.g. the "Back home" link)
          isn't hidden underneath it. */}
      <div aria-hidden style={{ height: "76px" }} />
    </div>
  );
}
