import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiTarget } from "./intent";

export type TargetResolution<T> =
  | { status: "resolved"; row: T }
  | { status: "none" }
  | { status: "multiple"; candidates: T[] };

const CANDIDATE_FETCH_LIMIT = 20;
const MAX_DISPLAYED_CANDIDATES = 3;

function narrow<T>(
  rows: T[],
  hasHint: boolean,
  mostRecent: boolean | undefined
): TargetResolution<T> {
  if (rows.length === 0) return { status: "none" };
  if (rows.length === 1) return { status: "resolved", row: rows[0] };
  if (mostRecent) return { status: "resolved", row: rows[0] };
  if (!hasHint) return { status: "none" };
  return { status: "multiple", candidates: rows.slice(0, MAX_DISPLAYED_CANDIDATES) };
}

export interface TransactionCandidate {
  id: string;
  merchant: string | null;
  amount: number;
  transaction_date: string;
  type: string;
  category_id: number | null;
  payment_method: string | null;
  account_info: string | null;
  notes: string | null;
}

/**
 * Resolves a natural-language transaction reference to a specific row (or
 * none/multiple). Selects every column an edit handler needs so it can reuse
 * the resolved row directly instead of re-fetching it by id afterwards.
 */
export async function resolveTransactionTarget(
  supabase: SupabaseClient,
  userId: string,
  target: AiTarget
): Promise<TargetResolution<TransactionCandidate>> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, merchant, amount, transaction_date, type, category_id, payment_method, account_info, notes")
    .eq("user_id", userId)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(CANDIDATE_FETCH_LIMIT);

  if (error) {
    console.error("[resolveTransactionTarget] supabase error:", error.message);
    return { status: "none" };
  }

  let rows = (data ?? []) as TransactionCandidate[];
  let hasHint = false;

  if (target.merchant) {
    hasHint = true;
    const needle = target.merchant.trim().toLowerCase();
    rows = rows.filter((r) => (r.merchant ?? "").toLowerCase().includes(needle));
  }
  if (target.amount) {
    const parsed = Number(target.amount);
    if (Number.isFinite(parsed)) {
      hasHint = true;
      const paise = Math.round(parsed * 100);
      rows = rows.filter((r) => r.amount === paise);
    }
  }
  if (target.date) {
    hasHint = true;
    rows = rows.filter((r) => r.transaction_date === target.date);
  }

  return narrow(rows, hasHint, target.mostRecent);
}

export interface RecurringExpenseCandidate {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  active: boolean;
  next_due_date: string;
  category_id: number | null;
  payment_method: string | null;
  account_info: string | null;
}

/**
 * Resolves a natural-language recurring-expense reference to a specific row
 * (or none/multiple). Selects every column an edit handler needs so it can
 * reuse the resolved row directly instead of re-fetching it by id afterwards.
 */
export async function resolveRecurringTarget(
  supabase: SupabaseClient,
  userId: string,
  target: { mostRecent?: boolean; name?: string }
): Promise<TargetResolution<RecurringExpenseCandidate>> {
  const { data, error } = await supabase
    .from("recurring_expenses")
    .select("id, name, amount, frequency, active, next_due_date, category_id, payment_method, account_info")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(CANDIDATE_FETCH_LIMIT);

  if (error) {
    console.error("[resolveRecurringTarget] supabase error:", error.message);
    return { status: "none" };
  }

  let rows = (data ?? []) as RecurringExpenseCandidate[];
  let hasHint = false;

  if (target.name) {
    hasHint = true;
    const needle = target.name.trim().toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(needle));
  }

  return narrow(rows, hasHint, target.mostRecent);
}
