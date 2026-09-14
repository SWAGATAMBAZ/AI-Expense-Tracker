import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ProfilePage from "./page";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-1", email: "test@example.com" } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: {
              full_name: "Jane Doe",
              currency: "USD",
              monthly_salary: 500_000,
              salary_day: 5,
              bank_info: "Chase Bank",
            },
          })),
        })),
      })),
    })),
  })),
}));

describe("ProfilePage", () => {
  it("pre-fills the form with the user's existing profile", async () => {
    const ui = await ProfilePage();
    render(ui);

    expect(screen.getByLabelText(/^name$/i)).toHaveValue("Jane Doe");
    expect(screen.getByLabelText(/monthly salary/i)).toHaveValue("5000");
    expect(screen.getByLabelText(/salary day/i)).toHaveValue(5);
    expect(screen.getByLabelText(/preferred currency/i)).toHaveValue("USD");
    expect(screen.getByLabelText(/bank\/payment info/i)).toHaveValue("Chase Bank");
    expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});
