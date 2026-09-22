# Phase 11–12 — Full regression, security pass, full review

## Scope
- **Phase 11**: Playwright E2E (mobile viewport, Pixel 7) covering the golden path against the real Supabase project and the **real** OpenRouter LLM (no mocking, no app-side throttling): onboarding -> recurring expense -> add expense via AI chat -> dashboard totals/savings update -> duplicate blocked (PRD §24 #8) -> correct a transaction (#7).
- **Security pass**: cross-user RLS test (user B cannot read/update/delete/insert-as user A on `profiles`, `transactions`, `recurring_expenses`) using the anon key + B's JWT; secrets-in-logs / client-bundle grep.
- **Phase 12**: one `/code-review high` pass over the full diff since project start; fix or consciously reject each finding.

## Non-goals
- No new product features. No SMS/voice (phases 7/8 cut).
- No LLM rate limiting/throttling added by the app; only OpenRouter's own upstream limits apply.

## Test isolation
E2E users are created through the Supabase admin API in `e2e/global-setup.ts` (gmail `+e2e-…` aliases, confirmed, random passwords) and deleted in `global-teardown.ts` (rows cascade). Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (local only, never committed, never in CI unless added as a secret).
