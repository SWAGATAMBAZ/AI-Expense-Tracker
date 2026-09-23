import Link from "next/link";
import { formatAmount } from "@/lib/transactions/format";

export function SpendSummaryCard({
  totalSpend,
  upcomingSpend,
  hasUpcomingItems,
  currency,
}: {
  totalSpend: number;
  upcomingSpend: number;
  hasUpcomingItems: boolean;
  currency: string;
}) {
  return (
    <div className="card grid grid-cols-2 gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="card-label">Total spend</span>
        <span className="stat-figure text-[var(--color-text-primary)]">
          {formatAmount(totalSpend, currency)}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1 border-l border-[var(--color-border)] pl-4">
        <span className="card-label">Upcoming spend</span>
        <span className="stat-figure text-[var(--color-warning)]">
          {formatAmount(upcomingSpend, currency)}
        </span>
        {!hasUpcomingItems ? (
          <Link href="/recurring/new" className="text-xs font-medium text-[var(--color-primary)]">
            Add a recurring expense
          </Link>
        ) : null}
      </div>
    </div>
  );
}
