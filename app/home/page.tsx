import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/transactions/categories";
import { getUpcomingSpend, type RecurringExpenseInput } from "@/lib/recurring/upcoming";
import type { RecurringFrequency } from "@/lib/recurring/validation";
import {
  computeTotalSpend,
  computeCategoryBreakdown,
  computePaymentMethodMix,
  computeSavingsForecast,
  type TransactionForAggregate,
} from "@/lib/dashboard/aggregate";
import {
  resolveDateRange,
  DATE_RANGE_FILTERS,
  type DateRangeFilter as Filter,
} from "@/lib/dashboard/dateRanges";
import { DateRangeFilter } from "./DateRangeFilter";
import { NavMenu } from "./NavMenu";
import { SpendSummaryCard } from "./SpendSummaryCard";
import { TopCategoriesCard } from "./TopCategoriesCard";
import { TotalSavingsCard } from "./TotalSavingsCard";
import { PaymentMethodChart } from "./PaymentMethodChart";
import { CategoryBreakdownChart } from "./CategoryBreakdownChart";
import { RecentTransactionsCard, type RecentTransactionItem } from "./RecentTransactionsCard";

const RECENT_TRANSACTIONS_LIMIT = 6;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayName = user.user_metadata?.full_name || user.email;

  const rawFilter = typeof params.range === "string" ? params.range : "month";
  const filter: Filter = (
    (DATE_RANGE_FILTERS as readonly string[]).includes(rawFilter) ? rawFilter : "month"
  ) as Filter;
  const today = new Date().toISOString().slice(0, 10);
  const range = resolveDateRange(
    filter,
    {
      from: typeof params.from === "string" ? params.from : undefined,
      to: typeof params.to === "string" ? params.to : undefined,
      month: typeof params.month === "string" ? params.month : undefined,
    },
    today
  );
  const currentMonthRange = resolveDateRange("month", {}, today);
  // The most common case (no filter selected) already queries this exact window -
  // avoid a second identical round trip to Supabase for the savings forecast.
  const periodIsCurrentMonth =
    range.start === currentMonthRange.start && range.end === currentMonthRange.end;

  const [
    { data: profile },
    categories,
    { data: periodTransactions, error: periodError },
    currentMonthResult,
    { data: recurringExpenses, error: recurringError },
    { data: recentTransactions, error: recentError },
  ] = await Promise.all([
    supabase.from("profiles").select("currency, monthly_salary").eq("id", user.id).maybeSingle(),
    getCategories(supabase),
    supabase
      .from("transactions")
      .select("amount, type, category_id, payment_method")
      .eq("user_id", user.id)
      .gte("transaction_date", range.start)
      .lte("transaction_date", range.end),
    periodIsCurrentMonth
      ? Promise.resolve({ data: null, error: null })
      : supabase
          .from("transactions")
          .select("amount, type, category_id, payment_method")
          .eq("user_id", user.id)
          .gte("transaction_date", currentMonthRange.start)
          .lte("transaction_date", currentMonthRange.end),
    supabase
      .from("recurring_expenses")
      .select("id, name, amount, frequency, next_due_date, active")
      .eq("user_id", user.id)
      .eq("active", true),
    supabase
      .from("transactions")
      .select("id, merchant, amount, transaction_date, type, category:categories(name)")
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(RECENT_TRANSACTIONS_LIMIT),
  ]);

  if (periodError) console.error("[HomePage] failed to load period transactions:", periodError);
  if (currentMonthResult.error)
    console.error("[HomePage] failed to load current-month transactions:", currentMonthResult.error);
  if (recurringError) console.error("[HomePage] failed to load recurring expenses:", recurringError);
  if (recentError) console.error("[HomePage] failed to load recent transactions:", recentError);

  const currency = profile?.currency ?? "INR";
  const periodTx: TransactionForAggregate[] = periodTransactions ?? [];
  const currentMonthTx: TransactionForAggregate[] = periodIsCurrentMonth
    ? periodTx
    : (currentMonthResult.data ?? []);
  // A real error on the current-month query makes the savings figure
  // unreliable - never silently compute it against a defaulted-to-empty
  // result set. (periodError already hides this whole section separately.)
  const savingsUnavailable = Boolean(currentMonthResult.error);

  const totalSpend = computeTotalSpend(periodTx);
  const categoryBreakdown = computeCategoryBreakdown(periodTx, categories);
  const paymentMethodMix = computePaymentMethodMix(periodTx);

  const upcoming = getUpcomingSpend(
    (recurringExpenses ?? []).map(
      (r): RecurringExpenseInput => ({
        id: r.id,
        name: r.name,
        amount: r.amount,
        frequency: r.frequency as RecurringFrequency,
        nextDueDate: r.next_due_date,
        active: r.active,
      })
    ),
    today
  );
  // Only expenses expected to hit *this* calendar month count against this
  // month's savings - a yearly premium due 11 months out shouldn't understate
  // it, even though it still belongs in the dashboard's general "upcoming" total.
  const upcomingWithinCurrentMonth = upcoming.items
    .filter((item) => item.nextOccurrence <= currentMonthRange.end)
    .reduce((sum, item) => sum + item.amount, 0);

  const savingsForecast = computeSavingsForecast(
    profile?.monthly_salary ?? null,
    computeTotalSpend(currentMonthTx),
    upcomingWithinCurrentMonth
  );

  return (
    <main className="flex flex-1 flex-col gap-6 py-8">
      <h1 className="sr-only">Dashboard</h1>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Welcome back, <span className="font-medium text-[var(--color-text-primary)]">{displayName}</span>.
      </p>

      <div className="flex items-center justify-between">
        <DateRangeFilter active={filter} label={range.label} />
        <NavMenu />
      </div>

      {periodError ? (
        <p className="error-text">Could not load your spending data. Please try again.</p>
      ) : (
        <>
          <SpendSummaryCard
            totalSpend={totalSpend}
            upcomingSpend={upcoming.total}
            hasUpcomingItems={upcoming.items.length > 0}
            currency={currency}
          />

          <div className="grid grid-cols-2 gap-4">
            <TopCategoriesCard items={categoryBreakdown} />
            {savingsUnavailable ? (
              <div className="card flex flex-col gap-2">
                <span className="text-sm text-[var(--color-text-secondary)]">Total savings</span>
                <span className="error-text">Could not load. Try again.</span>
              </div>
            ) : (
              <TotalSavingsCard forecast={savingsForecast} currency={currency} />
            )}
          </div>

          <PaymentMethodChart items={paymentMethodMix} currency={currency} />

          <CategoryBreakdownChart items={categoryBreakdown} currency={currency} />
        </>
      )}

      <RecentTransactionsCard
        transactions={(recentTransactions as unknown as RecentTransactionItem[]) ?? []}
        currency={currency}
      />
    </main>
  );
}
