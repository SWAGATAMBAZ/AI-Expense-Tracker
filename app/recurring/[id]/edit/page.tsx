import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/transactions/categories";
import { updateRecurringExpense } from "@/app/actions/recurring";
import { RecurringExpenseForm } from "../../RecurringExpenseForm";

export default async function EditRecurringExpensePage({
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

  const [{ data: recurringExpense, error }, categories] = await Promise.all([
    supabase
      .from("recurring_expenses")
      .select("id, name, amount, frequency, next_due_date, category_id, payment_method, account_info, active")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    getCategories(supabase),
  ]);

  if (error) {
    console.error("[EditRecurringExpensePage] failed to load recurring expense:", error);
    return (
      <main className="flex flex-1 flex-col gap-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Edit recurring expense</h1>
        <p className="error-text">Could not load this recurring expense. Please try again.</p>
        <Link href="/recurring" className="text-sm font-medium text-[var(--color-text-secondary)]">
          &larr; Back to recurring expenses
        </Link>
      </main>
    );
  }
  if (!recurringExpense) notFound();

  return (
    <main className="flex flex-1 flex-col gap-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Edit recurring expense</h1>

      <RecurringExpenseForm
        action={updateRecurringExpense.bind(null, id)}
        categories={categories}
        defaultValues={{
          name: recurringExpense.name,
          amountRupees: recurringExpense.amount / 100,
          frequency: recurringExpense.frequency,
          nextDueDate: recurringExpense.next_due_date,
          categoryId: recurringExpense.category_id ?? undefined,
          paymentMethod: recurringExpense.payment_method ?? "",
          accountInfo: recurringExpense.account_info ?? "",
          active: recurringExpense.active,
        }}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        mode="edit"
      />

      <Link
        href="/recurring"
        className="text-sm font-medium text-[var(--color-text-secondary)]"
      >
        &larr; Back to recurring expenses
      </Link>
    </main>
  );
}
