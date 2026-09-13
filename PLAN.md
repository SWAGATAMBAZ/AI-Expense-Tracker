# AI Expense Tracker — Execution Plan

This plan turns PRD.md into a step-by-step build order. It is optimized for: **free to build, free to host, mobile-first, one shareable link.**

---

## 0. Working Method (repeat this cycle for every phase below)

For each phase in the roadmap:

1. **Group** — the phase already bundles related PRD features together (done below).
2. **Spec** — before writing code, create a short spec doc at `specs/phase-N-<name>.md` covering: what's in scope (linking back to the relevant PRD section numbers), data model changes, API/route changes, and explicit non-goals for this phase.
3. **Plan** — a short implementation plan for that spec (files to touch, order of work). For anything non-trivial, do this in Claude Code's plan mode before executing.
4. **Execute** — implement it.
5. **Test** — run/extend automated tests for the phase (see §5). Don't move on with a broken build.
6. **Review** — run `/code-review` (medium/high) on the phase's diff before merging; fix or consciously accept findings.

Only after a phase passes test + review does the next phase start. This keeps each spec doc small and each review focused, instead of one giant spec/review at the end.

---

## 1. Tech Stack (minimal, free, mobile-first)

| Layer | Choice | Why |
|---|---|---|
| App framework | **Next.js (App Router, TypeScript)** | One codebase for frontend + backend API routes → one deployment, no separate backend service to host/pay for. |
| UI | **Tailwind CSS** | Fast to build a clean mobile-first responsive UI without a design system dependency. |
| PWA | **next-pwa** (manifest + service worker) + Web Share Target | Installable on Android home screen; enables the "share SMS into app" flow from §25.1 of the PRD. |
| Database + Auth | **Supabase (free tier)** — Postgres + built-in Auth + Row-Level Security | One free service gives DB, auth, and per-user data isolation instead of stitching together three. |
| Charts | **Recharts** | Lightweight, free, covers category/payment-method breakdowns and trends. |
| LLM access | **OpenRouter** (free-tier models) | Single API for swappable free models; see §2. |
| Speech-to-text | **Web Speech API** (browser-native) | Free, no backend cost; Android Chrome only (per PRD §25.2), used as progressive enhancement. |
| Hosting | **Vercel (free/Hobby tier)** | Native Next.js support, free HTTPS link, auto-deploy from GitHub. |
| Source control / CI | **GitHub** + **GitHub Actions (free minutes)** | Lint + typecheck + unit tests on every push. |
| Testing | **Vitest** + **React Testing Library** (unit/component), **Playwright** (E2E, mobile viewport emulation) | Free, fast, good mobile-viewport testing support. |

Explicitly **not** using: a separate backend framework/server, a paid vector DB, a paid LLM, native mobile app shells (Capacitor/React Native) — all deferred to post-MVP if ever needed.

---

## 2. LLM Strategy (OpenRouter, free)

- Access all models through **OpenRouter's OpenAI-compatible API**, using an env var for the model name (`OPENROUTER_MODEL`) so the model can be swapped without a code change — free-tier model availability on OpenRouter rotates over time.
- At build time, pick 1 primary free model that supports **JSON/structured output** reasonably well (check OpenRouter's current free-tier list — historically models tagged `:free`, e.g. Llama or Gemini Flash free variants). Confirm structured-output support before committing to a spec.
- Keep a **second free model as a fallback** (config, not code) in case the primary is rate-limited/down, per PRD §25.3.
- Enforce PRD §20 rules in code, not prompts:
  - LLM only returns structured JSON (amount, merchant, category, type, date, payment method, confidence) — it never writes to the DB directly.
  - Backend validates the JSON shape/types before anything touches the database.
  - All calculations (totals, savings, matching) are plain application code — never delegated to the LLM.
- One shared "extract transaction from text" prompt/function is reused by: SMS-paste ingestion, AI chat entry, and voice entry (after speech-to-text) — same pipeline, three entry points, per PRD §5.

---

## 3. Phase Roadmap

### MVP (P0) — build in this order

| Phase | Name | PRD sections covered | Depends on |
|---|---|---|---|
| 0 | Project setup | — (infra only) | — |
| 1 | Auth & onboarding | 3 (Registration/Login/Logout/Profile, Initial Financial Setup) | 0 |
| 2 | Core transaction data + manual CRUD | 6, 12 (categories, transaction list/edit/delete) | 1 |
| 3 | Recurring/upcoming expenses | 7 (CRUD + upcoming-spend logic) | 2 |
| 4 | Dashboard & forecasting math | 8, 9, 10, 11 (totals, category chart, upcoming spend, savings forecast, payment mix, date filters) | 2, 3 |
| 5 | LLM extraction pipeline | 5, 20 (message → LLM → validate → dedupe → DB), 17 (duplicate detection) | 2 |
| 6 | AI chat expense entry | 13, 14, 18 (chat UI, NL entry, confidence/clarifying questions) | 5 |
| 7 | SMS/message ingestion (MVP form) | 4, 21, 25.1 (paste + Share Target, same pipeline as phase 5) | 5 |

### P1 — after MVP is working end-to-end

| Phase | Name | PRD sections covered | Depends on |
|---|---|---|---|
| 8 | Voice expense entry | 15, 25.2 | 6 |
| 9 | Recurring-expense matching + transaction types | 7 (matching engine), 16 (income/refund/transfer) | 3, 5 |
| 10 | Edge-case hardening | 19 (full edge case list) | 1–9 |

### P2 — explicitly deferred (backlog only, not scheduled)

Native Android app for real SMS auto-read, advanced forecasting, budget recommendations, anomaly detection, multi-account aggregation, custom categories UI — from PRD §23 P2 list.

### Final phases (apply once, after P0 — and again after P1 if time allows)

| Phase | Name |
|---|---|
| 11 | Full regression test pass |
| 12 | Full code review pass (`/code-review high` or `ultra`) |
| 13 | Deploy to production (free hosting) |

---

## 4. Phase Details (spec must be written before each)

- **Phase 0 — Project setup**: Next.js + TS + Tailwind scaffold, Supabase project created, env var wiring (`.env.local`, never committed), base mobile layout shell, PWA manifest, GitHub repo + Actions CI skeleton (lint + typecheck).
- **Phase 1 — Auth & onboarding**: Supabase Auth (email/password), profile table, onboarding form (salary, salary date, currency, skip-able recurring expenses/bank info), route protection.
- **Phase 2 — Core transactions**: `transactions` table + RLS, category enum/table (extensible per PRD §6), manual add/edit/delete/view UI, transaction list component (mobile card layout).
- **Phase 3 — Recurring expenses**: `recurring_expenses` table, CRUD UI, "upcoming spend" derivation query (future/unprocessed only, per PRD §7).
- **Phase 4 — Dashboard**: date-range filter component, total spend, category breakdown (Recharts), upcoming spend list, savings forecast (PRD §9/10 formula, floor at ₹0), payment-method donut chart.
- **Phase 5 — LLM pipeline**: OpenRouter client wrapper, structured-output schema + validation (e.g. zod), duplicate-detection function (amount/date/merchant/account/ref-id comparison per PRD §17), confidence threshold → auto-save vs. ask-user branch (PRD §18).
- **Phase 6 — AI chat**: floating action button, chat UI, wires NL text into phase 5 pipeline, follow-up question flow when required fields are missing.
- **Phase 7 — SMS ingestion MVP**: paste-a-message screen + Android Share Target manifest entry, routes text through the same phase 5 pipeline, "upcoming → processed" transition logic (PRD §7 matching, best-effort per PRD §7's "if not confident, don't assume" rule).
- **Phase 8 — Voice**: Web Speech API integration, transcript → phase 5/6 pipeline, feature-detected UI (hidden gracefully on unsupported browsers).
- **Phase 9 — Matching & transaction types**: income/refund/transfer classification, recurring-expense matcher wired into phase 7 ingestion and manual entry.
- **Phase 10 — Edge cases**: work through PRD §19 checklist explicitly as test cases, patch gaps found.

---

## 5. Testing Strategy

- **Per phase (continuous)**:
  - Unit tests (Vitest) for pure logic: savings formula, duplicate matching, category defaults, upcoming→processed transition.
  - Component tests (React Testing Library) for forms and the transaction list on mobile viewport sizes.
  - For phases involving the LLM (5, 6, 7, 8): mock the LLM response in tests (deterministic), and manually test 5–10 real free-tier LLM calls with real-ish sample messages before marking the phase done.
- **Before each merge**: CI runs lint + typecheck + unit/component tests (GitHub Actions, free).
- **Phase 11 (full regression)**: Playwright E2E suite covering the golden path end-to-end on a mobile viewport — onboarding → paste an SMS → see it on dashboard → add an expense via chat → see savings update — plus the PRD §24 success-criteria list run through manually once.
- **Security pass** (fold into phase 11 or run `/security-review`): confirm RLS policies actually block cross-user access, confirm secrets aren't logged, confirm SMS/message text isn't over-retained (PRD §25.4).

---

## 6. Code Review Strategy

- After every phase's execute+test step: `/code-review` (medium effort is enough for most phases; use `high` for phases 5, 7, 9 since they carry the duplicate/matching/financial logic that's easy to get subtly wrong).
- Before deployment (phase 12): one broader pass — `/code-review high` end-to-end, or `/code-review ultra` if you want the multi-agent cloud pass — across the full diff since project start.
- Apply or consciously reject each finding; don't silently skip.

---

## 7. Deployment (free)

1. Push repo to GitHub.
2. Create Supabase project (free tier) → copy project URL + anon key → set as Vercel env vars.
3. Create OpenRouter account → generate API key (free tier) → set as Vercel env var, along with `OPENROUTER_MODEL` (+ fallback model var).
4. Import repo into Vercel → framework auto-detected (Next.js) → deploy.
5. Vercel gives a free `*.vercel.app` HTTPS link — this is the shareable prototype link, works on mobile browsers directly (no app store).
6. Add the PWA "Add to Home Screen" prompt so mobile users can install it like an app.
7. Re-deploys happen automatically on every push to `main` (or gate behind a `deploy` branch if you want manual control).

---

## 8. Definition of Done for MVP (P0)

All of PRD §23 P0 items work end-to-end on a real mobile browser, phases 0–7 have passed their tests and code review, phase 11–13 (regression, review, deploy) are complete, and the PRD §24 success-criteria list can be walked through live on the deployed link.
