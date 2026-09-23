import { formatAmount } from "@/lib/transactions/format";
import { PayBillButton } from "./PayBillButton";

export interface CardListItem {
  cardName: string;
  amount: number;
  paid: { amount: number; paidAt: string } | null;
}

export function CardList({
  cards,
  periodMonth,
  currency,
}: {
  cards: CardListItem[];
  periodMonth: string;
  currency: string;
}) {
  if (cards.length === 0) {
    return (
      <p className="card text-sm text-[var(--color-text-secondary)]">
        No credit card spending this month. Transactions paid with a method containing
        &quot;Credit Card&quot; (e.g. &quot;HDFC Credit Card&quot;) show up here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {cards.map((card) => (
        <li key={card.cardName} className="card flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium text-[var(--color-text-primary)]">{card.cardName}</span>
            <span className="font-semibold text-[var(--color-text-primary)]">
              {formatAmount(card.amount, currency)}
            </span>
          </div>
          <PayBillButton
            cardName={card.cardName}
            periodMonth={periodMonth}
            amount={card.amount}
            currency={currency}
            paid={card.paid}
          />
        </li>
      ))}
    </ul>
  );
}
