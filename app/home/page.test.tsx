import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/home/page";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("HomePage", () => {
  it("falls back to email when the user has no full_name metadata", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { email: "test@example.com" } } })),
      },
    } as never);

    const ui = await HomePage();
    render(ui);
    expect(
      screen.getByRole("heading", { name: /ai expense tracker/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/welcome back, test@example.com/i)).toBeInTheDocument();
  });

  it("prefers the user's full_name over their email when available", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              email: "test@example.com",
              user_metadata: { full_name: "Jordan Rivera" },
            },
          },
        })),
      },
    } as never);

    const ui = await HomePage();
    render(ui);
    expect(screen.getByText(/welcome back, jordan rivera/i)).toBeInTheDocument();
  });
});
