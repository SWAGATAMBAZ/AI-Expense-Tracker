import { describe, expect, it } from "vitest";
import {
  MAX_BANK_INFO_LENGTH,
  MAX_NAME_LENGTH,
  MAX_SALARY_RUPEES,
  parseSalaryDay,
  parseSalaryToPaise,
  validateBankInfo,
  validateCurrency,
  validateFullName,
  validateProfileForm,
} from "./validation";

describe("parseSalaryToPaise", () => {
  it("rejects empty input", () => {
    expect(parseSalaryToPaise("").ok).toBe(false);
    expect(parseSalaryToPaise("   ").ok).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(parseSalaryToPaise("abc").ok).toBe(false);
    expect(parseSalaryToPaise("₹5000").ok).toBe(false);
    expect(parseSalaryToPaise("5,000").ok).toBe(false);
  });

  it("rejects negative and zero", () => {
    expect(parseSalaryToPaise("-100").ok).toBe(false);
    expect(parseSalaryToPaise("0").ok).toBe(false);
  });

  it("rejects more than 2 decimal places", () => {
    expect(parseSalaryToPaise("100.123").ok).toBe(false);
  });

  it("accepts a whole number and converts to paise", () => {
    const result = parseSalaryToPaise("45000");
    expect(result).toEqual({ ok: true, value: 4_500_000 });
  });

  it("accepts up to 2 decimal places", () => {
    const result = parseSalaryToPaise("45000.50");
    expect(result).toEqual({ ok: true, value: 4_500_050 });
  });

  it("accepts the cap exactly", () => {
    expect(parseSalaryToPaise(String(MAX_SALARY_RUPEES)).ok).toBe(true);
  });

  it("rejects amounts over the cap", () => {
    expect(parseSalaryToPaise(String(MAX_SALARY_RUPEES + 1)).ok).toBe(false);
  });
});

describe("parseSalaryDay", () => {
  it("rejects empty input", () => {
    expect(parseSalaryDay("").ok).toBe(false);
  });

  it("rejects non-integer input", () => {
    expect(parseSalaryDay("15.5").ok).toBe(false);
    expect(parseSalaryDay("abc").ok).toBe(false);
  });

  it("rejects 0 and 32", () => {
    expect(parseSalaryDay("0").ok).toBe(false);
    expect(parseSalaryDay("32").ok).toBe(false);
  });

  it("accepts the boundaries 1 and 31", () => {
    expect(parseSalaryDay("1")).toEqual({ ok: true, value: 1 });
    expect(parseSalaryDay("31")).toEqual({ ok: true, value: 31 });
  });
});

describe("validateCurrency", () => {
  it("accepts an allowlisted code", () => {
    expect(validateCurrency("INR")).toEqual({ ok: true, value: "INR" });
  });

  it("normalizes lowercase input", () => {
    expect(validateCurrency("usd")).toEqual({ ok: true, value: "USD" });
  });

  it("rejects an unknown code", () => {
    expect(validateCurrency("XYZ").ok).toBe(false);
  });
});

describe("validateBankInfo", () => {
  it("normalizes empty/whitespace/undefined/null to null", () => {
    expect(validateBankInfo("")).toEqual({ ok: true, value: null });
    expect(validateBankInfo("   ")).toEqual({ ok: true, value: null });
    expect(validateBankInfo(undefined)).toEqual({ ok: true, value: null });
    expect(validateBankInfo(null)).toEqual({ ok: true, value: null });
  });

  it("trims surrounding whitespace", () => {
    expect(validateBankInfo("  HDFC Bank  ")).toEqual({ ok: true, value: "HDFC Bank" });
  });

  it("accepts exactly the max length", () => {
    const value = "a".repeat(MAX_BANK_INFO_LENGTH);
    expect(validateBankInfo(value)).toEqual({ ok: true, value });
  });

  it("rejects one character over the max length", () => {
    const value = "a".repeat(MAX_BANK_INFO_LENGTH + 1);
    expect(validateBankInfo(value).ok).toBe(false);
  });
});

describe("validateFullName", () => {
  it("rejects empty/whitespace-only input", () => {
    expect(validateFullName("").ok).toBe(false);
    expect(validateFullName("   ").ok).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    expect(validateFullName("  Jane Doe  ")).toEqual({ ok: true, value: "Jane Doe" });
  });

  it("accepts exactly the max length and rejects one over", () => {
    expect(validateFullName("a".repeat(MAX_NAME_LENGTH)).ok).toBe(true);
    expect(validateFullName("a".repeat(MAX_NAME_LENGTH + 1)).ok).toBe(false);
  });
});

describe("validateProfileForm", () => {
  it("returns parsed values when everything is valid", () => {
    const result = validateProfileForm({
      fullName: "Jane Doe",
      salary: "50000",
      salaryDay: "1",
      currency: "INR",
      bankInfo: "",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        fullName: "Jane Doe",
        monthlySalaryPaise: 5_000_000,
        salaryDay: 1,
        currency: "INR",
        bankInfo: null,
      },
    });
  });

  it("aggregates field errors for every invalid field", () => {
    const result = validateProfileForm({
      fullName: "",
      salary: "-1",
      salaryDay: "99",
      currency: "ZZZ",
      bankInfo: "a".repeat(MAX_BANK_INFO_LENGTH + 1),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual([
        "bankInfo",
        "currency",
        "fullName",
        "salary",
        "salaryDay",
      ]);
    }
  });
});
