import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminClient, e2eUser } from "./support/users";

// Security pass: with the *anon* key and user B's JWT, user A's data must be
// unreachable and immutable (PLAN §5 "confirm RLS actually blocks cross-user access").
test("RLS blocks cross-user access to profiles, transactions and recurring expenses", async () => {
  const a = e2eUser("a");
  const b = e2eUser("b");
  const admin = adminClient();

  const { data: category } = await admin.from("categories").select("id").limit(1).single();
  const { data: aTx, error: aTxErr } = await admin
    .from("transactions")
    .insert({
      user_id: a.id,
      merchant: "RLS-secret",
      amount: 12300,
      transaction_date: "2026-01-15",
      type: "expense",
      category_id: category!.id,
    })
    .select("id")
    .single();
  expect(aTxErr).toBeNull();
  const { data: aRec, error: aRecErr } = await admin
    .from("recurring_expenses")
    .insert({
      user_id: a.id,
      name: "RLS-secret-recurring",
      amount: 4500,
      frequency: "monthly",
      next_due_date: "2026-12-01",
    })
    .select("id")
    .single();
  expect(aRecErr).toBeNull();

  const asB = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { error: signInErr } = await asB.auth.signInWithPassword({
    email: b.email,
    password: b.password,
  });
  expect(signInErr).toBeNull();

  // Reads: B sees none of A's rows.
  const txRead = await asB.from("transactions").select("id").eq("id", aTx!.id);
  expect(txRead.data).toEqual([]);
  const recRead = await asB.from("recurring_expenses").select("id").eq("id", aRec!.id);
  expect(recRead.data).toEqual([]);
  const profileRead = await asB.from("profiles").select("id").eq("id", a.id);
  expect(profileRead.data).toEqual([]);

  // Writes: updates/deletes silently affect zero rows; inserts as A are rejected.
  await asB.from("transactions").update({ amount: 1 }).eq("id", aTx!.id);
  await asB.from("transactions").delete().eq("id", aTx!.id);
  await asB.from("recurring_expenses").update({ amount: 1 }).eq("id", aRec!.id);
  await asB.from("recurring_expenses").delete().eq("id", aRec!.id);
  await asB.from("profiles").update({ monthly_salary: 1 }).eq("id", a.id);

  const forged = await asB.from("transactions").insert({
    user_id: a.id,
    amount: 100,
    transaction_date: "2026-01-15",
    type: "expense",
  });
  expect(forged.error).not.toBeNull();
  const forgedRec = await asB.from("recurring_expenses").insert({
    user_id: a.id,
    name: "forged",
    amount: 100,
    frequency: "monthly",
    next_due_date: "2026-12-01",
  });
  expect(forgedRec.error).not.toBeNull();

  // Ground truth via service role: A's data is untouched.
  const { data: txAfter } = await admin.from("transactions").select("amount").eq("id", aTx!.id).single();
  expect(txAfter?.amount).toBe(12300);
  const { data: recAfter } = await admin
    .from("recurring_expenses")
    .select("amount")
    .eq("id", aRec!.id)
    .single();
  expect(recAfter?.amount).toBe(4500);
  const { data: profileAfter } = await admin
    .from("profiles")
    .select("monthly_salary")
    .eq("id", a.id)
    .single();
  expect(profileAfter?.monthly_salary).not.toBe(1);

  // Unauthenticated (anon-only) clients get nothing at all.
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const anonRead = await anon.from("transactions").select("id");
  expect(anonRead.data ?? []).toEqual([]);
});
