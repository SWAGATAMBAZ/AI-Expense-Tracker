import {
  computeTotalSpend,
  computeTotalIncome,
  computeCategoryBreakdown,
  computePaymentMethodMix,
  type TransactionForAggregate,
  type SavingsForecastResult,
} from "@/lib/dashboard/aggregate";
import type { UpcomingSpend } from "@/lib/recurring/upcoming";
import { formatAmount } from "@/lib/transactions/format";
import { matchCategoryId } from "./intent";
import type { QuerySpendingIntent } from "./intent";

const PERIOD_LABELS: Record<NonNullable<QuerySpendingIntent["period"]>, string> = {
  today: "today",
  week: "this week",
  month: "this month",
  last_month: "last month",
  all_time: "overall",
};

export function periodLabel(period: QuerySpendingIntent["period"]): string {
  return PERIOD_LABELS[period ?? "month"];
}

/**
 * Deterministic in-code formatting, not a second LLM call - the actual
 * figures come from the same aggregate helpers the dashboard uses (PRD:
 * never let the model guess at money), so the answer always matches what
 * the user would see on /home for the same period.
 */
export function answerSpendQuery(
  transactions: TransactionForAggregate[],
  categories: { id: number; name: string }[],
  intent: QuerySpendingIntent,
  currency: string
): string {
  const label = periodLabel(intent.period);

  if (intent.category) {
    const matchedId = matchCategoryId(intent.category, categories);
    if (matchedId == null) {
      return `I couldn't find a category matching "${intent.category}".`;
    }
    const breakdown = computeCategoryBreakdown(transactions, categories);
    const entry = breakdown.find((b) => b.categoryId === matchedId);
    const amount = entry?.amount ?? 0;
    const categoryName = entry?.categoryName ?? intent.category;
    return `You've spent ${formatAmount(amount, currency)} on ${categoryName} ${label}.`;
  }

  if (intent.paymentMethod) {
    const mix = computePaymentMethodMix(transactions);
    const needle = intent.paymentMethod.trim().toLowerCase();
    const entry = mix.find(
      (m) => m.method.toLowerCase().includes(needle) || needle.includes(m.method.toLowerCase())
    );
    const amount = entry?.amount ?? 0;
    const methodLabel = entry?.method ?? intent.paymentMethod;
    return `You've spent ${formatAmount(amount, currency)} via ${methodLabel} ${label}.`;
  }

  if (intent.metric === "income") {
    const income = computeTotalIncome(transactions);
    return `Your recorded income ${label} is ${formatAmount(income, currency)}.`;
  }

  if (intent.metric === "top_category") {
    const breakdown = computeCategoryBreakdown(transactions, categories);
    if (breakdown.length === 0) return `You have no categorized spending ${label}.`;
    const top = breakdown[0];
    return `Your biggest spending category ${label} is ${top.categoryName} at ${formatAmount(top.amount, currency)} (${top.percentage.toFixed(0)}% of your spend).`;
  }

  const total = computeTotalSpend(transactions);
  return `You've spent ${formatAmount(total, currency)} ${label}.`;
}

export function answerSavingsQuery(
  forecast: SavingsForecastResult | null,
  currency: string
): string {
  if (forecast === null) {
    return `You haven't set up a monthly salary yet, so I can't project savings - add it in your profile and I'll be able to tell you.`;
  }
  if (forecast.isOverBudget) {
    return `Your spending is projected to exceed your income this month, so estimated savings is ${formatAmount(0, currency)} right now.`;
  }
  return `Your projected savings this month is ${formatAmount(forecast.amount, currency)}.`;
}

export function answerUpcomingQuery(upcoming: UpcomingSpend, currency: string): string {
  if (upcoming.items.length === 0) {
    return `You have no upcoming recurring expenses right now.`;
  }
  const list = upcoming.items
    .slice(0, 5)
    .map((item) => `${item.name} (${formatAmount(item.amount, currency)})`)
    .join(", ");
  const more = upcoming.items.length > 5 ? `, and ${upcoming.items.length - 5} more` : "";
  return `Your upcoming spend is ${formatAmount(upcoming.total, currency)} across ${upcoming.items.length} bill${upcoming.items.length === 1 ? "" : "s"}: ${list}${more}.`;
}

export interface PurchaseAdviceResult {
  verdict: "hard_no" | "caution" | "go_ahead" | "no_salary";
  message: string;
}

/**
 * A budgeting heuristic, not real financial advice - explicitly framed as
 * such in the reply. Thresholds: over projected savings -> hard no; over
 * half of it -> caution (the classic "24-hour rule" for a non-urgent
 * purchase); otherwise -> go ahead. All arithmetic happens here in plain
 * code (PRD: don't trust the model with money math) - the LLM's only job
 * upstream is recognizing this as a purchase question and extracting the
 * amount/item.
 */
export function computePurchaseAdvice(
  amountPaise: number,
  item: string | null,
  forecast: SavingsForecastResult | null,
  currency: string
): PurchaseAdviceResult {
  const itemLabel = item ? `the ${item}` : "this";
  const price = formatAmount(amountPaise, currency);

  if (forecast === null) {
    return {
      verdict: "no_salary",
      message: `I can't give you personalized advice yet - add your monthly salary in your profile first, then I can weigh ${itemLabel} (${price}) against your actual savings.`,
    };
  }

  if (forecast.isOverBudget) {
    return {
      verdict: "hard_no",
      message: `Hard no for now - you're already projected to spend more than you earn this month, before ${itemLabel} (${price}) is even factored in. Let this one wait.`,
    };
  }

  if (amountPaise > forecast.amount) {
    const short = formatAmount(amountPaise - forecast.amount, currency);
    const savings = formatAmount(forecast.amount, currency);
    return {
      verdict: "hard_no",
      message: `Hard no for now - ${itemLabel} (${price}) is more than your projected savings this month (${savings}), so you'd be ${short} short. Wait until next month, or free up some budget first.`,
    };
  }

  const ratio = amountPaise / forecast.amount;
  if (ratio > 0.5) {
    const remaining = formatAmount(forecast.amount - amountPaise, currency);
    return {
      verdict: "caution",
      message: `It fits, but ${itemLabel} (${price}) would use over half your projected savings this month, leaving ${remaining}. If it's not urgent, try the 24-hour rule - wait a day, and if you still want it tomorrow, go ahead.`,
    };
  }

  const remaining = formatAmount(forecast.amount - amountPaise, currency);
  return {
    verdict: "go_ahead",
    message: `You're clear - ${itemLabel} (${price}) still leaves you ${remaining} in projected savings this month. Go for it.`,
  };
}
