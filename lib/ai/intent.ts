export const AI_INTENT_ACTIONS = [
  "add_transaction",
  "edit_transaction",
  "delete_transaction",
  "add_recurring_expense",
  "edit_recurring_expense",
  "clarify",
  "unknown",
] as const;
export type AiIntentAction = (typeof AI_INTENT_ACTIONS)[number];

/** A natural-language reference to an existing row - never a database ID. */
export interface AiTarget {
  mostRecent?: boolean;
  merchant?: string;
  amount?: string;
  date?: string;
}

export interface AddTransactionIntent {
  action: "add_transaction";
  merchant?: string;
  amount?: string;
  category?: string;
  date?: string;
  paymentMethod?: string;
  type?: string;
  notes?: string;
}

export interface TransactionChanges {
  merchant?: string;
  amount?: string;
  category?: string;
  date?: string;
  paymentMethod?: string;
  type?: string;
  notes?: string;
}

export interface EditTransactionIntent {
  action: "edit_transaction";
  target: AiTarget;
  changes: TransactionChanges;
}

export interface DeleteTransactionIntent {
  action: "delete_transaction";
  target: AiTarget;
  confirmed?: boolean;
}

export interface AddRecurringExpenseIntent {
  action: "add_recurring_expense";
  name?: string;
  amount?: string;
  frequency?: string;
  nextDueDate?: string;
  category?: string;
  paymentMethod?: string;
}

export interface RecurringExpenseChanges {
  name?: string;
  amount?: string;
  frequency?: string;
  nextDueDate?: string;
  category?: string;
  paymentMethod?: string;
  active?: boolean;
  skip?: boolean;
}

export interface EditRecurringExpenseIntent {
  action: "edit_recurring_expense";
  target: { mostRecent?: boolean; name?: string };
  changes: RecurringExpenseChanges;
}

export interface ClarifyIntent {
  action: "clarify";
  question: string;
}

export interface UnknownIntent {
  action: "unknown";
}

export type AiIntent =
  | AddTransactionIntent
  | EditTransactionIntent
  | DeleteTransactionIntent
  | AddRecurringExpenseIntent
  | EditRecurringExpenseIntent
  | ClarifyIntent
  | UnknownIntent;

export type ParseIntentResult =
  | { ok: true; value: AiIntent }
  | { ok: false; error: string };

/** Coerces a value the LLM may have typed as a number/bool into a string, or drops it. */
function asOptionalString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function asOptionalBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseTarget(raw: unknown): AiTarget {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    mostRecent: asOptionalBool(obj.mostRecent),
    merchant: asOptionalString(obj.merchant),
    amount: asOptionalString(obj.amount),
    date: asOptionalString(obj.date),
  };
}

/**
 * Structurally validates the LLM's raw JSON response into an AiIntent.
 * Deliberately permissive on individual field shapes/presence - the real
 * per-field validators (lib/transactions/validation.ts,
 * lib/recurring/validation.ts) run afterward on whatever comes through here.
 * This layer only guards against a malformed envelope (not an object, an
 * unrecognized `action`, etc.).
 */
export function parseAiIntent(raw: unknown): ParseIntentResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Response was not a JSON object." };
  }
  const obj = raw as Record<string, unknown>;
  const action = obj.action;
  if (typeof action !== "string" || !(AI_INTENT_ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, error: `Unrecognized or missing "action": ${String(action)}` };
  }

  switch (action as AiIntentAction) {
    case "add_transaction":
      return {
        ok: true,
        value: {
          action: "add_transaction",
          merchant: asOptionalString(obj.merchant),
          amount: asOptionalString(obj.amount),
          category: asOptionalString(obj.category),
          date: asOptionalString(obj.date),
          paymentMethod: asOptionalString(obj.paymentMethod),
          type: asOptionalString(obj.type),
          notes: asOptionalString(obj.notes),
        },
      };

    case "edit_transaction": {
      const changesRaw =
        obj.changes && typeof obj.changes === "object" ? (obj.changes as Record<string, unknown>) : {};
      return {
        ok: true,
        value: {
          action: "edit_transaction",
          target: parseTarget(obj.target),
          changes: {
            merchant: asOptionalString(changesRaw.merchant),
            amount: asOptionalString(changesRaw.amount),
            category: asOptionalString(changesRaw.category),
            date: asOptionalString(changesRaw.date),
            paymentMethod: asOptionalString(changesRaw.paymentMethod),
            type: asOptionalString(changesRaw.type),
            notes: asOptionalString(changesRaw.notes),
          },
        },
      };
    }

    case "delete_transaction":
      return {
        ok: true,
        value: {
          action: "delete_transaction",
          target: parseTarget(obj.target),
          confirmed: asOptionalBool(obj.confirmed),
        },
      };

    case "add_recurring_expense":
      return {
        ok: true,
        value: {
          action: "add_recurring_expense",
          name: asOptionalString(obj.name),
          amount: asOptionalString(obj.amount),
          frequency: asOptionalString(obj.frequency),
          nextDueDate: asOptionalString(obj.nextDueDate),
          category: asOptionalString(obj.category),
          paymentMethod: asOptionalString(obj.paymentMethod),
        },
      };

    case "edit_recurring_expense": {
      const changesRaw =
        obj.changes && typeof obj.changes === "object" ? (obj.changes as Record<string, unknown>) : {};
      const targetRaw =
        obj.target && typeof obj.target === "object" ? (obj.target as Record<string, unknown>) : {};
      return {
        ok: true,
        value: {
          action: "edit_recurring_expense",
          target: {
            mostRecent: asOptionalBool(targetRaw.mostRecent),
            name: asOptionalString(targetRaw.name),
          },
          changes: {
            name: asOptionalString(changesRaw.name),
            amount: asOptionalString(changesRaw.amount),
            frequency: asOptionalString(changesRaw.frequency),
            nextDueDate: asOptionalString(changesRaw.nextDueDate),
            category: asOptionalString(changesRaw.category),
            paymentMethod: asOptionalString(changesRaw.paymentMethod),
            active: asOptionalBool(changesRaw.active),
            skip: asOptionalBool(changesRaw.skip),
          },
        },
      };
    }

    case "clarify":
      return {
        ok: true,
        value: {
          action: "clarify",
          question: asOptionalString(obj.question) ?? "Could you clarify that?",
        },
      };

    case "unknown":
    default:
      return { ok: true, value: { action: "unknown" } };
  }
}

/** Case-insensitive exact match of an LLM-provided category name against the real category list. */
export function matchCategoryId(
  name: string | undefined,
  categories: readonly { id: number; name: string }[]
): number | null {
  if (!name) return null;
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return null;
  const match = categories.find((c) => c.name.toLowerCase() === trimmed);
  return match ? match.id : null;
}
