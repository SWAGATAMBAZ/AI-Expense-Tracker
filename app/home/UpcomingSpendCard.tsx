import Link from "next/link";
import { formatAmount, formatShortDate } from "@/lib/transactions/format";
import type { UpcomingItem } from "@/lib/recurring/upcoming";

export function UpcomingSpendCard({
  items,
  total,
  currency,
}: {
  items: UpcomingItem[];
  total: number;
  currency: string;
}) {
  if (items.length === 0) {
    return (
      <div className="card flex flex-col gap-2">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">Upcoming spend</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          No upcoming recurring expenses.
        </p>
        <Link href="/recurring/new" className="text-sm font-medium text-[var(--color-primary)]">
          Add one
        </Link>
      </div>
    );
  }

  const visible = items.slice(0, 5);

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">Upcoming spend</h2>
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
          {formatAmount(total, currency)}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {visible.map((item) => (
          <li key={item.id} className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-text-secondary)]">
              {item.name} &middot; {formatShortDate(item.nextOccurrence, { includeYear: false })}
            </span>
            <span className="text-[var(--color-text-primary)]">
              {formatAmount(item.amount, currency)}
            </span>
          </li>
        ))}
      </ul>

      <Link href="/recurring" className="text-sm font-medium text-[var(--color-primary)]">
        View all
      </Link>
    </div>
  );
}
