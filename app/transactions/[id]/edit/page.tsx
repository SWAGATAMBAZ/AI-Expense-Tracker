import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/transactions/categories";
import { updateTransaction } from "@/app/actions/transactions";
import { TransactionForm } from "../../TransactionForm";

export default async function EditTransactionPage({
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

  const [{ data: transaction }, categories] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, merchant, amount, category_id, transaction_date, payment_method, account_info, type, notes")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    getCategories(supabase),
  ]);

  if (!transaction) notFound();

  return (
    <main className="flex flex-1 flex-col gap-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Edit transaction</h1>

      <TransactionForm
        action={updateTransaction.bind(null, id)}
        categories={categories}
        defaultValues={{
          merchant: transaction.merchant ?? "",
          amountRupees: transaction.amount / 100,
          categoryId: transaction.category_id ?? undefined,
          date: transaction.transaction_date,
          paymentMethod: transaction.payment_method ?? "",
          accountInfo: transaction.account_info ?? "",
          type: transaction.type,
          notes: transaction.notes ?? "",
        }}
        submitLabel="Save changes"
        pendingLabel="Saving…"
      />

      <Link
        href={`/transactions/${id}`}
        className="text-sm font-medium text-[var(--color-text-secondary)]"
      >
        &larr; Back to transaction
      </Link>
    </main>
  );
}
