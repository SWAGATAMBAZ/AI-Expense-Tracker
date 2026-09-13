"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/transactions/categories";
import {
  validateRecurringExpenseForm,
  type RecurringExpenseFormInput,
} from "@/lib/recurring/validation";

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

    const { error } = await supabase.from("recurring_expenses").insert({
      user_id: user.id,
      name: parsed.value.name,
      amount: parsed.value.amountPaise,
      frequency: parsed.value.frequency,
      next_due_date: parsed.value.nextDueDate,
      category_id: parsed.value.categoryId,
      payment_method: parsed.value.paymentMethod,
      account_info: parsed.value.accountInfo,
      active: true,
    });

    if (error) {
      console.error("[createRecurringExpense] supabase error:", error.message);
      return { error: "Could not save this recurring expense. Please try again." };
    }
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

    const { data, error } = await supabase
      .from("recurring_expenses")
      .update({
        name: parsed.value.name,
        amount: parsed.value.amountPaise,
        frequency: parsed.value.frequency,
        next_due_date: parsed.value.nextDueDate,
        category_id: parsed.value.categoryId,
        payment_method: parsed.value.paymentMethod,
        account_info: parsed.value.accountInfo,
        active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[updateRecurringExpense] supabase error:", error.message);
      return { error: "Could not save your changes. Please try again." };
    }
    if (!data) return { error: "This recurring expense no longer exists." };
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
