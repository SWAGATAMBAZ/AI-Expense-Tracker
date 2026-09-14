# Spec: Edge Case Hardening (Phase 10)

## Overview

PLAN.md's Phase 10 is "work through PRD §19's edge-case checklist explicitly
as test cases, patch gaps found." This spec is the result of that pass: every
item in §19 is classified below as either **already correct** (verified,
covered by a new or existing test, no code change), **N/A / deferred**
(depends on the deferred SMS ingestion or is out of this app's architecture
entirely), or **a real gap** (a concrete, bounded fix). Five real gaps were
found; all five are small, and none require a database migration.

PRD sections implemented: §19 in full (see the checklist below for the
section-by-section mapping), plus the underlying sections each gap actually
belongs to (§9/§10 savings math, §7 recurring matching, §16 transaction
types, §17 duplicate detection).

## The full PRD §19 checklist, classified

### Transaction-related
| Item | Status |
|---|---|
| Duplicate SMS | N/A — depends on deferred Phase 7 (SMS ingestion) |
| **Duplicate manual entry** | **Gap #1** — `lib/ai/duplicate.ts`'s check only ever runs for AI-chat-created transactions; the manual form has no duplicate check at all |
| Failed transactions | N/A — this app has no live bank-transaction-status feed to ever see a "failed" state |
| Pending transactions | N/A — same reason |
| Reversed transactions | Already correct — modeled as a `refund` transaction; nets against spend like any refund |
| Refunds | Already correct — `computeTotalSpend` nets refunds (implemented and documented earlier this project) |
| Partial refunds | Already correct — netting doesn't require the refund to equal the original expense; a smaller refund nets a smaller amount, verified with a new test |
| Transfers between own accounts | Already correct — `type: "transfer"` excluded from spend |
| Cash expenses | Already correct — `payment_method` is free text, "Cash" needs no special handling |
| Unknown merchants | Already correct — `merchant` nullable everywhere |
| Unknown categories | Already correct — `category_id` nullable, "Uncategorized" fallback exists |
| Missing transaction amount | Already correct — required client+server-side on the manual form; triggers a clarify on chat |
| Missing merchant | Already correct — same as "unknown merchants" |
| Multiple transactions in one message | N/A — explicitly out of scope per the Phase 5/6 spec ("one message → one intent"); revisit alongside Phase 7 |
| Different date formats | Already correct — manual form uses a native date picker (always ISO); chat prompt already resolves relative/absolute phrasing to ISO using today's date |
| **Different currencies** | **Gap #5** — nothing currently detects when a chat message implies a different currency than the account's configured one; the amount would be silently recorded as the account currency |

### Recurring expenses
| Item | Status |
|---|---|
| Recurring expense not processed on expected date | Already correct — Phase 9's window tolerates early/late payment; a genuinely overdue-by-cycles bill safely stays "upcoming" (no false match) rather than guessing |
| Amount changes | Already correct — the recurring expense's amount is editable (manual form + AI chat's `edit_recurring_expense`); future matching uses whatever amount is currently stored |
| Recurring expense cancelled | Already correct — the existing `active` toggle |
| **Recurring expense skipped for a month** | **Gap #2** — no way to advance past one occurrence without either deactivating (loses the schedule) or waiting for a real transaction to match it |
| **Actual transaction amount differs from expected amount** | **Gap #3** — Phase 9 requires an exact amount match; a bill that comes in slightly different (rate change, rounding) never auto-settles even though everything else about it is an obvious match |
| Actual transaction arrives earlier/later than expected | Already correct — Phase 9's date window |
| Same recurring expense being matched to multiple transactions | Already correct by construction — `findMatchingRecurringExpense` is called once per new transaction against the recurring expense's *current* occurrence; a second transaction against an already-advanced due date is evaluated against the *next* occurrence, not double-matched against the same one |

### AI
| Item | Status |
|---|---|
| LLM fails | Already correct — `callOpenRouter`'s primary/fallback + the "AI assistant unavailable" message |
| LLM returns invalid structured data | Already correct — `JSON.parse`/`parseAiIntent` failure → "didn't understand, rephrase" |
| LLM is uncertain | Already correct — the clarify loop |
| LLM incorrectly categorizes a transaction | Already correct — every AI-created transaction is a normal, fully editable row |
| User gives ambiguous natural-language input | Already correct — `unknown`/`clarify` handling |
| User enters an expense with missing information | Already correct — the missing-amount clarify path |
| User changes/corrects an AI-generated transaction | Already correct — no distinction between AI- and manually-created rows for editing |

### Financial calculations
| Item | Status |
|---|---|
| Spending greater than salary | Already correct — `computeSavingsForecast` floors at 0, flags `isOverBudget` |
| No salary configured | Already correct — returns `null`, dashboard shows a setup prompt |
| No transactions yet | Already correct — empty-state copy already tested |
| No upcoming expenses | Already correct — `getUpcomingSpend` naturally totals 0 |
| User changes salary | Already correct — read fresh from `profiles` on every dashboard load, nothing to invalidate |
| **User has multiple income sources** | **Gap #4** — `computeSavingsForecast` only ever uses the fixed `profiles.monthly_salary`; an `income`-type transaction (a bonus, freelance payment — a type PRD §16 explicitly defines) currently affects *nothing*: it's excluded from spend (correct) but never added to income either, so it has zero effect on the savings forecast |
| Month changes | Already correct — `resolveDateRange`/the date-range filter |
| Previous month data must remain unchanged | Already correct by construction — every dashboard query is scoped to the selected date range; editing a transaction doesn't touch any other period's query results |

## In scope (the 5 gaps)

1. **Manual-entry duplicate warning.** Relocate `lib/ai/duplicate.ts` →
   `lib/transactions/duplicate.ts` (it's a plain deterministic check, not
   AI-specific — it's about to be used from a non-AI call site). Wire it
   into `createTransaction`: on a duplicate, **insert anyway and warn**
   (not block) — manual entry is deliberate enough that blocking would
   create more friction than value, and a legitimate repeat purchase
   (coffee twice in a day, same price) is common. Surfaced via a redirect
   query param (`/transactions?duplicateWarning=1`) rendered as a
   dismissible banner on the transactions list. AI chat's existing
   skip-and-inform behavior for duplicates is unchanged (that was a
   deliberate Phase 5/6 decision for a higher-accidental-repeat context).
2. **"Skip this cycle" for recurring expenses.** A new button next to
   Edit/Deactivate on `/recurring`'s list, and the equivalent via AI chat's
   `edit_recurring_expense` (a `skip: true` field alongside the existing
   `changes`). Advances `next_due_date` to the next occurrence using the
   existing `advanceDueDate`, with no transaction involved.
3. **Small amount tolerance in recurring matching.** `findMatchingRecurringExpense`'s
   amount check becomes "within `max(₹10, 1%)` of the recurring expense's
   amount" instead of requiring an exact match — enough to absorb a minor
   rate change or rounding difference without opening the door to
   unrelated amounts matching.
4. **Income transactions count toward the savings forecast.** New
   `computeTotalIncome` in `lib/dashboard/aggregate.ts` (mirrors
   `computeTotalSpend`'s shape, filters `type: "income"`). `app/home/page.tsx`
   passes `profile.monthly_salary + computeTotalIncome(currentMonthTx)` as
   the income figure — `computeSavingsForecast`'s own signature/logic is
   untouched.
5. **AI chat asks instead of assuming on a currency mismatch.** The user's
   account currency is added to the prompt context
   (`lib/ai/prompt.ts`); a new rule tells the model to use `clarify` when
   the message implies a different currency than the account's, instead of
   silently recording the number as-is. Deterministic code makes no
   currency judgment itself — this is natural-language understanding, PRD
   §20's LLM responsibility.

## Explicitly out of scope

- Everything marked "N/A" or "Already correct" in the table above — no
  code changes for those; several get a new test as evidence, not a fix.
- Real currency conversion (exchange rates, storing original + converted
  amounts) — gap #5 only asks instead of guessing; it never converts.
- Any further widening of recurring-expense matching beyond gap #3's fixed
  small tolerance (e.g., fuzzy merchant matching, multi-cycle-overdue
  auto-resolution) — still explicitly deferred, as in the Phase 9 spec.
- Multiple transactions in one message — tied to deferred Phase 7.

## Routes / API surface

- `Server Action skipRecurringExpenseCycle(id)` — `app/actions/recurring.ts` —
  authenticated, user-scoped. Advances one recurring expense's
  `next_due_date` by exactly one cycle.
- No other new routes. `createTransaction`'s existing signature is
  unchanged; it just redirects with an added query param on the warning
  path. `interpretMessage`/`handleAddTransaction`/`handleEditRecurringExpense`
  in `app/actions/ai.ts` are modified, not newly added.

## Database changes

None. All five gaps are fixed with existing columns (`next_due_date`,
`amount`, transaction `type`).

## Pages / components

- **Modify:** `app/transactions/page.tsx` — read a `duplicateWarning`
  search param, render a dismissible info banner above the list when
  present.
- **Modify:** `app/recurring/RecurringExpenseList.tsx` — add a "Skip this
  cycle" button per active row (mirrors `ToggleActiveButton`'s pattern:
  small client component, `useTransition`, calls the new action, then
  `router.refresh()`).
- **Create:** `app/recurring/SkipCycleButton.tsx`.

## Files to change

- `app/actions/transactions.ts` — duplicate check + warning redirect in
  `createTransaction`.
- `app/actions/recurring.ts` — new `skipRecurringExpenseCycle`.
- `app/actions/ai.ts` — `handleAddTransaction` reads the account currency
  into the prompt context (via `interpretMessage`); `handleEditRecurringExpense`
  handles a `skip: true` intent field.
- `lib/ai/intent.ts` — `EditRecurringExpenseIntent`/`RecurringExpenseChanges`
  gains an optional `skip?: boolean`.
- `lib/ai/prompt.ts` — `PromptContext` gains `currency`; new rule text.
- `lib/recurring/matching.ts` — amount check becomes tolerance-based.
- `lib/recurring/upcoming.ts` — new small `skipToNextOccurrence(nextDueDate, frequency)`
  helper, built on the existing `advanceDueDate`.
- `lib/dashboard/aggregate.ts` — new `computeTotalIncome`.
- `app/home/page.tsx` — combine salary + period income before calling
  `computeSavingsForecast`.
- `app/transactions/page.tsx`, `app/recurring/RecurringExpenseList.tsx`.

## Files to create

- `lib/transactions/duplicate.ts` (+test) — relocated from `lib/ai/duplicate.ts`.
- `app/recurring/SkipCycleButton.tsx`.
- Tests for every change above (see Definition of done).

## Files to delete

- `lib/ai/duplicate.ts` and `lib/ai/duplicate.test.ts` (superseded by the
  relocated `lib/transactions/duplicate.ts`; `app/actions/ai.ts`'s import
  updated accordingly).

## New dependencies

None.

## Rules for implementation

- The manual duplicate warning must never block the insert — PRD's intent
  is to help the user notice, not to fight a false positive.
- `skipRecurringExpenseCycle` is scoped to the authenticated user
  (`.eq("user_id", userId)`) like every other mutation in this codebase.
- The amount tolerance in gap #3 stays small and fixed (`max(₹10, 1%)`) —
  this is a hardening tweak, not a re-opening of Phase 9's "never guess"
  rule for genuinely different amounts.
- Gap #4's income figure is still plain application arithmetic, never
  delegated to the LLM (PRD §20).
- Gap #5 is prompt/LLM-side judgment only — no deterministic currency
  detection code is added; if the model doesn't flag a mismatch, nothing
  else in this phase catches it either (an acceptable, documented
  limitation of relying on NL understanding for this).
- Every new/changed function gets a unit test; no behavior change ships
  without one, matching this project's existing convention.

## Definition of done

- [ ] `npm run typecheck`, `npm run lint`, `npm test` pass, including:
  - `lib/transactions/duplicate.test.ts` (moved, unchanged assertions).
  - New `createTransaction` tests: duplicate found → still inserts,
    redirects with `?duplicateWarning=1`; no duplicate → redirects without it.
  - New `skipRecurringExpenseCycle` tests (mirrors the existing
    `toggleRecurringExpenseActive` test shape).
  - `lib/recurring/matching.test.ts` extended: amount just inside/outside
    the new tolerance.
  - `lib/dashboard/aggregate.test.ts` extended: `computeTotalIncome`
    sums only `income`-type transactions; a savings-forecast test
    combining salary + an income transaction.
  - `lib/ai/prompt.test.ts`/`app/actions/ai.test.ts` extended: the prompt
    includes the account currency; a currency-mismatch intent test isn't
    practical to assert against a real LLM in a unit test, so this is
    verified manually instead (see below).
- [ ] Manual verification against the seeded test data:
  - Add the same expense twice manually → both save, a dismissible
    warning banner appears on `/transactions`.
  - "Skip this cycle" on a recurring expense → its next due date advances
    exactly one cycle, `/home`'s Upcoming Spend drops accordingly, no
    transaction was created.
  - A transaction ±small amount from a recurring expense (e.g. Netflix
    ₹649 → paid ₹660) still auto-settles it; a transaction with a wildly
    different amount still does not.
  - Add an `income`-type transaction via chat or the manual form →
    `/home`'s Total Savings increases by that amount.
  - Ask the AI to add an expense in an obviously different currency
    (e.g. "$20 for coffee" on an INR account) → it asks for clarification
    instead of recording ₹20.
- [ ] `/code-review high` on the diff (financial-math and matching changes
  again, per PLAN.md §6) and findings addressed.
