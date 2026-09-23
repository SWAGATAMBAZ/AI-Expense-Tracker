# Spendify

An AI-first, mobile-first expense tracker. See `PRD.md` for the product
spec and `PLAN.md` for the phased execution plan.

## Prerequisites

- Node.js 24+ and npm 11+
- A free [Supabase](https://supabase.com/dashboard) account

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy the env template and fill in your Supabase project's values
   (Project Settings > API):
   ```
   # PowerShell
   Copy-Item .env.example .env.local
   # or, in Git Bash
   cp .env.example .env.local
   ```
   `.env.local` is git-ignored — never commit it.
3. Start the dev server:
   ```
   npm run dev
   ```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the dev server (Turbopack). |
| `npm run build` | Production build. Runs with `--webpack`, not the default Turbopack — see PWA notes below. |
| `npm run start` | Serve a production build. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run `tsc --noEmit`. |
| `npm test` | Run unit/component tests once (Vitest). |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:e2e` | Run Playwright E2E tests (suite added in a later phase). |

## PWA notes

The service worker is built with [Serwist](https://serwist.pages.dev/)
via `next.config.ts`. Serwist's Next.js integration hooks into webpack,
and Next.js 16 defaults to Turbopack for both `dev` and `build` — so
`npm run build` explicitly passes `--webpack` to make sure the service
worker actually gets generated. The service worker is disabled entirely
under `next dev` (`disable: process.env.NODE_ENV === "development"`) to
avoid stale-cache issues while developing, so `npm run dev` can keep
using the default Turbopack dev server without conflict.

## Verifying Supabase connectivity (manual, one-time)

After filling in `.env.local` with real Supabase values, you can confirm
the app can reach your project:

1. Temporarily add this to the top of `app/page.tsx`'s `HomePage`
   function body:
   ```tsx
   import { createClient } from "@/lib/supabase/client";

   if (typeof window !== "undefined") {
     createClient()
       .auth.getSession()
       .then(({ error }) => console.log("Supabase reachable:", !error, error));
   }
   ```
2. `npm run dev`, open `http://localhost:3000`, and check the browser
   console for `Supabase reachable: true` with no error.
3. Revert the change — don't commit it:
   ```
   git checkout -- app/page.tsx
   ```
