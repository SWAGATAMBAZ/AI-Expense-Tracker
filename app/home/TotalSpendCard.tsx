import { formatAmount } from "@/lib/transactions/format";

export function TotalSpendCard({
  amount,
  currency,
  label,
}: {
  amount: number;
  currency: string;
  label: string;
}) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-sm text-[var(--color-text-secondary)]">Total spend &middot; {label}</span>
      <span className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
        {formatAmount(amount, currency)}
      </span>
    </div>
  );
}
