import {
  parseAmountToPaise,
  validatePaymentMethod,
  validateAccountInfo,
  isValidCalendarDateString,
  type FieldResult,
} from "@/lib/transactions/validation";

export { parseAmountToPaise, validatePaymentMethod, validateAccountInfo };
export type { FieldResult };

export const RECURRING_FREQUENCIES = ["weekly", "monthly", "yearly"] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const MAX_NAME_LENGTH = 200;
const MIN_DATE = "2000-01-01";

/** Required, length-capped name for a recurring expense (e.g. "Rent", "Netflix"). */
export function validateName(input: string): FieldResult<string> {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, error: "Name is required." };
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
}

export function validateFrequency(input: string): FieldResult<RecurringFrequency> {
  const trimmed = input.trim();
  if (!(RECURRING_FREQUENCIES as readonly string[]).includes(trimmed)) {
    return { ok: false, error: "Select a valid frequency." };
  }
  return { ok: true, value: trimmed as RecurringFrequency };
}

/**
 * Validates a yyyy-mm-dd next-due-date string. Unlike a transaction date,
 * this is expected to be in the future (or today) most of the time, but a
 * recurring expense being set up late (e.g. rent due the 1st, entered on the
 * 3rd) is legitimate too — so there's no upper bound, only a sane floor.
 */
export function validateNextDueDate(input: string): FieldResult<string> {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, error: "Next due date is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || !isValidCalendarDateString(trimmed)) {
    return { ok: false, error: "Enter a valid date." };
  }
  if (trimmed < MIN_DATE) {
    return { ok: false, error: "Date is too far in the past." };
  }
  return { ok: true, value: trimmed };
}

/** Category is optional for a recurring expense (unlike a manual transaction). */
export function validateOptionalCategoryId(
  input: string,
  validCategoryIds?: readonly number[]
): FieldResult<number | null> {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: "Select a valid category." };
  }
  const id = Number(trimmed);
  if (validCategoryIds && !validCategoryIds.includes(id)) {
    return { ok: false, error: "Select a valid category." };
  }
  return { ok: true, value: id };
}

export interface RecurringExpenseFormInput {
  name: string;
  amount: string;
  frequency: string;
  nextDueDate: string;
  categoryId?: string;
  paymentMethod?: string;
  accountInfo?: string;
}

export interface RecurringExpenseFormValues {
  name: string;
  amountPaise: number;
  frequency: RecurringFrequency;
  nextDueDate: string;
  categoryId: number | null;
  paymentMethod: string | null;
  accountInfo: string | null;
}

export type RecurringExpenseFormResult =
  | { ok: true; value: RecurringExpenseFormValues }
  | { ok: false; fieldErrors: Record<string, string> };

export function validateRecurringExpenseForm(
  input: RecurringExpenseFormInput,
  options?: { validCategoryIds?: readonly number[] }
): RecurringExpenseFormResult {
  const name = validateName(input.name);
  const amount = parseAmountToPaise(input.amount);
  const frequency = validateFrequency(input.frequency);
  const nextDueDate = validateNextDueDate(input.nextDueDate);
  const categoryId = validateOptionalCategoryId(input.categoryId ?? "", options?.validCategoryIds);
  const paymentMethod = validatePaymentMethod(input.paymentMethod);
  const accountInfo = validateAccountInfo(input.accountInfo);

  const fieldErrors: Record<string, string> = {};
  if (!name.ok) fieldErrors.name = name.error;
  if (!amount.ok) fieldErrors.amount = amount.error;
  if (!frequency.ok) fieldErrors.frequency = frequency.error;
  if (!nextDueDate.ok) fieldErrors.nextDueDate = nextDueDate.error;
  if (!categoryId.ok) fieldErrors.categoryId = categoryId.error;
  if (!paymentMethod.ok) fieldErrors.paymentMethod = paymentMethod.error;
  if (!accountInfo.ok) fieldErrors.accountInfo = accountInfo.error;

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return {
    ok: true,
    value: {
      name: (name as { ok: true; value: string }).value,
      amountPaise: (amount as { ok: true; value: number }).value,
      frequency: (frequency as { ok: true; value: RecurringFrequency }).value,
      nextDueDate: (nextDueDate as { ok: true; value: string }).value,
      categoryId: (categoryId as { ok: true; value: number | null }).value,
      paymentMethod: (paymentMethod as { ok: true; value: string | null }).value,
      accountInfo: (accountInfo as { ok: true; value: string | null }).value,
    },
  };
}
