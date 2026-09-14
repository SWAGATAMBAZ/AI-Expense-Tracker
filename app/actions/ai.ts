"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCategories, type Category } from "@/lib/transactions/categories";
import { formatAmount, formatShortDate } from "@/lib/transactions/format";
import { callOpenRouter } from "@/lib/ai/openrouter";
import { buildMessages } from "@/lib/ai/prompt";
import { parseAiIntent, matchCategoryId, type AiIntent } from "@/lib/ai/intent";
import { findDuplicateTransaction } from "@/lib/transactions/duplicate";
import { resolveTransactionTarget, resolveRecurringTarget } from "@/lib/ai/resolveTarget";
import {
  parseAmountToPaise,
  validateTransactionDate,
  validateTransactionType,
  validateMerchant,
  validatePaymentMethod,
  validateNotes,
} from "@/lib/transactions/validation";
import { validateName, validateFrequency, validateNextDueDate } from "@/lib/recurring/validation";
import { insertTransactionRow, updateTransactionRow, deleteTransaction } from "./transactions";
import { insertRecurringExpenseRow, updateRecurringExpenseRow } from "./recurring";
import { skipToNextOccurrence } from "@/lib/recurring/upcoming";

export interface PendingIntent {
  intent: AiIntent;
  missingFields: string[];
}

export type InterpretResult =
  | { kind: "confirmation"; text: string; href?: string }
  | { kind: "clarify"; text: string; pending: PendingIntent | null }
  | { kind: "error"; text: string };

const UNAVAILABLE_MESSAGE =
  "The AI assistant is unavailable right now — please use the manual \"Add expense\" / \"Add recurring expense\" screens instead.";
const DIDNT_UNDERSTAND_MESSAGE =
  "I didn't quite understand that — could you rephrase, or use the manual \"Add expense\" screen instead?";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function candidateList(
  items: { merchant?: string | null; name?: string; amount: number; transaction_date?: string }[],
  currency: string
): string {
  return items
    .map((item, i) => {
      const label = item.merchant ?? item.name ?? "Unknown";
      const date = item.transaction_date ? ` on ${formatShortDate(item.transaction_date)}` : "";
      return `${i + 1}) ${label} — ${formatAmount(item.amount, currency)}${date}`;
    })
    .join("; ");
}

export async function interpretMessage(
  message: string,
  pending: PendingIntent | null
): Promise<InterpretResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "error", text: "Your session expired. Please log in again." };

  const [categories, profileResult] = await Promise.all([
    getCategories(supabase),
    supabase.from("profiles").select("currency").eq("id", user.id).maybeSingle(),
  ]);
  const currency = profileResult.data?.currency ?? "INR";

  const llmResult = await callOpenRouter(
    buildMessages(message, {
      today: today(),
      categories: categories.map((c) => c.name),
      pendingIntent: pending?.intent ?? null,
      missingFields: pending?.missingFields,
      currency,
    })
  );
  if (!llmResult.ok) return { kind: "error", text: UNAVAILABLE_MESSAGE };

  let raw: unknown;
  try {
    raw = JSON.parse(llmResult.content);
  } catch {
    return { kind: "clarify", text: DIDNT_UNDERSTAND_MESSAGE, pending: null };
  }

  const parsed = parseAiIntent(raw);
  if (!parsed.ok) return { kind: "clarify", text: DIDNT_UNDERSTAND_MESSAGE, pending: null };

  const intent = parsed.value;

  switch (intent.action) {
    case "add_transaction":
      return handleAddTransaction(supabase, user.id, categories, currency, intent);
    case "edit_transaction":
      return handleEditTransaction(supabase, user.id, categories, currency, intent);
    case "delete_transaction":
      return handleDeleteTransaction(supabase, user.id, currency, intent);
    case "add_recurring_expense":
      return handleAddRecurringExpense(supabase, user.id, categories, currency, intent);
    case "edit_recurring_expense":
      return handleEditRecurringExpense(supabase, user.id, categories, currency, intent);
    case "clarify":
      return { kind: "clarify", text: intent.question, pending: null };
    case "unknown":
    default:
      return { kind: "clarify", text: DIDNT_UNDERSTAND_MESSAGE, pending: null };
  }
}

async function handleAddTransaction(
  supabase: SupabaseClient,
  userId: string,
  categories: Category[],
  currency: string,
  intent: Extract<AiIntent, { action: "add_transaction" }>
): Promise<InterpretResult> {
  const amount = parseAmountToPaise(intent.amount ?? "");
  if (!amount.ok) {
    return {
      kind: "clarify",
      text: "How much did you spend?",
      pending: { intent, missingFields: ["amount"] },
    };
  }

  const dateResult = intent.date ? validateTransactionDate(intent.date) : null;
  const date = dateResult?.ok ? dateResult.value : today();

  const typeResult = intent.type ? validateTransactionType(intent.type) : null;
  const type = typeResult?.ok ? typeResult.value : "expense";

  const merchantResult = validateMerchant(intent.merchant ?? null);
  const merchant = merchantResult.ok ? merchantResult.value : null;

  const paymentMethodResult = validatePaymentMethod(intent.paymentMethod ?? null);
  const paymentMethod = paymentMethodResult.ok ? paymentMethodResult.value : null;

  const notesResult = validateNotes(intent.notes ?? null);
  const notes = notesResult.ok ? notesResult.value : null;

  const categoryId = matchCategoryId(intent.category, categories);

  const duplicate = await findDuplicateTransaction(supabase, userId, {
    amountPaise: amount.value,
    date,
    type,
    merchant,
  });
  if (duplicate) {
    return {
      kind: "confirmation",
      text: `That looks like a duplicate of the ${formatAmount(duplicate.amount, currency)} transaction${
        duplicate.merchant ? ` at ${duplicate.merchant}` : ""
      } on ${formatShortDate(duplicate.transaction_date)} — I didn't add it again.`,
      href: "/transactions",
    };
  }

  const { error, matchedRecurringExpenseName } = await insertTransactionRow(supabase, userId, {
    merchant,
    amountPaise: amount.value,
    currency,
    categoryId,
    date,
    paymentMethod,
    accountInfo: null,
    type,
    notes,
    source: "llm",
  });
  if (error) return { kind: "error", text: error };

  revalidatePath("/transactions");
  revalidatePath("/recurring");
  revalidatePath("/home");

  const categoryName = categoryId ? categories.find((c) => c.id === categoryId)?.name : undefined;
  const settleNote = matchedRecurringExpenseName
    ? ` This settles your upcoming ${matchedRecurringExpenseName} payment.`
    : "";
  return {
    kind: "confirmation",
    text: `Added ${formatAmount(amount.value, currency)} ${type}${merchant ? ` at ${merchant}` : ""}${
      categoryName ? ` — ${categoryName}` : ""
    }.${settleNote}`,
    href: "/transactions",
  };
}

async function handleEditTransaction(
  supabase: SupabaseClient,
  userId: string,
  categories: Category[],
  currency: string,
  intent: Extract<AiIntent, { action: "edit_transaction" }>
): Promise<InterpretResult> {
  const resolution = await resolveTransactionTarget(supabase, userId, intent.target);

  if (resolution.status === "none") {
    console.error("[handleEditTransaction] no match for target:", JSON.stringify(intent.target));
    return {
      kind: "clarify",
      text: "I couldn't find a matching transaction — which merchant or amount did you mean?",
      pending: { intent, missingFields: ["target"] },
    };
  }
  if (resolution.status === "multiple") {
    return {
      kind: "clarify",
      text: `I found more than one match: ${candidateList(resolution.candidates, currency)}. Which one did you mean?`,
      pending: { intent, missingFields: ["target"] },
    };
  }

  const targetId = resolution.row.id;
  const { data: existing, error: fetchError } = await supabase
    .from("transactions")
    .select("merchant, amount, category_id, transaction_date, payment_method, account_info, type, notes")
    .eq("id", targetId)
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchError || !existing) {
    return { kind: "error", text: "Could not load that transaction. Please try again." };
  }

  const changes = intent.changes;
  const amount =
    changes.amount !== undefined ? parseAmountToPaise(changes.amount) : null;
  const dateResult = changes.date !== undefined ? validateTransactionDate(changes.date) : null;
  const typeResult = changes.type !== undefined ? validateTransactionType(changes.type) : null;
  const merchantResult = changes.merchant !== undefined ? validateMerchant(changes.merchant) : null;
  const paymentMethodResult =
    changes.paymentMethod !== undefined ? validatePaymentMethod(changes.paymentMethod) : null;
  const notesResult = changes.notes !== undefined ? validateNotes(changes.notes) : null;
  const newCategoryId =
    changes.category !== undefined ? matchCategoryId(changes.category, categories) : null;

  const result = await updateTransactionRow(supabase, targetId, userId, {
    merchant: merchantResult?.ok ? merchantResult.value : existing.merchant,
    amountPaise: amount?.ok ? amount.value : existing.amount,
    categoryId: newCategoryId ?? existing.category_id,
    date: dateResult?.ok ? dateResult.value : existing.transaction_date,
    paymentMethod: paymentMethodResult?.ok ? paymentMethodResult.value : existing.payment_method,
    accountInfo: existing.account_info,
    type: typeResult?.ok ? typeResult.value : existing.type,
    notes: notesResult?.ok ? notesResult.value : existing.notes,
  });
  if (result.error) return { kind: "error", text: result.error };

  revalidatePath("/transactions");
  revalidatePath(`/transactions/${targetId}`);
  revalidatePath("/home");

  return {
    kind: "confirmation",
    text: `Updated the transaction${existing.merchant ? ` at ${existing.merchant}` : ""}.`,
    href: `/transactions/${targetId}`,
  };
}

async function handleDeleteTransaction(
  supabase: SupabaseClient,
  userId: string,
  currency: string,
  intent: Extract<AiIntent, { action: "delete_transaction" }>
): Promise<InterpretResult> {
  const resolution = await resolveTransactionTarget(supabase, userId, intent.target);

  if (resolution.status === "none") {
    return {
      kind: "clarify",
      text: "I couldn't find a matching transaction to delete — which merchant or amount did you mean?",
      pending: { intent, missingFields: ["target"] },
    };
  }
  if (resolution.status === "multiple") {
    return {
      kind: "clarify",
      text: `I found more than one match: ${candidateList(resolution.candidates, currency)}. Which one did you mean?`,
      pending: { intent, missingFields: ["target"] },
    };
  }

  const row = resolution.row;
  if (!intent.confirmed) {
    return {
      kind: "clarify",
      text: `Delete the ${formatAmount(row.amount, currency)} transaction${
        row.merchant ? ` at ${row.merchant}` : ""
      } on ${formatShortDate(row.transaction_date)}? Reply yes to confirm.`,
      pending: { intent, missingFields: ["confirmation"] },
    };
  }

  const result = await deleteTransaction(row.id);
  if (result.error) return { kind: "error", text: result.error };

  revalidatePath("/home");
  return {
    kind: "confirmation",
    text: `Deleted the ${formatAmount(row.amount, currency)} transaction${
      row.merchant ? ` at ${row.merchant}` : ""
    }.`,
    href: "/transactions",
  };
}

const REQUIRED_RECURRING_FIELD_QUESTIONS: Record<string, string> = {
  name: "What should I call this recurring expense?",
  amount: "How much is it?",
  nextDueDate: "When is it next due?",
};

async function handleAddRecurringExpense(
  supabase: SupabaseClient,
  userId: string,
  categories: Category[],
  currency: string,
  intent: Extract<AiIntent, { action: "add_recurring_expense" }>
): Promise<InterpretResult> {
  const nameResult = validateName(intent.name ?? "");
  const amountResult = parseAmountToPaise(intent.amount ?? "");
  const nextDueDateResult = validateNextDueDate(intent.nextDueDate ?? "");

  const missing: string[] = [];
  if (!nameResult.ok) missing.push("name");
  if (!amountResult.ok) missing.push("amount");
  if (!nextDueDateResult.ok) missing.push("nextDueDate");

  if (missing.length > 0) {
    const question = missing.map((field) => REQUIRED_RECURRING_FIELD_QUESTIONS[field]).join(" ");
    return { kind: "clarify", text: question, pending: { intent, missingFields: missing } };
  }

  const frequencyResult = intent.frequency ? validateFrequency(intent.frequency) : null;
  const frequency = frequencyResult?.ok ? frequencyResult.value : "monthly";
  const paymentMethodResult = validatePaymentMethod(intent.paymentMethod ?? null);
  const paymentMethod = paymentMethodResult.ok ? paymentMethodResult.value : null;
  const categoryId = matchCategoryId(intent.category, categories);

  const { error } = await insertRecurringExpenseRow(supabase, userId, {
    name: (nameResult as { ok: true; value: string }).value,
    amountPaise: (amountResult as { ok: true; value: number }).value,
    frequency,
    nextDueDate: (nextDueDateResult as { ok: true; value: string }).value,
    categoryId,
    paymentMethod,
    accountInfo: null,
  });
  if (error) return { kind: "error", text: error };

  revalidatePath("/recurring");
  revalidatePath("/home");

  const name = (nameResult as { ok: true; value: string }).value;
  const amount = (amountResult as { ok: true; value: number }).value;
  const nextDueDate = (nextDueDateResult as { ok: true; value: string }).value;
  return {
    kind: "confirmation",
    text: `Added recurring expense: ${name}, ${formatAmount(amount, currency)} ${frequency}, next due ${formatShortDate(nextDueDate)}.`,
    href: "/recurring",
  };
}

async function handleEditRecurringExpense(
  supabase: SupabaseClient,
  userId: string,
  categories: Category[],
  currency: string,
  intent: Extract<AiIntent, { action: "edit_recurring_expense" }>
): Promise<InterpretResult> {
  const resolution = await resolveRecurringTarget(supabase, userId, intent.target);

  if (resolution.status === "none") {
    return {
      kind: "clarify",
      text: "I couldn't find a matching recurring expense — what's it called?",
      pending: { intent, missingFields: ["target"] },
    };
  }
  if (resolution.status === "multiple") {
    return {
      kind: "clarify",
      text: `I found more than one match: ${candidateList(resolution.candidates, currency)}. Which one did you mean?`,
      pending: { intent, missingFields: ["target"] },
    };
  }

  const targetId = resolution.row.id;
  const { data: existing, error: fetchError } = await supabase
    .from("recurring_expenses")
    .select("name, amount, frequency, next_due_date, category_id, payment_method, account_info, active")
    .eq("id", targetId)
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchError || !existing) {
    return { kind: "error", text: "Could not load that recurring expense. Please try again." };
  }

  const changes = intent.changes;

  // "skip" is a standalone action (PRD §19), not composable with other edits
  // in the same message.
  if (changes.skip) {
    const nextDueDate = skipToNextOccurrence(
      existing.next_due_date as string,
      existing.frequency
    );
    const result = await updateRecurringExpenseRow(supabase, targetId, userId, {
      name: existing.name,
      amountPaise: existing.amount,
      frequency: existing.frequency,
      nextDueDate,
      categoryId: existing.category_id,
      paymentMethod: existing.payment_method,
      accountInfo: existing.account_info,
      active: existing.active,
    });
    if (result.error) return { kind: "error", text: result.error };

    revalidatePath("/recurring");
    revalidatePath("/home");
    return {
      kind: "confirmation",
      text: `Skipped this cycle for ${existing.name}. Next due: ${formatShortDate(nextDueDate)}.`,
      href: "/recurring",
    };
  }

  const nameResult = changes.name !== undefined ? validateName(changes.name) : null;
  const amountResult = changes.amount !== undefined ? parseAmountToPaise(changes.amount) : null;
  const frequencyResult = changes.frequency !== undefined ? validateFrequency(changes.frequency) : null;
  const nextDueDateResult =
    changes.nextDueDate !== undefined ? validateNextDueDate(changes.nextDueDate) : null;
  const paymentMethodResult =
    changes.paymentMethod !== undefined ? validatePaymentMethod(changes.paymentMethod) : null;
  const newCategoryId =
    changes.category !== undefined ? matchCategoryId(changes.category, categories) : null;

  const result = await updateRecurringExpenseRow(supabase, targetId, userId, {
    name: nameResult?.ok ? nameResult.value : existing.name,
    amountPaise: amountResult?.ok ? amountResult.value : existing.amount,
    frequency: frequencyResult?.ok ? frequencyResult.value : existing.frequency,
    nextDueDate: nextDueDateResult?.ok ? nextDueDateResult.value : existing.next_due_date,
    categoryId: newCategoryId ?? existing.category_id,
    paymentMethod: paymentMethodResult?.ok ? paymentMethodResult.value : existing.payment_method,
    accountInfo: existing.account_info,
    active: changes.active ?? existing.active,
  });
  if (result.error) return { kind: "error", text: result.error };

  revalidatePath("/recurring");
  revalidatePath("/home");

  return {
    kind: "confirmation",
    text: `Updated ${existing.name}.`,
    href: "/recurring",
  };
}
