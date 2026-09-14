import { describe, expect, it } from "vitest";
import {
  MAX_ACCOUNT_INFO_LENGTH,
  MAX_AMOUNT_RUPEES,
  MAX_MERCHANT_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_PAYMENT_METHOD_LENGTH,
  parseAmountToPaise,
  validateAccountInfo,
  validateCategoryId,
  validateMerchant,
  validateNotes,
  validatePaymentMethod,
  validateTransactionDate,
  validateTransactionForm,
  validateTransactionType,
} from "./validation";

describe("parseAmountToPaise", () => {
  it("rejects empty input", () => {
    expect(parseAmountToPaise("").ok).toBe(false);
    expect(parseAmountToPaise("   ").ok).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(parseAmountToPaise("abc").ok).toBe(false);
    expect(parseAmountToPaise("₹500").ok).toBe(false);
    expect(parseAmountToPaise("5,000").ok).toBe(false);
  });

  it("rejects negative and zero", () => {
    expect(parseAmountToPaise("-100").ok).toBe(false);
    expect(parseAmountToPaise("0").ok).toBe(false);
  });

  it("rejects more than 2 decimal places", () => {
    expect(parseAmountToPaise("100.123").ok).toBe(false);
  });

  it("accepts a whole number and converts to paise", () => {
    expect(parseAmountToPaise("500")).toEqual({ ok: true, value: 50_000 });
  });

  it("accepts up to 2 decimal places", () => {
    expect(parseAmountToPaise("500.50")).toEqual({ ok: true, value: 50_050 });
  });

  it("accepts the cap exactly", () => {
    expect(parseAmountToPaise(String(MAX_AMOUNT_RUPEES)).ok).toBe(true);
  });

  it("rejects amounts over the cap", () => {
    expect(parseAmountToPaise(String(MAX_AMOUNT_RUPEES + 1)).ok).toBe(false);
  });
});

describe("validateTransactionDate", () => {
  it("rejects empty input", () => {
    expect(validateTransactionDate("").ok).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(validateTransactionDate("15/01/2026").ok).toBe(false);
    expect(validateTransactionDate("not-a-date").ok).toBe(false);
  });

  it("rejects calendar-invalid dates instead of silently rolling over", () => {
    expect(validateTransactionDate("2024-02-30").ok).toBe(false);
    expect(validateTransactionDate("2025-04-31").ok).toBe(false);
  });

  it("rejects dates before the minimum", () => {
    expect(validateTransactionDate("1999-12-31").ok).toBe(false);
  });

  it("accepts the minimum date", () => {
    expect(validateTransactionDate("2000-01-01")).toEqual({ ok: true, value: "2000-01-01" });
  });

  it("accepts today", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(validateTransactionDate(today).ok).toBe(true);
  });

  it("accepts tomorrow (timezone drift buffer)", () => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    expect(validateTransactionDate(tomorrow.toISOString().slice(0, 10)).ok).toBe(true);
  });

  it("rejects far-future dates", () => {
    expect(validateTransactionDate("2999-01-01").ok).toBe(false);
  });
});

describe("validateCategoryId", () => {
  it("rejects empty input", () => {
    expect(validateCategoryId("").ok).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(validateCategoryId("abc").ok).toBe(false);
  });

  it("rejects an id not in the valid list", () => {
    expect(validateCategoryId("99", [1, 2, 3]).ok).toBe(false);
  });

  it("accepts an id in the valid list", () => {
    expect(validateCategoryId("2", [1, 2, 3])).toEqual({ ok: true, value: 2 });
  });

  it("accepts a well-formed id when no allowlist is supplied", () => {
    expect(validateCategoryId("5")).toEqual({ ok: true, value: 5 });
  });
});

describe("validateTransactionType", () => {
  it.each(["expense", "income", "refund", "transfer"])("accepts %s", (type) => {
    expect(validateTransactionType(type)).toEqual({ ok: true, value: type });
  });

  it("rejects empty input", () => {
    expect(validateTransactionType("").ok).toBe(false);
  });

  it("rejects an unknown value", () => {
    expect(validateTransactionType("recurring_expense").ok).toBe(false);
  });
});

describe("optional text validators", () => {
  it("normalizes empty/whitespace/undefined/null to null", () => {
    for (const validator of [validateMerchant, validatePaymentMethod, validateAccountInfo, validateNotes]) {
      expect(validator("")).toEqual({ ok: true, value: null });
      expect(validator("   ")).toEqual({ ok: true, value: null });
      expect(validator(undefined)).toEqual({ ok: true, value: null });
      expect(validator(null)).toEqual({ ok: true, value: null });
    }
  });

  it("trims surrounding whitespace", () => {
    expect(validateMerchant("  Zomato  ")).toEqual({ ok: true, value: "Zomato" });
  });

  it("enforces per-field length caps", () => {
    expect(validateMerchant("a".repeat(MAX_MERCHANT_LENGTH)).ok).toBe(true);
    expect(validateMerchant("a".repeat(MAX_MERCHANT_LENGTH + 1)).ok).toBe(false);
    expect(validatePaymentMethod("a".repeat(MAX_PAYMENT_METHOD_LENGTH)).ok).toBe(true);
    expect(validatePaymentMethod("a".repeat(MAX_PAYMENT_METHOD_LENGTH + 1)).ok).toBe(false);
    expect(validateAccountInfo("a".repeat(MAX_ACCOUNT_INFO_LENGTH)).ok).toBe(true);
    expect(validateAccountInfo("a".repeat(MAX_ACCOUNT_INFO_LENGTH + 1)).ok).toBe(false);
    expect(validateNotes("a".repeat(MAX_NOTES_LENGTH)).ok).toBe(true);
    expect(validateNotes("a".repeat(MAX_NOTES_LENGTH + 1)).ok).toBe(false);
  });
});

describe("validateTransactionForm", () => {
  it("returns parsed values when everything is valid", () => {
    const result = validateTransactionForm(
      {
        merchant: "Zomato",
        amount: "500",
        categoryId: "1",
        date: "2026-01-01",
        paymentMethod: "UPI",
        accountInfo: "HDFC XXXX1234",
        type: "expense",
        notes: "",
      },
      { validCategoryIds: [1, 2, 3] }
    );
    expect(result).toEqual({
      ok: true,
      value: {
        merchant: "Zomato",
        amountPaise: 50_000,
        categoryId: 1,
        date: "2026-01-01",
        paymentMethod: "UPI",
        accountInfo: "HDFC XXXX1234",
        type: "expense",
        notes: null,
      },
    });
  });

  it("aggregates field errors for every invalid field", () => {
    const result = validateTransactionForm({
      merchant: "a".repeat(MAX_MERCHANT_LENGTH + 1),
      amount: "-1",
      categoryId: "",
      date: "",
      paymentMethod: "a".repeat(MAX_PAYMENT_METHOD_LENGTH + 1),
      accountInfo: "a".repeat(MAX_ACCOUNT_INFO_LENGTH + 1),
      type: "unknown",
      notes: "a".repeat(MAX_NOTES_LENGTH + 1),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual([
        "accountInfo",
        "amount",
        "categoryId",
        "date",
        "merchant",
        "notes",
        "paymentMethod",
        "type",
      ]);
    }
  });
});
