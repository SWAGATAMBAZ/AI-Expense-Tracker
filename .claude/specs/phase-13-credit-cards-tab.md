# Phase 13 (ad-hoc) — Credit Cards tab

Post-deployment feature add, not part of the original PRD/PLAN roadmap - requested directly against the live public-demo prototype.

## Scope

A new bottom-nav tab (`/cards`, CRED-style) for the current calendar month:
- "Total credit spend" header, summing every payment method whose name contains "Credit Card" (case-insensitive) - e.g. "HDFC Credit Card", "HSBC Credit Card". Deliberately a free-text convention on the *existing* `payment_method` field, not a new enum/column, so it slots into transactions exactly like "UPI"/"Cash" already do.
- One tile per card showing this month's spend (reuses `computePaymentMethodMix`'s own refund-netting/flooring, filtered to card-like methods - never re-derives that math) with a **Pay bill** button.
- A list of the month's individual card transactions, tagged by card.

## Data model

New table `credit_card_payments` (migration `0006`): `(user_id, card_name, period_month, amount_paid, paid_at)`, unique per `(user_id, card_name, period_month)`, RLS matching every other table (select/insert/update/delete scoped to `user_id = auth.uid()`).

"Pay bill" is real and persisted (not a client-only mock) - the public demo is shared/consistent across visitors like every other feature, and a demo that silently resets on refresh would undermine that. It **only** writes to `credit_card_payments`, never to `transactions` - paying a bill isn't a new expense, so it must never feed into `computeTotalSpend`/`computeCategoryBreakdown`/`computePaymentMethodMix` or the savings forecast. "Undo" (delete the payment row) exists for correcting a mis-tap, not a real refund flow.

## Non-goals

- No partial/minimum payments - a single "pay in full" action.
- No new transaction type. No change to Total Spend/Total Savings math.
- No date-range picker - always the current calendar month, like a statement cycle.

## Testing

- `lib/creditCards/cards.test.ts`: card grouping, refund-netting-per-card, total.
- `e2e/security-rls.spec.ts`: extended to cover `credit_card_payments` cross-user isolation.
- `e2e/golden-path.spec.ts`: extended with a full add → view → pay → verify flow.
- Demo data (`scripts/seed-test-user.mjs`) updated: current month has HDFC Credit Card ₹4,500 and HSBC Credit Card ₹6,500 across several merchants.
