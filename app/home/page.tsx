import Link from "next/link";
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
import { signOut } from "@/app/actions/auth";
import { DateRangeFilter } from "./DateRangeFilter";
import { TotalSpendCard } from "./TotalSpendCard";
import { CategoryBreakdownChart } from "./CategoryBreakdownChart";
import { UpcomingSpendCard } from "./UpcomingSpendCard";
import { SavingsForecastCard } from "./SavingsForecastCard";
import { PaymentMethodChart } from "./PaymentMethodChart";

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
  const range = resolveDateRange(filter, {
    from: typeof params.from === "string" ? params.from : undefined,
    to: typeof params.to === "string" ? params.to : undefined,
    month: typeof params.month === "string" ? params.month : undefined,
  }, today);
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
  ]);

  if (periodError) console.error("[HomePage] failed to load period transactions:", periodError);
  if (currentMonthResult.error)
    console.error("[HomePage] failed to load current-month transactions:", currentMonthResult.error);
  if (recurringError) console.error("[HomePage] failed to load recurring expenses:", recurringError);

  const currency = profile?.currency ?? "INR";
  const periodTx: TransactionForAggregate[] = periodTransactions ?? [];
  const currentMonthTx: TransactionForAggregate[] = periodIsCurrentMonth
    ? periodTx
    : (currentMonthResult.data ?? []);

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

  const savingsForecast = computeSavingsForecast(
    profile?.monthly_salary ?? null,
    computeTotalSpend(currentMonthTx),
    upcoming.total
  );

  return (
    <main className="flex flex-1 flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Welcome back, {displayName}.</p>
      </div>

      <DateRangeFilter active={filter} />

      {periodError ? (
        <p className="error-text">Could not load your spending data. Please try again.</p>
      ) : (
        <>
          <TotalSpendCard amount={totalSpend} currency={currency} label={range.label} />
          <CategoryBreakdownChart items={categoryBreakdown} currency={currency} />
        </>
      )}

      <UpcomingSpendCard items={upcoming.items} total={upcoming.total} currency={currency} />

      <SavingsForecastCard forecast={savingsForecast} currency={currency} />

      {!periodError ? (
        <PaymentMethodChart items={paymentMethodMix} currency={currency} />
      ) : null}

      <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4">
        <div className="flex flex-wrap gap-4">
          <Link href="/transactions" className="text-sm font-medium text-[var(--color-primary)]">
            Transactions
          </Link>
          <Link href="/recurring" className="text-sm font-medium text-[var(--color-primary)]">
            Recurring expenses
          </Link>
          <Link href="/profile" className="text-sm font-medium text-[var(--color-primary)]">
            Profile
          </Link>
        </div>
        <form action={signOut}>
          <button type="submit" className="btn-secondary">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
