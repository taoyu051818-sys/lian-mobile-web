import { expect, request, test } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

/**
 * forum-gate E2E tests
 *
 * Tests the access control proxy deployed at nat100 (/opt/forum_gate/server.js).
 * Protected paths: /ops.html, /api/ops/*, /api/admin/*, /api/internal/*, /api/setup
 *
 * Authentication flow:
 * 1. Access protected path without cookie -> redirect to /gate-login
 * 2. POST correct passphrase -> set forum_gate_ok=1 cookie, redirect to /
 * 3. Access protected path with cookie -> proxy through
 *
 * Note: The passphrase is stored in GATE_ANSWER env var on the server.
 * For E2E tests, we use LIAN_E2E_GATE_ANSWER env var to provide it.
 */

const _PROTECTED_PATHS = [
  "/ops.html",
  "/api/ops/health",
  "/api/admin/me",
  "/api/internal/ping",
  "/api/setup",
];

const _UNPROTECTED_PATHS = ["/", "/api/feed", "/#/profile"];

function getGateAnswer(): string | null {
  return process.env.LIAN_E2E_GATE_ANSWER ?? null;
}

function isGateAnswerConfigured(): boolean {
  return getGateAnswer() !== null;
}

test.describe("@forum-gate forum-gate access control proxy", () => {
  test.describe("unauthenticated access", () => {
    test("protected path /ops.html redirects to /gate-login", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/ops.html`, {
        waitUntil: "domcontentloaded",
      });

      // Should redirect to /gate-login
      expect(page.url()).toContain("/gate-login");

      // Should show the login form with input field
      await expect(page.locator("form")).toBeVisible();
      await expect(page.locator('input[name="answer"]')).toBeVisible();

      await context.close();
    });

    test("protected path /api/admin/* redirects to /gate-login", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/api/admin/me`, {
        waitUntil: "domcontentloaded",
      });

      // Should redirect to /gate-login
      expect(page.url()).toContain("/gate-login");

      await context.close();
    });

    test("protected path /api/ops/* redirects to /gate-login", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/api/ops/health`, {
        waitUntil: "domcontentloaded",
      });

      // Should redirect to /gate-login
      expect(page.url()).toContain("/gate-login");

      await context.close();
    });

    test("protected path /api/internal/* redirects to /gate-login", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/api/internal/ping`, {
        waitUntil: "domcontentloaded",
      });

      // Should redirect to /gate-login
      expect(page.url()).toContain("/gate-login");

      await context.close();
    });

    test("protected path /api/setup redirects to /gate-login", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/api/setup`, {
        waitUntil: "domcontentloaded",
      });

      // Should redirect to /gate-login
      expect(page.url()).toContain("/gate-login");

      await context.close();
    });
  });

  test.describe("unprotected paths", () => {
    test("root path / is not intercepted", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/`, {
        waitUntil: "domcontentloaded",
      });

      // Should NOT redirect to /gate-login
      expect(page.url()).not.toContain("/gate-login");

      // Should show the feed view (main app)
      await expect(page.locator(".feed-view")).toBeVisible({ timeout: 15000 });

      await context.close();
    });

    test("public API /api/feed is not intercepted", async () => {
      const api = await request.newContext({ baseURL: BASE_URL });

      const response = await api.get("/api/feed?tab=%E6%AD%A4%E5%88%BB&page=1&limit=5");

      // Should return 200, not redirect
      expect(response.ok(), `expected 200, got ${response.status()}`).toBe(true);

      const body = await response.json();
      expect(body).toHaveProperty("items");

      await api.dispose();
    });

    test("hash route /#/profile is not intercepted", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/#/profile`, {
        waitUntil: "domcontentloaded",
      });

      // Should NOT redirect to /gate-login
      expect(page.url()).not.toContain("/gate-login");

      // Should show the profile view
      await expect(page.locator(".profile-view")).toBeVisible({ timeout: 15000 });

      await context.close();
    });
  });

  test.describe("authentication flow", () => {
    test("wrong passphrase shows error message", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Navigate to gate-login directly
      await page.goto(`${BASE_URL}/gate-login`, {
        waitUntil: "domcontentloaded",
      });

      // Fill in wrong passphrase
      const answerInput = page.locator('input[name="answer"]');
      await expect(answerInput).toBeVisible();
      await answerInput.fill("wrong_passphrase_12345");

      // Submit the form by pressing Enter or using form submit
      await answerInput.press("Enter");

      // Should show error message (Chinese: "口令错误")
      await expect(page.getByText("口令错误")).toBeVisible({ timeout: 5000 });

      // Should still be on gate-login page
      expect(page.url()).toContain("/gate-login");

      await context.close();
    });

    test("correct passphrase sets cookie and redirects", async ({ browser }) => {
      test.skip(
        !isGateAnswerConfigured(),
        "gate answer not configured — set LIAN_E2E_GATE_ANSWER to enable",
      );

      const context = await browser.newContext();
      const page = await context.newPage();

      // Navigate to gate-login
      await page.goto(`${BASE_URL}/gate-login`, {
        waitUntil: "domcontentloaded",
      });

      // Fill in correct passphrase
      const answerInput = page.locator('input[name="answer"]');
      await expect(answerInput).toBeVisible();
      await answerInput.fill(getGateAnswer()!);

      // Submit the form by pressing Enter
      await answerInput.press("Enter");

      // Should redirect away from gate-login (typically to /)
      await page.waitForURL((url) => !url.pathname.includes("/gate-login"), { timeout: 10000 });

      // Verify cookie is set
      const cookies = await context.cookies();
      const gateCookie = cookies.find((c) => c.name === "forum_gate_ok");
      expect(gateCookie, "forum_gate_ok cookie should be set").toBeTruthy();
      expect(gateCookie!.value).toBe("1");

      await context.close();
    });

    test("authenticated user can access protected path /ops.html", async ({ browser }) => {
      test.skip(
        !isGateAnswerConfigured(),
        "gate answer not configured — set LIAN_E2E_GATE_ANSWER to enable",
      );

      const context = await browser.newContext();
      const page = await context.newPage();

      // First authenticate via gate-login
      await page.goto(`${BASE_URL}/gate-login`, {
        waitUntil: "domcontentloaded",
      });

      const answerInput = page.locator('input[name="answer"]');
      await answerInput.fill(getGateAnswer()!);
      await answerInput.press("Enter");

      // Wait for redirect
      await page.waitForURL((url) => !url.pathname.includes("/gate-login"), { timeout: 10000 });

      // Now try to access protected path
      await page.goto(`${BASE_URL}/ops.html`, {
        waitUntil: "domcontentloaded",
      });

      // Should NOT redirect to gate-login
      expect(page.url()).not.toContain("/gate-login");

      // Should be on ops.html (or proxied content)
      expect(page.url()).toContain("/ops.html");

      await context.close();
    });

    test("authenticated API request to /api/admin/me passes through gate", async ({ browser }) => {
      test.skip(
        !isGateAnswerConfigured(),
        "gate answer not configured — set LIAN_E2E_GATE_ANSWER to enable",
      );

      const context = await browser.newContext();
      const page = await context.newPage();

      // First authenticate via gate-login
      await page.goto(`${BASE_URL}/gate-login`, {
        waitUntil: "domcontentloaded",
      });

      const answerInput = page.locator('input[name="answer"]');
      await answerInput.fill(getGateAnswer()!);
      await answerInput.press("Enter");

      // Wait for redirect
      await page.waitForURL((url) => !url.pathname.includes("/gate-login"), { timeout: 10000 });

      // Get cookies from browser context
      const cookies = await context.cookies();

      // Create API context with the gate cookie
      const api = await request.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: {
          Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
        },
      });

      // Request /api/admin/me - should pass through gate (may still return 401/403 from backend if not admin)
      const response = await api.get("/api/admin/me");

      // The key assertion: we should NOT get a redirect to gate-login
      // We expect either 200 (if admin), 401/403 (if not admin), but NOT a redirect
      expect(
        response.status() !== 302 && response.status() !== 301,
        `expected non-redirect status, got ${response.status()}`,
      ).toBe(true);

      // If we got HTML containing "gate-login", the gate intercepted us
      const contentType = response.headers()["content-type"] || "";
      if (contentType.includes("text/html")) {
        const body = await response.text();
        expect(body).not.toContain("gate-login");
      }

      await api.dispose();
      await context.close();
    });
  });

  test.describe("cookie-based authentication via API", () => {
    test("API request with forum_gate_ok=1 cookie bypasses gate", async () => {
      test.skip(
        !isGateAnswerConfigured(),
        "gate answer not configured — set LIAN_E2E_GATE_ANSWER to enable",
      );

      // First, authenticate to get the cookie
      const authApi = await request.newContext({ baseURL: BASE_URL });

      // POST to gate-login to authenticate
      const authResponse = await authApi.post("/gate-login", {
        form: {
          answer: getGateAnswer()!,
        },
      });

      // Get cookies from the response
      const setCookieHeader = authResponse.headers()["set-cookie"];
      expect(setCookieHeader, "should receive set-cookie header").toBeTruthy();

      await authApi.dispose();

      // Create new API context with the gate cookie
      const api = await request.newContext({
        baseURL: BASE_URL,
        extraHTTPHeaders: {
          Cookie: "forum_gate_ok=1",
        },
      });

      // Request a protected path
      const response = await api.get("/api/ops/health");

      // Should not redirect to gate-login
      const contentType = response.headers()["content-type"] || "";
      if (contentType.includes("text/html")) {
        const body = await response.text();
        expect(body).not.toContain("gate-login");
      }

      await api.dispose();
    });

    test("API request without cookie to protected path gets redirected", async ({ browser }) => {
      // Use browser context to observe the redirect behavior
      const context = await browser.newContext();
      const page = await context.newPage();

      // Navigate to protected path without cookie
      await page.goto(`${BASE_URL}/ops.html`, {
        waitUntil: "domcontentloaded",
      });

      // Should have been redirected to gate-login
      expect(page.url()).toContain("/gate-login");

      await context.close();
    });
  });
});
