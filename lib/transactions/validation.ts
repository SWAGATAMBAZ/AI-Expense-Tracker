export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const TRANSACTION_TYPES = ["expense", "income", "refund", "transfer"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const MAX_AMOUNT_RUPEES = 10_000_000; // ₹1 crore per transaction — sane ceiling
export const MAX_MERCHANT_LENGTH = 200;
export const MAX_PAYMENT_METHOD_LENGTH = 100;
export const MAX_ACCOUNT_INFO_LENGTH = 200;
export const MAX_NOTES_LENGTH = 1000;

const MIN_DATE = "2000-01-01";

/**
 * Checks a yyyy-mm-dd string is a real calendar date, not just a parseable
 * one — `new Date("2024-02-30T00:00:00Z")` silently rolls over to March 2nd
 * instead of failing, so `Number.isNaN(date.getTime())` alone doesn't catch
 * an invalid day-of-month.
 */
export function isValidCalendarDateString(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

/** Parses a user-typed amount string (rupees, e.g. "500" or "500.50") into integer paise. */
export function parseAmountToPaise(input: string): FieldResult<number> {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, error: "Amount is required." };
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, error: "Enter a valid amount (e.g. 500 or 500.50)." };
  }
  const rupees = Number(trimmed);
  if (!Number.isFinite(rupees) || rupees <= 0) {
    return { ok: false, error: "Amount must be greater than zero." };
  }
  if (rupees > MAX_AMOUNT_RUPEES) {
    return { ok: false, error: `Amount must be ${MAX_AMOUNT_RUPEES.toLocaleString("en-IN")} or less.` };
  }
  const paise = Math.round(rupees * 100);
  return { ok: true, value: paise };
}

/** Validates a yyyy-mm-dd date string (from <input type="date">). */
export function validateTransactionDate(input: string): FieldResult<string> {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, error: "Date is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false, error: "Enter a valid date." };
  }
  if (!isValidCalendarDateString(trimmed)) {
    return { ok: false, error: "Enter a valid date." };
  }
  if (trimmed < MIN_DATE) {
    return { ok: false, error: "Date is too far in the past." };
  }
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  if (trimmed > tomorrowStr) {
    return { ok: false, error: "Date cannot be in the future." };
  }
  return { ok: true, value: trimmed };
}

/**
 * Presence + integer-format check. Membership in the real category list is
 * enforced when `validCategoryIds` is supplied (Server Actions always pass
 * it); isolated unit tests may omit it to test format validation alone. The
 * categories FK constraint is a DB-layer backstop either way.
 */
export function validateCategoryId(
  input: string,
  validCategoryIds?: readonly number[]
): FieldResult<number> {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, error: "Select a category." };
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: "Select a category." };
  }
  const id = Number(trimmed);
  if (validCategoryIds && !validCategoryIds.includes(id)) {
    return { ok: false, error: "Select a valid category." };
  }
  return { ok: true, value: id };
}

export function validateTransactionType(input: string): FieldResult<TransactionType> {
  const trimmed = input.trim();
  if (!(TRANSACTION_TYPES as readonly string[]).includes(trimmed)) {
    return { ok: false, error: "Select a valid transaction type." };
  }
  return { ok: true, value: trimmed as TransactionType };
}

function validateOptionalText(
  input: string | undefined | null,
  maxLength: number,
  fieldLabel: string
): FieldResult<string | null> {
  const trimmed = (input ?? "").trim();
  if (trimmed === "") return { ok: true, value: null };
  if (trimmed.length > maxLength) {
    return { ok: false, error: `${fieldLabel} must be ${maxLength} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
}

export function validateMerchant(input: string | undefined | null): FieldResult<string | null> {
  return validateOptionalText(input, MAX_MERCHANT_LENGTH, "Merchant");
}

export function validatePaymentMethod(input: string | undefined | null): FieldResult<string | null> {
  return validateOptionalText(input, MAX_PAYMENT_METHOD_LENGTH, "Payment method");
}

export function validateAccountInfo(input: string | undefined | null): FieldResult<string | null> {
  return validateOptionalText(input, MAX_ACCOUNT_INFO_LENGTH, "Account/card info");
}

export function validateNotes(input: string | undefined | null): FieldResult<string | null> {
  return validateOptionalText(input, MAX_NOTES_LENGTH, "Notes");
}

export interface TransactionFormInput {
  merchant?: string;
  amount: string;
  categoryId: string;
  date: string;
  paymentMethod?: string;
  accountInfo?: string;
  type: string;
  notes?: string;
}

export interface TransactionFormValues {
  merchant: string | null;
  amountPaise: number;
  categoryId: number;
  date: string;
  paymentMethod: string | null;
  accountInfo: string | null;
  type: TransactionType;
  notes: string | null;
}

export type TransactionFormResult =
  | { ok: true; value: TransactionFormValues }
  | { ok: false; fieldErrors: Record<string, string> };

/** Aggregates all field validators; returns fieldErrors keyed for form rendering, or the parsed values. */
export function validateTransactionForm(
  input: TransactionFormInput,
  options?: { validCategoryIds?: readonly number[] }
): TransactionFormResult {
  const merchant = validateMerchant(input.merchant);
  const amount = parseAmountToPaise(input.amount);
  const categoryId = validateCategoryId(input.categoryId, options?.validCategoryIds);
  const date = validateTransactionDate(input.date);
  const paymentMethod = validatePaymentMethod(input.paymentMethod);
  const accountInfo = validateAccountInfo(input.accountInfo);
  const type = validateTransactionType(input.type);
  const notes = validateNotes(input.notes);

  const fieldErrors: Record<string, string> = {};
  if (!merchant.ok) fieldErrors.merchant = merchant.error;
  if (!amount.ok) fieldErrors.amount = amount.error;
  if (!categoryId.ok) fieldErrors.categoryId = categoryId.error;
  if (!date.ok) fieldErrors.date = date.error;
  if (!paymentMethod.ok) fieldErrors.paymentMethod = paymentMethod.error;
  if (!accountInfo.ok) fieldErrors.accountInfo = accountInfo.error;
  if (!type.ok) fieldErrors.type = type.error;
  if (!notes.ok) fieldErrors.notes = notes.error;

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return {
    ok: true,
    value: {
      merchant: (merchant as { ok: true; value: string | null }).value,
      amountPaise: (amount as { ok: true; value: number }).value,
      categoryId: (categoryId as { ok: true; value: number }).value,
      date: (date as { ok: true; value: string }).value,
      paymentMethod: (paymentMethod as { ok: true; value: string | null }).value,
      accountInfo: (accountInfo as { ok: true; value: string | null }).value,
      type: (type as { ok: true; value: TransactionType }).value,
      notes: (notes as { ok: true; value: string | null }).value,
    },
  };
}
