import { adminClient } from "./support/users";

// Deleting the auth user cascades to profiles/transactions/recurring_expenses.
export default async function globalTeardown() {
  const admin = adminClient();
  for (const key of ["E2E_USER_A", "E2E_USER_B"]) {
    const raw = process.env[key];
    if (!raw) continue;
    const { id } = JSON.parse(raw) as { id: string };
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.error(`[e2e teardown] failed to delete ${key}:`, error.message);
  }
}
