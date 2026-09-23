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
  loadChatHistory: vi.fn(async () => []),
}));

describe("AiAssistantPage", () => {
  it("shows the chat panel and a way back home", async () => {
    const ui = await AiAssistantPage();
    render(ui);

    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back home/i })).toHaveAttribute("href", "/home");
  });

  it("renders persisted chat history instead of just the greeting", async () => {
    const { loadChatHistory } = await import("@/app/actions/ai");
    vi.mocked(loadChatHistory).mockResolvedValueOnce([
      { role: "user", text: "spent 500 on lunch" },
      { role: "assistant", text: "Added ₹500 expense at lunch." },
    ]);

    const ui = await AiAssistantPage();
    render(ui);

    expect(screen.getByText("spent 500 on lunch")).toBeInTheDocument();
    expect(screen.getByText("Added ₹500 expense at lunch.")).toBeInTheDocument();
    expect(screen.queryByText(/tell me about an expense/i)).not.toBeInTheDocument();
  });
});
