import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { email: "test@example.com" } } })),
    },
  })),
}));

describe("HomePage", () => {
  it("renders a welcome message including the signed-in user's email", async () => {
    const ui = await HomePage();
    render(ui);
    expect(
      screen.getByRole("heading", { name: /ai expense tracker/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/welcome back, test@example.com/i)).toBeInTheDocument();
  });
});
