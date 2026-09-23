import type { SupabaseClient } from "@supabase/supabase-js";
import { getCategories } from "@/lib/transactions/categories";
import {
  computeCategoryBreakdown,
  computeSavingsForecast,
  computeTotalSpend,
  computeTotalIncome,
  type TransactionForAggregate,
} from "@/lib/dashboard/aggregate";
import { resolveDateRange } from "@/lib/dashboard/dateRanges";
import { getUpcomingSpend, type RecurringExpenseInput } from "@/lib/recurring/upcoming";
import type { RecurringFrequency } from "@/lib/recurring/validation";
import { formatAmount, formatShortDate } from "@/lib/transactions/format";

export const INSIGHT_KEYS = ["top-category", "upcoming-bill", "savings-forecast"] as const;
export type InsightKey = (typeof INSIGHT_KEYS)[number];

export interface Insight {
  key: InsightKey;
  title: string;
  message: string;
}

/**
 * The Inbox's demo insight cards (PRD ask: "for demo create 3 cards with
 * important insights"). Deterministic, built from the same aggregate
 * helpers the dashboard uses - not an LLM call - so the numbers can never
 * disagree with what the user sees on /home, and just browsing the Inbox
 * never burns an OpenRouter request. Always returns exactly one entry per
 * INSIGHT_KEYS, falling back to explanatory copy when there's no data yet
 * for that one, rather than silently dropping a card.
 */
export async function computeInsights(supabase: SupabaseClient, userId: string): Promise<Insight[]> {
  const today = new Date().toISOString().slice(0, 10);
  const monthRange = resolveDateRange("month", {}, today);

  const [categories, profileResult, txResult, recurringResult] = await Promise.all([
    getCategories(supabase),
    supabase.from("profiles").select("currency, monthly_salary").eq("id", userId).maybeSingle(),
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

  const currency = profileResult.data?.currency ?? "INR";
  const transactions = (txResult.data ?? []) as TransactionForAggregate[];

  const upcoming = getUpcomingSpend(
    ((recurringResult.data ?? []) as Record<string, unknown>[]).map(
      (r): RecurringExpenseInput => ({
        id: r.id as string,
        name: r.name as string,
        amount: r.amount as number,
        frequency: r.frequency as RecurringFrequency,
        nextDueDate: r.next_due_date as string,
        active: r.active as boolean,
      })
    ),
    today
  );

  const breakdown = computeCategoryBreakdown(transactions, categories);
  const topCategory: Insight =
    breakdown.length > 0
      ? {
          key: "top-category",
          title: `Biggest spend: ${breakdown[0].categoryName}`,
          message: `${breakdown[0].categoryName} is your biggest spend this month at ${formatAmount(
            breakdown[0].amount,
            currency
          )} (${breakdown[0].percentage.toFixed(0)}% of your spend).`,
        }
      : {
          key: "top-category",
          title: "No spending logged yet this month",
          message: "You haven't logged any spending yet this month — add a transaction and I'll spot your biggest category.",
        };

  const upcomingBill: Insight =
    upcoming.items.length > 0
      ? {
          key: "upcoming-bill",
          title: `Upcoming: ${upcoming.items[0].name}`,
          message: `${upcoming.items[0].name} (${formatAmount(
            upcoming.items[0].amount,
            currency
          )}) is due ${formatShortDate(upcoming.items[0].nextOccurrence)}.`,
        }
      : {
          key: "upcoming-bill",
          title: "No upcoming bills",
          message: "You have no active recurring expenses due right now.",
        };

  const upcomingWithinMonth = upcoming.items
    .filter((item) => item.nextOccurrence <= monthRange.end)
    .reduce((sum, item) => sum + item.amount, 0);
  const monthlyIncome =
    profileResult.data?.monthly_salary != null
      ? profileResult.data.monthly_salary + computeTotalIncome(transactions)
      : null;
  const forecast = computeSavingsForecast(monthlyIncome, computeTotalSpend(transactions), upcomingWithinMonth);
  const savingsForecast: Insight =
    forecast == null
      ? {
          key: "savings-forecast",
          title: "Set up your salary for a savings forecast",
          message: "Add your monthly salary in your profile and I'll be able to project this month's savings.",
        }
      : forecast.isOverBudget
        ? {
            key: "savings-forecast",
            title: "Spending is over budget this month",
            message: "You're projected to spend more than you earn this month — worth reviewing before any non-essential purchases.",
          }
        : {
            key: "savings-forecast",
            title: "This month's savings",
            message: `You're on track to save ${formatAmount(
              forecast.amount,
              currency
            )} this month. Worth setting some aside before it gets spent.`,
          };

  return [topCategory, upcomingBill, savingsForecast];
}

export async function computeInsight(
  supabase: SupabaseClient,
  userId: string,
  key: InsightKey
): Promise<Insight | null> {
  const all = await computeInsights(supabase, userId);
  return all.find((insight) => insight.key === key) ?? null;
}
