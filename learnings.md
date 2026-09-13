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

---
---

# Learnings — Phase 1: Auth & Onboarding

*Personal notes, written for a PM (not a developer) trying to understand
what actually happened in this phase and why it matters.*

---

## What was this phase, in one sentence?

We built the front door of the app: an account system (register, log
in, log out), a one-time setup form asking for salary/salary
date/currency, and a profile page to edit those details later — the
first screens a real user will ever see and touch.

---

## The pieces, explained without jargon

- **Registration / Login / Logout** — standard email + password
  accounts, backed by Supabase's built-in auth system (we didn't build
  password hashing, session cookies, etc. ourselves — that's the whole
  point of paying for Supabase).
- **Onboarding form** — a one-time questionnaire right after signup
  (salary, the day of the month it arrives, preferred currency) that
  later phases (the dashboard, the savings forecast) will depend on.
  Optional fields can be skipped and filled in later.
- **Row-Level Security (RLS)** — a database-enforced rule, not just an
  app-code rule, that a user can only ever see/edit their *own* row of
  data. Even if a future bug in our code forgot to filter by user, the
  database itself would refuse to leak someone else's salary.
- **Route protection** (`proxy.ts`) — a gatekeeper that runs before
  every page loads: not logged in → bounced to `/login`; logged in but
  never finished onboarding → bounced to `/onboarding`; otherwise let
  through. This is what makes "you can't skip onboarding by typing a
  different URL" actually true.

---

## A bug automated tests didn't catch — because we hadn't tried the thing a developer actually does every day

Everything — the automated tests, the production build — passed. But
the very next session, simply running the normal "start the app on my
laptop to look at it" command (`npm run dev`) crashed outright. It
turned out the PWA tool (Serwist, from Phase 0) and the exact way
`npm run dev` starts the app were incompatible in a way that neither
tests nor a production build exercised — only that one specific
command did.

**Why this matters as a PM lesson:** "all tests pass" and "an engineer
can actually sit down and open the app" are not the same claim. It's
worth explicitly asking, before calling something done, "has anyone
actually run this the normal way?" — not just "did the robot say yes?"

---

## Failing safe vs. failing loud

While fixing the above, a second, more serious gap surfaced: if our
database connection is ever misconfigured or unreachable, the
gatekeeper (`proxy.ts`) that runs on *every single page* was crashing
the whole site — including pages that don't need a login at all. The
fix makes it fail safe instead: treat the visitor as signed-out and let
public pages keep working, rather than a blank error page for
everyone.

**Why this matters as a PM lesson:** there's a real difference between
"this feature is broken" and "the entire site is down," and a bug in
one shouldn't create the other. When reviewing "what happens if X
fails" for any feature, always ask what it does to pages that have
nothing to do with X.

---

## Not every "it's not working" report is a code bug

While extending this phase, registration/onboarding appeared to stop
completing. The instinct is to assume a new bug was introduced. It
wasn't — the actual cause was that the local `.env.local` file (which
holds the connection details to our Supabase project) simply didn't
exist yet on that machine. The error-handling from the previous fix
already caught this and showed a sensible message; no code was broken.

**Why this matters as a PM lesson:** "the app stopped working" has at
least three very different root causes — a code bug, a
configuration/environment problem, and a genuine service outage — and
they require completely different fixes. Before asking an engineer to
"go find the bug," it's worth confirming the basics (is the account/
connection actually set up on this machine?) are in place.

---

## A third-party system's own hidden rules

Supabase quietly rejects signups using certain email domains it
considers non-deliverable (like the placeholder `example.com`), with
its own internal error code. Our code was treating this the same as
any unexpected failure — a generic "Something went wrong" message —
instead of telling the user their email domain specifically wasn't
accepted.

**Why this matters as a PM lesson:** every third-party service we
depend on (Supabase, the future LLM provider, etc.) has its own
opinions and hidden validation rules we don't control. A generic
catch-all error message is a good safety net, but it can also *hide*
useful, specific information from a real user trying to sign up. Worth
periodically asking: "are we swallowing an error message that would
actually help the user fix their own mistake?"

---

## Architecture evolving as the product actually takes shape

The original plan had one homepage that showed either a login prompt or
a welcome screen depending on whether you were signed in. Once real
screens existed, it became clear a public visitor needs a proper
marketing landing page ("what is this app, sign up here"), which is a
genuinely different thing from the authenticated user's home screen. We
split them: `/` is now public marketing, `/home` is the signed-in
screen.

**Why this matters as a PM lesson:** some structural decisions are hard
to get right from a spec alone — they only become obvious once you can
actually click through the real thing. This is a normal, healthy kind
of scope adjustment, not a sign the original plan was wrong; it's a
reason to expect a small amount of restructuring once early screens
exist, and to budget for it rather than treat it as unplanned rework.

---

## How we knew the phase was actually "done"

- Can a new user register, get steered through onboarding, and reach
  the app? ✅
- Does a wrong password / duplicate email show a clear message instead
  of crashing? ✅
- Is it *impossible* to reach a protected page by typing its URL while
  signed out, or skip onboarding the same way? ✅ (verified directly,
  not just "the button didn't let me")
- Does querying one user's data as a different signed-in user actually
  come back empty (RLS working, not just app code politely not
  asking)? ✅ (checked directly, not just through the app's own UI)
- Do all new screens work on a small phone-sized screen? ✅

**Why this matters as a PM lesson:** for anything involving accounts
and personal data, "does it work when I click around it normally" is
not enough evidence. The RLS check above is a case of deliberately
trying to do the *wrong* thing (see someone else's data) and confirming
it's refused — "done" for security-sensitive features means testing the
attack, not just the happy path.

---

## One-paragraph summary for a stakeholder update

*"Users can now actually create an account, log in, and tell us their
salary and payday so we can build the savings dashboard on top of it
later. Along the way we found and fixed a couple of rough edges — one
place where a broken database connection could have taken down the
entire site instead of just the login page, and a couple of confusing
error messages — the kind of polish that's cheap to fix now and
expensive to fix after real users hit it. Data privacy between
different users' accounts was tested directly, not just assumed. Next
phase: the actual expense-tracking screens."*

---
---

# Learnings — Phase 2: Core Transaction Data + Manual CRUD

*Personal notes, written for a PM (not a developer) trying to understand
what actually happened in this phase and why it matters.*

---

## What was this phase, in one sentence?

We built the app's first real spending data: a place to manually add,
view, edit, and delete an expense/income entry, plus the fixed list of
spending categories (Food & Dining, Groceries, Rent, etc.) — the boring
but essential plumbing every later feature (the dashboard, the AI
assistant) will read from and write to.

---

## The pieces, explained without jargon

- **Manual CRUD** — engineer-speak for "Create, Read, Update, Delete":
  the four basic things you can do to a piece of data. This phase is
  entirely about building that for one thing: a transaction (an
  expense, income, refund, or transfer).
- **Categories table** — a fixed, shared list of 22 spending categories
  stored in the database rather than hardcoded in the app, so it can be
  extended later without a code change.
- **RLS again** — the same per-user database lock from Phase 1, now
  applied to actual money data: a user can only see, edit, or delete
  *their own* transactions, enforced by the database itself.

---

## A deliberate gap between what the database allows and what the form requires

The transaction's category field is optional at the database level, but
required on this phase's manual "add an expense" form. That's not an
oversight — it's intentional. A human filling out a form should always
be able to pick a category. But Phase 5 (later) will have an AI read a
bank text message and try to guess the category automatically, and it
won't always be confident enough to guess correctly — for that case, an
uncategorized transaction needs to be a valid, storable state, not an
error.

**Why this matters as a PM lesson:** the database schema and the form
validation on top of it are allowed to disagree on purpose, when
different ways of creating the same data have different realistic
constraints. This is worth flagging explicitly in review (as it was
here) so it reads as "designed for a known future need," not "we forgot
to require a category."

---

## What a code review catches that passing tests don't

Every automated check (type-checking, linting, the test suite, a full
production build) passed cleanly on the first attempt. A subsequent
`/code-review` pass — a step specifically for catching things tests
don't check — still found five real issues, including:

- A styling rule meant only for the "expense/income/refund/transfer"
  label was accidentally applied to every field on the transaction
  detail screen, including free-text notes and merchant names —
  visually mangling anything the user typed (e.g. turning "called
  support re: refund" into "Called Support Re: Refund"). Nothing
  crashed; the data was stored correctly; it just displayed wrong.
- Two places where a real database error was being silently treated as
  "there's no data" — showing an empty transaction list, or a false
  "page not found," instead of a "something went wrong, please retry"
  message. The underlying rule (see Phase 0/1: "never crash, show a
  friendly message") was followed too literally — not crashing is
  necessary but not sufficient if the friendly fallback actively
  misleads the user about what happened.

Both were fixed the same session, re-verified, and confirmed still
green.

**Why this matters as a PM lesson:** "all tests pass" answers "does the
code do what we told it to do." It does not answer "does it do the
*right* thing in every situation, including ones we didn't think to
write a test for." A dedicated review pass looking for exactly that
kind of gap is not redundant with testing — it's catching a different
category of mistake, and this phase is a concrete example of it finding
real, user-visible problems that a fully green test suite missed.

---

## The recurring "needs a human" step, again

Just like Phase 0 needed someone to actually create the Supabase
account (an AI agent can't do that), this phase needs a human to
actually apply the new database changes (the new tables for categories
and transactions) to the real, live project — that requires a database
password/credential that isn't, and shouldn't be, handed to the coding
agent. The code is written and locally verified as far as it can be
without a live database; someone with access needs to run the migration
and then click through the feature once for real before it's fully
"done."

**Why this matters as a PM lesson:** this is the same category of
blocker as Phase 0's "someone needs to create the account" — a small,
identifiable, one-time human action that shouldn't be treated as the
team being behind schedule. The right response is scheduling it
promptly, not being surprised by it.

---

## How we knew the phase was actually "done" (so far)

- Does the code pass automatic style/type/error checks? ✅
- Do all automated tests pass, including new ones for the money-amount
  parsing and date validation edge cases? ✅
- Does the app still build for production? ✅
- Did a dedicated code-review pass run, and were its findings fixed
  rather than ignored? ✅
- Add → appears in the list → view → edit → delete, tried against a
  real, live database, on a phone-sized screen? ⏳ **pending** — needs
  the human step above first.
- Does a second user account genuinely get refused when trying to view
  or edit the first user's transactions? ⏳ **pending** — same reason.

**Why this matters as a PM lesson:** "done" isn't all-or-nothing — it's
useful to be explicit about which checklist items are fully verified
versus blocked on someone else's action, rather than rounding up to
"done" or down to "not started."

---

## One-paragraph summary for a stakeholder update

*"Users can now record real spending: add an expense or income entry by
hand, see a list of everything they've entered, correct mistakes, and
delete entries — with categories like Groceries or Rent pulled from a
shared, editable list rather than hardcoded. A review pass (separate
from automated testing) caught and fixed a handful of real but
non-obvious issues, including two places where a database hiccup would
have quietly shown the wrong thing to a user instead of a clear "please
retry" message. One step remains before this is fully verified:
applying the database change to our live project, which needs someone
with database access to run — after that, a final click-through check
closes out the phase."*
