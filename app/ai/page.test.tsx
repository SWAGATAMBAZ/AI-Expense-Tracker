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

describe("AiAssistantPage", () => {
  it("shows coming-soon copy and a way back home", async () => {
    const ui = await AiAssistantPage();
    render(ui);

    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back home/i })).toHaveAttribute("href", "/home");
  });
});
