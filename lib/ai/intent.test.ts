import { describe, expect, it } from "vitest";
import { parseAiIntent, matchCategoryId } from "./intent";

describe("parseAiIntent", () => {
  it("parses a full add_transaction intent", () => {
    const result = parseAiIntent({
      action: "add_transaction",
      merchant: "Zomato",
      amount: "500",
      category: "Food & Dining",
      date: "2026-09-14",
      paymentMethod: "UPI",
      type: "expense",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        action: "add_transaction",
        merchant: "Zomato",
        amount: "500",
        category: "Food & Dining",
        date: "2026-09-14",
        paymentMethod: "UPI",
        type: "expense",
        notes: undefined,
      },
    });
  });

  it("parses a minimal add_transaction intent (amount only)", () => {
    const result = parseAiIntent({ action: "add_transaction", amount: "300" });
    expect(result.ok).toBe(true);
    if (result.ok && result.value.action === "add_transaction") {
      expect(result.value.amount).toBe("300");
      expect(result.value.merchant).toBeUndefined();
    }
  });

  it("coerces a numeric amount to a string", () => {
    const result = parseAiIntent({ action: "add_transaction", amount: 500 });
    expect(result.ok).toBe(true);
    if (result.ok && result.value.action === "add_transaction") {
      expect(result.value.amount).toBe("500");
    }
  });

  it("defaults a missing target/changes to empty objects for edit_transaction", () => {
    const result = parseAiIntent({ action: "edit_transaction" });
    expect(result).toEqual({
      ok: true,
      value: { action: "edit_transaction", target: {}, changes: {} },
    });
  });

  it("parses a delete_transaction intent with confirmation", () => {
    const result = parseAiIntent({
      action: "delete_transaction",
      target: { mostRecent: true },
      confirmed: true,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        action: "delete_transaction",
        target: { mostRecent: true, merchant: undefined, amount: undefined, date: undefined },
        confirmed: true,
      },
    });
  });

  it("parses clarify and unknown intents", () => {
    expect(parseAiIntent({ action: "clarify", question: "How much?" })).toEqual({
      ok: true,
      value: { action: "clarify", question: "How much?" },
    });
    expect(parseAiIntent({ action: "unknown" })).toEqual({
      ok: true,
      value: { action: "unknown" },
    });
  });

  it("parses an edit_recurring_expense intent with a skip flag", () => {
    const result = parseAiIntent({
      action: "edit_recurring_expense",
      target: { name: "Netflix" },
      changes: { skip: true },
    });
    expect(result).toEqual({
      ok: true,
      value: {
        action: "edit_recurring_expense",
        target: { mostRecent: undefined, name: "Netflix" },
        changes: {
          name: undefined,
          amount: undefined,
          frequency: undefined,
          nextDueDate: undefined,
          category: undefined,
          paymentMethod: undefined,
          active: undefined,
          skip: true,
        },
      },
    });
  });

  it("parses a delete_recurring_expense intent", () => {
    const result = parseAiIntent({
      action: "delete_recurring_expense",
      target: { name: "Netflix" },
      confirmed: true,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        action: "delete_recurring_expense",
        target: { mostRecent: undefined, name: "Netflix" },
        confirmed: true,
      },
    });
  });

  it("parses a pay_credit_card_bill intent", () => {
    const result = parseAiIntent({ action: "pay_credit_card_bill", cardName: "HDFC" });
    expect(result).toEqual({
      ok: true,
      value: { action: "pay_credit_card_bill", cardName: "HDFC", confirmed: undefined },
    });
  });

  it("parses a query_spending intent with a category and period", () => {
    const result = parseAiIntent({
      action: "query_spending",
      category: "Food & Dining",
      period: "last_month",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        action: "query_spending",
        metric: undefined,
        category: "Food & Dining",
        paymentMethod: undefined,
        period: "last_month",
      },
    });
  });

  it("drops an unrecognized metric/period on query_spending rather than passing it through", () => {
    const result = parseAiIntent({ action: "query_spending", metric: "nonsense", period: "nonsense" });
    expect(result.ok).toBe(true);
    if (result.ok && result.value.action === "query_spending") {
      expect(result.value.metric).toBeUndefined();
      expect(result.value.period).toBeUndefined();
    }
  });

  it("parses a purchase_advice intent", () => {
    const result = parseAiIntent({ action: "purchase_advice", amount: "3000", item: "earphones" });
    expect(result).toEqual({
      ok: true,
      value: { action: "purchase_advice", amount: "3000", item: "earphones" },
    });
  });

  it("rejects a missing action", () => {
    const result = parseAiIntent({ amount: "500" });
    expect(result.ok).toBe(false);
  });

  it("rejects an unrecognized action", () => {
    const result = parseAiIntent({ action: "delete_everything" });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-object response", () => {
    expect(parseAiIntent("just some text").ok).toBe(false);
    expect(parseAiIntent(null).ok).toBe(false);
    expect(parseAiIntent(["add_transaction"]).ok).toBe(false);
  });
});

describe("matchCategoryId", () => {
  const categories = [
    { id: 1, name: "Food & Dining" },
    { id: 2, name: "Groceries" },
  ];

  it("matches case-insensitively", () => {
    expect(matchCategoryId("food & dining", categories)).toBe(1);
    expect(matchCategoryId("GROCERIES", categories)).toBe(2);
  });

  it("returns null for no match or missing name", () => {
    expect(matchCategoryId("Rent", categories)).toBeNull();
    expect(matchCategoryId(undefined, categories)).toBeNull();
    expect(matchCategoryId("", categories)).toBeNull();
  });

  it("falls back to a one-way substring match for a close variant", () => {
    expect(matchCategoryId("Grocery", categories)).toBe(2);
    expect(matchCategoryId("Food", categories)).toBe(1);
  });

  it("does not guess when the substring match is ambiguous between categories", () => {
    const ambiguous = [
      { id: 1, name: "Food & Dining" },
      { id: 2, name: "Food Delivery" },
    ];
    expect(matchCategoryId("Food", ambiguous)).toBeNull();
  });
});
