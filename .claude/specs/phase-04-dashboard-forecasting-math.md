# Spec: Dashboard & Forecasting Math (Phase 04)

## Overview
This phase turns the raw data Phases 2 and 3 collect (actual
transactions, recurring expenses) into the app's primary screen: a
dashboard combining a date-filtered spending summary, a category
breakdown, upcoming spend, a savings forecast, and a payment-method
mix. It implements PRD.md §8 (Dashboard, date filters, total spend,
spending by category, upcoming spend), §9 (Savings Forecast), §10
(Avoid Double Counting in Savings), and §11 (Payment Method Mix). Per
PLAN.md §3/§4, this is the last MVP phase before the LLM pipeline
begins (Phase 5), and per PRD §8 ("The dashboard is the primary
screen"), it turns `app/home/page.tsx` — currently a placeholder — into
the app's actual landing page. This spec is being written and
implemented in the same branch/session as Phase 3
(`.claude/specs/phase-03-recurring-upcoming-expenses.md`) at the user's
request, but is kept as its own spec/commit-sized unit so each phase's
scope and Definition of Done stay independently verifiable, per
PLAN.md §0's stated method.

## Depends on
- **Phase 1 (Auth & onboarding)**, per PLAN.md §3's "Depends on"
  column — provides `profiles.monthly_salary` and `profiles.currency`,
  used by the Savings Forecast and all money formatting.
- **Phase 2 (Core transaction data + manual CRUD)** — provides the
  `transactions` table this phase aggregates (Total Spend, Spending by
  Category, Payment Method Mix all read from it) and the `categories`
  table (for the category breakdown's labels).
- **Phase 3 (Recurring / upcoming expenses)** — provides
  `lib/recurring/upcoming.ts`'s `getUpcomingSpend` function, reused
  directly for this phase's Upcoming Spend card and Savings Forecast
  calculation, and the `recurring_expenses` table it reads from.

## In scope
- **Date range filter** — PRD §8: Today / This Week / This Month /
  Last Month / Previous Months / Custom Date Range, defaulting to
  **Current Month**. "Previous Months" is interpreted as a picker over
  prior calendar months (distinct from the single fixed "Last Month"
  option and from an arbitrary "Custom Date Range"). The selected
  filter is carried in the URL as search params (e.g. `?range=month` or
  `?range=custom&from=...&to=...`) rather than client-only state, so
  the dashboard's state is a plain server-rendered read of the URL —
  shareable/bookmarkable/back-button-friendly, and needs no client
  state library.
- **Total Spend card** — sum of `type = 'expense'` transactions'
  `amount` within the selected period — PRD §8. Only `expense`-type
  transactions count as spend; `income`/`refund`/`transfer` are
  excluded, per PRD §16's "not every bank transaction is an expense."
- **Spending by Category** — a chart (Recharts) plus a list, grouping
  `type = 'expense'` transactions in the selected period by category —
  PRD §8.
- **Upcoming Spend card** — reuses Phase 3's `getUpcomingSpend`
  derivation. This card is **not** filtered by the selected date range
  — PRD §8's own example presents it as a simple forward-looking list
  ("expenses expected in the future"), not tied to a historical period
  selector, so it always shows every active recurring expense's next
  occurrence and a running total, regardless of which historical range
  is selected for Total Spend/category charts.
- **Savings Forecast** — `Income − Confirmed Spend − Remaining Upcoming
  Spend`, floored at ₹0 (never shown negative), per PRD §9/§10. Uses
  the **current calendar month** specifically (the salary is a monthly
  figure — computing "savings forecast" against an arbitrary selected
  historical range, like "Last Month," wouldn't be a meaningful
  number), independent of whichever date range is selected for the
  Total Spend/category sections. If spending already exceeds income,
  an optional warning/insight may be shown (PRD §9 explicitly allows,
  doesn't require, this) rather than a negative number.
- **Payment Method Mix** — a pie/donut chart (Recharts) of `type =
  'expense'` transaction amounts grouped by `payment_method` within the
  selected period, per PRD §11. A missing/blank `payment_method` is
  grouped under "Unspecified."
- **`app/home/page.tsx` becomes the dashboard** — replacing its current
  placeholder content.

## Explicitly out of scope
- **True double-counting avoidance via transaction matching** — PRD
  §10's full "processed transaction replaces upcoming amount" model
  requires Phase 9's matching engine, which doesn't exist yet. This
  phase's Savings Forecast subtracts *both* confirmed spend and
  Phase 3's date-derived upcoming amount as independent numbers, which
  can under-count savings if a user has manually logged a transaction
  for a bill that's also still counted as upcoming (its recurring
  expense's due date hasn't rolled over yet). This is the same
  documented simplification Phase 3's spec calls out, carried through
  to its consumer here; it stops being a simplification once Phase 9
  ships.
- **Multiple income sources** — PRD §19 lists "user has multiple income
  sources" as an edge case, but `profiles` (Phase 1) has a single
  `monthly_salary` field. Changing that schema is a Phase-1-shaped
  decision, not this phase's — Savings Forecast uses the single stored
  salary value as-is. Flagged here as a known gap rather than silently
  ignored.
- **AI/LLM-driven anything** — Phases 5–8. This phase computes
  everything from data that's already in the database via Phases 2/3;
  it never calls an LLM.
- **Budget recommendations, anomaly detection, multi-account
  aggregation, custom category colors** — PRD §23's P2 list, explicitly
  deferred.
- **Editing transactions/recurring expenses from the dashboard itself**
  — those flows already exist at `/transactions` and `/recurring`
  (Phases 2/3); the dashboard links out to them rather than
  duplicating their forms.

## Routes / API surface
No new Server Actions — this phase is entirely reads, aggregated in
plain TypeScript. `app/home/page.tsx` becomes an `async` Server
Component that reads `searchParams` (per Next.js's `searchParams` prop
for data-loading use cases) to resolve the selected date range, then
queries Supabase and runs the aggregation functions below.

## Database changes
No database changes. The existing index from Phase 2
(`transactions (user_id, transaction_date desc)`) already supports
filtering a single user's transactions by date range; table sizes at
MVP scale don't justify an additional index on `type` or
`payment_method` yet.

## Pages / components
- **Create:**
  - `lib/dashboard/dateRanges.ts` — pure, unit-tested date-range
    resolution: `resolveDateRange(filter, params, referenceToday):
    { start: string; end: string; label: string }` for each of the six
    PRD §8 filter options, given an injectable "today" for deterministic
    tests.
  - `lib/dashboard/aggregate.ts` — pure, unit-tested functions taking
    plain transaction/recurring-expense arrays (no Supabase dependency,
    so no DB needed to test the money math): `computeTotalSpend`,
    `computeCategoryBreakdown`, `computePaymentMethodMix`,
    `computeSavingsForecast(income, confirmedSpend, upcomingSpend)`
    (applies the §9/§10 formula and the ₹0 floor). All financial
    calculations live here, in plain application code, never in the
    database or an LLM.
  - `app/home/DateRangeFilter.tsx` — client component rendering the six
    filter options (and a custom-range date-picker pair), navigating
    via `router.push`/`<Link>` to update the `range`/`from`/`to` search
    params.
  - `app/home/TotalSpendCard.tsx`, `CategoryBreakdownChart.tsx`,
    `UpcomingSpendCard.tsx`, `SavingsForecastCard.tsx`,
    `PaymentMethodChart.tsx` — presentational components, each taking
    already-computed plain data as props (no data fetching inside
    them), reusing `lib/transactions/format.ts`'s `formatAmount` for
    all money display (the shared helper Phase 2 factored out
    specifically for this reuse).
- **Modify:**
  - `app/home/page.tsx` — rewritten as the dashboard: resolves the date
    range from `searchParams`, fetches the period's transactions and
    the user's active recurring expenses + profile, runs the
    `lib/dashboard/aggregate.ts` functions, and renders the cards/
    charts above plus the existing links to `/transactions`,
    `/recurring`, and `/profile`.

## Files to change
- `app/home/page.tsx`

## Files to create
- `lib/dashboard/dateRanges.ts` (+ `.test.ts`)
- `lib/dashboard/aggregate.ts` (+ `.test.ts`)
- `app/home/DateRangeFilter.tsx`
- `app/home/TotalSpendCard.tsx`
- `app/home/CategoryBreakdownChart.tsx`
- `app/home/UpcomingSpendCard.tsx`
- `app/home/SavingsForecastCard.tsx`
- `app/home/PaymentMethodChart.tsx`
- `app/home/page.test.tsx` (updated for the new dashboard content,
  replacing the Phase-1/2-era placeholder assertions)

## New dependencies
**`recharts`** — already the planned charting library per PLAN.md §1
("Charts | Recharts | Lightweight, free, covers category/payment-method
breakdowns and trends"), just not yet installed; this is the first
phase that actually needs a chart. No lighter alternative is being
introduced since this was already the chosen tool, not a new decision.

## Rules for implementation
- All financial calculations (totals, category grouping, payment-method
  grouping, savings forecast) are plain application code in
  `lib/dashboard/aggregate.ts` — never delegated to the LLM (no LLM is
  involved in this phase at all) and never computed ad hoc inline in a
  component.
- All Supabase queries are scoped to the authenticated user (RLS
  enforced, not just assumed).
- Store/handle money as integers in the smallest currency unit
  throughout the aggregation pipeline; only convert to a decimal at the
  final display step via `lib/transactions/format.ts`.
- Mobile-first: the dashboard, its filter control, and every chart must
  be verified at a ~375px viewport — charts in particular need to
  reflow rather than overflow at that width.
- Handle the "no salary configured," "no transactions yet," and "no
  upcoming expenses" edge cases (PRD §19, Financial calculations)
  gracefully — e.g. an unset salary shows a prompt to set it in
  `/profile` rather than a broken forecast; empty transaction data
  shows a clear empty state, not a crashing chart.
- No secrets or API keys committed — env vars only; this phase adds no
  new secrets.
- Recharts' `ResponsiveContainer` relies on `ResizeObserver`, which
  jsdom does not implement — add a minimal `ResizeObserver` mock to
  `vitest.setup.ts` (or give charts a fixed test-only size) so chart
  component tests don't fail purely on this jsdom gap.

## Definition of done
- [ ] The dashboard defaults to the current month on first load with no
      `range` param set.
- [ ] Switching between Today/This Week/This Month/Last Month/Previous
      Months/Custom Range updates the Total Spend and category
      breakdown and is reflected in the URL (reloading the URL directly
      reproduces the same view).
- [ ] Total Spend for the selected period matches a manual sum of that
      period's expense-type transactions.
- [ ] The category breakdown chart's segments match the list's numbers,
      and both exclude non-expense transactions.
- [ ] Upcoming Spend shows every active recurring expense's next
      occurrence and total, unaffected by the selected date range.
- [ ] Savings Forecast equals `salary − this month's confirmed spend −
      upcoming spend`, is never shown negative (floors at ₹0 when
      spending exceeds income), and updates when the salary is changed
      on `/profile`.
- [ ] No salary configured shows a clear prompt instead of a broken or
      misleading forecast number.
- [ ] Payment Method Mix chart renders and groups missing payment
      methods under "Unspecified."
- [ ] Changing the current month's data does not alter a previously
      viewed prior month's numbers (PRD §19: "previous month data must
      remain unchanged") — verified by comparing a prior month's totals
      before and after adding a new current-month transaction.
- [ ] `lib/dashboard/dateRanges.test.ts` and
      `lib/dashboard/aggregate.test.ts` cover the PRD §19 "Financial
      calculations" edge cases: spending greater than salary, no salary
      configured, no transactions yet, no upcoming expenses, and month
      boundaries (e.g. a custom range spanning exactly one calendar
      month matches the "This Month" preset's numbers).
- [ ] The dashboard and every chart are checked at a ~375px viewport
      with no horizontal overflow.
- [ ] `npx tsc --noEmit`, `npx eslint .`, and `npx vitest run` all pass.
- [ ] `npm run build` succeeds.
- [ ] `git status` shows no `.env.local` or other secret file staged.
- [ ] `/code-review` (medium effort, per PLAN.md §6) run on this
      phase's portion of the diff, with findings applied or
      consciously accepted.
