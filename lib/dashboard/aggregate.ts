export interface TransactionForAggregate {
  amount: number;
  type: string;
  category_id: number | null;
  payment_method: string | null;
}

function expensesOnly(transactions: TransactionForAggregate[]): TransactionForAggregate[] {
  return transactions.filter((t) => t.type === "expense");
}

export function computeTotalSpend(transactions: TransactionForAggregate[]): number {
  return expensesOnly(transactions).reduce((sum, t) => sum + t.amount, 0);
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
  const expenses = expensesOnly(transactions);
  const total = expenses.reduce((sum, t) => sum + t.amount, 0);

  const byCategory = new Map<number | null, number>();
  for (const t of expenses) {
    byCategory.set(t.category_id, (byCategory.get(t.category_id) ?? 0) + t.amount);
  }

  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  return Array.from(byCategory.entries())
    .map(([categoryId, amount]) => ({
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
  const expenses = expensesOnly(transactions);
  const total = expenses.reduce((sum, t) => sum + t.amount, 0);

  const byMethod = new Map<string, number>();
  for (const t of expenses) {
    const method = t.payment_method?.trim() || "Unspecified";
    byMethod.set(method, (byMethod.get(method) ?? 0) + t.amount);
  }

  return Array.from(byMethod.entries())
    .map(([method, amount]) => ({
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
