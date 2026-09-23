import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AiAssistantPage from "./page";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-1", email: "test@example.com" } },
      })),
    },
  })),
}));

vi.mock("@/app/actions/ai", () => ({
  interpretMessage: vi.fn(),
  loadChatSessions: vi.fn(async () => []),
  loadSessionMessages: vi.fn(async () => []),
  getOrCreateFirstChatSessionId: vi.fn(async () => "first-chat-id"),
  createChatSession: vi.fn(),
}));

function makeSearchParams(params: Record<string, string> = {}) {
  return Promise.resolve(params);
}

describe("AiAssistantPage", () => {
  it("shows the chat panel, chat history drawer trigger, and a way back home", async () => {
    const ui = await AiAssistantPage({ searchParams: makeSearchParams() });
    render(ui);

    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /chat history/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back home/i })).toHaveAttribute("href", "/home");
  });

  it("defaults to First chat's persisted history instead of just the greeting", async () => {
    const { loadSessionMessages } = await import("@/app/actions/ai");
    vi.mocked(loadSessionMessages).mockResolvedValueOnce([
      { role: "user", text: "spent 500 on lunch" },
      { role: "assistant", text: "Added ₹500 expense at lunch." },
    ]);

    const ui = await AiAssistantPage({ searchParams: makeSearchParams() });
    render(ui);

    expect(loadSessionMessages).toHaveBeenCalledWith("first-chat-id");
    expect(screen.getByText("spent 500 on lunch")).toBeInTheDocument();
    expect(screen.getByText("Added ₹500 expense at lunch.")).toBeInTheDocument();
    expect(screen.queryByText(/tell me about an expense/i)).not.toBeInTheDocument();
  });

  it("shows a requested session's messages instead of First chat's when ?session= is one of the user's own", async () => {
    const { loadChatSessions, loadSessionMessages } = await import("@/app/actions/ai");
    vi.mocked(loadChatSessions).mockResolvedValueOnce([
      { id: "first-chat-id", title: "First chat", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "session-2", title: "Upcoming: Netflix", updatedAt: "2026-01-02T00:00:00.000Z" },
    ]);
    vi.mocked(loadSessionMessages).mockResolvedValueOnce([
      { role: "assistant", text: "Netflix (₹649.00) is due 5 Jan." },
    ]);

    const ui = await AiAssistantPage({ searchParams: makeSearchParams({ session: "session-2" }) });
    render(ui);

    expect(loadSessionMessages).toHaveBeenCalledWith("session-2");
    expect(screen.getByText("Netflix (₹649.00) is due 5 Jan.")).toBeInTheDocument();
  });

  it("falls back to First chat when ?session= doesn't match any of the user's sessions", async () => {
    const { loadChatSessions, loadSessionMessages } = await import("@/app/actions/ai");
    vi.mocked(loadChatSessions).mockResolvedValueOnce([
      { id: "first-chat-id", title: "First chat", updatedAt: "2026-01-01T00:00:00.000Z" },
    ]);

    const ui = await AiAssistantPage({ searchParams: makeSearchParams({ session: "not-mine" }) });
    render(ui);

    expect(loadSessionMessages).toHaveBeenCalledWith("first-chat-id");
  });
});
