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
      <div className="flex flex-col gap-1">
        <span className="text-sm text-[var(--color-text-secondary)]">Total spend</span>
        <span className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          {formatAmount(totalSpend, currency)}
        </span>
      </div>
      <div className="flex flex-col gap-1 border-l border-[var(--color-border)] pl-4">
        <span className="text-sm text-[var(--color-text-secondary)]">Upcoming spend</span>
        <span className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
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
