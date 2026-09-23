import { computePaymentMethodMix, type TransactionForAggregate } from "@/lib/dashboard/aggregate";

/**
 * Any payment method whose name contains "credit card" is treated as a
 * card (e.g. "HDFC Credit Card", "HSBC Credit Card") - deliberately a
 * free-text convention, not a new enum, so it reuses the same
 * `payment_method` field every other transaction already has instead of
 * introducing a parallel "which card" concept.
 */
export function isCreditCardMethod(method: string): boolean {
  return /credit card/i.test(method);
}

export interface CreditCardSummaryItem {
  cardName: string;
  amount: number;
}

/**
 * Reuses computePaymentMethodMix's own refund-netting/flooring (PRD "never
 * double count") rather than re-deriving it, then narrows to credit-card
 * methods only. Deliberately ignores that function's `percentage` field -
 * this tab's "share" is of card spend only, not of all spend.
 */
export function computeCreditCardSummary(
  transactions: TransactionForAggregate[]
): CreditCardSummaryItem[] {
  return computePaymentMethodMix(transactions)
    .filter((item) => isCreditCardMethod(item.method))
    .map((item) => ({ cardName: item.method, amount: item.amount }));
}

export function computeTotalCreditSpend(items: CreditCardSummaryItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

/** 'YYYY-MM' for the given date (defaults to now), matching a bill's period_month. */
export function currentPeriodMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}
