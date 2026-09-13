# Spec: Core Transaction Data + Manual CRUD (Phase 02)

## Overview
This phase introduces the app's first spending data: a `transactions`
table plus a full manual create/view/edit/delete UI for it. It
implements PRD.md §6 ("Transaction Categories" — the category list,
its extensibility, and the ability to correct a miscategorized
transaction) and §12 ("Transactions" — the fields every transaction
shows, and the view/edit/categorize/delete/correct actions a user can
take). Per PLAN.md §3, this is the first phase after auth/onboarding
and sits directly ahead of Phases 3–7, all of which read or write this
same `transactions` table (recurring-expense matching, the dashboard,
and the LLM pipeline). Getting the schema and manual-entry path right
here means every later phase has real data and a proven UI pattern to
build on instead of guessing at both at once.

## Depends on
**Phase 1 (Auth & onboarding)**, per PLAN.md §3's "Depends on" column.
It provides: the `profiles` table and its `id = auth.uid()` RLS
pattern to copy for the new table, the authenticated Supabase
server/browser clients (`lib/supabase/server.ts`,
`lib/supabase/client.ts`), the route-protection middleware
(`middleware.ts` + `lib/auth/routing.ts`) that already treats any path
outside `/`, `/login`, `/register` as protected, the profile's
`currency` field (used to format displayed amounts), and the
validate-in-a-plain-TS-module pattern (`lib/profile/validation.ts`)
this phase reuses for transaction field validation.

## In scope
- **`transactions` table + Row-Level Security** — the first spending
  data model (PRD §12).
- **Category list** — a fixed, extensible set of categories seeded
  from PRD §6's list (Food & Dining, Groceries, Shopping,
  Transportation, Fuel, Travel, Entertainment, Bills & Utilities,
  Rent, EMI / Loans, Healthcare, Education, Fitness & Gym,
  Subscriptions, Insurance, Personal Care, Investments, Household,
  Gifts, Taxes, Fees & Charges, Other) — PRD §6.
- **Manual add** — a form to create a transaction with merchant,
  amount, category, date, payment method, account/card (optional),
  and transaction type — PRD §12 "Each transaction should show" +
  "Users should be able to... View."
- **Transaction list** — a mobile-first list of the signed-in user's
  transactions (most recent first) showing merchant, amount, category,
  date, payment method, and transaction type — PRD §12.
- **View a single transaction's full detail** — PRD §12 "View."
- **Edit a transaction** — change any field, including correcting the
  category — PRD §12 "Edit," "Categorize," "Correct transaction
  information."
- **Delete a transaction** — with a confirmation step — PRD §12
  "Delete."
- **Transaction type field** — expense / income / refund / transfer,
  manually selected on this phase's form (PRD §16 defines these types;
  automatic classification from LLM/SMS input is Phase 5/7/9 — this
  phase only needs the column and a manual selector to satisfy PRD
  §12's "Transaction type" display requirement).

## Explicitly out of scope
- **Recurring expenses** (their own table/CRUD, "upcoming spend"
  derivation) — Phase 3 per PLAN.md §3/§4. This phase's `transactions`
  table has no link to recurring expenses yet; that FK/matching logic
  arrives in Phases 3 and 9.
- **Dashboard, charts, totals, savings forecast, payment-method mix,
  date-range filters** — Phase 4. This phase only lists transactions
  chronologically; it computes no aggregates.
- **LLM extraction pipeline, SMS/message ingestion, AI chat, voice
  entry** — Phases 5–8. Every transaction in this phase is created by
  the user typing into a form; nothing here calls an LLM.
- **Duplicate detection** — Phase 5 (PRD §17). Manual entry in this
  phase performs no dedupe checks; a user can create two identical
  transactions if they choose to.
- **Automatic transaction-type classification / recurring-expense
  matching engine** — Phase 9 (PRD §7 matching, §16). This phase's
  type field is a plain manual dropdown, not an inference.
- **Multi-currency conversion** — PRD §19 lists "different currencies"
  as an edge case, but this phase stores whatever currency the user's
  profile is set to and does no conversion; true multi-currency
  handling isn't scheduled in PLAN.md and stays out of scope until it
  is.
- **Custom/user-defined categories UI** — PRD §23 P2 list ("custom
  categories UI") is explicitly deferred; this phase's categories are
  a fixed seeded list, only "extensible" at the schema level (an
  ordinary table row, not hardcoded in application code).

## Routes / API surface
Implemented as Next.js Server Actions, consistent with Phase 1
(`app/actions/*.ts`, `"use server"`, Supabase access via
`lib/supabase/server.ts`):

- `Server Action createTransaction(prevState, formData)` — validates
  and inserts a new row into `transactions` for the signed-in user —
  authenticated.
- `Server Action updateTransaction(id, prevState, formData)` —
  validates and updates an existing transaction the caller owns —
  authenticated.
- `Server Action deleteTransaction(id)` — deletes a transaction the
  caller owns — authenticated.

No REST route handlers are needed; all reads happen directly in Server
Components via the Supabase server client (same pattern as
`app/home/page.tsx` and `app/profile/page.tsx`).

## Database changes
New migration `supabase/migrations/0003_transactions.sql`:

- **Table `categories`**
  - `id smallint primary key generated always as identity`
  - `name text not null unique`
  - `sort_order smallint not null`
  - Seeded with the 22 PRD §6 categories via `insert` statements in the
    same migration, ordered as listed in the PRD (`Other` last).
  - No RLS needed — this is shared reference data, not per-user data;
    grant `select` to `authenticated` (and `anon` is irrelevant since
    every page reading it sits behind the auth middleware).
- **Table `transactions`**
  - `id uuid primary key default gen_random_uuid()`
  - `user_id uuid not null references auth.users(id) on delete cascade`
  - `merchant text` — nullable (PRD §19 "unknown merchants," "missing
    merchant").
  - `amount integer not null` — stored in the smallest currency unit
    (e.g. paise), never a float, per the money-as-integer rule; `check
    (amount > 0)` (sign is carried by `type`, not the amount value).
  - `currency text not null default 'INR'` — copied from the user's
    profile currency at creation time so historical transactions don't
    silently change if the user later edits their profile currency.
  - `category_id smallint references public.categories(id)` —
    nullable (PRD §19 "unknown categories"); `on delete set null` so
    removing a category later doesn't destroy transaction history.
  - `transaction_date date not null`.
  - `payment_method text` — nullable free text for MVP (e.g. "Cash",
    "UPI", "Credit Card"); a fixed enum isn't in PRD §12's requirements
    and would block entries like "Cash" vs. a specific card without
    real payment-method data yet.
  - `account_info text` — nullable free text (e.g. "HDFC XXXX1234"),
    per PRD §12 "Account/card where applicable."
  - `type text not null check (type in ('expense', 'income', 'refund',
    'transfer'))` — PRD §16 (excluding `recurring_expense`, which per
    PRD §16 describes an *expected future* expense, i.e. a row in
    Phase 3's `recurring_expenses` table, not a value this table's
    actual-transaction `type` column takes).
  - `notes text` — nullable free text, general-purpose (useful for
    manual corrections and, later, for what the LLM couldn't
    structure).
  - `source text not null default 'manual' check (source in
    ('manual', 'llm', 'sms'))` — this phase only ever writes `manual`;
    the column exists now so Phase 5/7 don't need another migration
    for it and so the UI can already show "how was this added" if
    useful in Phase 4+.
  - `created_at timestamptz not null default now()`.
  - `updated_at timestamptz not null default now()`.
  - Index: `create index on transactions (user_id, transaction_date
    desc)` — supports the list view's default ordering per user.
- **RLS**: enabled on `transactions`. Policies: a user may `select`,
  `insert`, `update`, and `delete` only rows where `user_id =
  auth.uid()`, with `insert`/`update` also checked via `with check
  (user_id = auth.uid())` so a user can't assign a transaction to
  someone else's `user_id`.

## Pages / components
- **Create:**
  - `app/transactions/page.tsx` — the transaction list (Server
    Component; queries `transactions` joined to `categories` for the
    signed-in user, ordered by `transaction_date desc`).
  - `app/transactions/new/page.tsx` — the add-transaction form.
  - `app/transactions/[id]/page.tsx` — single transaction detail view.
  - `app/transactions/[id]/edit/page.tsx` — edit form, pre-filled.
  - `app/transactions/TransactionForm.tsx` — shared client form
    component used by both new/edit pages (fields: merchant, amount,
    category select, date, payment method, account/card, type, notes),
    following the `ProfileForm.tsx` pattern (client component wrapping
    `useActionState` over a Server Action).
  - `app/transactions/TransactionList.tsx` — mobile card-style list
    item component (merchant, amount, category, date, payment method,
    type badge), following PRD §12's per-transaction field list.
  - `app/transactions/DeleteTransactionButton.tsx` — client component
    with a confirm step before calling `deleteTransaction`.
  - `app/actions/transactions.ts` — `createTransaction`,
    `updateTransaction`, `deleteTransaction` Server Actions.
  - `lib/transactions/validation.ts` — field validators (amount →
    integer paise, date, category id, type enum, text-length caps for
    merchant/payment method/account info/notes), mirroring
    `lib/profile/validation.ts`'s `FieldResult<T>` pattern.
  - `lib/transactions/categories.ts` — a typed reference to the fixed
    category list/ids for use in server-rendered `<select>` options
    and in tests (reads from the `categories` table; no hardcoded
    duplicate list in app code beyond a fallback label map if needed
    for rendering).
- **Modify:**
  - `app/home/page.tsx` — replace the "Dashboard features start in
    Phase 4" placeholder text with a link to `/transactions`, so the
    new feature is reachable from the authenticated landing page.

## Files to change
- `app/home/page.tsx`

## Files to create
- `supabase/migrations/0003_transactions.sql`
- `app/transactions/page.tsx`
- `app/transactions/new/page.tsx`
- `app/transactions/[id]/page.tsx`
- `app/transactions/[id]/edit/page.tsx`
- `app/transactions/TransactionForm.tsx`
- `app/transactions/TransactionList.tsx`
- `app/transactions/DeleteTransactionButton.tsx`
- `app/actions/transactions.ts`
- `lib/transactions/validation.ts`
- `lib/transactions/categories.ts`
- Corresponding test files (e.g. `lib/transactions/validation.test.ts`,
  `app/transactions/page.test.tsx`, `app/actions/transactions.test.ts`
  where practical without a live Supabase instance).

## New dependencies
No new dependencies. Field validation (amount, date, enum checks,
text-length caps) is the same shape of problem `lib/profile/validation.ts`
already solves with plain TypeScript; `zod` remains reserved for Phase
5, where LLM output is genuinely unpredictable and worth a schema
library.

## Rules for implementation
- All Supabase queries are scoped to the authenticated user
  (Row-Level Security enforced, not just assumed) — verify the RLS
  policies on `transactions` actually block cross-user
  select/insert/update/delete, don't rely on app-level `user_id`
  filtering alone.
- Store money as integers in the smallest currency unit (paise, not
  rupees-as-float) — applies to `transactions.amount`; reuse the
  parse-rupees-to-paise pattern from `parseSalaryToPaise`.
- All financial calculations are plain application code — this phase
  does no aggregation, but the `amount` sign/type convention it
  establishes (`type` column, unsigned `amount`) must not require the
  LLM or any future phase to reinterpret stored values.
- Mobile-first: the list, add form, detail, and edit screens must all
  be verified at a ~375px viewport.
- No secrets or API keys committed — env vars only; this phase adds no
  new secrets.
- Handle Supabase failures gracefully on every new Server Action
  (insert/update/delete error, not-found on a stale `id`, expired
  session) with a user-visible message — never a hard crash, matching
  the `try/catch` + `unstable_rethrow` pattern in
  `app/actions/profile.ts`.

## Definition of done
- [ ] A signed-in user can create a transaction with merchant, amount,
      category, date, payment method, account/card, and type from
      `/transactions/new`, and is returned to `/transactions` seeing
      it in the list.
- [ ] The transaction list shows merchant, amount, category, date,
      payment method, and type for every transaction belonging to the
      signed-in user, most recent first.
- [ ] Clicking a transaction opens its detail view with all PRD §12
      fields visible.
- [ ] Editing a transaction (including changing its category) persists
      the change and is reflected immediately in the list and detail
      view.
- [ ] Deleting a transaction requires a confirmation step and removes
      it from the list after confirming.
- [ ] Submitting the form with a missing/invalid amount, missing date,
      or no category shows a clear field-level error instead of
      crashing or silently failing.
- [ ] RLS is verified directly (not just through the app UI): querying
      `transactions` as one user cannot return another user's rows,
      and attempting to update/delete another user's transaction id
      fails.
- [ ] `categories` contains all 22 PRD §6 categories and is readable
      by any authenticated user.
- [ ] All new screens (`/transactions`, `/transactions/new`,
      `/transactions/[id]`, `/transactions/[id]/edit`) are checked at
      a ~375px viewport and remain usable (no overflow, tappable
      buttons, readable list cards).
- [ ] `npx tsc --noEmit`, `npx eslint .`, and `npx vitest run` all
      pass, including new unit tests for
      `lib/transactions/validation.ts` and at least one component test
      for the transaction form (PLAN.md §5: "Unit tests for pure
      logic" + "Component tests for forms").
- [ ] `npm run build` succeeds.
- [ ] `git status` shows no `.env.local` or other secret file staged.
- [ ] `/code-review` (medium effort, per PLAN.md §6) run on the diff
      before merging, with findings applied or consciously accepted.
