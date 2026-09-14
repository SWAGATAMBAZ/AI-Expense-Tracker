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
): Promise<{ error?: string }> {
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
  });

  if (error) return { error: "Could not save this transaction. Please try again." };
  return {};
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

  revalidatePath("/transactions");
  redirect("/transactions");
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
