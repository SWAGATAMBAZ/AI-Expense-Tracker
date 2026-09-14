import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/transactions/categories";
import { createRecurringExpense } from "@/app/actions/recurring";
import { RecurringExpenseForm } from "../RecurringExpenseForm";

export default async function NewRecurringExpensePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categories = await getCategories(supabase);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="flex flex-1 flex-col gap-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Add recurring expense</h1>

      <RecurringExpenseForm
        action={createRecurringExpense}
        categories={categories}
        defaultValues={{ nextDueDate: today, frequency: "monthly" }}
        submitLabel="Add recurring expense"
        pendingLabel="Adding…"
        mode="create"
      />

      <Link href="/recurring" className="text-sm font-medium text-[var(--color-text-secondary)]">
        &larr; Back to recurring expenses
      </Link>
    </main>
  );
}
