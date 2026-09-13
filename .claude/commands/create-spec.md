---
description: Create a spec file and feature branch for the next AI Expense Tracker phase
argument-hint: "Phase number, optionally a name override, e.g. 1  or  1 auth-onboarding"
allowed-tools: Read, Write, Glob, Bash(git:*)
---

You are a senior developer spinning up the next phase of the
AI Expense Tracker. Always follow PRD.md and PLAN.md.

User input: $ARGUMENTS

## Step 1 — Check working directory is clean
Run `git status` and check for uncommitted, unstaged, or
untracked files. If any exist, stop immediately and tell
the user to commit or stash changes before proceeding.
DO NOT CONTINUE until the working directory is clean.

## Step 2 — Parse the arguments
From $ARGUMENTS extract:

1. `phase_number` — zero-padded to 2 digits: 1 → 01, 11 → 11

2. `phase_title` — human readable title in Title Case
   - If $ARGUMENTS only contains a number, look up the phase's
     name from the roadmap table in PLAN.md §3 (e.g. phase 1 →
     "Auth & Onboarding").
   - If $ARGUMENTS also includes a name (for ad-hoc work not
     on the roadmap table), use that instead — Title Case it.
   - Example: "Auth & Onboarding", "Dashboard & Forecasting Math"

3. `phase_slug` — git and file safe slug
   - Lowercase, kebab-case
   - Only a-z, 0-9 and -
   - Maximum 40 characters
   - Example: auth-onboarding, dashboard-forecasting

4. `branch_name` — format: `feature/phase-<phase_number>-<phase_slug>`
   - Example: `feature/phase-01-auth-onboarding`

If you cannot infer these from $ARGUMENTS and PLAN.md, ask the
user to clarify before proceeding.

## Step 3 — Check branch name is not taken
Run `git branch` to list existing branches.
If `branch_name` is already taken, append a number:
`feature/phase-01-auth-onboarding-01`, `-02`, etc.

## Step 4 — Switch to main and pull latest
Run:
```
git checkout main
git pull origin main
```

## Step 5 — Create and switch to the feature branch
Run:
```
git checkout -b <branch_name>
```

## Step 6 — Research the project before writing the spec
Read these before writing anything:
- `PRD.md` — the product spec (find the section numbers relevant
  to this phase, per PLAN.md §3's "PRD sections covered" column)
- `PLAN.md` — the phase roadmap (§3) and phase detail (§4) for
  this specific phase
- All files in `.claude/specs/` — avoid duplicating or
  contradicting an existing spec
- `package.json`, and the app's source directory (e.g. `app/`,
  `components/`, `lib/`) — understand what already exists so the
  spec reflects real current state, not a guess
- Any Supabase schema/migration files present (e.g.
  `supabase/migrations/`) — understand the current data model
  before proposing changes to it

If a spec file for this exact phase number already exists in
`.claude/specs/`, stop and warn the user instead of silently
overwriting it — ask whether to revise the existing spec or
proceed anyway.

## Step 7 — Write the spec
Generate a spec document with this exact structure:

---
# Spec: <phase_title> (Phase <phase_number>)

## Overview
One paragraph describing what this phase delivers and why it
sits at this point in the roadmap (PLAN.md §3/§4). Name the
specific PRD.md section numbers this phase implements.

## Depends on
Which previous phases must already be complete (per PLAN.md §3's
"Depends on" column), and what they provide (data model, auth,
pipeline, etc.) that this phase builds on.

## In scope
The concrete features/behaviors this phase delivers, each tied
to a PRD.md section number.

## Explicitly out of scope
Anything adjacent that PRD.md describes but that belongs to a
later phase (per PLAN.md's roadmap) — state it so it isn't
accidentally built early or forgotten.

## Routes / API surface
Every new Next.js route handler or server action needed:
- `METHOD /api/path` or `Server Action <name>` — description — access level (public/authenticated)

If no new routes: state "No new routes".

## Database changes
Any new Supabase tables, columns, RLS policies, or migrations
needed. Verify against existing migration files before writing
this. If none: state "No database changes".

## Pages / components
- **Create:** new pages/components with their path (e.g. `app/dashboard/page.tsx`)
- **Modify:** existing pages/components and what changes

## Files to change
Every file that will be modified.

## Files to create
Every new file that will be created.

## New dependencies
Any new npm packages, with why a lighter/existing option isn't
enough. If none: state "No new dependencies".

## Rules for implementation
Specific constraints Claude must follow. Always include the
ones relevant to this phase from this list:
- The LLM only ever returns structured data (never writes to the
  database directly) — PRD §20
- All LLM output is validated (e.g. with zod) before it touches
  the database
- All financial calculations (totals, savings, matching) are
  plain application code, never delegated to the LLM
- All Supabase queries are scoped to the authenticated user
  (Row-Level Security enforced, not just assumed)
- Store money as integers in the smallest currency unit (e.g.
  paise), never as floats
- Mobile-first: every new screen must be verified at a ~375px
  viewport
- No secrets or API keys committed — env vars only
- Handle LLM/API failure and timeouts gracefully (fall back to
  "needs manual review", never a hard crash) — PRD §25.3

## Definition of done
A specific testable checklist. Each item must be something that
can be verified by running the app or running a test, and should
map back to PLAN.md §5 (testing) and §6 (code review) for this
phase.
---

## Step 8 — Save the spec
Save to: `.claude/specs/phase-<phase_number>-<phase_slug>.md`

## Step 9 — Report to the user
Print a short summary in this exact format:
```
Branch:    <branch_name>
Spec file: .claude/specs/phase-<phase_number>-<phase_slug>.md
Title:     <phase_title>
```

Then tell the user:
"Review the spec at `.claude/specs/phase-<phase_number>-<phase_slug>.md`
then enter Plan Mode with Shift+Tab twice to begin implementation."

Do not print the full spec in chat unless explicitly asked.
