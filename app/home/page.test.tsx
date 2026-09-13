import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function makeTransactionsBuilder(data: unknown[]) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.gte = vi.fn(() => builder);
  builder.lte = vi.fn(async () => ({ data, error: null }));
  return builder;
}

let periodTransactions: unknown[] = [];
let recurringExpenses: unknown[] = [];
let salary: number | null = 60_000_00;

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
              maybeSingle: vi.fn(async () => ({
                data: { currency: "INR", monthly_salary: salary },
              })),
            })),
          })),
        };
      }
      if (table === "categories") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(async () => ({
              data: [
                { id: 1, name: "Food & Dining" },
                { id: 2, name: "Groceries" },
              ],
            })),
          })),
        };
      }
      if (table === "transactions") {
        return makeTransactionsBuilder(periodTransactions);
      }
      if (table === "recurring_expenses") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: recurringExpenses, error: null })),
            })),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  })),
}));

function makeSearchParams(params: Record<string, string> = {}) {
  return Promise.resolve(params);
}

describe("HomePage (dashboard)", () => {
  it("defaults to the current month with no range param and shows total spend", async () => {
    periodTransactions = [
      { amount: 500_00, type: "expense", category_id: 1, payment_method: "UPI" },
      { amount: 300_00, type: "expense", category_id: 2, payment_method: "Cash" },
    ];
    recurringExpenses = [];
    salary = 60_000_00;

    const ui = await HomePage({ searchParams: makeSearchParams() });
    render(ui);

    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/total spend/i)).toBeInTheDocument();
    // "This Month" appears both as the active filter chip and the card's period label.
    expect(screen.getAllByText(/this month/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Food & Dining").length).toBeGreaterThan(0);
  });

  it("shows a setup prompt instead of a forecast when no salary is configured", async () => {
    periodTransactions = [];
    recurringExpenses = [];
    salary = null;

    const ui = await HomePage({ searchParams: makeSearchParams() });
    render(ui);

    expect(screen.getByText(/set your monthly salary/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /set up profile/i })).toHaveAttribute(
      "href",
      "/profile"
    );
  });

  it("shows upcoming recurring expenses regardless of the selected range", async () => {
    periodTransactions = [];
    recurringExpenses = [
      {
        id: "rec-1",
        name: "Netflix",
        amount: 649_00,
        frequency: "monthly",
        next_due_date: "2020-01-01",
        active: true,
      },
    ];
    salary = 60_000_00;

    const ui = await HomePage({ searchParams: makeSearchParams({ range: "last_month" }) });
    render(ui);

    expect(screen.getByText(/upcoming spend/i)).toBeInTheDocument();
    expect(screen.getByText(/netflix/i)).toBeInTheDocument();
  });

  it("shows empty-state copy when there are no expenses in the period", async () => {
    periodTransactions = [];
    recurringExpenses = [];
    salary = 60_000_00;

    const ui = await HomePage({ searchParams: makeSearchParams() });
    render(ui);

    expect(screen.getAllByText(/no expenses recorded for this period yet/i).length).toBeGreaterThan(
      0
    );
  });
});
