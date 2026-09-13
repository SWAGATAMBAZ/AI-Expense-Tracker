import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import TransactionsPage from "./page";

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
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn(async () => ({
              data: [
                {
                  id: "txn-1",
                  merchant: "Zomato",
                  amount: 50_000,
                  currency: "INR",
                  transaction_date: "2026-01-05",
                  payment_method: "UPI",
                  type: "expense",
                  category: { name: "Food & Dining" },
                },
                {
                  id: "txn-2",
                  merchant: "Salary",
                  amount: 5_000_000,
                  currency: "INR",
                  transaction_date: "2026-01-01",
                  payment_method: null,
                  type: "income",
                  category: null,
                },
              ],
            })),
          })),
        })),
      })),
    })),
  })),
}));

describe("TransactionsPage", () => {
  it("renders every transaction belonging to the signed-in user", async () => {
    const ui = await TransactionsPage();
    render(ui);

    expect(screen.getByText("Zomato")).toBeInTheDocument();
    expect(screen.getByText("Food & Dining")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.getByText("Uncategorized")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\+ add/i })).toHaveAttribute(
      "href",
      "/transactions/new"
    );
  });
});
