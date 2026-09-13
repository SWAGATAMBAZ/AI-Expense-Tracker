"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/transactions/categories";
import { validateTransactionForm, type TransactionFormInput } from "@/lib/transactions/validation";

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

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      merchant: parsed.value.merchant,
      amount: parsed.value.amountPaise,
      currency: profile?.currency ?? "INR",
      category_id: parsed.value.categoryId,
      transaction_date: parsed.value.date,
      payment_method: parsed.value.paymentMethod,
      account_info: parsed.value.accountInfo,
      type: parsed.value.type,
      notes: parsed.value.notes,
      source: "manual",
    });

    if (error) return { error: "Could not save this transaction. Please try again." };
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

    const { data, error } = await supabase
      .from("transactions")
      .update({
        merchant: parsed.value.merchant,
        amount: parsed.value.amountPaise,
        category_id: parsed.value.categoryId,
        transaction_date: parsed.value.date,
        payment_method: parsed.value.paymentMethod,
        account_info: parsed.value.accountInfo,
        type: parsed.value.type,
        notes: parsed.value.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) return { error: "Could not save your changes. Please try again." };
    if (!data) return { error: "This transaction no longer exists." };
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
