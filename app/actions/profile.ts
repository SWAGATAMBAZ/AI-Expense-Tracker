"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateProfileForm } from "@/lib/profile/validation";

export interface ProfileActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

function extractFormInput(formData: FormData) {
  return {
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please log in again." };

  const { error } = await supabase
    .from("profiles")
    .update({
      monthly_salary: parsed.value.monthlySalaryPaise,
      salary_day: parsed.value.salaryDay,
      currency: parsed.value.currency,
      bank_info: parsed.value.bankInfo,
      onboarding_completed: true,
    })
    .eq("id", user.id);

  if (error) return { error: "Could not save your details. Please try again." };
  redirect("/");
}

export async function updateProfile(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const parsed = validateProfileForm(extractFormInput(formData));
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please log in again." };

  const { error } = await supabase
    .from("profiles")
    .update({
      monthly_salary: parsed.value.monthlySalaryPaise,
      salary_day: parsed.value.salaryDay,
      currency: parsed.value.currency,
      bank_info: parsed.value.bankInfo,
    })
    .eq("id", user.id);

  if (error) return { error: "Could not save your changes. Please try again." };
  return { success: true };
}
