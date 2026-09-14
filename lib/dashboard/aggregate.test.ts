import { describe, expect, it } from "vitest";
import {
  computeTotalSpend,
  computeTotalIncome,
  computeCategoryBreakdown,
  computePaymentMethodMix,
  computeSavingsForecast,
} from "./aggregate";

describe("computeTotalSpend", () => {
  it("sums expenses, ignoring income and transfers", () => {
    const total = computeTotalSpend([
      { amount: 500_00, type: "expense", category_id: 1, payment_method: "UPI" },
      { amount: 5_000_00, type: "income", category_id: null, payment_method: null },
      { amount: 1_000_00, type: "transfer", category_id: null, payment_method: null },
      { amount: 300_00, type: "expense", category_id: 2, payment_method: "Cash" },
    ]);
    expect(total).toBe(800_00);
  });

  it("nets a refund against spend rather than ignoring it", () => {
    const total = computeTotalSpend([
      { amount: 500_00, type: "expense", category_id: 1, payment_method: "UPI" },
      { amount: 200_00, type: "refund", category_id: 1, payment_method: "UPI" },
    ]);
    expect(total).toBe(300_00);
  });

  it("floors at 0 when refunds exceed expenses in the period", () => {
    const total = computeTotalSpend([
      { amount: 100_00, type: "expense", category_id: 1, payment_method: "UPI" },
      { amount: 400_00, type: "refund", category_id: 1, payment_method: "UPI" },
    ]);
    expect(total).toBe(0);
  });

  it("returns 0 for no transactions", () => {
    expect(computeTotalSpend([])).toBe(0);
  });
});

describe("computeTotalIncome", () => {
  it("sums income transactions, ignoring everything else", () => {
    const total = computeTotalIncome([
      { amount: 5_000_00, type: "income", category_id: null, payment_method: null },
      { amount: 500_00, type: "expense", category_id: 1, payment_method: "UPI" },
      { amount: 1_200_00, type: "income", category_id: null, payment_method: null },
    ]);
    expect(total).toBe(6_200_00);
  });

  it("returns 0 for no income transactions", () => {
    expect(
      computeTotalIncome([{ amount: 500_00, type: "expense", category_id: 1, payment_method: "UPI" }])
    ).toBe(0);
  });
});

describe("computeCategoryBreakdown", () => {
  const categories = [
    { id: 1, name: "Food & Dining" },
    { id: 2, name: "Groceries" },
  ];

  it("groups expenses by category, sorted by amount descending, with percentages", () => {
    const result = computeCategoryBreakdown(
      [
        { amount: 300_00, type: "expense", category_id: 2, payment_method: null },
        { amount: 700_00, type: "expense", category_id: 1, payment_method: null },
        { amount: 1_000_00, type: "income", category_id: 1, payment_method: null },
      ],
      categories
    );
    expect(result).toEqual([
      { categoryId: 1, categoryName: "Food & Dining", amount: 700_00, percentage: 70 },
      { categoryId: 2, categoryName: "Groceries", amount: 300_00, percentage: 30 },
    ]);
  });

  it("groups a null category_id as Uncategorized", () => {
    const result = computeCategoryBreakdown(
      [{ amount: 100_00, type: "expense", category_id: null, payment_method: null }],
      categories
    );
    expect(result).toEqual([
      { categoryId: null, categoryName: "Uncategorized", amount: 100_00, percentage: 100 },
    ]);
  });

  it("returns an empty array for no expense transactions", () => {
    expect(computeCategoryBreakdown([], categories)).toEqual([]);
  });

  it("nets a refund against its category instead of ignoring it", () => {
    const result = computeCategoryBreakdown(
      [
        { amount: 700_00, type: "expense", category_id: 1, payment_method: null },
        { amount: 200_00, type: "refund", category_id: 1, payment_method: null },
        { amount: 300_00, type: "expense", category_id: 2, payment_method: null },
      ],
      categories
    );
    expect(result).toEqual([
      { categoryId: 1, categoryName: "Food & Dining", amount: 500_00, percentage: 62.5 },
      { categoryId: 2, categoryName: "Groceries", amount: 300_00, percentage: 37.5 },
    ]);
  });

  it("drops a category fully offset by its own refunds instead of showing it negative", () => {
    const result = computeCategoryBreakdown(
      [
        { amount: 200_00, type: "expense", category_id: 1, payment_method: null },
        { amount: 200_00, type: "refund", category_id: 1, payment_method: null },
        { amount: 300_00, type: "expense", category_id: 2, payment_method: null },
      ],
      categories
    );
    expect(result).toEqual([
      { categoryId: 2, categoryName: "Groceries", amount: 300_00, percentage: 100 },
    ]);
  });
});

describe("computePaymentMethodMix", () => {
  it("groups missing/blank payment methods under 'Unspecified'", () => {
    const result = computePaymentMethodMix([
      { amount: 500_00, type: "expense", category_id: null, payment_method: "UPI" },
      { amount: 300_00, type: "expense", category_id: null, payment_method: null },
      { amount: 200_00, type: "expense", category_id: null, payment_method: "  " },
    ]);
    expect(result).toEqual([
      { method: "UPI", amount: 500_00, percentage: 50 },
      { method: "Unspecified", amount: 500_00, percentage: 50 },
    ]);
  });

  it("nets a refund against its payment method", () => {
    const result = computePaymentMethodMix([
      { amount: 500_00, type: "expense", category_id: null, payment_method: "UPI" },
      { amount: 150_00, type: "refund", category_id: null, payment_method: "UPI" },
    ]);
    expect(result).toEqual([{ method: "UPI", amount: 350_00, percentage: 100 }]);
  });
});

describe("computeSavingsForecast", () => {
  it("applies Income - Confirmed Spend - Upcoming Spend", () => {
    expect(computeSavingsForecast(60_000_00, 18_000_00, 22_000_00)).toEqual({
      amount: 20_000_00,
      isOverBudget: false,
    });
  });

  it("floors at 0 when spending exceeds income, but flags isOverBudget", () => {
    expect(computeSavingsForecast(10_000_00, 8_000_00, 5_000_00)).toEqual({
      amount: 0,
      isOverBudget: true,
    });
  });

  it("returns null when no salary is configured", () => {
    expect(computeSavingsForecast(null, 1_000_00, 0)).toBeNull();
  });

  it("handles zero spend and zero upcoming", () => {
    expect(computeSavingsForecast(50_000_00, 0, 0)).toEqual({
      amount: 50_000_00,
      isOverBudget: false,
    });
  });
});
