"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { payCreditCardBill, undoCreditCardPayment } from "@/app/actions/creditCards";
import { formatAmount, formatShortDate } from "@/lib/transactions/format";

export function PayBillButton({
  cardName,
  periodMonth,
  amount,
  currency,
  paid,
}: {
  cardName: string;
  periodMonth: string;
  amount: number;
  currency: string;
  paid: { amount: number; paidAt: string } | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePay() {
    setError(null);
    startTransition(async () => {
      const result = await payCreditCardBill(cardName, periodMonth, amount);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleUndo() {
    setError(null);
    startTransition(async () => {
      const result = await undoCreditCardPayment(cardName, periodMonth);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (paid) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-[var(--color-accent)]">
            Paid {formatAmount(paid.amount, currency)} &middot; {formatShortDate(paid.paidAt.slice(0, 10), { includeYear: false })}
          </span>
          <button
            type="button"
            onClick={handleUndo}
            disabled={isPending}
            className="text-xs font-medium text-[var(--color-text-secondary)] underline disabled:opacity-60"
          >
            {isPending ? "…" : "Undo"}
          </button>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handlePay}
        disabled={isPending}
        className="btn-primary !w-auto px-4 py-1.5 text-sm disabled:opacity-60"
      >
        {isPending ? "Paying…" : `Pay bill · ${formatAmount(amount, currency)}`}
      </button>
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
