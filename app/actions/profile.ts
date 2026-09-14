"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateProfileForm } from "@/lib/profile/validation";

export interface ProfileActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

function extractFormInput(formData: FormData) {
  return {
    fullName: String(formData.get("fullName") ?? ""),
    salary: String(formData.get("salary") ?? ""),
    salaryDay: String(formData.get("salaryDay") ?? ""),
    currency: String(formData.get("currency") ?? ""),
    bankInfo: String(formData.get("bankInfo") ?? ""),
  };
}

export async function completeOnboarding(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const parsed = validateProfileForm(extractFormInput(formData));
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Please log in again." };

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.value.fullName,
        monthly_salary: parsed.value.monthlySalaryPaise,
        salary_day: parsed.value.salaryDay,
        currency: parsed.value.currency,
        bank_info: parsed.value.bankInfo,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    if (error) return { error: "Could not save your details. Please try again." };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[completeOnboarding] unexpected error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/home");
  redirect("/home");
}

export async function updateProfile(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const parsed = validateProfileForm(extractFormInput(formData));
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Your session expired. Please log in again." };

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.value.fullName,
        monthly_salary: parsed.value.monthlySalaryPaise,
        salary_day: parsed.value.salaryDay,
        currency: parsed.value.currency,
        bank_info: parsed.value.bankInfo,
      })
      .eq("id", user.id);

    if (error) return { error: "Could not save your changes. Please try again." };
    revalidatePath("/profile");
    revalidatePath("/home");
    return { success: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[updateProfile] unexpected error:", error);
    return { error: "Something went wrong. Please try again." };
  }
}
