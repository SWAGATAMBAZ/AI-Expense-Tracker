import { describe, expect, it } from "vitest";
import {
  answerSpendQuery,
  answerSavingsQuery,
  answerUpcomingQuery,
  computePurchaseAdvice,
  periodLabel,
} from "./queries";

const categories = [
  { id: 1, name: "Food & Dining" },
  { id: 2, name: "Groceries" },
];

describe("periodLabel", () => {
  it("maps each period to a readable phrase, defaulting to this month", () => {
    expect(periodLabel("today")).toBe("today");
    expect(periodLabel("week")).toBe("this week");
    expect(periodLabel("month")).toBe("this month");
    expect(periodLabel("last_month")).toBe("last month");
    expect(periodLabel("all_time")).toBe("overall");
    expect(periodLabel(undefined)).toBe("this month");
  });
});

describe("answerSpendQuery", () => {
  const transactions = [
    { amount: 300_00, type: "expense", category_id: 1, payment_method: "UPI" },
    { amount: 200_00, type: "expense", category_id: 2, payment_method: "HDFC Credit Card" },
    { amount: 5_000_00, type: "income", category_id: null, payment_method: null },
  ];

  it("answers a category-filtered question", () => {
    const answer = answerSpendQuery(transactions, categories, { action: "query_spending", category: "Food & Dining" }, "INR");
    expect(answer).toContain("₹300.00");
    expect(answer).toContain("Food & Dining");
  });

  it("says so when the category doesn't match anything real", () => {
    const answer = answerSpendQuery(transactions, categories, { action: "query_spending", category: "Rent" }, "INR");
    expect(answer).toMatch(/couldn't find/i);
  });

  it("answers a payment-method-filtered question", () => {
    const answer = answerSpendQuery(
      transactions,
      categories,
      { action: "query_spending", paymentMethod: "HDFC" },
      "INR"
    );
    expect(answer).toContain("₹200.00");
    expect(answer).toContain("HDFC Credit Card");
  });

  it("answers a total-income question", () => {
    const answer = answerSpendQuery(transactions, categories, { action: "query_spending", metric: "income" }, "INR");
    expect(answer).toContain("₹5,000.00");
  });

  it("answers a top-category question", () => {
    const answer = answerSpendQuery(transactions, categories, { action: "query_spending", metric: "top_category" }, "INR");
    expect(answer).toContain("Food & Dining");
    expect(answer).toContain("₹300.00");
  });

  it("defaults to total spend", () => {
    const answer = answerSpendQuery(transactions, categories, { action: "query_spending" }, "INR");
    expect(answer).toContain("₹500.00");
  });
});

describe("answerSavingsQuery", () => {
  it("reports the projected savings figure", () => {
    expect(answerSavingsQuery({ amount: 20_000_00, isOverBudget: false }, "INR")).toContain("₹20,000.00");
  });

  it("flags over-budget instead of a real figure", () => {
    expect(answerSavingsQuery({ amount: 0, isOverBudget: true }, "INR")).toMatch(/exceed/i);
  });

  it("asks for a salary when none is configured", () => {
    expect(answerSavingsQuery(null, "INR")).toMatch(/haven't set up/i);
  });
});

describe("answerUpcomingQuery", () => {
  it("lists upcoming items with their total", () => {
    const answer = answerUpcomingQuery(
      { items: [{ id: "1", name: "Rent", amount: 20_000_00, nextOccurrence: "2026-10-01" }], total: 20_000_00 },
      "INR"
    );
    expect(answer).toContain("Rent");
    expect(answer).toContain("₹20,000.00");
  });

  it("says so when there's nothing upcoming", () => {
    expect(answerUpcomingQuery({ items: [], total: 0 }, "INR")).toMatch(/no upcoming/i);
  });
});

describe("computePurchaseAdvice", () => {
  it("says hard no when the amount exceeds projected savings", () => {
    const result = computePurchaseAdvice(15_000_00, "earphones", { amount: 10_000_00, isOverBudget: false }, "INR");
    expect(result.verdict).toBe("hard_no");
    expect(result.message).toContain("₹15,000.00");
  });

  it("says hard no when already over budget, regardless of amount", () => {
    const result = computePurchaseAdvice(100_00, "coffee", { amount: 0, isOverBudget: true }, "INR");
    expect(result.verdict).toBe("hard_no");
  });

  it("says caution (24-hour rule) when the amount is over half of savings", () => {
    const result = computePurchaseAdvice(6_000_00, "earphones", { amount: 10_000_00, isOverBudget: false }, "INR");
    expect(result.verdict).toBe("caution");
    expect(result.message).toMatch(/24-hour/i);
  });

  it("says go ahead when the amount comfortably fits", () => {
    const result = computePurchaseAdvice(1_000_00, "earphones", { amount: 10_000_00, isOverBudget: false }, "INR");
    expect(result.verdict).toBe("go_ahead");
  });

  it("asks for a salary setup when none is configured", () => {
    const result = computePurchaseAdvice(3_000_00, "earphones", null, "INR");
    expect(result.verdict).toBe("no_salary");
  });
});
