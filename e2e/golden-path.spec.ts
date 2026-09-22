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
  await expect(page).toHaveURL(/\/home/);
}

test("register-free login redirects a fresh user into onboarding, then dashboard", async ({ page }) => {
  const user = e2eUser("a");

  await page.goto("/home");
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Monthly salary").fill(String(SALARY));
  await page.getByLabel("Salary day of month").fill("1");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/home/);
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
  await expect(page).toHaveURL(/\/recurring$/);
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
  await page.getByRole("link", { name: /edit/i }).first().click();
  await page.getByLabel("Amount").fill(String(LUNCH_CORRECTED));
  await page.getByRole("button", { name: "Save changes" }).click();

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
