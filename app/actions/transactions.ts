"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/transactions/categories";
import {
  validateTransactionForm,
  type TransactionFormInput,
  type TransactionType,
} from "@/lib/transactions/validation";
import {
  findMatchingRecurringExpense,
  advancePastMatch,
  type RecurringMatchCandidate,
} from "@/lib/recurring/matching";
import type { RecurringFrequency } from "@/lib/recurring/validation";
import { findDuplicateTransaction } from "@/lib/transactions/duplicate";

export interface TransactionRowInput {
  merchant: string | null;
  amountPaise: number;
  currency: string;
  categoryId: number | null;
  date: string;
  paymentMethod: string | null;
  accountInfo: string | null;
  type: TransactionType;
  notes: string | null;
  source?: "manual" | "llm" | "sms";
}

/**
 * The actual insert, shared by the manual form action below and the AI
 * assistant (app/actions/ai.ts) - unlike `createTransaction`, this never
 * redirects, so it's safe to call from a context that isn't a form submit.
 */
export async function insertTransactionRow(
  supabase: SupabaseClient,
  userId: string,
  input: TransactionRowInput
): Promise<{
  error?: string;
  matchedRecurringExpenseId?: string;
  matchedRecurringExpenseName?: string;
}> {
  // Recurring-expense matching (PRD §7/§10): only expenses can settle a
  // recurring bill. Done before the insert so the match can be recorded on
  // the row itself in the same write.
  let match: RecurringMatchCandidate | null = null;
  if (input.type === "expense") {
    const { data: recurringExpenses } = await supabase
      .from("recurring_expenses")
      .select("id, name, amount, frequency, next_due_date, category_id")
      .eq("user_id", userId)
      .eq("active", true)
      .order("next_due_date", { ascending: true });

    const candidates: RecurringMatchCandidate[] = (recurringExpenses ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      amount: row.amount as number,
      frequency: row.frequency as RecurringFrequency,
      nextDueDate: row.next_due_date as string,
      categoryId: row.category_id as number | null,
    }));

    match = findMatchingRecurringExpense(candidates, {
      amountPaise: input.amountPaise,
      date: input.date,
      type: input.type,
      merchant: input.merchant,
      categoryId: input.categoryId,
    });
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    merchant: input.merchant,
    amount: input.amountPaise,
    currency: input.currency,
    category_id: input.categoryId,
    transaction_date: input.date,
    payment_method: input.paymentMethod,
    account_info: input.accountInfo,
    type: input.type,
    notes: input.notes,
    source: input.source ?? "manual",
    matched_recurring_expense_id: match?.id ?? null,
  });

  if (error) return { error: "Could not save this transaction. Please try again." };

  if (match) {
    const { error: advanceError } = await supabase
      .from("recurring_expenses")
      .update({
        next_due_date: advancePastMatch(match, input.date),
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id)
      .eq("user_id", userId);
    // The transaction itself already saved successfully - don't fail the
    // whole operation over this secondary update failing.
    if (advanceError) {
      console.error(
        "[insertTransactionRow] failed to advance matched recurring expense:",
        advanceError.message
      );
    }
  }

  return match ? { matchedRecurringExpenseId: match.id, matchedRecurringExpenseName: match.name } : {};
}

export interface TransactionRowUpdate {
  merchant: string | null;
  amountPaise: number;
  categoryId: number | null;
  date: string;
  paymentMethod: string | null;
  accountInfo: string | null;
  type: TransactionType;
  notes: string | null;
}

/** The actual update, shared by the manual form action and the AI assistant. */
export async function updateTransactionRow(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  input: TransactionRowUpdate
): Promise<{ id?: string; error?: string; notFound?: boolean }> {
  const { data, error } = await supabase
    .from("transactions")
    .update({
      merchant: input.merchant,
      amount: input.amountPaise,
      category_id: input.categoryId,
      transaction_date: input.date,
      payment_method: input.paymentMethod,
      account_info: input.accountInfo,
      type: input.type,
      notes: input.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) return { error: "Could not save your changes. Please try again." };
  if (!data) return { notFound: true, error: "This transaction no longer exists." };
  return { id: (data as { id: string }).id };
}

export interface TransactionActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

function extractFormInput(formData: FormData): TransactionFormInput {
  return {
    merchant: String(formData.get("merchant") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    date: String(formData.get("date") ?? ""),
    paymentMethod: String(formData.get("paymentMethod") ?? ""),
    accountInfo: String(formData.get("accountInfo") ?? ""),
    type: String(formData.get("type") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

export async function createTransaction(
  _prev: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  let isDuplicate = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Please log in again." };

    const [categories, { data: profile }] = await Promise.all([
      getCategories(supabase),
      supabase.from("profiles").select("currency").eq("id", user.id).maybeSingle(),
    ]);
    const parsed = validateTransactionForm(extractFormInput(formData), {
      validCategoryIds: categories.map((c) => c.id),
    });
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    // PRD §17/§19: manual entry is deliberate, so a duplicate is inserted
    // anyway - the user is only warned, not blocked, unlike the AI chat's
    // skip-and-inform behavior.
    isDuplicate =
      (await findDuplicateTransaction(supabase, user.id, {
        amountPaise: parsed.value.amountPaise,
        date: parsed.value.date,
        type: parsed.value.type,
        merchant: parsed.value.merchant,
      })) != null;

    const { error } = await insertTransactionRow(supabase, user.id, {
      merchant: parsed.value.merchant,
      amountPaise: parsed.value.amountPaise,
      currency: profile?.currency ?? "INR",
      categoryId: parsed.value.categoryId,
      date: parsed.value.date,
      paymentMethod: parsed.value.paymentMethod,
      accountInfo: parsed.value.accountInfo,
      type: parsed.value.type,
      notes: parsed.value.notes,
      source: "manual",
    });

    if (error) return { error };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[createTransaction] unexpected error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  // A matched recurring expense may have just been advanced too.
  revalidatePath("/transactions");
  revalidatePath("/recurring");
  revalidatePath("/home");
  redirect(isDuplicate ? "/transactions?duplicateWarning=1" : "/transactions");
}

export async function updateTransaction(
  id: string,
  _prev: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Please log in again." };

    const categories = await getCategories(supabase);
    const parsed = validateTransactionForm(extractFormInput(formData), {
      validCategoryIds: categories.map((c) => c.id),
    });
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    const result = await updateTransactionRow(supabase, id, user.id, {
      merchant: parsed.value.merchant,
      amountPaise: parsed.value.amountPaise,
      categoryId: parsed.value.categoryId,
      date: parsed.value.date,
      paymentMethod: parsed.value.paymentMethod,
      accountInfo: parsed.value.accountInfo,
      type: parsed.value.type,
      notes: parsed.value.notes,
    });
    if (result.error) return { error: result.error };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[updateTransaction] unexpected error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/transactions");
  revalidatePath(`/transactions/${id}`);
  redirect(`/transactions/${id}`);
}

export async function deleteTransaction(id: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Please log in again." };

    const { data, error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) return { error: "Could not delete this transaction. Please try again." };
    if (!data) return { error: "This transaction no longer exists." };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[deleteTransaction] unexpected error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/transactions");
  return {};
}
