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
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(async () => ({ data: recentTransactions, error: null }));
  return builder;
}

let periodTransactions: unknown[] = [];
let recurringExpenses: unknown[] = [];
let recentTransactions: unknown[] = [];
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
    recentTransactions = [];
    salary = 60_000_00;

    const ui = await HomePage({ searchParams: makeSearchParams() });
    render(ui);

    expect(screen.getByText(/total spend/i)).toBeInTheDocument();
    expect(screen.getByText(/this month/i)).toBeInTheDocument();
    expect(screen.getAllByText("Food & Dining").length).toBeGreaterThan(0);
  });

  it("shows a setup prompt instead of a forecast when no salary is configured", async () => {
    periodTransactions = [];
    recurringExpenses = [];
    recentTransactions = [];
    salary = null;

    const ui = await HomePage({ searchParams: makeSearchParams() });
    render(ui);

    expect(screen.getByRole("link", { name: /set up salary/i })).toHaveAttribute(
      "href",
      "/profile"
    );
  });

  it("shows upcoming spend regardless of the selected range", async () => {
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
    recentTransactions = [];
    salary = 60_000_00;

    const ui = await HomePage({ searchParams: makeSearchParams({ range: "last_month" }) });
    render(ui);

    expect(screen.getByText(/upcoming spend/i)).toBeInTheDocument();
  });

  it("shows recent transactions with a link to view all", async () => {
    periodTransactions = [];
    recurringExpenses = [];
    recentTransactions = [
      {
        id: "txn-1",
        merchant: "Zomato",
        amount: 500_00,
        transaction_date: "2026-01-05",
        type: "expense",
        category: { name: "Food & Dining" },
      },
    ];
    salary = 60_000_00;

    const ui = await HomePage({ searchParams: makeSearchParams() });
    render(ui);

    expect(screen.getByText("Zomato")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view all/i })).toHaveAttribute(
      "href",
      "/transactions"
    );
  });

  it("does not let a far-future recurring expense understate this month's savings", async () => {
    periodTransactions = [];
    const future = new Date();
    future.setUTCMonth(future.getUTCMonth() + 6);
    const futureDate = future.toISOString().slice(0, 10);
    recurringExpenses = [
      {
        id: "rec-1",
        name: "Insurance",
        amount: 12_000_00,
        frequency: "yearly",
        next_due_date: futureDate,
        active: true,
      },
    ];
    recentTransactions = [];
    salary = 60_000_00;

    const ui = await HomePage({ searchParams: makeSearchParams() });
    render(ui);

    // Full salary, unreduced by a recurring expense due many months from now.
    expect(screen.getByText(/60,000/)).toBeInTheDocument();
  });

  it("shows empty-state copy when there are no transactions in the period", async () => {
    periodTransactions = [];
    recurringExpenses = [];
    recentTransactions = [];
    salary = 60_000_00;

    const ui = await HomePage({ searchParams: makeSearchParams() });
    render(ui);

    expect(screen.getAllByText(/no expenses recorded for this period yet/i).length).toBeGreaterThan(
      0
    );
    expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument();
  });
});
