# Phase 14 (ad-hoc) — AI assistant: queries, history, purchase advice

Post-deployment feature add, requested directly against the live public-demo prototype.

## Scope

1. **Spending queries** (`query_spending` intent) — "How much have I spent on food?", "What's my biggest category?", "How much have I saved?", "What bills are coming up?". Answers are computed with the same aggregate helpers `/home` and `/cards` already use (`computeTotalSpend`/`computeCategoryBreakdown`/`computePaymentMethodMix`/`computeSavingsForecast`/`getUpcomingSpend`) and formatted **in code**, never asked of the LLM to compute - the model's only job is recognizing the question and extracting `metric`/`category`/`paymentMethod`/`period`.
2. **Chat history persistence** (`ai_chat_messages` table, migration `0007`) — every exchange is saved and reloaded on the next visit, instead of resetting to just the greeting. `ChatPanel` now auto-scrolls to the latest message on load, since there can be real history to scroll through.
3. **Fuller task coverage** — added `delete_recurring_expense` and `pay_credit_card_bill` intents (both follow the existing delete-needs-confirmation pattern) so the two remaining common manual actions without a chat equivalent are covered. Editing/deleting the most recent transaction already worked via `edit_transaction`/`delete_transaction` + `target.mostRecent` - no change needed there.
4. **Purchase advice** (`purchase_advice` intent) — "Should I buy earphones for 3000?". Deterministic heuristic in `lib/ai/queries.ts`, not LLM arithmetic: compares the amount against this month's *projected savings* (same forecast `/home` shows):
   - amount > savings (or already over budget) → **hard no**
   - amount > 50% of savings → **caution**, suggests the 24-hour rule
   - otherwise → **go ahead**, states what's left

   Explicitly framed as a budgeting heuristic, not real financial advice.

## Non-goals (deliberately left out)

- **Profile/salary updates via chat.** `updateProfile` validates a *complete* form (name/salary/day/currency/bank info all at once); wiring a partial chat-driven update would mean either relaxing that validation or building a merge-with-existing path, and salary is the one field that silently skews every other financial calculation in the app if the model mishears it. Left to the manual form; can revisit if asked for specifically.
- **Open-ended natural-language queries** ("what did I buy last Tuesday that was over 200?") - `query_spending` covers a fixed set of metrics/filters (spend/income/savings/upcoming/top-category, by category/payment-method/period), not a general text-to-SQL system.
- **Multi-turn advice conversations** ("what if I also bought X") - `purchase_advice` is single-shot per message, same as every other intent.

## Testing

- `lib/ai/queries.test.ts`: all five answer-formatters + the four purchase-advice verdict branches.
- `lib/ai/intent.test.ts`: parsing for all four new action shapes, including dropping an unrecognized `metric`/`period`.
- `app/actions/ai.test.ts`: end-to-end (mocked LLM + Supabase) coverage for a category-filtered query, a savings query, a hard-no purchase verdict, paying a card bill, and deleting a recurring expense.
- `app/ai/page.test.tsx`: persisted history renders instead of the greeting.
