import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

/**
 * Map LIAN_E2E_JOURNEY_GROUP (set by the workflow_dispatch input) to a
 * Playwright `grep` regex. "all" / unset runs everything; the role names map
 * to a `@<role>` tag. The fixture validation suite is `@account-fixture`.
 */
function resolveGrep(): RegExp | undefined {
  const group = (process.env.LIAN_E2E_JOURNEY_GROUP ?? "").trim().toLowerCase();
  if (!group || group === "all") return undefined;
  const escaped = group.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`@${escaped}\\b`, "i");
}

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html"], ["github"], ["list"]] : [["list"], ["html", { open: "never" }]],
  grep: resolveGrep(),
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    recordHar: {
      mode: "minimal",
      path: "test-results/journey.har",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
