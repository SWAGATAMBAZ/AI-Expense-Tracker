# Spec: AI Transaction Assistant — LLM Pipeline + Chat (Phases 5 & 6)

## Overview

This spec combines PLAN.md's Phase 5 (LLM extraction pipeline) and Phase 6
(AI chat) into one phase, because shipping either alone has no user-visible
value: a pipeline nobody can invoke, or a chat UI with nothing behind it.
Together they deliver the app's first real "AI-first" behavior (PRD §2,
§22): the user opens `/ai` (currently a coming-soon placeholder from the
Phase 3/4 dashboard-nav work) and types a plain-language message. An
OpenRouter LLM extracts a structured **intent** (PRD §5), the app validates
it with the *exact same* validators the manual forms already use (Phase 2/3),
runs duplicate detection for new transactions (PRD §17), and either executes
the action immediately or asks one concise follow-up question when something
required is missing or uncertain (PRD §14, §18).

Per the user's explicit scope: this covers not just "add an expense" but the
core manual actions PRD requires being AI-reachable — add a transaction (any
type), edit/correct an existing transaction, delete one (with confirmation),
add a recurring expense, and edit/deactivate a recurring expense.

PRD sections implemented: §5 (AI Transaction Understanding), §13 (AI Expense
Assistant), §14 (Natural Language Expense Entry), §17 (Duplicate Detection),
§18 (AI Confidence & Human Correction), §20 (AI/LLM Requirement).

## Depends on

- **Phase 2** — `transactions` table, `lib/transactions/validation.ts`
  (`validateTransactionForm`, `parseAmountToPaise`, etc.), `app/actions/transactions.ts`
  (`createTransaction`, `updateTransaction`, `deleteTransaction`).
- **Phase 3** — `recurring_expenses` table, `lib/recurring/validation.ts`
  (`validateRecurringExpenseForm`), `app/actions/recurring.ts`
  (`createRecurringExpense`, `updateRecurringExpense`,
  `toggleRecurringExpenseActive`, `deleteRecurringExpense`).
- **Phase 4** — the `/ai` placeholder page and bottom-nav entry point.

None of the above are modified — this phase only adds a new caller on top of
them, so the manual-form behavior and its existing tests are untouched.

## In scope

- OpenRouter integration: a thin fetch wrapper (no SDK), primary + fallback
  free model, small/short prompts (PRD §20).
- One shared extraction pipeline: text → LLM → structured intent → field
  validation (reusing Phase 2/3 validators) → duplicate check (creates only)
  → execute or ask a follow-up (PRD §5, §18).
- Chat UI at `/ai`: message thread, text input, renders confirmations,
  clarifying questions, and plain-language errors.
- Supported intents, each mapped to an existing, unmodified server action:
  - `add_transaction` (expense/income/refund/transfer) → `createTransaction`
  - `edit_transaction` (natural reference: merchant/amount/"the last one") → `updateTransaction`
  - `delete_transaction` (always confirmed first) → `deleteTransaction`
  - `add_recurring_expense` → `createRecurringExpense`
  - `edit_recurring_expense` (amount/frequency/next due date/category, or
    activate/deactivate) → `updateRecurringExpense` / `toggleRecurringExpenseActive`
- Duplicate detection (PRD §17) before any `add_transaction` insert: compare
  amount + date + merchant + payment method against the user's existing rows
  in a short window.
- Confidence handling (PRD §18): the LLM returns a confidence signal per
  field; missing/low-confidence required fields → one clarifying question,
  never a silent guess. Rows created this way use `source: "llm"` (column
  already exists) and remain editable through the existing manual screens.

## Explicitly out of scope

- **Voice input** (Phase 8, PRD §15) — text only.
- **SMS/message paste ingestion** (Phase 7, PRD §4/§21) — this phase builds
  the shared pipeline Phase 7 will reuse, not the paste-a-message entry point.
- **Automatic** recurring-expense matching ("upcoming → processed") and
  **automatic** income/refund/transfer classification from ingested bank
  text (Phase 9, PRD §7/§16) — out of scope here; this phase's duplicate
  check only prevents literal dupes of chat/paste-created rows, it does not
  try to match a transaction against a recurring expense.
- **Persisted chat history.** The conversation, including any pending
  clarification, lives in client-side state for the current page load only.
  Refreshing `/ai` starts a new conversation. No PRD requirement mandates
  persistence — revisit later if asked for.
- **Multiple intents per message** (PRD §19). One message → one intent; if
  the message is compound/ambiguous, the LLM is instructed to ask which one
  the user means rather than guessing or acting on both.
- **Bulk operations** — edit/delete acts on at most one resolved row per
  confirmation.
- Any dedicated non-English handling beyond whatever the chosen model
  natively understands.

## Routes / API surface

- `Server Action interpretMessage(prevState, formData)` — `app/actions/ai.ts` —
  authenticated. Input: the user's chat text plus a small serialized
  "pending intent" (present only when the previous turn asked a follow-up
  question). Behavior:
  1. Calls `lib/ai/openrouter.ts` with the shared prompt (`lib/ai/prompt.ts`)
     to get a structured intent back.
  2. Validates the intent envelope shape (`lib/ai/intent.ts`), then the
     extracted fields through the existing Phase 2/3 validators.
  3. For `edit_transaction`/`delete_transaction`/`edit_recurring_expense`,
     resolves the natural-language target via `lib/ai/resolveTarget.ts`.
  4. For `add_transaction`, runs `lib/ai/duplicate.ts` before inserting.
  5. Executes the matching existing action function directly (not through
     its `<form action>` binding) and returns a confirmation string, **or**
     returns a clarifying question + updated pending-intent for the next turn,
     **or** returns a plain-language failure message (LLM down, ambiguous
     target, etc.) — never throws to the client.
- No new public API routes. Everything is a Server Action, consistent with
  the rest of the app.

## Database changes

No new tables, no schema changes. `transactions.source` already accepts
`'llm'` (migration `0003_transactions.sql`); every field the assistant needs
to write already exists on `transactions` and `recurring_expenses`. Pending
clarification state is client-side only, not persisted.

## Pages / components

- **Modify:** `app/ai/page.tsx` — replace the "coming soon" card with the
  real chat UI shell; same auth-redirect pattern as today.
- **Create:** `app/ai/ChatPanel.tsx` (client component) — message thread +
  input, holds pending-intent state across turns, calls `interpretMessage`,
  renders confirmation/clarification/error text and a short summary
  ("Added ₹450 expense — Food & Dining") linking to the affected transaction
  or recurring expense.
- **Create:** `lib/ai/openrouter.ts` — fetch wrapper for OpenRouter's
  chat-completions endpoint: model, fallback model, timeout, JSON-mode
  request, error/timeout normalization.
- **Create:** `lib/ai/prompt.ts` — the single shared system prompt + schema
  description (category list, transaction types, recurring frequencies),
  reused by chat now and by Phase 7's SMS-paste flow later.
- **Create:** `lib/ai/intent.ts` — intent type definitions (discriminated
  union on `action`) + hand-rolled validator for the LLM's raw JSON.
- **Create:** `lib/ai/resolveTarget.ts` — resolves a natural-language
  reference to zero/one/many rows via a user-scoped Supabase query; zero or
  many matches → ask the user to be more specific instead of guessing.
- **Create:** `lib/ai/duplicate.ts` — the PRD §17 duplicate check, reused
  before any chat-originated transaction insert.

## Files to change

- `app/ai/page.tsx`
- `.env.example` (add `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`,
  `OPENROUTER_FALLBACK_MODEL` placeholders)

## Files to create

- `app/ai/ChatPanel.tsx`
- `app/ai/ChatPanel.test.tsx`
- `app/actions/ai.ts`
- `app/actions/ai.test.ts`
- `lib/ai/openrouter.ts`
- `lib/ai/openrouter.test.ts`
- `lib/ai/prompt.ts`
- `lib/ai/intent.ts`
- `lib/ai/intent.test.ts`
- `lib/ai/resolveTarget.ts`
- `lib/ai/resolveTarget.test.ts`
- `lib/ai/duplicate.ts`
- `lib/ai/duplicate.test.ts`

## New dependencies

None. The LLM response is a small, well-defined discriminated-union JSON
shape (5 intents, a handful of fields each) — a hand-rolled validator in
`lib/ai/intent.ts`, in the same style as the existing hand-rolled validators
in `lib/transactions/validation.ts`/`lib/recurring/validation.ts`, is enough
and matches the codebase's existing convention (no `zod` anywhere yet) rather
than introducing a new pattern for one feature. The global `fetch` (already
available in Next.js/Node) is enough for the OpenRouter HTTP call — no SDK
needed. `zod` remains an option later if the schema grows meaningfully.

## OpenRouter model choice (researched live against openrouter.ai, Sep 2026)

- **Primary:** `liquid/lfm-2.5-2.6b:free` — LiquidAI LFM2.5, 2.6B parameters.
  Explicitly described by the provider as suited for "agent workflows, data
  extraction" — precisely this use case — and it's genuinely lightweight (a
  small model → fast, low-latency responses), supports `tools` and
  `response_format`/`structured_outputs`, 65K context (far more than one
  chat message needs).
- **Fallback:** `google/gemma-4-26b-a4b-it:free` — Google DeepMind
  Mixture-of-Experts (25.2B total / 3.8B active params → "near-31B quality"
  at small-model latency), supports `tools` + `response_format`, larger
  context (262K). Used only when the primary errors/times out — a reputable
  major-lab model as the safety net.
- Both are `$0` per token on OpenRouter — genuinely free, no cost ceiling to
  worry about beyond OpenRouter's request-rate limits (see below).
- Config via env vars only (`OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODEL`),
  never hardcoded, since free-tier model availability rotates — matches
  PLAN.md §2.

## Rules for implementation

- The LLM only ever returns structured data; it never writes to the database
  directly — PRD §20.
- All LLM output is validated before it touches the database: first the
  intent-envelope shape (`lib/ai/intent.ts`), then the extracted fields
  through the same validators the manual forms use. No separate,
  possibly-drifting AI-only validation logic.
- All financial calculations remain plain application code — this phase does
  not touch `lib/dashboard/aggregate.ts`.
- All Supabase queries (including target resolution for edit/delete) are
  scoped to the authenticated user (`.eq("user_id", user.id)`) — never trust
  an ID the LLM returns; it only ever gets natural-language descriptors.
- Store money as integers in paise. The LLM returns a decimal rupee amount;
  it is converted via the existing `parseAmountToPaise` and validated before
  anything is persisted — never a raw LLM number written directly.
- Mobile-first: chat UI verified at a ~375px viewport (message bubbles,
  input, safe spacing above the existing fixed bottom nav).
- No secrets committed — `OPENROUTER_API_KEY` only in `.env.local`; add
  placeholders (no values) to `.env.example`; never log the key or full
  request bodies containing it.
- Handle LLM/API failure and timeouts gracefully (PRD §25.3): on a
  primary-model failure/timeout/malformed JSON, retry once against the
  fallback model; if both fail, tell the user plainly to use the manual
  "Add expense"/"Add recurring expense" screens — never block or crash the
  page.
- A destructive intent (`delete_transaction`) always requires an explicit
  confirmation turn before the delete actually runs — mirrors the existing
  two-step `DeleteTransactionButton` UX, just via chat.

## Definition of done

- [ ] `npm run typecheck`, `npm run lint`, `npm test` all pass, including new
      unit tests for: intent-envelope validation (valid/invalid shapes),
      duplicate detection (exact dupe / near-miss / distinct), target
      resolution (zero/one/many matches), and the OpenRouter wrapper's
      timeout/fallback behavior (HTTP mocked — no real network calls in tests).
- [ ] Manually tested against the real free-tier OpenRouter primary model
      (5–10 real messages, per PLAN.md §5), covering: a clean "add expense"
      message, one missing the amount (expect a follow-up question), an edit
      ("actually that was 500 not 450"), a delete with confirmation, an
      add-recurring message, and one deliberately garbage/ambiguous message
      (expect a graceful "I didn't understand" reply, not a crash).
- [ ] A transaction/recurring expense created via chat appears correctly on
      `/home` and `/transactions`/`/recurring`, exactly like a manually
      created one, and is fully editable there.
- [ ] Sending the same "add expense" message twice does not create two rows
      (duplicate check verified).
- [ ] App still works end-to-end with `OPENROUTER_API_KEY` unset or the API
      unreachable — chat shows a clear "AI assistant unavailable, use the
      manual form" message; the rest of the app is unaffected.
- [ ] Verified at a ~375px mobile viewport.
- [ ] `/code-review high` run on the diff (this phase carries
      validation/duplicate/target-resolution logic per PLAN.md §6) and
      findings addressed.
