import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { loadEnvLocal, requireEnv } from "./env";

export interface E2EUser {
  id: string;
  email: string;
  password: string;
}

export function adminClient(): SupabaseClient {
  loadEnvLocal();
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createConfirmedUser(admin: SupabaseClient, label: string): Promise<E2EUser> {
  const email = `swagatambaz100+e2e-${label}-${Date.now()}@gmail.com`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E ${label}` },
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  return { id: data.user.id, email, password };
}

/** Reads the users global-setup stashed in env (workers inherit process.env). */
export function e2eUser(label: "a" | "b"): E2EUser {
  const raw = process.env[`E2E_USER_${label.toUpperCase()}`];
  if (!raw) throw new Error(`E2E_USER_${label.toUpperCase()} missing - did global-setup run?`);
  return JSON.parse(raw) as E2EUser;
}
