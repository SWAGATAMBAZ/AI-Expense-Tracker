import { describe, expect, it } from "vitest";
import {
  isCreditCardMethod,
  computeCreditCardSummary,
  computeTotalCreditSpend,
  currentPeriodMonth,
} from "./cards";

describe("isCreditCardMethod", () => {
  it("matches any name containing 'credit card', case-insensitively", () => {
    expect(isCreditCardMethod("HDFC Credit Card")).toBe(true);
    expect(isCreditCardMethod("hsbc credit card")).toBe(true);
    expect(isCreditCardMethod("Credit Card")).toBe(true);
  });

  it("does not match unrelated payment methods", () => {
    expect(isCreditCardMethod("UPI")).toBe(false);
    expect(isCreditCardMethod("Cash")).toBe(false);
    expect(isCreditCardMethod("Debit Card")).toBe(false);
    expect(isCreditCardMethod("Bank Transfer")).toBe(false);
  });
});

describe("computeCreditCardSummary", () => {
  it("groups by card name and excludes non-card payment methods", () => {
    const result = computeCreditCardSummary([
      { amount: 450000, type: "expense", category_id: 1, payment_method: "HDFC Credit Card" },
      { amount: 650000, type: "expense", category_id: 2, payment_method: "HSBC Credit Card" },
      { amount: 30000, type: "expense", category_id: 3, payment_method: "UPI" },
    ]);
    expect(result).toEqual(
      expect.arrayContaining([
        { cardName: "HDFC Credit Card", amount: 450000 },
        { cardName: "HSBC Credit Card", amount: 650000 },
      ])
    );
    expect(result).toHaveLength(2);
  });

  it("nets a refund against its own card, matching the dashboard's own math", () => {
    const result = computeCreditCardSummary([
      { amount: 500000, type: "expense", category_id: 1, payment_method: "HDFC Credit Card" },
      { amount: 100000, type: "refund", category_id: 1, payment_method: "HDFC Credit Card" },
    ]);
    expect(result).toEqual([{ cardName: "HDFC Credit Card", amount: 400000 }]);
  });

  it("returns an empty array when there are no card transactions", () => {
    expect(
      computeCreditCardSummary([
        { amount: 500, type: "expense", category_id: 1, payment_method: "Cash" },
      ])
    ).toEqual([]);
  });
});

describe("computeTotalCreditSpend", () => {
  it("sums every card's amount", () => {
    expect(
      computeTotalCreditSpend([
        { cardName: "HDFC Credit Card", amount: 450000 },
        { cardName: "HSBC Credit Card", amount: 650000 },
      ])
    ).toBe(1100000);
  });

  it("returns 0 for no cards", () => {
    expect(computeTotalCreditSpend([])).toBe(0);
  });
});

describe("currentPeriodMonth", () => {
  it("formats a date as YYYY-MM in UTC", () => {
    expect(currentPeriodMonth(new Date(Date.UTC(2026, 8, 22)))).toBe("2026-09");
    expect(currentPeriodMonth(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01");
  });
});
