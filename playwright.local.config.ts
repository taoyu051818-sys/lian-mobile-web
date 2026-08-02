import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.LIAN_LOCAL_E2E_BASE_URL ?? "http://127.0.0.1:4317";
const parsedBaseURL = new URL(baseURL);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

if (parsedBaseURL.protocol !== "http:" || !LOOPBACK_HOSTS.has(parsedBaseURL.hostname)) {
  throw new Error(
    `Local E2E refuses non-loopback target: ${baseURL}. Use http://127.0.0.1:<port>.`,
  );
}

const port = parsedBaseURL.port || "80";

export default defineConfig({
  testDir: "tests/e2e/local",
  testMatch: "core-journeys.spec.ts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL,
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: `node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...process.env,
      LIAN_BACKEND_BASE_URL: "http://127.0.0.1:4200",
      LIAN_E2E_MODE: "true",
      LIAN_E2E_ENV: "local",
    },
  },
  projects: [
    { name: "chromium-local", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
  ],
});
