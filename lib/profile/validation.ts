export const CURRENCY_ALLOWLIST = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "CAD",
  "SGD",
  "AED",
] as const;
export type CurrencyCode = (typeof CURRENCY_ALLOWLIST)[number];

export const MAX_SALARY_RUPEES = 100_000_000; // ₹10 crore — sane ceiling, avoids overflow/absurd input
export const MAX_BANK_INFO_LENGTH = 500;
export const MAX_NAME_LENGTH = 100;

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Parses a user-typed salary string (rupees, e.g. "45000" or "45000.50") into integer paise. */
export function parseSalaryToPaise(input: string): FieldResult<number> {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, error: "Monthly salary is required." };
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, error: "Enter a valid amount (e.g. 45000 or 45000.50)." };
  }
  const rupees = Number(trimmed);
  if (!Number.isFinite(rupees) || rupees <= 0) {
    return { ok: false, error: "Salary must be greater than zero." };
  }
  if (rupees > MAX_SALARY_RUPEES) {
    return { ok: false, error: `Salary must be ${MAX_SALARY_RUPEES.toLocaleString("en-IN")} or less.` };
  }
  const paise = Math.round(rupees * 100);
  return { ok: true, value: paise };
}

/** Validates a 1-31 day-of-month string input. */
export function parseSalaryDay(input: string): FieldResult<number> {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, error: "Salary day is required." };
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: "Salary day must be a whole number between 1 and 31." };
  }
  const day = Number(trimmed);
  if (day < 1 || day > 31) {
    return { ok: false, error: "Salary day must be between 1 and 31." };
  }
  return { ok: true, value: day };
}

/** Required display name, e.g. "Full name". Matches the required-at-registration convention. */
export function validateFullName(input: string): FieldResult<string> {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, error: "Name is required." };
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
}

export function validateCurrency(input: string): FieldResult<CurrencyCode> {
  const code = input.trim().toUpperCase();
  if (!(CURRENCY_ALLOWLIST as readonly string[]).includes(code)) {
    return { ok: false, error: "Select a supported currency." };
  }
  return { ok: true, value: code as CurrencyCode };
}

/** Optional free-text bank/payment note. Empty/whitespace-only input is valid and normalizes to null. */
export function validateBankInfo(input: string | undefined | null): FieldResult<string | null> {
  const trimmed = (input ?? "").trim();
  if (trimmed === "") return { ok: true, value: null };
  if (trimmed.length > MAX_BANK_INFO_LENGTH) {
    return { ok: false, error: `Bank info must be ${MAX_BANK_INFO_LENGTH} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
}

export interface ProfileFormInput {
  fullName: string;
  salary: string;
  salaryDay: string;
  currency: string;
  bankInfo?: string;
}

export interface ProfileFormValues {
  fullName: string;
  monthlySalaryPaise: number;
  salaryDay: number;
  currency: CurrencyCode;
  bankInfo: string | null;
}

export type ProfileFormResult =
  | { ok: true; value: ProfileFormValues }
  | { ok: false; fieldErrors: Record<string, string> };

/** Aggregates all field validators; returns fieldErrors keyed for form rendering, or the parsed values. */
export function validateProfileForm(input: ProfileFormInput): ProfileFormResult {
  const fullName = validateFullName(input.fullName);
  const salary = parseSalaryToPaise(input.salary);
  const day = parseSalaryDay(input.salaryDay);
  const currency = validateCurrency(input.currency);
  const bank = validateBankInfo(input.bankInfo);

  const fieldErrors: Record<string, string> = {};
  if (!fullName.ok) fieldErrors.fullName = fullName.error;
  if (!salary.ok) fieldErrors.salary = salary.error;
  if (!day.ok) fieldErrors.salaryDay = day.error;
  if (!currency.ok) fieldErrors.currency = currency.error;
  if (!bank.ok) fieldErrors.bankInfo = bank.error;

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return {
    ok: true,
    value: {
      fullName: (fullName as { ok: true; value: string }).value,
      monthlySalaryPaise: (salary as { ok: true; value: number }).value,
      salaryDay: (day as { ok: true; value: number }).value,
      currency: (currency as { ok: true; value: CurrencyCode }).value,
      bankInfo: (bank as { ok: true; value: string | null }).value,
    },
  };
}
