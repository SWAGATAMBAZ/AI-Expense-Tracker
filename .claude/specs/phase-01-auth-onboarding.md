# Spec: Auth & Onboarding (Phase 01)

## Overview
This phase adds real user accounts and the initial financial setup flow
on top of the Phase 0 scaffold: registration, login, logout, a profile
screen, and a skippable onboarding form that captures the numbers the
forecasting features (Phases 4, 9, 10) will need later — monthly
salary, salary date, and currency. It implements PRD.md §3 in full
("Primary User Flow — A. Onboarding": Step 1 Registration/Login/
Logout/Profile, and Step 2 Initial Financial Setup). Per PLAN.md §3,
this is the first functional phase — everything before it (Phase 0)
was infrastructure only — so this is also where the app's first real
screens and its first database table appear.

## Depends on
**Phase 0 (Project setup)**, per PLAN.md §3's "Depends on" column. It
provides: the Next.js/TypeScript/Tailwind app shell (`app/layout.tsx`,
`app/globals.css`), the Supabase browser/server client helpers
(`lib/supabase/client.ts`, `lib/supabase/server.ts`), the CI pipeline
(lint/typecheck/unit tests), and the mobile-first base layout every new
screen in this phase renders inside. No Supabase tables exist yet —
this phase creates the first one.

## In scope
- **Registration** (email/password) — PRD §3 Step 1 "Register".
- **Login** (email/password) — PRD §3 Step 1 "Login".
- **Logout** — PRD §3 Step 1 "Logout".
- **Profile screen** (view + edit salary/salary date/currency) — PRD §3
  Step 1 "Profile".
- **Onboarding form** capturing: monthly salary, salary date, preferred
  currency — PRD §3 Step 2. Presented once, right after first
  registration.
- **Optional/skippable fields in onboarding**: bank/payment info (free
  text) and an acknowledgement that recurring expenses can be added
  later — PRD §3 Step 2 ("user should also be able to skip optional
  information and configure it later").
- **Route protection**: unauthenticated users can't reach any
  authenticated screen; users who haven't finished onboarding are
  steered to it before anything else.
- **`profiles` table + Row-Level Security**, the first real Supabase
  schema in this project.

## Explicitly out of scope
- **Recurring expense CRUD.** PRD §3 Step 2 lists "Existing recurring
  expenses" as an onboarding input, but the `recurring_expenses` table
  and its management UI belong to Phase 3 (PLAN.md §3/§4). Onboarding
  in this phase does **not** persist any recurring-expense data — it
  only tells the user this is coming and lets them move on. Building
  that data model now would duplicate work once Phase 3 defines it
  properly.
- **Transactions, categories, dashboard, or any spending data** —
  Phases 2 and 4.
- **Password reset / magic link / OAuth providers** — PRD §3 only lists
  Register/Login/Logout/Profile; email/password is the minimum that
  satisfies it. Additional auth methods aren't in the PRD and would be
  scope creep.
- **Structured bank/account records** (e.g., a linked-accounts table
  used later for per-transaction account matching) — PRD §3 calls this
  "optional bank/payment information," which this phase treats as a
  simple free-text note on the profile, not a modeled entity. Real
  account/payment-method structure is introduced organically once
  transactions exist (Phase 2 onward).
- **Any LLM involvement** — none of this phase touches Phase 5's
  pipeline.

## Routes / API surface
Implemented as Next.js Server Actions (no REST API routes needed —
Supabase Auth + Postgres access happens server-side via
`lib/supabase/server.ts`):

- `Server Action signUp(formData)` — creates an auth user via
  `supabase.auth.signUp` — public.
- `Server Action signIn(formData)` — `supabase.auth.signInWithPassword`
  — public.
- `Server Action signOut()` — `supabase.auth.signOut` — authenticated.
- `Server Action completeOnboarding(formData)` — validates and saves
  salary/salary date/currency (+ optional bank note) to the caller's
  `profiles` row, sets `onboarding_completed = true` — authenticated.
- `Server Action updateProfile(formData)` — edits salary/salary
  date/currency/bank note on the caller's existing `profiles` row —
  authenticated.

## Database changes
New migration `supabase/migrations/0001_profiles.sql`:

- **Table `profiles`**
  - `id uuid primary key references auth.users(id) on delete cascade`
  - `currency text not null default 'INR'`
  - `monthly_salary integer` — nullable until onboarding is completed;
    stored as an integer in the smallest currency unit (e.g. paise for
    INR), never a float, per the money-as-integer rule.
  - `salary_day smallint` — day of month (1–31) the salary typically
    arrives; nullable until set. Clamped/handled in app code for
    months with fewer days (e.g. 31 in a 30-day month) — no DB
    constraint beyond `check (salary_day between 1 and 31)`.
  - `bank_info text` — optional free-text note, nullable.
  - `onboarding_completed boolean not null default false`.
  - `created_at timestamptz not null default now()`.
  - `updated_at timestamptz not null default now()`.
- **Trigger**: on `auth.users` insert, a `handle_new_user()` function
  auto-creates the matching `profiles` row (id only, everything else
  defaulted/null) so app code never has to remember to create it.
- **RLS**: enabled on `profiles`. Policies: a user may `select` and
  `update` only the row where `id = auth.uid()`. No `insert`/`delete`
  policy for regular users — row creation is handled solely by the
  trigger (running as the table owner), so users can never create a
  profile for another `id` or delete their own.

## Pages / components
- **Create:**
  - `app/login/page.tsx` — email/password login form.
  - `app/register/page.tsx` — email/password registration form.
  - `app/onboarding/page.tsx` — salary/salary date/currency form, with
    skippable bank-info field and a "recurring expenses — add these
    later" note.
  - `app/profile/page.tsx` — view + edit salary/salary date/currency/
    bank note; sign-out button.
  - `app/actions/auth.ts` — `signUp`, `signIn`, `signOut` Server
    Actions.
  - `app/actions/profile.ts` — `completeOnboarding`, `updateProfile`
    Server Actions.
  - `lib/supabase/middleware.ts` — session-refresh helper used by
    `middleware.ts` (standard `@supabase/ssr` pattern).
  - `middleware.ts` (repo root) — route protection: redirects signed-
    out users to `/login`, redirects signed-in-but-not-onboarded users
    to `/onboarding`, redirects signed-in users away from
    `/login`/`/register`.
- **Modify:**
  - `app/page.tsx` — replace the Phase 0 placeholder with a minimal
    authenticated landing screen (e.g., a welcome message + sign-out
    link); real dashboard content arrives in Phase 4. Unauthenticated
    visitors never see this — middleware redirects them first.

## Files to change
- `app/page.tsx`

## Files to create
- `supabase/migrations/0001_profiles.sql`
- `middleware.ts`
- `lib/supabase/middleware.ts`
- `app/login/page.tsx`
- `app/register/page.tsx`
- `app/onboarding/page.tsx`
- `app/profile/page.tsx`
- `app/actions/auth.ts`
- `app/actions/profile.ts`
- Corresponding component/action test files (e.g.
  `app/actions/profile.test.ts` for the onboarding/profile validation
  logic).

## New dependencies
No new dependencies. Form inputs in this phase are simple enough
(an amount, a day-of-month 1–31, a 3-letter currency code, optional
free text) to validate with plain TypeScript in the Server Actions.
`zod` is introduced in Phase 5, where it's actually required for
validating unpredictable LLM output — adding it here for a handful of
well-known fields would be an unjustified dependency ahead of need.

## Rules for implementation
- All Supabase queries are scoped to the authenticated user
  (Row-Level Security enforced, not just assumed) — verify the RLS
  policies actually block cross-user access, don't rely on app-level
  filtering alone.
- Store money as integers in the smallest currency unit (paise, not
  rupees-as-float) — applies to `monthly_salary`.
- Mobile-first: every new screen (`login`, `register`, `onboarding`,
  `profile`) must be verified at a ~375px viewport.
- No secrets or API keys committed — env vars only; this phase doesn't
  add new secrets beyond what Phase 0 already wired
  (`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- Handle Supabase Auth failures gracefully (wrong password, duplicate
  email, network error) with a user-visible message — never a hard
  crash or a blank screen.

## Definition of done
- [ ] A new user can register with email/password and is redirected to
      `/onboarding`.
- [ ] Registering with an already-used email shows a clear error
      instead of crashing.
- [ ] A registered user can log in with correct credentials; wrong
      credentials show a clear error.
- [ ] Visiting `/`, `/onboarding`, or `/profile` while signed out
      redirects to `/login`.
- [ ] A signed-in user who hasn't completed onboarding is redirected to
      `/onboarding` from any other protected route.
- [ ] Submitting the onboarding form with salary, salary date, and
      currency saves them to `profiles`, sets
      `onboarding_completed = true`, and redirects to `/`.
- [ ] Skipping the optional bank-info field still allows onboarding to
      complete successfully.
- [ ] The profile page shows the current salary/salary date/currency,
      allows editing, and changes persist after a page reload.
- [ ] Logging out clears the session; the next visit to a protected
      route redirects to `/login` again.
- [ ] RLS is verified directly (not just through the app UI): querying
      `profiles` as one user cannot return another user's row.
- [ ] All new screens are checked at a ~375px viewport and remain
      usable (no overflow, tappable buttons).
- [ ] `npx tsc --noEmit`, `npx eslint .`, and `npx vitest run` all pass,
      including at least one new unit/component test covering the
      onboarding/profile Server Action validation logic (PLAN.md §5:
      "Component tests for forms").
- [ ] `npm run build` succeeds.
- [ ] `git status` shows no `.env.local` or other secret file staged.
- [ ] `/code-review` (medium effort, per PLAN.md §6) run on the diff
      before merging, with findings applied or consciously accepted.
