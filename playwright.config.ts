import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // One shared user per suite, and tests within a file build on each other.
  workers: 1,
  fullyParallel: false,
  // No retries: golden-path.spec.ts is a stateful serial sequence sharing
  // one demo user across tests, so a whole-file retry would replay steps
  // against an already-mutated user (e.g. already onboarded) instead of a
  // clean slate. Per-assertion timeouts below already absorb real LLM
  // slowness; chat sends get an even longer explicit timeout.
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "Mobile Chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
