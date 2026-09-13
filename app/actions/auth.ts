"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AuthActionState {
  error?: string;
}

function friendlyAuthError(message: string): string {
  if (/already registered|already been registered/i.test(message)) {
    return "An account with this email already exists. Try logging in instead.";
  }
  if (/invalid login credentials/i.test(message)) {
    return "Incorrect email or password.";
  }
  if (/password.*at least|password.*6/i.test(message)) {
    return "Password must be at least 6 characters.";
  }
  if (/rate limit/i.test(message)) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return "Something went wrong. Please try again.";
}

export async function signUp(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!name) return { error: "Name is required." };
  if (name.length > 100) return { error: "Name must be 100 characters or fewer." };
  if (!email || !password) return { error: "Email and password are required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) return { error: friendlyAuthError(error.message) };
  } catch (error) {
    // redirect()/notFound() work by throwing internally — never swallow those.
    unstable_rethrow(error);
    console.error("[signUp] unexpected error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/onboarding");
}

export async function signIn(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Email and password are required." };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: friendlyAuthError(error.message) };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[signIn] unexpected error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/home"); // proxy bounces to /onboarding if not yet onboarded
}

export async function signOut(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    unstable_rethrow(error);
    console.error("[signOut] unexpected error:", error);
  }
  redirect("/login");
}
