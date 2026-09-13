# Spec: Project Setup (Phase 00)

## Overview
This phase creates the foundational scaffold that every later phase builds
on: a Next.js (App Router, TypeScript) application with Tailwind CSS, a
connected Supabase project, a mobile-first base layout, a PWA manifest, and
a CI skeleton that runs lint + typecheck on every push. PRD.md has no
functional section mapped to this phase (per PLAN.md §3, PRD sections
covered: "— (infra only)") — it exists purely so that phase 1 onward can
start writing features against a working, deployable, testable app shell
instead of an empty repo. This matches PLAN.md §4's "Phase 0 — Project
setup" description and the tech stack decisions in PLAN.md §1.

## Depends on
None — this is the first phase. It has no prior phase to build on; instead
it produces the foundation (repo structure, tooling, base layout, hosting
wiring) that Phase 1 (Auth & Onboarding) and all subsequent phases depend
on.

## In scope
- Next.js (App Router, TypeScript) project scaffold — PLAN.md §1 tech
  stack row "App framework".
- Tailwind CSS installed and configured for mobile-first styling —
  PLAN.md §1 "UI".
- Supabase project created; `@supabase/supabase-js` (and
  `@supabase/ssr` for server/browser client helpers) installed; env var
  wiring for `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` via `.env.local` (never committed) —
  PLAN.md §1 "Database + Auth", PRD §25.4 (secrets/data privacy
  baseline).
- Base mobile-first layout shell (root layout, viewport meta, base
  Tailwind container/typography) that later phases' pages will render
  inside.
- PWA manifest + service worker registration via `next-pwa`, installable
  "Add to Home Screen" on Android — PLAN.md §1 "PWA", PLAN.md §7 step 6.
  Web Share Target manifest entry is **not** wired yet (that's Phase 7,
  PLAN.md §3) — only the base manifest/icons/service-worker plumbing
  goes in now.
- GitHub Actions CI skeleton: lint (ESLint) + typecheck (`tsc --noEmit`)
  on every push/PR — PLAN.md §1 "Source control / CI", PLAN.md §5 "Before
  each merge".
- Testing tooling installed and wired into CI: Vitest + React Testing
  Library (unit/component), Playwright installed (config only, no E2E
  suite yet — that's Phase 11) — PLAN.md §1 "Testing".
- `.env.example` documenting required env vars without real values.
- `.gitignore` covering `.env.local`, `node_modules`, `.next`, build
  output.

## Explicitly out of scope
- Any actual auth flow, login/register pages, or profile table — Phase 1
  (PLAN.md §3).
- Any Supabase tables/migrations beyond project creation itself — the
  first real schema (profiles) lands in Phase 1; transactions/categories
  land in Phase 2; recurring_expenses lands in Phase 3.
- OpenRouter/LLM client wiring — Phase 5 (PLAN.md §3, §4).
- Dashboard, charts, or any Recharts usage — Phase 4.
- Web Share Target functionality (only the manifest scaffold, not the
  share-intent handling route) — Phase 7 (PRD §25.1).
- Actual Vercel deployment — Phase 13 (PLAN.md §7), though env vars are
  named now so Phase 13 can reuse them without renaming.
- Any Playwright E2E test cases — Phase 11 (PLAN.md §5).

## Routes / API surface
No new routes. This phase only creates the root layout (`app/layout.tsx`)
and a placeholder home page (`app/page.tsx`) with no business logic.

## Database changes
No database changes. A Supabase project is created (infra step, via the
Supabase dashboard/CLI), but no tables, columns, or RLS policies are
defined in this phase — the first schema (profiles) is Phase 1's
responsibility.

## Pages / components
- **Create:**
  - `app/layout.tsx` — root layout: HTML shell, viewport meta, global
    Tailwind styles, PWA manifest link.
  - `app/page.tsx` — placeholder landing/home page (temporary content;
    replaced by real routing once Phase 1 auth exists).
  - `app/globals.css` — Tailwind base/components/utilities imports.
- **Modify:** none (no existing pages/components in the repo yet).

## Files to change
- `README.md` — replace the single-line placeholder with setup/run
  instructions (install, env vars, dev server, test commands).
- `.gitignore` — create/extend to exclude `.env.local`, `node_modules`,
  `.next`, coverage output, Playwright artifacts.

## Files to create
- `package.json`, `tsconfig.json`, `next.config.js` (or `.ts`, with
  `next-pwa` wrapper), `tailwind.config.ts`, `postcss.config.js`
- `.eslintrc.json` (or flat `eslint.config.js`)
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- `public/manifest.json`, `public/icons/` (placeholder app icons)
- `.env.example`
- `lib/supabase/client.ts` — browser Supabase client factory
- `lib/supabase/server.ts` — server Supabase client factory (for Server
  Components/Route Handlers)
- `vitest.config.ts`, `playwright.config.ts`
- `.github/workflows/ci.yml` — lint + typecheck + unit test job
- `.gitignore` (if not already present as a real file)

## New dependencies
- `next`, `react`, `react-dom`, `typescript`, `@types/react`,
  `@types/node` — required baseline; no lighter option fits an App
  Router + TypeScript project (PLAN.md §1).
- `tailwindcss`, `postcss`, `autoprefixer` — PLAN.md §1 UI choice;
  avoids hand-rolling a mobile-first responsive design system.
- `@supabase/supabase-js`, `@supabase/ssr` — PLAN.md §1 Database + Auth
  choice; `@supabase/ssr` is needed specifically because App Router mixes
  server and client components and needs cookie-aware client helpers.
- `next-pwa` — PLAN.md §1 PWA choice; avoids hand-writing service-worker
  registration/caching logic.
- `vitest`, `@testing-library/react`, `@testing-library/jest-dom`,
  `jsdom` — PLAN.md §1 Testing choice for unit/component tests.
- `@playwright/test` — PLAN.md §1 Testing choice for E2E (installed now,
  suite written in Phase 11).
- `eslint`, `eslint-config-next` — required for the CI lint step.
- No paid or heavier alternatives (e.g. a separate Express backend, a
  paid vector DB, a UI component library) are introduced — matches
  PLAN.md §1's "Explicitly not using" list.

## Rules for implementation
- No secrets or API keys committed — env vars only. `.env.local` must be
  git-ignored; `.env.example` holds only placeholder key names.
- Mobile-first: the base layout must be verified at a ~375px viewport
  before this phase is marked done, even though no real screens exist
  yet — this sets the baseline every later page inherits.
- Keep the scaffold minimal: no premature abstractions, no placeholder
  business logic, no unused dependencies beyond what's listed above.

## Definition of done
- [ ] `npm install` succeeds from a clean clone with no manual steps
      beyond copying `.env.example` to `.env.local` and filling in real
      Supabase values.
- [ ] `npm run dev` starts the app and the placeholder home page renders
      correctly at a 375px-wide viewport (PLAN.md §5 mobile-viewport
      testing expectation).
- [ ] `npm run build` completes with no errors.
- [ ] `npx tsc --noEmit` passes with no type errors.
- [ ] `npx eslint .` passes with no errors.
- [ ] `npx vitest run` executes successfully (even with zero or a trivial
      smoke test) — confirms the test runner is wired correctly.
- [ ] The PWA manifest is served at `/manifest.json` and linked from
      `app/layout.tsx`; Chrome DevTools' Application panel shows it as
      valid with no console errors.
- [ ] A Supabase project exists and `lib/supabase/client.ts` /
      `lib/supabase/server.ts` can successfully connect using the env
      vars in `.env.local` (verified with a throwaway
      `supabase.auth.getSession()` call in dev, then removed).
- [ ] GitHub Actions workflow (`.github/workflows/ci.yml`) runs on a
      pushed commit/PR and all steps (lint, typecheck, unit test) pass
      green — satisfies PLAN.md §5 "Before each merge" and sets up
      PLAN.md §6's review gate for future phases.
- [ ] No `.env.local` or other secret file is present in `git status` or
      committed history.
