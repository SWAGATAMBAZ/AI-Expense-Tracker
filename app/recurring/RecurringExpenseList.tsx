import Link from "next/link";
import { formatAmount, formatShortDate } from "@/lib/transactions/format";
import { DeleteRecurringExpenseButton } from "./DeleteRecurringExpenseButton";
import { ToggleActiveButton } from "./ToggleActiveButton";

export interface RecurringExpenseListItem {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  active: boolean;
  nextOccurrence: string;
  category: { name: string } | { name: string }[] | null;
}

function categoryName(category: RecurringExpenseListItem["category"]) {
  if (!category) return "Uncategorized";
  return Array.isArray(category) ? (category[0]?.name ?? "Uncategorized") : category.name;
}

export function RecurringExpenseList({
  expenses,
  currency,
}: {
  expenses: RecurringExpenseListItem[];
  currency: string;
}) {
  if (expenses.length === 0) {
    return (
      <p className="card text-sm text-[var(--color-text-secondary)]">
        No recurring expenses yet. Add your first one above.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {expenses.map((expense) => (
        <li
          key={expense.id}
          className={`card flex flex-col gap-2 ${expense.active ? "" : "opacity-60"}`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium text-[var(--color-text-primary)]">{expense.name}</span>
            <span className="font-semibold text-[var(--color-text-primary)]">
              {formatAmount(expense.amount, currency)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-secondary)]">
            <span className="capitalize">{expense.frequency}</span>
            <span>&middot;</span>
            <span>{categoryName(expense.category)}</span>
            <span>&middot;</span>
            <span>Next: {formatShortDate(expense.nextOccurrence)}</span>
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
                expense.active
                  ? "bg-emerald-50 text-[var(--color-accent)]"
                  : "bg-slate-100 text-[var(--color-text-muted)]"
              }`}
            >
              {expense.active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/recurring/${expense.id}/edit`}
              className="text-sm font-medium text-[var(--color-primary)]"
            >
              Edit
            </Link>
            <ToggleActiveButton id={expense.id} active={expense.active} />
            <DeleteRecurringExpenseButton id={expense.id} />
          </div>
        </li>
      ))}
    </ul>
  );
}
