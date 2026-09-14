"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/transactions/categories";
import {
  validateRecurringExpenseForm,
  type RecurringExpenseFormInput,
  type RecurringFrequency,
} from "@/lib/recurring/validation";

export interface RecurringExpenseRowInput {
  name: string;
  amountPaise: number;
  frequency: RecurringFrequency;
  nextDueDate: string;
  categoryId: number | null;
  paymentMethod: string | null;
  accountInfo: string | null;
}

/**
 * The actual insert, shared by the manual form action below and the AI
 * assistant (app/actions/ai.ts) - unlike `createRecurringExpense`, this
 * never redirects, so it's safe to call outside a form submit.
 */
export async function insertRecurringExpenseRow(
  supabase: SupabaseClient,
  userId: string,
  input: RecurringExpenseRowInput
): Promise<{ error?: string }> {
  const { error } = await supabase.from("recurring_expenses").insert({
    user_id: userId,
    name: input.name,
    amount: input.amountPaise,
    frequency: input.frequency,
    next_due_date: input.nextDueDate,
    category_id: input.categoryId,
    payment_method: input.paymentMethod,
    account_info: input.accountInfo,
    active: true,
  });

  if (error) {
    console.error("[insertRecurringExpenseRow] supabase error:", error.message);
    return { error: "Could not save this recurring expense. Please try again." };
  }
  return {};
}

export interface RecurringExpenseRowUpdate extends RecurringExpenseRowInput {
  active: boolean;
}

/** The actual update, shared by the manual form action and the AI assistant. */
export async function updateRecurringExpenseRow(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  input: RecurringExpenseRowUpdate
): Promise<{ id?: string; error?: string; notFound?: boolean }> {
  const { data, error } = await supabase
    .from("recurring_expenses")
    .update({
      name: input.name,
      amount: input.amountPaise,
      frequency: input.frequency,
      next_due_date: input.nextDueDate,
      category_id: input.categoryId,
      payment_method: input.paymentMethod,
      account_info: input.accountInfo,
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[updateRecurringExpenseRow] supabase error:", error.message);
    return { error: "Could not save your changes. Please try again." };
  }
  if (!data) return { notFound: true, error: "This recurring expense no longer exists." };
  return { id: (data as { id: string }).id };
}

export interface RecurringExpenseActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function extractFormInput(formData: FormData): RecurringExpenseFormInput {
  return {
    name: String(formData.get("name") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    frequency: String(formData.get("frequency") ?? ""),
    nextDueDate: String(formData.get("nextDueDate") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    paymentMethod: String(formData.get("paymentMethod") ?? ""),
    accountInfo: String(formData.get("accountInfo") ?? ""),
  };
}

export async function createRecurringExpense(
  _prev: RecurringExpenseActionState,
  formData: FormData
): Promise<RecurringExpenseActionState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Please log in again." };

    const categories = await getCategories(supabase);
    const parsed = validateRecurringExpenseForm(extractFormInput(formData), {
      validCategoryIds: categories.map((c) => c.id),
    });
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    const { error } = await insertRecurringExpenseRow(supabase, user.id, {
      name: parsed.value.name,
      amountPaise: parsed.value.amountPaise,
      frequency: parsed.value.frequency,
      nextDueDate: parsed.value.nextDueDate,
      categoryId: parsed.value.categoryId,
      paymentMethod: parsed.value.paymentMethod,
      accountInfo: parsed.value.accountInfo,
    });

    if (error) return { error };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[createRecurringExpense] unexpected error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/recurring");
  revalidatePath("/home");
  redirect("/recurring");
}

export async function updateRecurringExpense(
  id: string,
  _prev: RecurringExpenseActionState,
  formData: FormData
): Promise<RecurringExpenseActionState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Please log in again." };

    const categories = await getCategories(supabase);
    const parsed = validateRecurringExpenseForm(extractFormInput(formData), {
      validCategoryIds: categories.map((c) => c.id),
    });
    if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

    const active = formData.get("active") === "on";

    const result = await updateRecurringExpenseRow(supabase, id, user.id, {
      name: parsed.value.name,
      amountPaise: parsed.value.amountPaise,
      frequency: parsed.value.frequency,
      nextDueDate: parsed.value.nextDueDate,
      categoryId: parsed.value.categoryId,
      paymentMethod: parsed.value.paymentMethod,
      accountInfo: parsed.value.accountInfo,
      active,
    });
    if (result.error) return { error: result.error };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[updateRecurringExpense] unexpected error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/recurring");
  revalidatePath("/home");
  redirect("/recurring");
}

export async function deleteRecurringExpense(id: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Please log in again." };

    const { data, error } = await supabase
      .from("recurring_expenses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[deleteRecurringExpense] supabase error:", error.message);
      return { error: "Could not delete this recurring expense. Please try again." };
    }
    if (!data) return { error: "This recurring expense no longer exists." };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[deleteRecurringExpense] unexpected error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/recurring");
  revalidatePath("/home");
  return {};
}

export async function toggleRecurringExpenseActive(
  id: string,
  active: boolean
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Please log in again." };

    const { data, error } = await supabase
      .from("recurring_expenses")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[toggleRecurringExpenseActive] supabase error:", error.message);
      return { error: "Could not update this recurring expense. Please try again." };
    }
    if (!data) return { error: "This recurring expense no longer exists." };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[toggleRecurringExpenseActive] unexpected error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/recurring");
  revalidatePath("/home");
  return {};
}
