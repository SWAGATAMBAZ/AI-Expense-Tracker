import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransactionForm } from "./TransactionForm";
import type { TransactionActionState } from "@/app/actions/transactions";

const categories = [
  { id: 1, name: "Food & Dining" },
  { id: 2, name: "Groceries" },
];

describe("TransactionForm", () => {
  it("renders every field, all categories, and all transaction types", () => {
    const action = vi.fn(async (): Promise<TransactionActionState> => ({}));

    render(
      <TransactionForm
        action={action}
        categories={categories}
        submitLabel="Add transaction"
        pendingLabel="Adding…"
      />
    );

    expect(screen.getByLabelText(/merchant/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/payment method/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/account\/card/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();

    const categorySelect = screen.getByLabelText(/category/i);
    expect(categorySelect.querySelectorAll("option")).toHaveLength(categories.length + 1);

    const typeSelect = screen.getByLabelText(/transaction type/i);
    expect(typeSelect.querySelectorAll("option")).toHaveLength(4);

    expect(screen.getByRole("button", { name: /add transaction/i })).toBeInTheDocument();
  });

  it("pre-fills default values for editing", () => {
    const action = vi.fn(async (): Promise<TransactionActionState> => ({}));

    render(
      <TransactionForm
        action={action}
        categories={categories}
        defaultValues={{
          merchant: "Zomato",
          amountRupees: 500,
          categoryId: 1,
          date: "2026-01-01",
          type: "expense",
        }}
        submitLabel="Save changes"
        pendingLabel="Saving…"
      />
    );

    expect(screen.getByLabelText(/merchant/i)).toHaveValue("Zomato");
    expect(screen.getByLabelText(/amount/i)).toHaveValue("500");
    expect(screen.getByLabelText(/date/i)).toHaveValue("2026-01-01");
    expect(screen.getByLabelText(/category/i)).toHaveValue("1");
  });
});
