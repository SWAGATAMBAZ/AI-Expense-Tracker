# Spec: Recurring-Expense Matching (Phase 9)

## Overview

This phase closes a real, currently-live gap: `lib/recurring/upcoming.ts`'s
`getUpcomingSpend` is purely date-based — it rolls a recurring expense's
`next_due_date` forward once it's calendar-passed, with **zero awareness**
of whether a matching transaction was actually recorded. So today, if a
user pays Rent and logs it (manually or via AI chat), Rent still shows as
"upcoming" until its due date passes on the calendar — meaning it gets
subtracted from the savings forecast **twice** (once as confirmed spend via
`computeTotalSpend`, once as still-upcoming via `getUpcomingSpend`), which
is exactly the double-counting PRD §10 says must never happen.

The fix is at the **data layer, not the dashboard**: when a new expense
transaction is created (from any already-built source — the manual form or
AI chat; Phase 7 SMS ingestion is deferred, see PLAN.md), attempt to match
it against the user's active recurring expenses. On a confident match,
advance that recurring expense's `next_due_date` in the database. Every
dashboard/list screen (`app/home/page.tsx`, `app/recurring/page.tsx`)
already reads `next_due_date` and rolls it forward for display via the
existing `getUpcomingSpend`/`advanceDueDate` — **so once the underlying
row is correctly advanced, the dashboard numbers become correct with no
changes to any dashboard/UI code at all.**

PRD sections implemented: §7 (Upcoming Expense → Processed Transaction
transition, matching fields), §10 (avoid double-counting in savings).

## Depends on

- **Phase 2** — `transactions` table, `app/actions/transactions.ts`'s
  shared `insertTransactionRow` (already used by both the manual form
  action and the AI assistant — this phase hooks into that single choke
  point so both callers get matching for free).
- **Phase 3** — `recurring_expenses` table, `lib/recurring/upcoming.ts`'s
  `advanceDueDate` (reused as-is, called differently — see below).
- **Phase 5/6** — the AI chat pipeline (`app/actions/ai.ts`), whose
  `add_transaction` confirmation text is enhanced when a match occurs.

## In scope

- A deterministic (non-LLM) matcher, run once at transaction-creation time
  for `type: "expense"` transactions only, against the user's **active**
  recurring expenses.
- Match requires ALL of:
  - Exact amount match (`recurring.amount === transaction.amountPaise`).
  - Transaction date within a frequency-scaled window of the recurring
    expense's *current* occurrence (computed via the existing
    `advanceDueDate`, evaluated as of the transaction's own date — so a
    backdated manual entry matches against what was due around *its*
    date, not necessarily today): weekly → ±3 days, monthly → ±7 days,
    yearly → ±14 days.
  - At least one corroborating signal: same `category_id` (when both have
    one set), or a case-insensitive substring match between the
    transaction's merchant and the recurring expense's name.
- **Exactly one** candidate satisfying all of the above → confident match,
  advance `next_due_date` to strictly after the fulfilled occurrence
  (reusing `advanceDueDate`, referenced one day past that occurrence so it
  always progresses at least one full cycle, even for a stale/overdue row).
  **Zero or multiple** candidates → no match, per PRD §7 ("if the system
  cannot confidently match it, it should avoid automatically assuming").
- The matched transaction records which recurring expense it settled
  (new nullable column — see Database changes) for traceability and to
  give Phase 10 a foundation for "undo the advance if this transaction is
  later deleted."
- AI chat's `add_transaction` confirmation is enhanced to mention the
  match when one occurs (e.g. "Added ₹20,000 expense at Landlord — this
  settles your upcoming Rent payment.").

## Explicitly out of scope

- **Matching on edit.** Only transaction *creation* triggers matching. If
  a transaction is added with a typo'd amount (no match) and later
  corrected via edit, it will not retroactively match. Deferred to Phase
  10 or later if it turns out to matter in practice.
- **Undo on delete.** Deleting a transaction that previously advanced a
  recurring expense's `next_due_date` does not roll it back. The new
  `matched_recurring_expense_id` column makes this buildable later
  (Phase 10) without another migration.
- **Fuzzy/tolerant amount matching** ("actual amount differs slightly from
  expected," PRD §19) — this phase requires an exact amount match. A
  bill that comes in for a different amount than usual will not
  auto-match; it stays upcoming rather than guessing.
- **Very overdue (multi-cycle-behind) bills.** The window is scaled to one
  cycle's worth of slack; a recurring expense several cycles behind
  because it was never logged may not match cleanly. Known Phase 10 edge
  case (PRD §19 "recurring expense not processed on expected date").
- **Manual-entry confirmation messaging.** `createTransaction` redirects
  to `/transactions` with no chat-style text channel to enhance; only the
  AI chat confirmation gets the "this settles..." message in this phase.
- Automatic classification of *ingested* messages against recurring
  expenses (depends on the deferred Phase 7) — not applicable here.

## Routes / API surface

No new routes or server actions. `insertTransactionRow` in
`app/actions/transactions.ts` (already the single shared insert path for
both the manual `createTransaction` action and the AI assistant) gains the
matching step internally, and its return type gains an optional
`matchedRecurringExpenseId` field that `app/actions/ai.ts` reads to build
its confirmation text.

## Database changes

One new migration, `supabase/migrations/0005_transaction_recurring_match.sql`:

```sql
alter table public.transactions
  add column matched_recurring_expense_id uuid
    references public.recurring_expenses(id) on delete set null;
```

Nullable, no default, no RLS changes needed (inherits the existing
per-row `transactions` policies). No changes to `recurring_expenses`'
schema — matching only ever writes to its existing `next_due_date` column.

## Pages / components

- **Modify:** `app/transactions/[id]/page.tsx` — when
  `matched_recurring_expense_id` is set, show a small "Settles: {recurring
  expense name}" line on the transaction detail view (read-only; a
  minimal use of the new column so the traceability is actually visible
  somewhere, not just in the database).
- No other page changes. `app/home/page.tsx`, `app/recurring/page.tsx`,
  and every chart/aggregate component are untouched — they already derive
  correct numbers from `recurring_expenses.next_due_date` once matching
  keeps that column current.

## Files to change

- `app/actions/transactions.ts` — `insertTransactionRow` runs the matcher
  and, on a match, updates the recurring expense and returns
  `matchedRecurringExpenseId`.
- `app/actions/ai.ts` — `handleAddTransaction` reads that field and
  appends the "this settles..." sentence to its confirmation text.
- `app/transactions/[id]/page.tsx` — show the "Settles: X" line.

## Files to create

- `lib/recurring/matching.ts` — the pure matcher:
  `findMatchingRecurringExpense(candidates, transaction)` (no Supabase
  dependency, fully unit-testable) plus the "advance past this occurrence"
  date helper built on top of the existing `advanceDueDate`.
- `lib/recurring/matching.test.ts`
- `supabase/migrations/0005_transaction_recurring_match.sql`

## New dependencies

None.

## Rules for implementation

- Matching logic is plain application code, never delegated to the LLM —
  PRD §20. It runs identically regardless of whether the transaction came
  from the manual form or the AI chat.
- Zero or multiple candidate matches must never be auto-resolved — leave
  the recurring expense's `next_due_date` untouched rather than guess
  (PRD §7).
- All Supabase queries remain scoped to the authenticated user
  (`.eq("user_id", userId)`) — the candidate-fetch query included.
- Store money as integers in paise throughout — the matcher compares raw
  `amount`/`amountPaise` integers, never converts to a float.
- The existing `advanceDueDate` function is reused, not reimplemented or
  forked, to keep "what does upcoming mean" defined in exactly one place.
- Mobile-first: the new "Settles: X" line on the transaction detail page
  verified at a ~375px viewport.
- No behavior change to `createTransaction`/`updateTransaction`'s existing
  callers beyond gaining matching — their existing tests must keep passing
  unmodified except where they now also assert on matching behavior.

## Definition of done

- [ ] `npm run typecheck`, `npm run lint`, `npm test` all pass, including
      new unit tests for `lib/recurring/matching.ts` covering: a confident
      single match (amount + date window + category), a confident match
      via merchant-name substring instead of category, no match when the
      amount differs, no match when two active recurring expenses both
      satisfy the criteria (ambiguous), no match when the transaction type
      isn't `expense`, no match against an inactive recurring expense, and
      each frequency's window boundary (weekly/monthly/yearly).
- [ ] `app/actions/transactions.test.ts` extended to cover
      `insertTransactionRow` actually calling the update on a match and
      returning `matchedRecurringExpenseId`.
- [ ] Manual verification against the seeded test data
      (`npm run seed:test-user`): create (via the AI chat) a transaction
      that exactly matches the seeded Rent recurring expense's amount and
      due-date window — confirm `/recurring` now shows Rent's next due
      date advanced by one cycle, `/home`'s Upcoming Spend drops by the
      Rent amount, Total Spend/Savings reflect it exactly once (not
      twice), and the AI chat confirmation mentions the match.
- [ ] Confirm an unrelated new expense (no plausible recurring match)
      changes nothing about any recurring expense's due date.
- [ ] Confirm deleting or editing a *non-matching* transaction still works
      exactly as before (no regression in the existing manual/AI edit and
      delete flows).
- [ ] `/code-review high` run on the diff (spec explicitly calls for this
      per PLAN.md §6 — matching/financial logic is easy to get subtly
      wrong) and findings addressed.
