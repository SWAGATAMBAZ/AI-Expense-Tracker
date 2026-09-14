import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RecurringExpensesPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-1", email: "test@example.com" } },
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { currency: "INR" } })),
            })),
          })),
        };
      }
      if (table === "recurring_expenses") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({
              data: [
                {
                  id: "rec-1",
                  name: "Apartment Rent",
                  amount: 20_000_00,
                  frequency: "monthly",
                  next_due_date: "2020-01-01",
                  active: true,
                  category: { name: "Rent" },
                },
                {
                  id: "rec-2",
                  name: "Old Gym",
                  amount: 1_500_00,
                  frequency: "monthly",
                  next_due_date: "2020-01-01",
                  active: false,
                  category: null,
                },
              ],
            })),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  })),
}));

describe("RecurringExpensesPage", () => {
  it("renders active and inactive recurring expenses with an upcoming total", async () => {
    const ui = await RecurringExpensesPage();
    render(ui);

    expect(screen.getByText("Apartment Rent")).toBeInTheDocument();
    expect(screen.getByText("Old Gym")).toBeInTheDocument();
    expect(screen.getByText("Upcoming spend")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\+ add/i })).toHaveAttribute(
      "href",
      "/recurring/new"
    );
  });
});
