import Link from "next/link";
import { formatAmount } from "@/lib/transactions/format";
import type { SavingsForecastResult } from "@/lib/dashboard/aggregate";

export function SavingsForecastCard({
  forecast,
  currency,
}: {
  forecast: SavingsForecastResult | null;
  currency: string;
}) {
  if (forecast === null) {
    return (
      <div className="card flex flex-col gap-2">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">
          Savings forecast
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Set your monthly salary to see your savings forecast.
        </p>
        <Link href="/profile" className="btn-secondary text-center">
          Set up profile
        </Link>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-1">
      <span className="text-sm text-[var(--color-text-secondary)]">
        Savings forecast &middot; This Month
      </span>
      <span className="text-3xl font-semibold tracking-tight text-[var(--color-accent)]">
        {formatAmount(forecast.amount, currency)}
      </span>
      {forecast.isOverBudget ? (
        <p className="error-text">Your projected spending exceeds your income this month.</p>
      ) : null}
    </div>
  );
}
