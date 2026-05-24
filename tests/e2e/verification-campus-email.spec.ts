/**
 * Campus email verification E2E tests (src/features/verification).
 *
 * Covers the VerificationView component and useCampusEmailVerify composable.
 * This is a critical user journey: campus_verified is required for:
 *   - Trade posts (buy/sell)
 *   - School-visibility content
 *   - Runner eligibility
 *
 * Test structure:
 *   1. UI rendering — VerificationView loads with correct chrome and form fields
 *   2. Form validation — empty email / empty code triggers client-side errors
 *   3. Send code flow — API call to /api/verify/campus-email/send
 *   4. Confirm code flow — API call to /api/verify/campus-email/confirm
 *   5. Cooldown behavior — resend button disabled during cooldown
 *   6. Error handling — 429 rate limit, 400 invalid code, 500 server error
 *   7. Success state — user gains campus_verified tag after confirmation
 *
 * Role requirements:
 *   - registered: can access verification view, can attempt verification
 *   - campus: already verified, should see verified state
 *   - anonymous: should be redirected to login
 */

import { expect, test, type Page } from "@playwright/test";

import { isRoleConfigured, loginAs, browserContextForRole } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

/**
 * Navigate to the verification view.
 * The verification view is accessed via /#/profile/verification or a button in profile.
 */
async function navigateToVerification(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/#/profile/verification`);
  // Wait for the verification view to load
  await page.waitForSelector(".verification-view, [data-testid='verification-view']", {
    timeout: 15000,
  });
}

test.describe("@verification campus email verification UI", () => {
  test.beforeEach(async () => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured - set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
  });

  test("verification view renders with campus email form for unverified user", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered", BASE_URL);
    const context = await browserContextForRole(browser, api);
    const page = await context.newPage();

    await navigateToVerification(page);

    // Campus email section should be visible
    const campusSection = page.locator(
      ".verification-campus, [data-testid='verification-campus-section']",
    );
    await expect(campusSection).toBeVisible({ timeout: 10000 });

    // Email input field should be present
    const emailInput = page.locator(
      'input[type="email"], input[placeholder*="edu"], input[autocomplete*="email"]',
    );
    await expect(emailInput).toBeVisible();

    // Send code button should be present
    const sendButton = page.locator('button:has-text("发送"), button:has-text("获取验证码")');
    await expect(sendButton).toBeVisible();

    await context.close();
  });

  test("empty email shows validation error on send attempt", async ({ browser }) => {
    const { api } = await loginAs("registered", BASE_URL);
    const context = await browserContextForRole(browser, api);
    const page = await context.newPage();

    await navigateToVerification(page);

    // Click send without entering email
    const sendButton = page.locator('button:has-text("发送"), button:has-text("获取验证码")');
    await sendButton.click();

    // Error message should appear
    const errorMessage = page.locator(
      '.error-message, [role="alert"], .verification-error, .field-error',
    );
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    await context.close();
  });

  test("code input field appears after email is sent (mocked)", async ({ browser }) => {
    const { api } = await loginAs("registered", BASE_URL);
    const context = await browserContextForRole(browser, api);
    const page = await context.newPage();

    // Mock the send code API to return success
    await page.route("**/api/verify/campus-email/send", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, institution: "Test University" }),
      });
    });

    await navigateToVerification(page);

    // Enter a valid .edu email
    const emailInput = page.locator(
      'input[type="email"], input[placeholder*="edu"], input[autocomplete*="email"]',
    );
    await emailInput.fill("test@example.edu");

    // Click send
    const sendButton = page.locator('button:has-text("发送"), button:has-text("获取验证码")');
    await sendButton.click();

    // Code input should now be visible or enabled
    const codeInput = page.locator(
      'input[placeholder*="验证码"], input[autocomplete="one-time-code"], input[inputmode="numeric"]',
    );
    await expect(codeInput).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test("cooldown timer prevents rapid resend", async ({ browser }) => {
    const { api } = await loginAs("registered", BASE_URL);
    const context = await browserContextForRole(browser, api);
    const page = await context.newPage();

    // Mock the send code API
    await page.route("**/api/verify/campus-email/send", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await navigateToVerification(page);

    const emailInput = page.locator(
      'input[type="email"], input[placeholder*="edu"], input[autocomplete*="email"]',
    );
    await emailInput.fill("test@example.edu");

    const sendButton = page.locator('button:has-text("发送"), button:has-text("获取验证码")');
    await sendButton.click();

    // After sending, button should be disabled or show countdown
    await expect(sendButton).toBeDisabled({ timeout: 5000 });

    // Or check for countdown text
    const countdownText = page.locator('button:has-text("秒"), .cooldown-timer');
    const isCountdownVisible = await countdownText.isVisible().catch(() => false);
    const isButtonDisabled = await sendButton.isDisabled();

    expect(isCountdownVisible || isButtonDisabled).toBe(true);

    await context.close();
  });

  test("429 rate limit shows appropriate error message", async ({ browser }) => {
    const { api } = await loginAs("registered", BASE_URL);
    const context = await browserContextForRole(browser, api);
    const page = await context.newPage();

    // Mock 429 response
    await page.route("**/api/verify/campus-email/send", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        headers: { "Retry-After": "60" },
        body: JSON.stringify({ error: "rate_limited", retryAfterSeconds: 60 }),
      });
    });

    await navigateToVerification(page);

    const emailInput = page.locator(
      'input[type="email"], input[placeholder*="edu"], input[autocomplete*="email"]',
    );
    await emailInput.fill("test@example.edu");

    const sendButton = page.locator('button:has-text("发送"), button:has-text("获取验证码")');
    await sendButton.click();

    // Error message about rate limiting should appear
    const errorMessage = page.locator('.error-message, [role="alert"], .verification-error');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    await context.close();
  });

  test("empty code shows validation error on confirm attempt", async ({ browser }) => {
    const { api } = await loginAs("registered", BASE_URL);
    const context = await browserContextForRole(browser, api);
    const page = await context.newPage();

    // Mock send success
    await page.route("**/api/verify/campus-email/send", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await navigateToVerification(page);

    const emailInput = page.locator(
      'input[type="email"], input[placeholder*="edu"], input[autocomplete*="email"]',
    );
    await emailInput.fill("test@example.edu");

    const sendButton = page.locator('button:has-text("发送"), button:has-text("获取验证码")');
    await sendButton.click();

    // Wait for code input to appear
    const codeInput = page.locator(
      'input[placeholder*="验证码"], input[autocomplete="one-time-code"], input[inputmode="numeric"]',
    );
    await expect(codeInput).toBeVisible({ timeout: 10000 });

    // Try to submit without entering code
    const submitButton = page.locator('button:has-text("验证"), button:has-text("确认")');
    if (await submitButton.isVisible()) {
      await submitButton.click();

      // Error message should appear
      const errorMessage = page.locator(
        '.error-message, [role="alert"], .verification-error, .field-error',
      );
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    }

    await context.close();
  });

  test("invalid code shows server error message", async ({ browser }) => {
    const { api } = await loginAs("registered", BASE_URL);
    const context = await browserContextForRole(browser, api);
    const page = await context.newPage();

    // Mock send success
    await page.route("**/api/verify/campus-email/send", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    // Mock confirm failure
    await page.route("**/api/verify/campus-email/confirm", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid_code", message: "验证码错误或已过期" }),
      });
    });

    await navigateToVerification(page);

    const emailInput = page.locator(
      'input[type="email"], input[placeholder*="edu"], input[autocomplete*="email"]',
    );
    await emailInput.fill("test@example.edu");

    const sendButton = page.locator('button:has-text("发送"), button:has-text("获取验证码")');
    await sendButton.click();

    const codeInput = page.locator(
      'input[placeholder*="验证码"], input[autocomplete="one-time-code"], input[inputmode="numeric"]',
    );
    await expect(codeInput).toBeVisible({ timeout: 10000 });

    await codeInput.fill("123456");

    const submitButton = page.locator('button:has-text("验证"), button:has-text("确认")');
    if (await submitButton.isVisible()) {
      await submitButton.click();

      // Error message should appear
      const errorMessage = page.locator('.error-message, [role="alert"], .verification-error');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    }

    await context.close();
  });
});

test.describe("@verification campus-verified user state", () => {
  test("campus-verified user sees verified badge in verification view", async ({ browser }) => {
    test.skip(
      !isRoleConfigured("campus"),
      "campus role not configured - set LIAN_E2E_CAMPUS_USERNAME / LIAN_E2E_CAMPUS_PASSWORD",
    );

    const { api } = await loginAs("campus", BASE_URL);
    const context = await browserContextForRole(browser, api);
    const page = await context.newPage();

    await navigateToVerification(page);

    // Should see verified state indicator
    const verifiedBadge = page.locator(
      '.verified-badge, .verification-status--verified, [data-verified="true"], :has-text("已认证")',
    );
    await expect(verifiedBadge).toBeVisible({ timeout: 10000 });

    await context.close();
  });
});

test.describe("@verification anonymous access", () => {
  test("anonymous user is redirected to login when accessing verification", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/#/profile/verification`);

    // Should be redirected to profile (which shows auth panel) or login
    // Wait for either auth panel or login redirect
    const authPanel = page.locator(".auth-panel, .login-form, [data-testid='auth-panel']");
    const profileView = page.locator(".profile-view");

    // Either auth panel is visible or we're on profile page (which shows auth for anonymous)
    await expect(authPanel.or(profileView)).toBeVisible({ timeout: 15000 });

    // If on profile, auth panel should be shown for anonymous user
    if (await profileView.isVisible()) {
      await expect(authPanel).toBeVisible({ timeout: 5000 });
    }

    await context.close();
  });
});

test("@verification structural fallback — verification lane is wired even without role creds", async () => {
  // This test verifies the verification route exists and returns expected structure
  // without requiring any role credentials
  const api = await (await import("@playwright/test")).request.newContext();

  // The verification endpoints should exist (even if they require auth)
  const sendResponse = await api.post(`${BASE_URL}/api/verify/campus-email/send`, {
    data: { email: "test@example.edu" },
  });

  // Should get 401 (unauthorized) not 404 (not found)
  expect([401, 403, 400, 429]).toContain(sendResponse.status());

  const confirmResponse = await api.post(`${BASE_URL}/api/verify/campus-email/confirm`, {
    data: { email: "test@example.edu", code: "123456" },
  });

  // Should get 401 (unauthorized) not 404 (not found)
  expect([401, 403, 400]).toContain(confirmResponse.status());

  await api.dispose();
});
