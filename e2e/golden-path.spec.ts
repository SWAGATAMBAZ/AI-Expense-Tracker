import { test, expect, type Page } from "@playwright/test";
import { e2eUser } from "./support/users";

// PRD §24 golden path on a mobile viewport, against the real Supabase project
// and the real OpenRouter LLM (deliberately unmocked and unthrottled).
test.describe.configure({ mode: "serial" });

const SALARY = 50_000;
const RECURRING = 10_000;
const LUNCH = 500;
const LUNCH_CORRECTED = 600;

function lastDayOfCurrentMonth(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return d.toISOString().slice(0, 10);
}

/** Matches an amount like 39,500 / 39,500.00 regardless of currency symbol/locale grouping. */
function amountPattern(value: number): RegExp {
  const grouped = value.toLocaleString("en-US");
  return new RegExp(`${grouped.replace(/,/g, "[,\\s]?")}(\\.00)?`);
}

const card = (page: Page, label: string) => page.locator(".card", { hasText: label }).first();

async function sendChat(page: Page, text: string) {
  await page.getByLabel("Message").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
}

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  // Assert on rendered content, not page.url(): a sign-in redirect chained
  // through the proxy (this app's renamed middleware.ts) renders the
  // correct destination but doesn't always push the new URL to the address
  // bar - a Next.js App Router quirk with server-action-triggered redirects,
  // not an auth/gating bug (confirmed correct server-side).
  await expect(page.getByText("Welcome back,")).toBeVisible();
}

test("register-free login redirects a fresh user into onboarding, then dashboard", async ({ page }) => {
  const user = e2eUser("a");

  await page.goto("/home");
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();

  // Content, not page.url() - see the comment on the login() helper above.
  await expect(page.getByRole("heading", { name: "Let's set up your finances" })).toBeVisible();
  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Monthly salary").fill(String(SALARY));
  await page.getByLabel("Salary day of month").fill("1");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Welcome back,")).toBeVisible();
  await expect(card(page, "Total savings")).toContainText(amountPattern(SALARY));
});

test("recurring expense shows as upcoming spend and reduces forecast savings", async ({ page }) => {
  const user = e2eUser("a");
  await login(page, user);

  await page.goto("/recurring/new");
  await page.getByLabel("Name").fill("Rent");
  await page.getByLabel("Amount").fill(String(RECURRING));
  await page.getByLabel("Next due date").fill(lastDayOfCurrentMonth());
  await page.getByRole("button", { name: /add|save/i }).last().click();
  // Content, not page.url() - see the comment on the login() helper above.
  await expect(page.getByText("Rent").first()).toBeVisible();

  await page.goto("/home");
  await expect(card(page, "Upcoming spend")).toContainText(amountPattern(RECURRING));
  await expect(card(page, "Total savings")).toContainText(amountPattern(SALARY - RECURRING));
});

test("adding an expense via AI chat updates the dashboard; duplicates are blocked", async ({ page }) => {
  await login(page, e2eUser("a"));

  await page.goto("/ai");
  await sendChat(page, `Spent ${LUNCH} on lunch at Zomato`);
  await expect(page.getByText(/^Added/)).toBeVisible({ timeout: 90_000 });

  await page.goto("/home");
  await expect(card(page, "Total spend")).toContainText(amountPattern(LUNCH));
  await expect(card(page, "Total savings")).toContainText(
    amountPattern(SALARY - RECURRING - LUNCH)
  );

  // PRD §24 #8: the same transaction must never be counted twice.
  await page.goto("/ai");
  await sendChat(page, `Spent ${LUNCH} on lunch at Zomato`);
  await expect(page.getByText(/duplicate/i)).toBeVisible({ timeout: 90_000 });

  await page.goto("/transactions");
  await expect(page.locator("ul li.card")).toHaveCount(1);
});

test("a transaction can be corrected and savings follow", async ({ page }) => {
  await login(page, e2eUser("a"));

  await page.goto("/transactions");
  await page.locator("ul li.card a").first().click();
  // Exact match, not a loose /edit/i substring: the app-wide bottom nav's
  // "Credit cards" link contains "edit" (cr-EDIT-cards) and would otherwise
  // also match, and BottomNav can be present in the DOM before this page's
  // own "Edit" link finishes mounting, making .first() pick the wrong one.
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByLabel("Amount").fill(String(LUNCH_CORRECTED));
  await page.getByRole("button", { name: "Save changes" }).click();
  // Wait for the save to actually land (its server-action fetch is
  // in-flight) before navigating away - an immediate page.goto() can race
  // ahead of (and cancel) that request. Content, not page.url() - see the
  // comment on the login() helper above.
  await expect(page.getByText(amountPattern(LUNCH_CORRECTED))).toBeVisible();

  await page.goto("/home");
  await expect(card(page, "Total spend")).toContainText(amountPattern(LUNCH_CORRECTED));
  await expect(card(page, "Total savings")).toContainText(
    amountPattern(SALARY - RECURRING - LUNCH_CORRECTED)
  );
});

test("deleting the transaction restores savings", async ({ page }) => {
  await login(page, e2eUser("a"));

  await page.goto("/transactions");
  await page.getByRole("button", { name: /delete/i }).first().click();
  await page.getByRole("button", { name: /confirm|yes|delete/i }).last().click();
  await expect(page.locator("ul li.card")).toHaveCount(0);

  await page.goto("/home");
  await expect(card(page, "Total savings")).toContainText(amountPattern(SALARY - RECURRING));
});

const CARD_SPEND = 1200;

test("a credit card transaction shows on the Credit Cards tab and can be marked paid", async ({
  page,
}) => {
  await login(page, e2eUser("a"));

  await page.goto("/transactions/new");
  await page.getByLabel("Merchant").fill("Amazon");
  await page.getByLabel("Amount").fill(String(CARD_SPEND));
  await page.getByLabel("Category").selectOption({ label: "Shopping" });
  await page.getByLabel("Payment method").fill("HDFC Credit Card");
  await page.getByRole("button", { name: /add|save/i }).last().click();
  // Content, not page.url() - see the comment on the login() helper above.
  await expect(page.getByText(amountPattern(CARD_SPEND))).toBeVisible();

  await page.goto("/cards");
  await expect(card(page, "Total credit spend")).toContainText(amountPattern(CARD_SPEND));
  // "HDFC Credit Card" legitimately appears twice (the card tile and the
  // per-transaction tag below it) - just confirm it shows up at all.
  await expect(page.getByText("HDFC Credit Card").first()).toBeVisible();

  await page.getByRole("button", { name: /pay bill/i }).click();
  await expect(page.getByText(/^Paid/)).toBeVisible();
});
