import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/transactions/categories";
import { createTransaction } from "@/app/actions/transactions";
import { TransactionForm } from "../TransactionForm";

export default async function NewTransactionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categories = await getCategories(supabase);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="flex flex-1 flex-col gap-6 pb-8">
      <h1 className="text-2xl font-semibold tracking-tight">Add transaction</h1>

      <TransactionForm
        action={createTransaction}
        categories={categories}
        defaultValues={{ date: today, type: "expense" }}
        submitLabel="Add transaction"
        pendingLabel="Adding…"
      />

      <Link href="/transactions" className="text-sm font-medium text-[var(--color-text-secondary)]">
        &larr; Back to transactions
      </Link>
    </main>
  );
}
