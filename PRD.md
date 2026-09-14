# AI Expense Tracker — Product Specification

## 1. Problem

Most expense-tracking applications require users to manually enter every transaction, select a category, and maintain their records themselves. This creates friction, so users often stop tracking expenses consistently.

The goal of this application is to build an **AI-first expense tracker that automatically captures, understands, categorizes, and records expenses with minimal user effort**.

The app should not only show past spending, but also give users a **forward-looking financial view** by showing upcoming recurring expenses and estimating their expected savings for the month.

The core idea:

> **The user should not have to actively maintain their expense tracker. The application should maintain it for them.**

---

# 2. Solution

Build a mobile-friendly AI expense tracker that:

1. Automatically detects financial transactions from supported sources such as transaction SMS/messages.
2. Uses an LLM to extract transaction information from unstructured messages.
3. Automatically categorizes transactions.
4. Detects duplicates and prevents the same transaction from being recorded twice.
5. Allows users to manually add expenses through an AI chat interface.
6. Allows users to add expenses using voice.
7. Tracks recurring/upcoming expenses such as rent, EMI, subscriptions, gym memberships, etc.
8. Provides a real-time view of:
   - Total spending
   - Spending by category
   - Upcoming spending
   - Estimated savings
   - Payment method distribution
9. Automatically moves an upcoming expense into actual spending once the corresponding transaction is processed.
10. Minimizes manual input while still allowing users to correct AI-generated information.

---

# 3. Primary User Flow

## A. Onboarding

User opens the application.

### Step 1 — Registration/Login
- Register
- Login
- Logout
- Profile

### Step 2 — Initial Financial Setup

Ask the user for important information required for forecasting:

- Monthly salary/income
- Salary date
- Existing recurring expenses
- Preferred currency
- Optional bank/payment information

The user should also be able to skip optional information and configure it later.

---

# 4. Transaction Ingestion

The application should attempt to automatically capture transactions from supported message/SMS sources.

### Example

User receives:

> "INR 450 debited from HDFC Bank account XXXX1234 for UPI transaction at Swiggy."

The system should:

1. Detect that this is a financial transaction.
2. Send the relevant message content to the LLM.
3. Extract structured information:
   - Amount
   - Merchant
   - Transaction type
   - Date/time
   - Payment method
   - Account/card
   - Category
   - Reference information if available
4. Validate the extracted information.
5. Check whether the transaction already exists.
6. If it is a new transaction, create it automatically.
7. Update the dashboard.

The user should not need to manually enter this transaction.

---

# 5. AI Transaction Understanding

The LLM should convert unstructured financial messages into structured transaction data.

Example:

```text
Input:
"₹850 debited from your HDFC Bank card at Zomato"

Output:

Amount: ₹850
Merchant: Zomato
Category: Food & Dining
Payment Method: Credit Card
Transaction Type: Expense
Date: Transaction date
```

The LLM should **not directly modify the database**.

The application should:

> Message → LLM extraction → Validation → Duplicate check → Database

The backend/application logic should remain responsible for financial calculations and database changes.

---

# 6. Transaction Categories

Use a practical category system that covers common personal expenses.

Initial categories may include:

- Food & Dining
- Groceries
- Shopping
- Transportation
- Fuel
- Travel
- Entertainment
- Bills & Utilities
- Rent
- EMI / Loans
- Healthcare
- Education
- Fitness & Gym
- Subscriptions
- Insurance
- Personal Care
- Investments
- Household
- Gifts
- Taxes
- Fees & Charges
- Other

The category system should be extensible.

Users should be able to correct an incorrectly categorized transaction.

---

# 7. Upcoming / Recurring Expenses

Users can define recurring expenses such as:

- Rent
- EMI
- Gym membership
- Netflix/Spotify subscriptions
- Insurance
- Electricity
- Internet
- Phone bill
- SIP/investment
- Other recurring expenses

Each recurring expense should have:

- Name
- Amount
- Frequency
- Expected date
- Category
- Payment method
- Optional account/card
- Active/inactive status

### Important Logic

Upcoming expenses should initially appear under **Upcoming Spend**.

Once the actual transaction is detected:

> Upcoming Expense → Processed Transaction → Total Spend

The same expense must **not be counted twice**.

Example:

```text
Upcoming EMI: ₹20,000

Before transaction:
Upcoming Spend = ₹20,000

EMI transaction detected:
Actual Spend += ₹20,000
Upcoming Spend -= ₹20,000
```

The system should attempt to match the actual transaction with the corresponding recurring expense using information such as:

- Amount
- Merchant
- Category
- Expected date
- Account/payment method

If the system cannot confidently match it, it should avoid automatically assuming that the transactions are the same.

---

# 8. Dashboard

The dashboard is the primary screen.

## Date Filters

Default:

**Current Month**

Available filters:

- Today
- This Week
- This Month
- Last Month
- Previous Months
- Custom Date Range

The user should be able to select a custom start and end date.

---

## Dashboard Metrics

### Total Spend

Show total confirmed expenses for the selected period.

---

### Spending by Category

Show spending across categories.

Example:

```text
Food & Dining      ₹8,500
Shopping           ₹5,200
Transportation     ₹3,100
Entertainment      ₹2,500
Bills              ₹6,000
```

Display this visually as a chart and/or list.

---

### Upcoming Spend

Show expenses expected in the future based on recurring expenses.

Example:

```text
Upcoming Spend

Rent              ₹20,000
EMI               ₹15,000
Gym                ₹1,500
Netflix              ₹649

Total Upcoming:   ₹37,149
```

Only future/unprocessed recurring expenses should be included.

---

# 9. Savings Forecast

The application should provide an estimated savings number.

Basic logic:

```text
Estimated Savings =
Income
− Confirmed Spend
− Remaining Upcoming Spend
```

Example:

```text
Monthly Salary:          ₹60,000
Confirmed Spend:         ₹18,000
Remaining Upcoming:     ₹22,000

Estimated Savings:       ₹20,000
```

### Important Rule

If spending exceeds income:

```text
Estimated Savings = ₹0
```

Do not display negative savings on the primary dashboard.

The application can optionally communicate that the user's projected spending exceeds their income through a warning/insight.

### Refund Netting

Confirmed Spend nets refunds against their matching expense rather than ignoring them — a ₹500 expense that is fully refunded contributes ₹0 to Confirmed Spend for the period (floored at 0 if refunds exceed expenses). This applies to the category breakdown and payment-method mix as well, so they always sum back to the headline Total Spend figure.

---

# 10. Avoid Double Counting in Savings

The forecasting system must distinguish between:

- Already processed transactions
- Upcoming expenses
- Recurring expenses
- Pending transactions

When an upcoming expense is processed, it must stop contributing to the future/upcoming amount.

Example:

```text
Salary: ₹60,000

Upcoming EMI: ₹20,000
Actual spending: ₹10,000

Projected savings:
₹60,000 − ₹10,000 − ₹20,000
= ₹30,000
```

After the EMI is processed:

```text
Actual spending: ₹30,000
Upcoming EMI: ₹0

Projected savings:
₹60,000 − ₹30,000
= ₹30,000
```

The EMI should not be deducted twice.

---

# 11. Payment Method Mix

Show spending based on payment method.

Initial methods:

- UPI
- Credit Card
- Debit Card
- Cash
- Bank Transfer
- Other

Display this using a pie/donut chart.

---

# 12. Transactions

Below the dashboard insights, display the user's transactions.

Each transaction should show:

- Merchant
- Amount
- Category
- Date
- Payment method
- Account/card where applicable
- Transaction type

Users should be able to:

- View
- Edit
- Categorize
- Delete
- Correct transaction information

---

# 13. AI Expense Assistant

An AI action should be available from the dashboard's bottom navigation bar
(center position, alongside Transactions, Add recurring expense, Add expense,
and Account).

When clicked, it opens an AI chat interface.

The user can simply describe an expense naturally.

### Example

User:

> "I spent 500 cash on dinner yesterday."

AI should understand:

```text
Amount: ₹500
Payment Method: Cash
Category: Food & Dining
Transaction Type: Expense
Date: Yesterday
```

The AI should create the transaction after validating the information.

---

# 14. Natural Language Expense Entry

The user should not need to follow a specific format.

Examples:

> "Spent 300 on lunch"

> "Paid 1200 for my gym membership"

> "Yesterday I spent 850 at Zomato using my HDFC credit card"

> "Add ₹500 cash expense for groceries"

The system should infer the relevant fields.

If critical information is missing and cannot reasonably be inferred, the AI should ask a concise follow-up question.

Example:

> "How much did you spend?"

---

# 15. Voice Expense Entry

The AI assistant should support voice input.

Flow:

```text
Voice Input
↓
Speech-to-Text
↓
Expense Understanding
↓
Structured Transaction
↓
Validation
↓
Create Transaction
```

Example:

> "I spent 450 rupees on dinner yesterday using cash."

The system should convert this into a transaction automatically.

---

# 16. Transaction Types

The system should distinguish between different financial events.

At minimum:

### Expense
Money spent by the user.

### Income
Money received by the user, such as salary.

### Refund
Money returned from a previous expense. Nets against Total Spend and the Savings Forecast rather than being ignored (see §9).

### Transfer
Money moved between the user's own accounts.

### Recurring Expense
Expected future expense.

This is important because **not every bank transaction is an expense**.

For example:

> ₹20,000 transferred from HDFC to ICICI

should not increase spending.

---

# 17. Duplicate Detection

The system must prevent duplicate transactions.

The same transaction may appear more than once because:

- The same SMS is received multiple times.
- A message is reprocessed.
- The user manually enters a transaction that was already automatically captured.

The system should compare relevant transaction attributes such as:

- Amount
- Date/time
- Merchant
- Account
- Payment method
- Transaction/reference ID where available

before creating a new transaction.

---

# 18. AI Confidence & Human Correction

AI-generated transactions should have an internal confidence level.

If the information is highly confident:

> Automatically record the transaction.

If important information is uncertain:

> Ask the user for confirmation or clarification.

Users should always be able to edit the AI-generated transaction.

User corrections should take precedence over the original AI prediction.

---

# 19. Important Edge Cases

The system should handle:

### Transaction-related
- Duplicate SMS
- Duplicate manual entry
- Failed transactions
- Pending transactions
- Reversed transactions
- Refunds
- Partial refunds
- Transfers between own accounts
- Cash expenses
- Unknown merchants
- Unknown categories
- Missing transaction amount
- Missing merchant
- Multiple transactions in one message
- Different date formats
- Different currencies

### Recurring expenses
- Recurring expense not processed on expected date
- Amount changes
- Recurring expense cancelled
- Recurring expense skipped for a month
- Actual transaction amount differs from expected amount
- Actual transaction arrives earlier/later than expected
- Same recurring expense being matched to multiple transactions

### AI
- LLM fails
- LLM returns invalid structured data
- LLM is uncertain
- LLM incorrectly categorizes a transaction
- User gives ambiguous natural-language input
- User enters an expense with missing information
- User changes/corrects an AI-generated transaction

### Financial calculations
- Spending greater than salary
- No salary configured
- No transactions yet
- No upcoming expenses
- User changes salary
- User has multiple income sources
- Month changes
- Previous month data must remain unchanged

---

# 20. AI / LLM Requirement

Use a **free or lowest-cost LLM solution through OpenRouter** during development/MVP.

The implementation should:

- Minimize unnecessary LLM calls.
- Use structured output wherever possible.
- Keep prompts small.
- Never rely on the LLM for deterministic financial calculations.
- Never allow the LLM to directly perform unrestricted database operations.
- Validate all LLM outputs before storing them.

The LLM should primarily be responsible for:

- Understanding natural language
- Extracting transaction information
- Categorization
- Understanding user intent
- Conversational interaction

The application/backend should be responsible for:

- Calculations
- Duplicate detection
- Transaction matching
- Savings calculation
- Recurring-expense logic
- Database updates
- Data validation

---

# 21. Message/SMS Transaction Capture

The preferred automated transaction-capture flow is:

```text
Bank / Payment Notification
↓
Message/SMS received
↓
Application detects relevant financial message
↓
Extract message content
↓
LLM parses transaction
↓
Validate structured result
↓
Duplicate detection
↓
Create/update transaction
↓
Update dashboard
```

The system should only process messages that appear to contain financial transactions.

Non-financial messages should be ignored.

The implementation should also consider privacy and permissions carefully, since financial messages contain sensitive information.

The message-reading approach should be treated as an **MVP ingestion mechanism**, while the architecture should remain flexible enough to support additional transaction sources later.

---

# 22. Core Product Principle

The application should optimize for:

> **Zero/Minimal manual expense entry.**

The user should ideally open the application and immediately see:

```text
How much have I spent?
Where did I spend it?
What do I still need to spend?
How much am I likely to save?
Am I on track financially?
```

The application should therefore be more than an expense ledger.

It should function as a **personal financial awareness and forecasting assistant**.

---

# 23. MVP Priority

### P0 — Must Have

- Registration/Login
- Profile
- Salary/income setup
- Transaction storage
- AI transaction extraction
- Automatic categorization
- Duplicate detection
- Manual transaction editing
- Dashboard
- Total spending
- Category spending
- Upcoming expenses
- Savings forecast
- Payment method mix
- Recurring expenses
- AI chat expense entry

### P1 — Important

- AI confidence handling
- Transaction matching with recurring expenses
- Refund handling
- Transfer detection
- Better financial insights
- Custom categories

### P2 — Future / explicitly deferred for this MVP

- **Automatic SMS/message transaction ingestion** — architecture designed
  and documented (§25.1: paste + Android PWA Share Target, reusing the AI
  chat pipeline), but not built for this MVP. Cut so the MVP can focus on
  the AI chat + manual entry ingestion paths, which are fully built.
- **Voice expense entry** — cut entirely from this MVP (not just
  deprioritized), per §25.2. Revisit post-MVP if there's demand.
- More transaction sources
- Advanced financial forecasting
- Budget recommendations
- Spending anomaly detection
- Personalized financial recommendations
- Advanced AI financial assistant
- Multi-account financial aggregation

---

# 24. Success Criteria

The product should succeed if a user can:

1. Set up their income and recurring expenses.
2. Have transactions automatically captured with minimal effort.
3. See accurate categorized spending.
4. See upcoming expenses.
5. See a meaningful projected savings number.
6. Add a cash/manual expense naturally through AI.
7. Correct AI mistakes easily.
8. Never have the same transaction counted twice.
9. Understand their current and projected financial position within a few seconds of opening the dashboard.

The key product metric is:

> **How much manual work does the user have to do to maintain an accurate expense record?**

The ideal experience is that the user **does almost nothing, while the app continuously maintains an accurate financial picture.**

---

# 25. Technical & Platform Constraints (Added for Free / Prototype Deployment)

These notes exist because the product must be **free to run, deployable as a shareable link (not an app-store install), and mobile-first**. That combination changes how a couple of PRD sections can realistically be implemented for the MVP.

## 25.1 SMS Ingestion Reality

Section 4/21 describe automatic capture from bank SMS. In practice:

- **iOS never exposes SMS content to third-party apps** — there is no API for this, at any tier.
- **Android only exposes SMS (RECEIVE_SMS/READ_SMS) to native apps** installed from an APK/Play Store — not to anything running in a browser tab, including an installed PWA.

Since a free, link-shared app is a web app (PWA), true automatic background SMS reading is **not achievable in the MVP**. The designed (not yet built) MVP ingestion mechanism is:

- **Manual forward/paste**: the user pastes or shares the bank SMS/notification text into the app.
- **One-tap simulation via PWA Share Target**: on Android, the app registers as a share target, so the user can hit "Share" on the SMS/notification itself and land directly in the app with the text pre-filled — this is the closest free equivalent to "automatic" capture.
- Everything downstream (LLM parse → validate → duplicate check → store → dashboard update) reuses the AI chat pipeline (Phase 5/6) as-is — no new backend logic, just a new entry point.
- True silent background auto-reading requires a **native Android app** (out of scope for this MVP) using `NotificationListenerService` (reads bank SMS via their system notification — what most real Indian expense apps actually use today, since Play Store policy now restricts the broader `READ_SMS`/`RECEIVE_SMS` permission to apps whose core function is messaging) or the narrower SMS Retriever/User Consent API (OTP-style, not suited to ongoing transaction capture). None of these APIs are reachable from a browser tab/PWA on any OS; on iOS no app, native or not, can read Messages content at all.
- **Status: designed and documented here, not built for this MVP** — cut so the MVP can focus on the AI chat + manual entry paths, which are fully built. Revisit as a dedicated phase if/when this project moves beyond a web-link prototype.

## 25.2 Voice Input Reality

The Web Speech API (browser-native speech-to-text) is free and needs no backend, but is reliably supported on **Android Chrome only** — iOS Safari support is limited or absent. Voice entry would need to be a progressive enhancement (shown only when the browser supports it), not a required path.

**Status: cut entirely from this MVP** (not just deprioritized) — revisit post-MVP if there's demand.

## 25.3 Free-Tier LLM Behavior

Free OpenRouter models can be rate-limited, queued, or occasionally unavailable. The app must treat LLM failure/timeout as a normal case — falling back to "needs manual review/confirmation" — rather than blocking the user or failing the whole ingestion flow.

## 25.4 Data Privacy Baseline

- Passwords are never stored in plain text (handled by the auth provider).
- Raw SMS/message text is only retained as long as needed for parsing/audit and is treated as sensitive (excluded from logs).
- All financial data is scoped per-user (row-level access control), since this is real financial information even in a prototype.

## 25.5 Free-Tier Infrastructure Limits

Free hosting/DB tiers (e.g. cold starts, monthly quotas, sleep after inactivity) are acceptable and expected for a prototype/demo — called out here so it's a known trade-off, not a bug.