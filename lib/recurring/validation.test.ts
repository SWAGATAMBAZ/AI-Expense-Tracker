import { describe, expect, it } from "vitest";
import {
  MAX_NAME_LENGTH,
  validateName,
  validateFrequency,
  validateNextDueDate,
  validateOptionalCategoryId,
  validateRecurringExpenseForm,
} from "./validation";

describe("validateName", () => {
  it("rejects empty input", () => {
    expect(validateName("").ok).toBe(false);
    expect(validateName("   ").ok).toBe(false);
  });

  it("trims and accepts a normal name", () => {
    expect(validateName("  Rent  ")).toEqual({ ok: true, value: "Rent" });
  });

  it("enforces the length cap", () => {
    expect(validateName("a".repeat(MAX_NAME_LENGTH)).ok).toBe(true);
    expect(validateName("a".repeat(MAX_NAME_LENGTH + 1)).ok).toBe(false);
  });
});

describe("validateFrequency", () => {
  it.each(["weekly", "monthly", "yearly"])("accepts %s", (frequency) => {
    expect(validateFrequency(frequency)).toEqual({ ok: true, value: frequency });
  });

  it("rejects an unknown frequency", () => {
    expect(validateFrequency("daily").ok).toBe(false);
    expect(validateFrequency("").ok).toBe(false);
  });
});

describe("validateNextDueDate", () => {
  it("rejects empty input", () => {
    expect(validateNextDueDate("").ok).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(validateNextDueDate("01/15/2026").ok).toBe(false);
  });

  it("rejects calendar-invalid dates instead of silently rolling over", () => {
    expect(validateNextDueDate("2024-02-30").ok).toBe(false);
    expect(validateNextDueDate("2025-04-31").ok).toBe(false);
  });

  it("rejects dates before the minimum", () => {
    expect(validateNextDueDate("1999-12-31").ok).toBe(false);
  });

  it("accepts a past-but-recent date (setting up a slightly-overdue bill is valid)", () => {
    expect(validateNextDueDate("2020-01-01").ok).toBe(true);
  });

  it("accepts a far-future date (no upper bound, unlike transaction dates)", () => {
    expect(validateNextDueDate("2099-01-01")).toEqual({ ok: true, value: "2099-01-01" });
  });
});

describe("validateOptionalCategoryId", () => {
  it("accepts empty input as null (category is optional)", () => {
    expect(validateOptionalCategoryId("")).toEqual({ ok: true, value: null });
  });

  it("rejects non-numeric input", () => {
    expect(validateOptionalCategoryId("abc").ok).toBe(false);
  });

  it("rejects an id not in the valid list", () => {
    expect(validateOptionalCategoryId("99", [1, 2, 3]).ok).toBe(false);
  });

  it("accepts a valid id", () => {
    expect(validateOptionalCategoryId("2", [1, 2, 3])).toEqual({ ok: true, value: 2 });
  });
});

describe("validateRecurringExpenseForm", () => {
  it("returns parsed values when everything is valid, including no category", () => {
    const result = validateRecurringExpenseForm({
      name: "Netflix",
      amount: "649",
      frequency: "monthly",
      nextDueDate: "2026-02-01",
      categoryId: "",
      paymentMethod: "Credit Card",
      accountInfo: "",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Netflix",
        amountPaise: 64_900,
        frequency: "monthly",
        nextDueDate: "2026-02-01",
        categoryId: null,
        paymentMethod: "Credit Card",
        accountInfo: null,
      },
    });
  });

  it("aggregates field errors for every invalid field", () => {
    const result = validateRecurringExpenseForm({
      name: "",
      amount: "-1",
      frequency: "daily",
      nextDueDate: "",
      categoryId: "abc",
      paymentMethod: "",
      accountInfo: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual([
        "amount",
        "categoryId",
        "frequency",
        "name",
        "nextDueDate",
      ]);
    }
  });
});
