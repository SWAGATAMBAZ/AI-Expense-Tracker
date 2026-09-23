import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatAmount } from "@/lib/transactions/format";
import {
  computeCreditCardSummary,
  computeTotalCreditSpend,
  currentPeriodMonth,
  isCreditCardMethod,
} from "@/lib/creditCards/cards";
import { resolveDateRange } from "@/lib/dashboard/dateRanges";
import { CardList, type CardListItem } from "./CardList";
import { CardTransactionsList, type CardTransactionItem } from "./CardTransactionsList";

export default async function CreditCardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);
  // Always the current calendar month (like a real statement cycle) -
  // deliberately independent of the dashboard's user-selected date filter.
  const monthRange = resolveDateRange("month", {}, today);
  const periodMonth = currentPeriodMonth();

  const [{ data: profile }, { data: transactions, error }, { data: payments, error: paymentsError }] =
    await Promise.all([
      supabase.from("profiles").select("currency").eq("id", user.id).maybeSingle(),
      supabase
        .from("transactions")
        .select("id, merchant, amount, type, category_id, payment_method, transaction_date")
        .eq("user_id", user.id)
        .gte("transaction_date", monthRange.start)
        .lte("transaction_date", monthRange.end),
      supabase
        .from("credit_card_payments")
        .select("card_name, amount_paid, paid_at")
        .eq("user_id", user.id)
        .eq("period_month", periodMonth),
    ]);

  if (error) console.error("[CreditCardsPage] failed to load transactions:", error);
  if (paymentsError) console.error("[CreditCardsPage] failed to load payments:", paymentsError);

  const currency = profile?.currency ?? "INR";
  const rows = transactions ?? [];

  const cardSummary = computeCreditCardSummary(rows);
  const totalCreditSpend = computeTotalCreditSpend(cardSummary);

  const paidByCard = new Map(
    (payments ?? []).map((p) => [p.card_name as string, { amount: p.amount_paid as number, paidAt: p.paid_at as string }])
  );

  const cards: CardListItem[] = cardSummary
    .map((item) => ({
      cardName: item.cardName,
      amount: item.amount,
      paid: paidByCard.get(item.cardName) ?? null,
    }))
    .sort((a, b) => b.amount - a.amount);

  const cardTransactions: CardTransactionItem[] = rows
    .filter((t) => t.payment_method && isCreditCardMethod(t.payment_method as string))
    .map((t) => ({
      id: t.id as string,
      merchant: t.merchant as string | null,
      amount: t.amount as number,
      type: t.type as string,
      cardName: t.payment_method as string,
      transaction_date: t.transaction_date as string,
    }))
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

  return (
    <main className="flex flex-1 flex-col gap-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Credit cards</h1>

      <div className="card flex flex-col gap-1">
        <span className="card-label">Total credit spend</span>
        <span className="stat-figure text-[var(--color-text-primary)]">
          {formatAmount(totalCreditSpend, currency)}
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">{monthRange.label}</span>
      </div>

      {error ? (
        <p className="error-text">Could not load your card data. Please try again.</p>
      ) : (
        <>
          <CardList cards={cards} periodMonth={periodMonth} currency={currency} />
          <CardTransactionsList transactions={cardTransactions} currency={currency} />
        </>
      )}

      <Link href="/home" className="text-sm font-medium text-[var(--color-text-secondary)]">
        &larr; Back home
      </Link>
    </main>
  );
}
