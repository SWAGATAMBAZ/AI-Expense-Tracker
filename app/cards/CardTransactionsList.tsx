import Link from "next/link";
import { formatAmount, formatShortDate } from "@/lib/transactions/format";

export interface CardTransactionItem {
  id: string;
  merchant: string | null;
  amount: number;
  type: string;
  cardName: string;
  transaction_date: string;
}

export function CardTransactionsList({
  transactions,
  currency,
}: {
  transactions: CardTransactionItem[];
  currency: string;
}) {
  return (
    <div className="card flex flex-col gap-3">
      <h2 className="card-label">Transactions this month</h2>

      {transactions.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">No card transactions yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-border)]">
          {transactions.map((transaction) => (
            <li key={transaction.id} className="py-2.5">
              <Link
                href={`/transactions/${transaction.id}`}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {transaction.merchant ?? "Unknown merchant"}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {transaction.cardName} &middot;{" "}
                    {formatShortDate(transaction.transaction_date, { includeYear: false })}
                  </span>
                </div>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    transaction.type === "expense"
                      ? "text-[var(--color-text-primary)]"
                      : "text-[var(--color-accent)]"
                  }`}
                >
                  {transaction.type === "expense" ? "-" : "+"}
                  {formatAmount(transaction.amount, currency)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
