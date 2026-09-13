# Learnings — Phase 0: Project Setup

*Personal notes, written for a PM (not a developer) trying to understand
what actually happened in this phase and why it matters.*

---

## What was this phase, in one sentence?

Before writing a single "real" feature (login, expense tracking,
dashboards), we built the empty container the app will live in — the
folders, tools, and safety nets — so every future phase has solid ground
to build on instead of starting from nothing each time.

Think of it like building the foundation and utility hookups (water,
electricity) of a house before deciding what color to paint the walls.
You can't skip it, and skimping on it now creates expensive problems
later.

---

## The pieces, explained without jargon

- **Next.js** — the actual "engine" the website/app runs on. This is the
  single biggest technical decision already made (in `PLAN.md`, before
  this phase); Phase 0 just installed it and got it running.
- **Tailwind CSS** — a toolkit for styling things (colors, spacing,
  layout) quickly without writing custom design code for every button.
- **Supabase** — a hosted database + login system, so we don't have to
  build "sign up / log in / store data securely" from scratch. It's a
  paid product with a generous free tier.
- **PWA (Progressive Web App) / Service Worker** — the plumbing that
  lets a website act a bit like a real app: installable on a phone's
  home screen, works when offline-ish. We only built the plumbing this
  phase — no real "install this app" prompt shows up yet, that comes
  later.
- **CI (Continuous Integration)** — an automatic robot that checks every
  change we push to GitHub for basic mistakes (typos in code, broken
  formatting, broken tests) *before* it can cause a problem. Think of it
  as a spell-checker that runs itself.
- **Tests (Vitest / Playwright)** — small scripts that check "does this
  still work the way it's supposed to?" automatically, instead of a
  human manually clicking through the app every time something changes.

None of these produce a feature a user can see yet. That's expected and
by design — this phase is infrastructure only.

---

## Decisions I had to adapt on the fly (and why this matters for a PM)

The written spec named a specific tool (`next-pwa`) for the PWA piece.
While building, it turned out that tool is effectively abandoned and
silently fails to work with the current version of Next.js — it would
have looked like it worked (no error message) but produced nothing
useful. I swapped it for an actively maintained alternative (`Serwist`)
that does the same job.

**Why this matters as a PM lesson:** specs go stale. The moment you write
"use library X," you've frozen a decision to a snapshot in time. Software
tools update constantly, some die, some get replaced. A good spec should
describe the *outcome* you want ("the app should be installable on a
phone") more than the *exact tool*, and a good team calls out clearly when
they deviate and why — which is what happened here, documented directly
in the code's spec file rather than silently done.

Similarly, the styling tool (Tailwind) changed its whole configuration
approach in its newest version — an entire file type (`tailwind.config.ts`)
that used to be required doesn't exist anymore. Following the spec's
literal file list would have meant creating a pointless empty file. I
skipped it and noted why.

**Takeaway:** "follow the spec" and "follow the intent of the spec" are
not always the same thing. Good execution means knowing when reality has
moved past the written plan, and being explicit about it instead of
either blindly complying or silently going rogue.

---

## A security issue I caught (and why "0 vulnerabilities" is a real number to track)

When installing the PWA tool, it pulled in a dependency (a
piece-of-someone-else's-code that our code depends on) with a known
security flaw — nothing exploitable in an obvious way yet, but a real,
published vulnerability. I forced it to use a safer version instead.

**Why this matters as a PM lesson:** modern software is built like a
tower of blocks — your code depends on other people's code, which
depends on more people's code, and so on, often dozens of layers deep.
You don't choose most of these dependencies directly; they come bundled
in. Tools like `npm audit` (what caught this) scan that whole tower for
known problems. "0 vulnerabilities" isn't a vanity metric — it's a real,
checkable number, and it's worth asking your engineering team to report
it periodically, especially before a real launch.

---

## The one thing that *needed* a human (me), not the AI

Everything in this phase was automatable except one step: actually
creating a Supabase account and project. That requires a real email
login through a browser — no AI agent can do that on your behalf.

**Why this matters as a PM lesson:** even in a highly automated
workflow, there are usually a small number of "human-in-the-loop" steps —
things that need an actual account, a business decision, a legal
signature, a credit card, etc. Good planning identifies these early and
clearly, so they don't become last-minute blockers. Here, the rest of
the work was structured so it *didn't* wait on me to do that — everything
else could be finished and verified independently.

---

## Why bother with CI and tests this early, when there's no feature yet?

It would have been faster to skip testing/CI setup and just start
building login and expense-tracking screens immediately. We didn't,
on purpose.

**Why this matters as a PM lesson:** the cost of adding "safety net"
infrastructure (automated checks, tests) goes up the longer you wait.
Adding it to an empty project takes an afternoon. Retrofitting it onto a
project with 10 half-finished features and no tests is a multi-week,
high-risk project of its own — and by then, bugs have already shipped
that the safety net would have caught for free. This is a common
trade-off request you'll get from engineers ("let us set up
infrastructure first") — Phase 0 is a concrete example of why that ask
is usually worth granting.

---

## How we knew the phase was actually "done"

Not by feeling — by a checklist written *before* the work started (in
the spec document), each item independently verifiable:
- Does the code pass automatic style/error checks? ✅
- Do the automated tests pass? ✅
- Does the app actually build and start? ✅
- Does the "installable app" plumbing (manifest, icons, service worker)
  actually load correctly? ✅ (checked manually)
- Did the automatic checker robot (CI) confirm all of this on GitHub,
  independent of my local machine? ✅

**Why this matters as a PM lesson:** "done" should be defined *before*
work starts, as a specific, checkable list — not decided afterward by
gut feeling. This is the same idea as acceptance criteria on a user
story, just applied to infrastructure work instead of a feature.

---

## One-paragraph summary for a stakeholder update

*"We finished the technical groundwork for the AI Expense Tracker — the
app now runs, is connected to our database provider, has the basic
plumbing to be installed like a phone app, and every future code change
will be automatically checked for errors before it can break anything.
No user-facing features yet — that starts next phase (login and
onboarding) — but the foundation is solid, tested, and pushed to GitHub.
One small action item is on me: creating our Supabase (database)
account, which takes about five minutes."*
