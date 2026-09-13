import Link from "next/link";
import { DeleteTransactionButton } from "./DeleteTransactionButton";
import { formatAmount } from "@/lib/transactions/format";

export interface TransactionListItem {
  id: string;
  merchant: string | null;
  amount: number;
  currency: string;
  transaction_date: string;
  payment_method: string | null;
  type: string;
  category: { name: string } | { name: string }[] | null;
}

function categoryName(category: TransactionListItem["category"]) {
  if (!category) return "Uncategorized";
  return Array.isArray(category) ? (category[0]?.name ?? "Uncategorized") : category.name;
}

export function TransactionList({ transactions }: { transactions: TransactionListItem[] }) {
  if (transactions.length === 0) {
    return (
      <p className="card text-sm text-[var(--color-text-secondary)]">
        No transactions yet. Add your first one above.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {transactions.map((transaction) => (
        <li key={transaction.id} className="card flex flex-col gap-2">
          <Link href={`/transactions/${transaction.id}`} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-[var(--color-text-primary)]">
                {transaction.merchant ?? "Unknown merchant"}
              </span>
              <span className="font-semibold text-[var(--color-text-primary)]">
                {formatAmount(transaction.amount, transaction.currency)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-secondary)]">
              <span>{categoryName(transaction.category)}</span>
              <span>&middot;</span>
              <span>{transaction.transaction_date}</span>
              {transaction.payment_method ? (
                <>
                  <span>&middot;</span>
                  <span>{transaction.payment_method}</span>
                </>
              ) : null}
              <span className="ml-auto rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 capitalize">
                {transaction.type}
              </span>
            </div>
          </Link>
          <DeleteTransactionButton id={transaction.id} />
        </li>
      ))}
    </ul>
  );
}
