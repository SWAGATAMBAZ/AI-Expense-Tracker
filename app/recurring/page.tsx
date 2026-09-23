import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatAmount } from "@/lib/transactions/format";
import { getUpcomingSpend } from "@/lib/recurring/upcoming";
import type { RecurringFrequency } from "@/lib/recurring/validation";
import { RecurringExpenseList, type RecurringExpenseListItem } from "./RecurringExpenseList";

export default async function RecurringExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: recurringExpenses, error }] = await Promise.all([
    supabase.from("profiles").select("currency").eq("id", user.id).maybeSingle(),
    supabase
      .from("recurring_expenses")
      .select(
        "id, name, amount, frequency, next_due_date, active, category:categories(name)"
      )
      .eq("user_id", user.id),
  ]);

  if (error) console.error("[RecurringExpensesPage] failed to load recurring expenses:", error);

  const currency = profile?.currency ?? "INR";
  const today = new Date().toISOString().slice(0, 10);

  const rows = recurringExpenses ?? [];

  // Single source of truth for rolled-forward due dates: computed once here,
  // then looked up below instead of re-derived, so the list and the total
  // can never drift apart.
  const upcoming = getUpcomingSpend(
    rows
      .filter((row) => row.active)
      .map((row) => ({
        id: row.id as string,
        name: row.name as string,
        amount: row.amount as number,
        frequency: row.frequency as RecurringFrequency,
        nextDueDate: row.next_due_date as string,
        active: row.active as boolean,
      })),
    today
  );
  const nextOccurrenceById = new Map(upcoming.items.map((item) => [item.id, item.nextOccurrence]));

  const items: RecurringExpenseListItem[] = rows
    .map((row) => ({
      id: row.id as string,
      name: row.name as string,
      amount: row.amount as number,
      frequency: row.frequency as string,
      active: row.active as boolean,
      // Inactive expenses aren't rolled forward — their due date is frozen.
      nextOccurrence: nextOccurrenceById.get(row.id as string) ?? (row.next_due_date as string),
      category: row.category as RecurringExpenseListItem["category"],
    }))
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.nextOccurrence.localeCompare(b.nextOccurrence);
    });

  return (
    <main className="flex flex-1 flex-col gap-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Recurring expenses</h1>
        <Link href="/recurring/new" className="text-sm font-medium text-[var(--color-primary)]">
          + Add
        </Link>
      </div>

      <div className="card flex items-baseline justify-between">
        <span className="text-sm text-[var(--color-text-secondary)]">Upcoming spend</span>
        <span className="text-lg font-semibold text-[var(--color-text-primary)]">
          {formatAmount(upcoming.total, currency)}
        </span>
      </div>

      {error ? (
        <p className="error-text">Could not load your recurring expenses. Please try again.</p>
      ) : (
        <RecurringExpenseList expenses={items} currency={currency} />
      )}

      <Link href="/home" className="text-sm font-medium text-[var(--color-text-secondary)]">
        &larr; Back home
      </Link>
    </main>
  );
}
