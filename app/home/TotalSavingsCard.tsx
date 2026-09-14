import Link from "next/link";
import { formatAmount } from "@/lib/transactions/format";
import type { SavingsForecastResult } from "@/lib/dashboard/aggregate";

export function TotalSavingsCard({
  forecast,
  currency,
}: {
  forecast: SavingsForecastResult | null;
  currency: string;
}) {
  if (forecast === null) {
    return (
      <div className="card flex flex-col gap-2">
        <span className="card-label">Total savings</span>
        <Link href="/profile" className="text-sm font-medium text-[var(--color-primary)]">
          Set up salary
        </Link>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-1 border-[color-mix(in_srgb,var(--color-accent)_25%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-accent)_6%,white)]">
      <span className="card-label">Total savings</span>
      <span className="stat-figure text-[var(--color-accent)]">
        {formatAmount(forecast.amount, currency)}
      </span>
      {forecast.isOverBudget ? (
        <span className="text-xs font-medium text-[var(--color-danger)]">
          Spending exceeds income
        </span>
      ) : null}
    </div>
  );
}
