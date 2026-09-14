export interface TransactionForAggregate {
  amount: number;
  type: string;
  category_id: number | null;
  payment_method: string | null;
}

function spendRelevant(transactions: TransactionForAggregate[]): TransactionForAggregate[] {
  return transactions.filter((t) => t.type === "expense" || t.type === "refund");
}

/** A refund reverses a prior expense (PRD §12), so it nets against spend rather than being ignored. */
function signedAmount(t: TransactionForAggregate): number {
  return t.type === "refund" ? -t.amount : t.amount;
}

export function computeTotalSpend(transactions: TransactionForAggregate[]): number {
  const net = spendRelevant(transactions).reduce((sum, t) => sum + signedAmount(t), 0);
  return Math.max(0, net);
}

/** Logged income transactions (PRD §19), summed plainly - no netting against spend. */
export function computeTotalIncome(transactions: TransactionForAggregate[]): number {
  return transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
}

export interface CategoryBreakdownItem {
  categoryId: number | null;
  categoryName: string;
  amount: number;
  percentage: number;
}

export function computeCategoryBreakdown(
  transactions: TransactionForAggregate[],
  categories: { id: number; name: string }[]
): CategoryBreakdownItem[] {
  const total = computeTotalSpend(transactions);

  const byCategory = new Map<number | null, number>();
  for (const t of spendRelevant(transactions)) {
    byCategory.set(t.category_id, (byCategory.get(t.category_id) ?? 0) + signedAmount(t));
  }

  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  return Array.from(byCategory.entries())
    // A category fully offset by its own refunds (or over-refunded) contributes
    // nothing to display - never a negative slice.
    .map(([categoryId, netAmount]) => ({ categoryId, amount: Math.max(0, netAmount) }))
    .filter((entry) => entry.amount > 0)
    .map(({ categoryId, amount }) => ({
      categoryId,
      categoryName: categoryId != null ? (nameById.get(categoryId) ?? "Uncategorized") : "Uncategorized",
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export interface PaymentMethodMixItem {
  method: string;
  amount: number;
  percentage: number;
}

export function computePaymentMethodMix(
  transactions: TransactionForAggregate[]
): PaymentMethodMixItem[] {
  const total = computeTotalSpend(transactions);

  const byMethod = new Map<string, number>();
  for (const t of spendRelevant(transactions)) {
    const method = t.payment_method?.trim() || "Unspecified";
    byMethod.set(method, (byMethod.get(method) ?? 0) + signedAmount(t));
  }

  return Array.from(byMethod.entries())
    .map(([method, netAmount]) => ({ method, amount: Math.max(0, netAmount) }))
    .filter((entry) => entry.amount > 0)
    .map(({ method, amount }) => ({
      method,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export interface SavingsForecastResult {
  amount: number;
  isOverBudget: boolean;
}

/**
 * Estimated Savings = Income - Confirmed Spend - Remaining Upcoming Spend,
 * floored at 0 (never shown negative), per PRD §9/§10. Returns null when no
 * salary is configured, so the caller can render a setup prompt instead of a
 * fabricated number.
 */
export function computeSavingsForecast(
  incomePaise: number | null,
  confirmedSpendPaise: number,
  upcomingSpendPaise: number
): SavingsForecastResult | null {
  if (incomePaise == null) return null;

  const raw = incomePaise - confirmedSpendPaise - upcomingSpendPaise;
  return {
    amount: Math.max(0, raw),
    isOverBudget: raw < 0,
  };
}
