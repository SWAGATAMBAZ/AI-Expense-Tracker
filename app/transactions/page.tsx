import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TransactionList, type TransactionListItem } from "./TransactionList";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const showDuplicateWarning = params.duplicateWarning === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select(
      "id, merchant, amount, currency, transaction_date, payment_method, type, category:categories(name)"
    )
    .eq("user_id", user.id)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) console.error("[TransactionsPage] failed to load transactions:", error);

  return (
    <main className="flex flex-1 flex-col gap-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <Link href="/transactions/new" className="text-sm font-medium text-[var(--color-primary)]">
          + Add
        </Link>
      </div>

      {showDuplicateWarning && (
        <p className="card border-[color-mix(in_srgb,var(--color-warning)_25%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-warning)_8%,white)] text-sm text-[var(--color-warning)]">
          This looks like a duplicate of an existing transaction — we added it anyway. Check below if
          that wasn&apos;t intended.
        </p>
      )}

      {error ? (
        <p className="error-text">Could not load your transactions. Please try again.</p>
      ) : (
        <TransactionList transactions={(transactions as unknown as TransactionListItem[]) ?? []} />
      )}

      <Link href="/home" className="text-sm font-medium text-[var(--color-text-secondary)]">
        &larr; Back home
      </Link>
    </main>
  );
}
