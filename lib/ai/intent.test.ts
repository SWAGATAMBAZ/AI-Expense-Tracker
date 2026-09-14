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
});
