import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteTransactionButton } from "../DeleteTransactionButton";
import { formatAmount } from "@/lib/transactions/format";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: transaction, error } = await supabase
    .from("transactions")
    .select(
      "id, merchant, amount, currency, transaction_date, payment_method, account_info, type, notes, source, category:categories(name), matched_recurring_expense:recurring_expenses(name)"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return (
      <main className="flex flex-1 flex-col gap-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Transaction detail</h1>
        <p className="error-text">Could not load this transaction. Please try again.</p>
        <Link href="/transactions" className="text-sm font-medium text-[var(--color-text-secondary)]">
          &larr; Back to transactions
        </Link>
      </main>
    );
  }
  if (!transaction) notFound();

  const category = Array.isArray(transaction.category)
    ? transaction.category[0]
    : transaction.category;
  const matchedRecurringExpense = Array.isArray(transaction.matched_recurring_expense)
    ? transaction.matched_recurring_expense[0]
    : transaction.matched_recurring_expense;
  const typeLabel = transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1);

  const rows: [string, string][] = [
    ["Merchant", transaction.merchant ?? "Unknown merchant"],
    ["Amount", formatAmount(transaction.amount, transaction.currency)],
    ["Category", category?.name ?? "Uncategorized"],
    ["Date", transaction.transaction_date],
    ["Payment method", transaction.payment_method ?? "—"],
    ["Account/card", transaction.account_info ?? "—"],
    ["Type", typeLabel],
    ["Notes", transaction.notes ?? "—"],
    ...(matchedRecurringExpense ? ([["Settles", matchedRecurringExpense.name]] as [string, string][]) : []),
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Transaction detail</h1>

      <dl className="card flex flex-col gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-sm text-[var(--color-text-secondary)]">{label}</dt>
            <dd className="text-right text-sm font-medium text-[var(--color-text-primary)]">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3">
        <Link href={`/transactions/${id}/edit`} className="btn-secondary text-center">
          Edit
        </Link>
        <DeleteTransactionButton id={id} redirectTo="/transactions" />
      </div>

      <Link href="/transactions" className="text-sm font-medium text-[var(--color-text-secondary)]">
        &larr; Back to transactions
      </Link>
    </main>
  );
}
