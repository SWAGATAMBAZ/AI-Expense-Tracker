// Seeds a confirmed test-user account with realistic dummy data so the app's
// features (dashboard, transactions, recurring expenses, bottom nav actions)
// can be verified end-to-end against a real Supabase project.
//
// Local-only: reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from
// .env.local (gitignored). Never run this against production data, and never
// commit the service-role key.
//
// Usage: npm run seed:test-user

import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "swagatambaz100+test@gmail.com";

function loadEnvLocal() {
  const path = new URL("../.env.local", import.meta.url);
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnvLocal();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Add SUPABASE_SERVICE_ROLE_KEY=<your service role key> to .env.local " +
      "(Supabase Dashboard -> Project Settings -> API -> service_role secret)."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function pad(n) {
  return String(n).padStart(2, "0");
}
function isoDate(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}
function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

const now = new Date();
const year = now.getUTCFullYear();
const month = now.getUTCMonth();
const lastMonth = month === 0 ? 11 : month - 1;
const lastMonthYear = month === 0 ? year - 1 : year;
const clampDay = (y, m, d) => Math.min(d, lastDayOfMonth(y, m));

async function getOrCreateTestUser() {
  // Paginate through admin.listUsers to find an existing test account, so
  // re-running this script doesn't create duplicate users.
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const existing = data.users.find((u) => u.email === TEST_EMAIL);
    if (existing) return { user: existing, password: null };
    if (data.users.length < 200) break;
  }

  const password = randomBytes(9).toString("base64url");
  const { data, error } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Test User" },
  });
  if (error) throw error;
  return { user: data.user, password };
}

async function getCategoryIds() {
  const { data, error } = await supabase.from("categories").select("id, name");
  if (error) throw error;
  const byName = new Map(data.map((c) => [c.name, c.id]));
  const required = [
    "Food & Dining",
    "Groceries",
    "Shopping",
    "Transportation",
    "Entertainment",
    "Bills & Utilities",
  ];
  for (const name of required) {
    if (!byName.has(name)) throw new Error(`Missing expected category: ${name}`);
  }
  return byName;
}

async function seed() {
  const { user, password } = await getOrCreateTestUser();
  const userId = user.id;
  console.log(`Test user: ${TEST_EMAIL} (id ${userId})`);

  const categories = await getCategoryIds();
  const cat = (name) => categories.get(name);

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    currency: "INR",
    monthly_salary: 60_000_00,
    salary_day: 1,
    bank_info: "HDFC Bank, card ending 1234",
    onboarding_completed: true,
  });
  if (profileError) throw profileError;

  await supabase.from("transactions").delete().eq("user_id", userId);
  await supabase.from("recurring_expenses").delete().eq("user_id", userId);

  const recurring = [
    {
      name: "Rent",
      amount: 20_000_00,
      frequency: "monthly",
      next_due_date: isoDate(year, month, clampDay(year, month, 28)),
      category_id: cat("Rent"),
      payment_method: "Bank Transfer",
      active: true,
    },
    {
      name: "Car EMI",
      amount: 15_000_00,
      frequency: "monthly",
      next_due_date: isoDate(year, month, clampDay(year, month, 25)),
      category_id: cat("EMI / Loans"),
      payment_method: "Bank Transfer",
      active: true,
    },
    {
      name: "Gym membership",
      amount: 1_500_00,
      frequency: "monthly",
      next_due_date: isoDate(year, month, clampDay(year, month, 20)),
      category_id: cat("Fitness & Gym"),
      payment_method: "UPI",
      active: true,
    },
    {
      name: "Netflix",
      amount: 649_00,
      frequency: "monthly",
      next_due_date: isoDate(year, month, clampDay(year, month, 22)),
      category_id: cat("Subscriptions"),
      payment_method: "Credit Card",
      active: true,
    },
    {
      name: "Old music subscription (cancelled)",
      amount: 199_00,
      frequency: "monthly",
      next_due_date: isoDate(year, month, clampDay(year, month, 15)),
      category_id: cat("Subscriptions"),
      payment_method: "Credit Card",
      active: false,
    },
  ].map((row) => ({ ...row, user_id: userId }));

  const { error: recurringError } = await supabase.from("recurring_expenses").insert(recurring);
  if (recurringError) throw recurringError;

  const currentMonthTransactions = [
    { merchant: "Zomato", amount: 450_00, category: "Food & Dining", method: "UPI", day: 3, type: "expense" },
    { merchant: "Swiggy", amount: 380_00, category: "Food & Dining", method: "UPI", day: 10, type: "expense" },
    // Split across two named cards (Credit Cards tab) instead of a generic
    // "Credit Card" - HDFC totals 4,500 and HSBC totals 6,500 this month,
    // matching the illustrative numbers from the product ask.
    { merchant: "BigBasket", amount: 2_200_00, category: "Groceries", method: "HDFC Credit Card", day: 5, type: "expense" },
    { merchant: "Uber", amount: 320_00, category: "Transportation", method: "UPI", day: 7, type: "expense" },
    { merchant: "HP Petrol Pump", amount: 1_500_00, category: "Transportation", method: "Cash", day: 12, type: "expense" },
    { merchant: "BookMyShow", amount: 500_00, category: "Entertainment", method: "HDFC Credit Card", day: 14, type: "expense" },
    { merchant: "State Electricity Board", amount: 1_800_00, category: "Bills & Utilities", method: "HDFC Credit Card", day: 2, type: "expense" },
    { merchant: "Airtel Broadband", amount: 999_00, category: "Bills & Utilities", method: "HSBC Credit Card", day: 2, type: "expense" },
    { merchant: "Amazon", amount: 4_000_00, category: "Shopping", method: "HSBC Credit Card", day: 15, type: "expense" },
    { merchant: "Decathlon", amount: 1_501_00, category: "Shopping", method: "HSBC Credit Card", day: 17, type: "expense" },
    { merchant: "Zomato refund", amount: 150_00, category: "Food & Dining", method: "UPI", day: 11, type: "refund" },
    { merchant: "Employer", amount: 60_000_00, category: null, method: "Bank Transfer", day: 1, type: "income" },
    { merchant: "Own savings account", amount: 5_000_00, category: null, method: "Bank Transfer", day: 6, type: "transfer" },
  ];

  const previousMonthTransactions = [
    { merchant: "Dominos", amount: 500_00, category: "Food & Dining", method: "Cash", day: 20, type: "expense" },
    { merchant: "Myntra", amount: 1_500_00, category: "Shopping", method: "Credit Card", day: 22, type: "expense" },
  ];

  const transactions = [
    ...currentMonthTransactions.map((t) => ({
      user_id: userId,
      merchant: t.merchant,
      amount: t.amount,
      currency: "INR",
      category_id: t.category ? cat(t.category) : null,
      transaction_date: isoDate(year, month, clampDay(year, month, t.day)),
      payment_method: t.method,
      type: t.type,
      source: "manual",
    })),
    ...previousMonthTransactions.map((t) => ({
      user_id: userId,
      merchant: t.merchant,
      amount: t.amount,
      currency: "INR",
      category_id: t.category ? cat(t.category) : null,
      transaction_date: isoDate(lastMonthYear, lastMonth, clampDay(lastMonthYear, lastMonth, t.day)),
      payment_method: t.method,
      type: t.type,
      source: "manual",
    })),
  ];

  const { error: txError } = await supabase.from("transactions").insert(transactions);
  if (txError) throw txError;

  console.log(`Inserted ${recurring.length} recurring expenses and ${transactions.length} transactions.`);
  if (password) {
    console.log(`\nNew test account created. Password (save it, shown once): ${password}`);
  } else {
    console.log("\nExisting test account reused — password unchanged.");
  }
  console.log(`Log in at /login with ${TEST_EMAIL}`);
}

seed().catch((error) => {
  console.error("Seeding failed:", error.message ?? error);
  process.exit(1);
});
