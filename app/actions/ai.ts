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
  type TransactionType,
} from "@/lib/transactions/validation";
import {
  validateName,
  validateFrequency,
  validateNextDueDate,
  type RecurringFrequency,
} from "@/lib/recurring/validation";
import { insertTransactionRow, updateTransactionRow, deleteTransaction } from "./transactions";
import {
  insertRecurringExpenseRow,
  updateRecurringExpenseRow,
  deleteRecurringExpense,
} from "./recurring";
import { payCreditCardBill } from "./creditCards";
import { skipToNextOccurrence, getUpcomingSpend } from "@/lib/recurring/upcoming";
import { resolveDateRange } from "@/lib/dashboard/dateRanges";
import {
  computeSavingsForecast,
  computeTotalSpend,
  computeTotalIncome,
  type SavingsForecastResult,
  type TransactionForAggregate,
} from "@/lib/dashboard/aggregate";
import { computeCreditCardSummary, currentPeriodMonth } from "@/lib/creditCards/cards";
import {
  answerSpendQuery,
  answerSavingsQuery,
  answerUpcomingQuery,
  computePurchaseAdvice,
} from "@/lib/ai/queries";

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

/**
 * Loads the persisted chat transcript for the current user (product ask:
 * "maintain chat history" across page loads, not just in-memory state).
 * Best-effort: a load failure degrades to an empty history rather than
 * blocking the page.
 */
export async function loadChatHistory(): Promise<
  { role: "user" | "assistant"; text: string; href?: string }[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("ai_chat_messages")
    .select("role, content, href")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) {
    console.error("[loadChatHistory] supabase error:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    role: row.role as "user" | "assistant",
    text: row.content as string,
    href: (row.href as string | null) ?? undefined,
  }));
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

  const result = await computeInterpretResult(supabase, user.id, message, pending);

  // Persist the exchange for chat history - best-effort, a save failure
  // shouldn't break the reply the user already got.
  const { error: saveError } = await supabase.from("ai_chat_messages").insert([
    { user_id: user.id, role: "user", content: message },
    {
      user_id: user.id,
      role: "assistant",
      content: result.text,
      href: result.kind === "confirmation" ? (result.href ?? null) : null,
    },
  ]);
  if (saveError) {
    console.error("[interpretMessage] failed to save chat history:", saveError.message);
  }

  return result;
}

async function computeInterpretResult(
  supabase: SupabaseClient,
  userId: string,
  message: string,
  pending: PendingIntent | null
): Promise<InterpretResult> {
  const [categories, profileResult] = await Promise.all([
    getCategories(supabase),
    supabase.from("profiles").select("currency").eq("id", userId).maybeSingle(),
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
      return handleAddTransaction(supabase, userId, categories, currency, intent);
    case "edit_transaction":
      return handleEditTransaction(supabase, userId, categories, currency, intent);
    case "delete_transaction":
      return handleDeleteTransaction(supabase, userId, currency, intent);
    case "add_recurring_expense":
      return handleAddRecurringExpense(supabase, userId, categories, currency, intent);
    case "edit_recurring_expense":
      return handleEditRecurringExpense(supabase, userId, categories, currency, intent);
    case "delete_recurring_expense":
      return handleDeleteRecurringExpense(supabase, userId, currency, intent);
    case "pay_credit_card_bill":
      return handlePayCreditCardBill(supabase, userId, currency, intent);
    case "query_spending":
      return handleQuerySpending(supabase, userId, categories, currency, intent);
    case "purchase_advice":
      return handlePurchaseAdvice(supabase, userId, currency, intent);
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
  // A date was given but rejected by validation - don't silently record it
  // as today without saying so (the user stated a specific date).
  const dateNote = intent.date && !dateResult?.ok ? ` (couldn't use the date you gave, so I used today.)` : "";

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
  // A category was mentioned but didn't match any real category - say so
  // rather than silently saving it uncategorized (PRD §18: don't guess, but
  // also don't claim something happened that didn't).
  const categoryNote =
    intent.category && !categoryId
      ? ` I couldn't match the category "${intent.category}", so I left it uncategorized.`
      : "";
  return {
    kind: "confirmation",
    text: `Added ${formatAmount(amount.value, currency)} ${type}${merchant ? ` at ${merchant}` : ""}${
      categoryName ? ` — ${categoryName}` : ""
    }.${settleNote}${categoryNote}${dateNote}`,
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
  // resolveTransactionTarget already selected every column needed below -
  // no need for a second round trip to re-fetch the same row.
  const existing = resolution.row;

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
    // existing.type is a DB value already constrained to this union by a
    // check constraint (supabase-js can't express that in its return type).
    type: typeResult?.ok ? typeResult.value : (existing.type as TransactionType),
    notes: notesResult?.ok ? notesResult.value : existing.notes,
  });
  if (result.error) return { kind: "error", text: result.error };

  revalidatePath("/transactions");
  revalidatePath(`/transactions/${targetId}`);
  revalidatePath("/home");

  // A change was requested for a field but rejected by validation (or, for
  // category, matched nothing real) - each such field silently keeps its old
  // value above, so say which ones didn't apply instead of confirming
  // "Updated" as if everything requested went through (PRD §7 success
  // criterion: correct AI mistakes easily, which requires knowing when a
  // correction didn't actually apply).
  const rejectedFields: string[] = [];
  if (changes.amount !== undefined && !amount?.ok) rejectedFields.push("amount");
  if (changes.date !== undefined && !dateResult?.ok) rejectedFields.push("date");
  if (changes.type !== undefined && !typeResult?.ok) rejectedFields.push("type");
  if (changes.merchant !== undefined && !merchantResult?.ok) rejectedFields.push("merchant");
  if (changes.paymentMethod !== undefined && !paymentMethodResult?.ok)
    rejectedFields.push("payment method");
  if (changes.notes !== undefined && !notesResult?.ok) rejectedFields.push("notes");
  if (changes.category !== undefined && newCategoryId === null) rejectedFields.push("category");
  const changeNote =
    rejectedFields.length > 0
      ? ` I couldn't apply the ${rejectedFields.join(", ")} change${
          rejectedFields.length > 1 ? "s" : ""
        }, so ${rejectedFields.length > 1 ? "those stay" : "it stays"} unchanged.`
      : "";
  return {
    kind: "confirmation",
    text: `Updated the transaction${existing.merchant ? ` at ${existing.merchant}` : ""}.${changeNote}`,
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
  // resolveRecurringTarget already selected every column needed below - no
  // need for a second round trip to re-fetch the same row.
  const existing = resolution.row;

  const changes = intent.changes;

  // "skip" is a standalone action (PRD §19), not composable with other edits
  // in the same message.
  if (changes.skip) {
    // existing.frequency is a DB value already constrained to this union by
    // a check constraint (supabase-js can't express that in its return type).
    const existingFrequency = existing.frequency as RecurringFrequency;
    const nextDueDate = skipToNextOccurrence(existing.next_due_date, existingFrequency);
    const result = await updateRecurringExpenseRow(supabase, targetId, userId, {
      name: existing.name,
      amountPaise: existing.amount,
      frequency: existingFrequency,
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
    frequency: frequencyResult?.ok ? frequencyResult.value : (existing.frequency as RecurringFrequency),
    nextDueDate: nextDueDateResult?.ok ? nextDueDateResult.value : existing.next_due_date,
    categoryId: newCategoryId ?? existing.category_id,
    paymentMethod: paymentMethodResult?.ok ? paymentMethodResult.value : existing.payment_method,
    accountInfo: existing.account_info,
    active: changes.active ?? existing.active,
  });
  if (result.error) return { kind: "error", text: result.error };

  revalidatePath("/recurring");
  revalidatePath("/home");

  const rejectedFields: string[] = [];
  if (changes.name !== undefined && !nameResult?.ok) rejectedFields.push("name");
  if (changes.amount !== undefined && !amountResult?.ok) rejectedFields.push("amount");
  if (changes.frequency !== undefined && !frequencyResult?.ok) rejectedFields.push("frequency");
  if (changes.nextDueDate !== undefined && !nextDueDateResult?.ok) rejectedFields.push("next due date");
  if (changes.paymentMethod !== undefined && !paymentMethodResult?.ok)
    rejectedFields.push("payment method");
  if (changes.category !== undefined && newCategoryId === null) rejectedFields.push("category");
  const changeNote =
    rejectedFields.length > 0
      ? ` I couldn't apply the ${rejectedFields.join(", ")} change${
          rejectedFields.length > 1 ? "s" : ""
        }, so ${rejectedFields.length > 1 ? "those stay" : "it stays"} unchanged.`
      : "";
  return {
    kind: "confirmation",
    text: `Updated ${existing.name}.${changeNote}`,
    href: "/recurring",
  };
}

async function handleDeleteRecurringExpense(
  supabase: SupabaseClient,
  userId: string,
  currency: string,
  intent: Extract<AiIntent, { action: "delete_recurring_expense" }>
): Promise<InterpretResult> {
  const resolution = await resolveRecurringTarget(supabase, userId, intent.target);

  if (resolution.status === "none") {
    return {
      kind: "clarify",
      text: "I couldn't find a matching recurring expense to delete — what's it called?",
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
      text: `Delete the recurring expense "${row.name}" (${formatAmount(row.amount, currency)}/${row.frequency})? Reply yes to confirm.`,
      pending: { intent, missingFields: ["confirmation"] },
    };
  }

  const result = await deleteRecurringExpense(row.id);
  if (result.error) return { kind: "error", text: result.error };

  revalidatePath("/recurring");
  revalidatePath("/home");
  return {
    kind: "confirmation",
    text: `Deleted the recurring expense "${row.name}".`,
    href: "/recurring",
  };
}

async function handlePayCreditCardBill(
  supabase: SupabaseClient,
  userId: string,
  currency: string,
  intent: Extract<AiIntent, { action: "pay_credit_card_bill" }>
): Promise<InterpretResult> {
  const todayStr = today();
  const monthRange = resolveDateRange("month", {}, todayStr);
  const periodMonth = currentPeriodMonth();

  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("amount, type, category_id, payment_method")
    .eq("user_id", userId)
    .gte("transaction_date", monthRange.start)
    .lte("transaction_date", monthRange.end);
  if (txError) {
    console.error("[handlePayCreditCardBill] supabase error:", txError.message);
    return { kind: "error", text: "Could not load your card spending. Please try again." };
  }

  const cards = computeCreditCardSummary((transactions ?? []) as TransactionForAggregate[]);
  if (cards.length === 0) {
    return {
      kind: "confirmation",
      text: "You have no credit card spending this month to pay off.",
      href: "/cards",
    };
  }

  let card = cards[0];
  if (intent.cardName) {
    const needle = intent.cardName.trim().toLowerCase();
    const matches = cards.filter((c) => c.cardName.toLowerCase().includes(needle));
    if (matches.length === 0) {
      return {
        kind: "clarify",
        text: `I couldn't find a card matching "${intent.cardName}" with spending this month. You have: ${cards
          .map((c) => c.cardName)
          .join(", ")}.`,
        pending: null,
      };
    }
    if (matches.length > 1) {
      return {
        kind: "clarify",
        text: `Which card did you mean: ${matches.map((c) => c.cardName).join(", ")}?`,
        pending: { intent, missingFields: ["cardName"] },
      };
    }
    card = matches[0];
  } else if (cards.length > 1) {
    return {
      kind: "clarify",
      text: `Which card's bill do you want to pay: ${cards
        .map((c) => `${c.cardName} (${formatAmount(c.amount, currency)})`)
        .join(", ")}?`,
      pending: { intent, missingFields: ["cardName"] },
    };
  }

  const { data: existingPayment } = await supabase
    .from("credit_card_payments")
    .select("amount_paid, paid_at")
    .eq("user_id", userId)
    .eq("card_name", card.cardName)
    .eq("period_month", periodMonth)
    .maybeSingle();
  if (existingPayment) {
    return {
      kind: "confirmation",
      text: `${card.cardName} is already marked paid (${formatAmount(
        existingPayment.amount_paid as number,
        currency
      )} on ${formatShortDate(String(existingPayment.paid_at).slice(0, 10))}).`,
      href: "/cards",
    };
  }

  if (!intent.confirmed) {
    return {
      kind: "clarify",
      text: `Mark ${card.cardName}'s bill of ${formatAmount(card.amount, currency)} as paid? Reply yes to confirm.`,
      pending: { intent: { ...intent, cardName: card.cardName }, missingFields: ["confirmation"] },
    };
  }

  const result = await payCreditCardBill(card.cardName, periodMonth, card.amount);
  if (result.error) return { kind: "error", text: result.error };

  revalidatePath("/cards");
  return {
    kind: "confirmation",
    text: `Marked ${card.cardName}'s bill (${formatAmount(card.amount, currency)}) as paid.`,
    href: "/cards",
  };
}

/**
 * Mirrors app/home/page.tsx's own savings-forecast computation exactly
 * (same salary + current-month spend + upcoming-within-month math) so the
 * AI's answer can never disagree with what the dashboard shows.
 */
async function computeCurrentMonthSavingsForecast(
  supabase: SupabaseClient,
  userId: string
): Promise<SavingsForecastResult | null> {
  const todayStr = today();
  const monthRange = resolveDateRange("month", {}, todayStr);

  const [{ data: profile }, { data: currentMonthTx }, { data: recurringExpenses }] = await Promise.all([
    supabase.from("profiles").select("monthly_salary").eq("id", userId).maybeSingle(),
    supabase
      .from("transactions")
      .select("amount, type, category_id, payment_method")
      .eq("user_id", userId)
      .gte("transaction_date", monthRange.start)
      .lte("transaction_date", monthRange.end),
    supabase
      .from("recurring_expenses")
      .select("id, name, amount, frequency, next_due_date, active")
      .eq("user_id", userId)
      .eq("active", true),
  ]);

  const currentMonthTransactions = (currentMonthTx ?? []) as TransactionForAggregate[];
  const upcoming = getUpcomingSpend(
    (recurringExpenses ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      amount: r.amount as number,
      frequency: r.frequency as RecurringFrequency,
      nextDueDate: r.next_due_date as string,
      active: r.active as boolean,
    })),
    todayStr
  );
  const upcomingWithinCurrentMonth = upcoming.items
    .filter((item) => item.nextOccurrence <= monthRange.end)
    .reduce((sum, item) => sum + item.amount, 0);

  const monthlyIncome =
    profile?.monthly_salary != null
      ? profile.monthly_salary + computeTotalIncome(currentMonthTransactions)
      : null;

  return computeSavingsForecast(
    monthlyIncome,
    computeTotalSpend(currentMonthTransactions),
    upcomingWithinCurrentMonth
  );
}

async function handleQuerySpending(
  supabase: SupabaseClient,
  userId: string,
  categories: Category[],
  currency: string,
  intent: Extract<AiIntent, { action: "query_spending" }>
): Promise<InterpretResult> {
  if (intent.metric === "savings") {
    const forecast = await computeCurrentMonthSavingsForecast(supabase, userId);
    return { kind: "confirmation", text: answerSavingsQuery(forecast, currency), href: "/home" };
  }

  if (intent.metric === "upcoming") {
    const { data: recurringExpenses } = await supabase
      .from("recurring_expenses")
      .select("id, name, amount, frequency, next_due_date, active")
      .eq("user_id", userId)
      .eq("active", true);
    const upcoming = getUpcomingSpend(
      (recurringExpenses ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        amount: r.amount as number,
        frequency: r.frequency as RecurringFrequency,
        nextDueDate: r.next_due_date as string,
        active: r.active as boolean,
      })),
      today()
    );
    return { kind: "confirmation", text: answerUpcomingQuery(upcoming, currency), href: "/recurring" };
  }

  const period = intent.period ?? "month";
  const range = period === "all_time" ? null : resolveDateRange(period, {}, today());

  let txQuery = supabase
    .from("transactions")
    .select("amount, type, category_id, payment_method")
    .eq("user_id", userId);
  if (range) txQuery = txQuery.gte("transaction_date", range.start).lte("transaction_date", range.end);
  const { data: transactions, error: txError } = await txQuery;
  if (txError) {
    console.error("[handleQuerySpending] supabase error:", txError.message);
    return { kind: "error", text: "Could not load your transactions. Please try again." };
  }

  const answer = answerSpendQuery(
    (transactions ?? []) as TransactionForAggregate[],
    categories,
    intent,
    currency
  );
  return { kind: "confirmation", text: answer, href: "/transactions" };
}

async function handlePurchaseAdvice(
  supabase: SupabaseClient,
  userId: string,
  currency: string,
  intent: Extract<AiIntent, { action: "purchase_advice" }>
): Promise<InterpretResult> {
  const amount = parseAmountToPaise(intent.amount ?? "");
  if (!amount.ok) {
    return {
      kind: "clarify",
      text: "How much does it cost?",
      pending: { intent, missingFields: ["amount"] },
    };
  }

  const forecast = await computeCurrentMonthSavingsForecast(supabase, userId);
  const advice = computePurchaseAdvice(amount.value, intent.item ?? null, forecast, currency);
  return { kind: "confirmation", text: advice.message, href: "/home" };
}
