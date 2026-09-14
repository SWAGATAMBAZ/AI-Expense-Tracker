import Link from "next/link";
import { formatAmount, formatShortDate } from "@/lib/transactions/format";

export interface RecentTransactionItem {
  id: string;
  merchant: string | null;
  amount: number;
  transaction_date: string;
  type: string;
  category: { name: string } | { name: string }[] | null;
}

function categoryName(category: RecentTransactionItem["category"]) {
  if (!category) return "Uncategorized";
  return Array.isArray(category) ? (category[0]?.name ?? "Uncategorized") : category.name;
}

export function RecentTransactionsCard({
  transactions,
  currency,
}: {
  transactions: RecentTransactionItem[];
  currency: string;
}) {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">Transactions</h2>
        <Link href="/transactions" className="text-sm font-medium text-[var(--color-primary)]">
          View all
        </Link>
      </div>

      {transactions.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          No transactions yet.{" "}
          <Link href="/transactions/new" className="font-medium text-[var(--color-primary)]">
            Add one
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-border)]">
          {transactions.map((transaction) => (
            <li key={transaction.id} className="flex items-center justify-between gap-2 py-2.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {transaction.merchant ?? "Unknown merchant"}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {categoryName(transaction.category)} &middot;{" "}
                  {formatShortDate(transaction.transaction_date, { includeYear: false })}
                </span>
              </div>
              <span
                className={`text-sm font-semibold ${
                  transaction.type === "expense"
                    ? "text-[var(--color-text-primary)]"
                    : "text-[var(--color-accent)]"
                }`}
              >
                {transaction.type === "expense" ? "-" : "+"}
                {formatAmount(transaction.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
