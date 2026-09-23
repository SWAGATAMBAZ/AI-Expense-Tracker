import type { AiIntent } from "./intent";

export interface PromptContext {
  today: string;
  categories: readonly string[];
  pendingIntent?: AiIntent | null;
  missingFields?: readonly string[];
  currency?: string;
}

const TRANSACTION_TYPES = ["expense", "income", "refund", "transfer"];
const RECURRING_FREQUENCIES = ["weekly", "monthly", "yearly"];

/**
 * The single shared system prompt for every extraction call (chat now,
 * Phase 7's SMS-paste flow later). Kept compact and example-driven per PRD
 * §20 ("keep prompts small") - a small free-tier model follows a few
 * concrete JSON examples far more reliably than an abstract schema.
 */
export function buildSystemPrompt(context: PromptContext): string {
  return [
    `You are a financial-transaction extraction engine for an expense tracker. Today's date is ${context.today}.`,
    `Read the user's message and reply with ONLY one JSON object - no prose, no markdown fences.`,
    `Categories (optional, use exact spelling or omit): ${context.categories.join(", ")}.`,
    `Transaction types: ${TRANSACTION_TYPES.join(", ")}. Recurring frequencies: ${RECURRING_FREQUENCIES.join(", ")}.`,
    `Resolve relative dates ("yesterday", "today") into an absolute yyyy-mm-dd date yourself using today's date above.`,
    `Pick exactly ONE of these shapes based on what the user wants:`,
    `{"action":"add_transaction","amount":"500","merchant":"Zomato","category":"Food & Dining","date":"2026-09-14","paymentMethod":"UPI","type":"expense","notes":"optional"}`,
    `{"action":"edit_transaction","target":{"mostRecent":true,"merchant":"Zomato","amount":"450","date":"2026-09-14"},"changes":{"amount":"500"}}`,
    `{"action":"delete_transaction","target":{"mostRecent":true,"merchant":"Zomato"},"confirmed":false}`,
    `{"action":"add_recurring_expense","name":"Netflix","amount":"649","frequency":"monthly","nextDueDate":"2026-10-01","category":"Subscriptions"}`,
    `{"action":"edit_recurring_expense","target":{"name":"Netflix"},"changes":{"amount":"699","active":true}}`,
    `{"action":"edit_recurring_expense","target":{"name":"Netflix"},"changes":{"skip":true}}`,
    `{"action":"delete_recurring_expense","target":{"name":"Netflix"},"confirmed":false}`,
    `{"action":"pay_credit_card_bill","cardName":"HDFC","confirmed":false}`,
    `{"action":"query_spending","metric":"spend","category":"Food & Dining","period":"month"}`,
    `{"action":"query_spending","metric":"savings"}`,
    `{"action":"purchase_advice","amount":"3000","item":"earphones"}`,
    `{"action":"clarify","question":"How much did you spend?"}`,
    `{"action":"unknown"}`,
    `query_spending is for QUESTIONS about existing data, never for making changes: "metric" is one of spend (default)/income/savings/upcoming/top_category, "period" is one of today/week/month (default)/last_month/all_time. Set "category" or "paymentMethod" only when the user names one (e.g. "how much on food" -> category; "how much on my HDFC card" -> paymentMethod) - omit both for an overall figure. Use metric "savings" for "how much have I saved"/"can I afford things this month" type questions, "upcoming" for "what bills are coming up", "top_category" for "where am I spending the most".`,
    `purchase_advice is for a hypothetical "should I buy X" / "can I afford X" question about a specific priced item - extract the amount and item name, do not compute the answer yourself (the app checks it against real savings data).`,
    `pay_credit_card_bill needs confirmation like delete actions - set "confirmed":true only once the user has explicitly agreed after being asked. Omit "cardName" if the user didn't name a specific card (e.g. just "pay my card bill") and there's only one active this month.`,
    `Use "changes":{"skip":true} on edit_recurring_expense when the user wants to skip the upcoming/current cycle of a recurring bill (e.g. "skip Netflix this month") without recording a transaction - do not combine "skip" with other change fields in the same message.`,
    `Rules: "target" fields are hints to find an EXISTING row, never a database ID - only fill in what the user actually said (merchant/amount/date/name), and set "mostRecent":true for phrases like "the last one"/"that one". Only include "changes"/fields you can infer; omit fields you don't know rather than guessing.`,
    `IMPORTANT: if the message clearly describes ONE action (e.g. an expense, a recurring bill) but is missing a detail like the amount, DO NOT use "clarify" - instead emit that action's normal JSON shape with only the fields you're confident about, omitting what's missing (e.g. {"action":"add_transaction","merchant":"BigBasket","category":"Groceries"} with no "amount"). The app will ask the user for the missing piece itself. Only use "clarify" when the message is genuinely ambiguous about WHICH action is meant, or a delete needs confirmation. If the message is unrelated to money/expenses, use "unknown".`,
    buildPendingIntentNote(context),
    buildCurrencyNote(context),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildCurrencyNote(context: PromptContext): string {
  if (!context.currency) return "";
  return `The user's account currency is ${context.currency}. If the message implies a different currency (e.g. names another currency or symbol), do NOT convert or assume - use "clarify" to ask which amount/currency they mean.`;
}

function buildPendingIntentNote(context: PromptContext): string {
  if (!context.pendingIntent) return "";
  const missing = context.missingFields?.length
    ? ` The user's new message is most likely answering: ${context.missingFields.join(", ")}.`
    : "";
  return `There is an incomplete intent from the previous turn: ${JSON.stringify(context.pendingIntent)}.${missing} Merge the new message into it and re-emit the COMPLETE intent JSON (same shape), not just the new fields.`;
}

export function buildMessages(
  userText: string,
  context: PromptContext
): { role: "system" | "user"; content: string }[] {
  return [
    { role: "system", content: buildSystemPrompt(context) },
    { role: "user", content: userText },
  ];
}
