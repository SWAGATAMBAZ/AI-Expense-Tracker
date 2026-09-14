# Spec: Recurring / Upcoming Expenses (Phase 03)

## Overview
This phase adds a second, distinct data model on top of Phase 2's
transaction data: **expected future bills** (rent, EMI, subscriptions,
etc.) rather than actual money movements. It implements PRD.md §7
("Upcoming / Recurring Expenses") — full CRUD on recurring expenses,
plus a derivation of "Upcoming Spend" (the amount and next occurrence
of every active recurring expense). Per PLAN.md §3/§4, this phase sits
directly after Phase 2 (it reuses the `categories` table and the
Server-Action/RLS/validation conventions Phase 2 established) and
directly before Phase 4 (the dashboard), which consumes this phase's
upcoming-spend derivation for its "Upcoming Spend" card and its Savings
Forecast calculation. This spec is being written and implemented in
the same branch/session as Phase 4 (`.claude/specs/phase-04-dashboard-forecasting-math.md`)
at the user's request, but is kept as its own spec/commit-sized unit so
each phase's scope and Definition of Done stay independently
verifiable, per PLAN.md §0's stated method.

## Depends on
**Phase 2 (Core transaction data + manual CRUD)**, per PLAN.md §3's
"Depends on" column. It provides: the `categories` table (reused here
via the same FK pattern `transactions.category_id` uses), the
per-user RLS policy style from `supabase/migrations/0003_transactions.sql`,
the Server Action conventions (`app/actions/transactions.ts`), and the
plain-TS validator pattern (`lib/transactions/validation.ts`). It does
**not** depend on any recurring-expense-specific work from Phase 2 —
Phase 2's `transactions` table has no link to recurring expenses.

## In scope
- **`recurring_expenses` table + Row-Level Security** — PRD §7's field
  list: name, amount, frequency, expected/next-due date, category,
  payment method, optional account/card, active/inactive status.
- **CRUD UI**: add / view / edit / delete a recurring expense, and
  toggle it active/inactive (an inactive recurring expense stops
  contributing to Upcoming Spend without deleting its history) — PRD
  §7.
- **Upcoming-spend derivation**: a pure, unit-tested function that,
  given "today," returns each **active** recurring expense's next
  occurrence date and amount, automatically rolling `next_due_date`
  forward past any cycles that have already elapsed (e.g. a monthly
  rent due on the 1st, checked on the 15th, reports next due date as
  next month's 1st) — pure date arithmetic, no transaction lookups.
  This satisfies PRD §8's "Only future/unprocessed recurring expenses
  should be included" using the only signal this phase has available
  (the date), since real transaction-matching doesn't exist yet (see
  "Explicitly out of scope" below).
- **A standalone "Upcoming Spend" list screen** (`/recurring`) showing
  every active recurring expense's next occurrence + a running total —
  a minimal version of PRD §8's Upcoming Spend card, ahead of Phase 4
  wiring the same derivation into the full dashboard.

## Explicitly out of scope
- **Automatic matching between a recurring expense and an actual
  transaction** — PRD §7's "Important Logic" describes an `Upcoming
  Expense → Processed Transaction → Total Spend` transition, matched
  by amount/merchant/category/expected-date/account. This is Phase 9
  ("Recurring-expense matching + transaction types") per PLAN.md §3/§4,
  which explicitly wires matching into Phase 7's ingestion pipeline and
  manual entry — neither of which exists yet. **This is a deliberate,
  known simplification**: until Phase 9, "upcoming" is derived purely
  from the recurring expense's own date, not from whether a real
  transaction was actually recorded for it. A user who manually logs a
  transaction for their rent this month will see both the transaction
  (in Phase 2's list) and the recurring expense (still "upcoming" until
  its date passes) — true double-count avoidance per PRD §10 arrives
  with Phase 9's matching engine.
- **Any "processed" status tied to a real transaction row** — same
  reason; Phase 9.
- **Dashboard integration** (rendering inside the full dashboard's
  Upcoming Spend card, feeding the Savings Forecast) — Phase 4, spec'd
  separately even though built in this same branch.
- **Notifications or reminders** before a due date — not requested by
  PRD.
- **Arbitrary/custom recurrence rules** (e.g. "every 3rd Tuesday," a
  cron-like syntax) — PRD's own examples (rent, EMI, gym, subscriptions,
  insurance, utilities, SIP) are all naturally weekly, monthly, or
  yearly; a fixed 3-option frequency enum covers every PRD example
  without over-building a general scheduling system nothing has asked
  for.
- **Multiple income sources / non-salary recurring income** — PRD §7's
  examples are all recurring *expenses*; recurring income is not
  mentioned here (income entries remain manual via Phase 2's
  `type: "income"` transactions).

## Routes / API surface
Server Actions in `app/actions/recurring.ts`, following
`app/actions/transactions.ts`'s pattern:
- `Server Action createRecurringExpense(prevState, formData)` —
  authenticated.
- `Server Action updateRecurringExpense(id, prevState, formData)` —
  authenticated.
- `Server Action deleteRecurringExpense(id)` — authenticated.
- `Server Action toggleRecurringExpenseActive(id, active)` —
  authenticated; flips `active` without touching other fields.

No REST route handlers — reads happen in Server Components via
`lib/supabase/server.ts`, matching Phase 2.

## Database changes
New migration `supabase/migrations/0004_recurring_expenses.sql`:
- **Table `recurring_expenses`**
  - `id uuid primary key default gen_random_uuid()`
  - `user_id uuid not null references auth.users(id) on delete cascade`
  - `name text not null`
  - `amount integer not null check (amount > 0)` — paise, per the
    money-as-integer rule.
  - `frequency text not null check (frequency in ('weekly', 'monthly',
    'yearly'))`.
  - `next_due_date date not null` — the next expected occurrence;
    advanced by application code (see `lib/recurring/upcoming.ts`
    below) whenever a cycle elapses, not by a DB trigger, keeping the
    date-rollover logic in one testable place.
  - `category_id smallint references public.categories(id) on delete
    set null` — nullable, reusing Phase 2's categories table.
  - `payment_method text` — nullable free text, same convention as
    `transactions.payment_method`.
  - `account_info text` — nullable free text.
  - `active boolean not null default true`.
  - `created_at timestamptz not null default now()`.
  - `updated_at timestamptz not null default now()`.
  - Index: `create index on recurring_expenses (user_id, active,
    next_due_date)` — supports the upcoming-spend query's
    filter/sort.
- **RLS**: enabled on `recurring_expenses`, with `select`/`insert`/
  `update`/`delete` policies scoped to `user_id = auth.uid()`,
  identical in shape to `0003_transactions.sql`'s policies.

## Pages / components
- **Create:**
  - `app/recurring/page.tsx` — list of the user's recurring expenses
    with their next occurrence, plus the running "Upcoming Spend"
    total; add/edit/delete/toggle entry points.
  - `app/recurring/new/page.tsx` — add form.
  - `app/recurring/[id]/edit/page.tsx` — edit form, pre-filled.
  - `app/recurring/RecurringExpenseForm.tsx` — shared create/edit
    client form (action-as-a-prop, mirroring
    `app/transactions/TransactionForm.tsx`): name, amount, frequency
    select, next due date, category select, payment method, account/
    card, active checkbox (edit only — a newly created expense always
    starts active).
  - `app/recurring/RecurringExpenseList.tsx` — list item component
    (name, amount, next due date, category, active/inactive badge,
    toggle + delete controls).
  - `app/actions/recurring.ts` — the four Server Actions above.
  - `lib/recurring/validation.ts` — field validators (name required
    with a length cap, amount → paise via the same pattern as
    `parseAmountToPaise`, frequency enum, next due date required and
    not absurdly far in the past, category optional), aggregated the
    same way as `lib/transactions/validation.ts`.
  - `lib/recurring/upcoming.ts` — pure functions: `advanceDueDate(date,
    frequency, referenceToday)` (rolls a date forward by whole cycles
    until it's `>= referenceToday`, handling month-length edge cases —
    e.g. a monthly expense due the 31st rolls to the last day of a
    shorter month) and `getUpcomingSpend(recurringExpenses,
    referenceToday)` (maps each active expense to its rolled-forward
    next occurrence + amount, and returns the total). No Supabase
    dependency — takes plain data in, returns plain data out, so it's
    trivially unit-testable and directly reusable by Phase 4.
- **Modify:**
  - `app/home/page.tsx` — add a link to `/recurring`, alongside the
    existing `/transactions` and `/profile` links (Phase 4 will later
    replace this page's content with the full dashboard; this phase
    only adds the link).

## Files to change
- `app/home/page.tsx`

## Files to create
- `supabase/migrations/0004_recurring_expenses.sql`
- `app/recurring/page.tsx`
- `app/recurring/new/page.tsx`
- `app/recurring/[id]/edit/page.tsx`
- `app/recurring/RecurringExpenseForm.tsx`
- `app/recurring/RecurringExpenseList.tsx`
- `app/actions/recurring.ts`
- `lib/recurring/validation.ts`
- `lib/recurring/upcoming.ts`
- Corresponding test files (`lib/recurring/validation.test.ts`,
  `lib/recurring/upcoming.test.ts` — covering the date-rollover edge
  cases explicitly, e.g. Jan 31 monthly → Feb 28/29 → Mar 31 — and
  `app/actions/recurring.test.ts`, `app/recurring/page.test.tsx`).

## New dependencies
No new dependencies. Date-rollover arithmetic (`advanceDueDate`) is
implemented with plain `Date` math, the same way `lib/transactions/validation.ts`'s
`validateTransactionDate` already handles date bounds without a
library — the logic here (add N months/weeks/years, clamp to the
target month's actual last day) is a well-contained, testable amount of
code that doesn't justify pulling in a date library for one phase.

## Rules for implementation
- All Supabase queries are scoped to the authenticated user
  (Row-Level Security enforced, not just assumed) — verify the RLS
  policies on `recurring_expenses` actually block cross-user access.
- Store money as integers in the smallest currency unit (paise) —
  applies to `recurring_expenses.amount`.
- All date-rollover and total calculations are plain application code
  in `lib/recurring/upcoming.ts` — never delegated to a database
  function or (in later phases) an LLM.
- Mobile-first: the list, add, and edit screens must all be verified
  at a ~375px viewport.
- No secrets or API keys committed — env vars only; this phase adds no
  new secrets.
- Handle Supabase failures gracefully on every new Server Action
  (insert/update/delete/toggle error, stale/foreign id, expired
  session) with a user-visible message — never a hard crash, matching
  `app/actions/transactions.ts`'s try/catch + `unstable_rethrow`
  pattern.

## Definition of done
- [ ] A signed-in user can create a recurring expense with name,
      amount, frequency, next due date, category, payment method, and
      account/card, and sees it in the `/recurring` list.
- [ ] Editing a recurring expense (including its category) persists
      the change.
- [ ] Toggling a recurring expense inactive removes it from the
      Upcoming Spend total without deleting it; toggling it back active
      restores it.
- [ ] Deleting a recurring expense removes it from the list.
- [ ] `advanceDueDate`/`getUpcomingSpend` unit tests cover: a due date
      today (counts as upcoming), a due date already in the past
      (rolls forward the correct number of cycles for weekly/monthly/
      yearly), and month-length edge cases (e.g. Jan 31 monthly rolling
      through February).
- [ ] The `/recurring` page's total matches the sum of each listed
      active expense's next-occurrence amount.
- [ ] Submitting the form with a missing name, invalid amount, or
      missing due date shows a clear field-level error instead of
      crashing.
- [ ] RLS is verified directly: querying `recurring_expenses` as one
      user cannot return another user's rows, and updating/deleting
      another user's row fails.
- [ ] All new screens are checked at a ~375px viewport and remain
      usable.
- [ ] `npx tsc --noEmit`, `npx eslint .`, and `npx vitest run` all
      pass, including the date-rollover edge-case tests above.
- [ ] `npm run build` succeeds.
- [ ] `git status` shows no `.env.local` or other secret file staged.
- [ ] `/code-review` (medium effort, per PLAN.md §6) run on this
      phase's portion of the diff, with findings applied or
      consciously accepted.
