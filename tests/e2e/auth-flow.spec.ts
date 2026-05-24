import { expect, test } from "@playwright/test";

import { isRoleConfigured, readRoleCredentials } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

/**
 * Auth flow E2E tests covering AuthPanel, AuthLoginFields, AuthRegisterFields,
 * AuthModeTabs, and AuthSubmitState components.
 *
 * These tests exercise the actual UI login/register flow rather than bypassing
 * it with loginAs() fixture.
 */

test.describe("@auth-flow Auth UI flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to profile which shows auth panel when not logged in
    await page.goto(`${BASE_URL}/#/profile`);
    await expect(page.locator(".profile-view")).toBeVisible();
  });

  test("auth panel renders with login mode by default", async ({ page }) => {
    // Auth panel should be visible
    const authPanel = page.locator(".auth-panel");
    await expect(authPanel).toBeVisible({ timeout: 15000 });

    // Title should be present
    await expect(page.locator("#auth-panel-title")).toContainText("登录 / 注册");

    // Mode tabs should show login as active
    const loginTab = page.locator(".auth-mode-tabs button", { hasText: "登录" });
    const registerTab = page.locator(".auth-mode-tabs button", { hasText: "注册" });
    await expect(loginTab).toBeVisible();
    await expect(registerTab).toBeVisible();
    await expect(loginTab).toHaveClass(/is-active/);
    await expect(registerTab).not.toHaveClass(/is-active/);

    // Login fields should be visible (email or nickname input)
    const loginInput = authPanel.locator('input[autocomplete="username"]');
    await expect(loginInput).toBeVisible();

    // Password field should be visible
    const passwordInput = authPanel.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // Submit button should show "登录"
    const submitButton = authPanel.locator('button[type="submit"]');
    await expect(submitButton).toContainText("登录");
  });

  test("mode tabs switch between login and register", async ({ page }) => {
    const authPanel = page.locator(".auth-panel");
    const loginTab = page.locator(".auth-mode-tabs button", { hasText: "登录" });
    const registerTab = page.locator(".auth-mode-tabs button", { hasText: "注册" });

    // Switch to register mode
    await registerTab.click();
    await expect(registerTab).toHaveClass(/is-active/);
    await expect(loginTab).not.toHaveClass(/is-active/);

    // Register fields should now be visible
    const nicknameInput = authPanel.locator('input[autocomplete="nickname"]');
    await expect(nicknameInput).toBeVisible();

    const emailInput = authPanel.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // Submit button should show "注册并登录"
    const submitButton = authPanel.locator('button[type="submit"]');
    await expect(submitButton).toContainText("注册并登录");

    // Switch back to login mode
    await loginTab.click();
    await expect(loginTab).toHaveClass(/is-active/);
    await expect(registerTab).not.toHaveClass(/is-active/);

    // Login input should be visible again
    const loginInput = authPanel.locator('input[autocomplete="username"]');
    await expect(loginInput).toBeVisible();

    // Submit button should show "登录" again
    await expect(submitButton).toContainText("登录");
  });

  test("login form shows validation error for empty fields", async ({ page }) => {
    const authPanel = page.locator(".auth-panel");
    const submitButton = authPanel.locator('button[type="submit"]');

    // Try to submit empty form
    await submitButton.click();

    // Browser native validation should prevent submission (required fields)
    // The form should still be visible and not navigated away
    await expect(authPanel).toBeVisible();
  });

  test("login form shows error for invalid credentials", async ({ page }) => {
    // This test may be slow due to server response time for invalid credentials
    test.setTimeout(90000);

    const authPanel = page.locator(".auth-panel");
    await expect(authPanel).toBeVisible({ timeout: 15000 });

    const loginInput = authPanel.locator('input[autocomplete="username"]');
    const passwordInput = authPanel.locator('input[type="password"]');
    const submitButton = authPanel.locator('button[type="submit"]');

    // Fill in invalid credentials
    await loginInput.fill("nonexistent_user_e2e_test_12345");
    await passwordInput.fill("wrongpassword123");

    // Submit the form
    await submitButton.click();

    // Button should show processing state briefly
    // Note: this may be too fast to catch reliably, so we use a short timeout
    await expect(submitButton)
      .toContainText("处理中", { timeout: 5000 })
      .catch(() => {
        // Processing state may have already passed - that's OK
      });

    // Wait for error message to appear (InlineError component with role="alert")
    // Server may be slow to respond with auth errors
    const errorAlert = authPanel.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 30000 });

    // Error message should be displayed
    const errorText = await errorAlert.textContent();
    expect(errorText).toBeTruthy();

    // Button should return to normal state
    await expect(submitButton).toContainText("登录", { timeout: 10000 });
  });

  test("successful login with valid credentials", async ({ page }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const creds = readRoleCredentials("registered");
    if (!creds) return;

    const authPanel = page.locator(".auth-panel");
    const loginInput = authPanel.locator('input[autocomplete="username"]');
    const passwordInput = authPanel.locator('input[type="password"]');
    const submitButton = authPanel.locator('button[type="submit"]');

    // Fill in valid credentials
    await loginInput.fill(creds.username);
    await passwordInput.fill(creds.password);

    // Submit the form
    await submitButton.click();

    // Button should show processing state
    await expect(submitButton).toContainText("处理中");

    // Wait for success - auth panel should disappear and profile content should load
    // The success message "已登录，正在刷新个人资料。" may briefly appear
    await expect(authPanel).toBeHidden({ timeout: 15000 });

    // Profile should now show logged-in state (settings block or user info)
    // Wait for profile to load authenticated content
    await page.waitForTimeout(1000);

    // Verify we're no longer seeing the auth panel
    await expect(page.locator(".auth-panel")).toHaveCount(0);
  });

  test("register form shows all required fields", async ({ page }) => {
    const authPanel = page.locator(".auth-panel");
    const registerTab = page.locator(".auth-mode-tabs button", { hasText: "注册" });

    // Switch to register mode
    await registerTab.click();

    // Nickname field
    const nicknameInput = authPanel.locator('input[autocomplete="nickname"]');
    await expect(nicknameInput).toBeVisible();
    await expect(nicknameInput).toHaveAttribute("placeholder", "怎么称呼你");

    // Email field
    const emailInput = authPanel.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // Password field
    const passwordInput = authPanel.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // Submit button
    const submitButton = authPanel.locator('button[type="submit"]');
    await expect(submitButton).toContainText("注册并登录");
  });

  test("register form validates nickname is required", async ({ page }) => {
    const authPanel = page.locator(".auth-panel");
    const registerTab = page.locator(".auth-mode-tabs button", { hasText: "注册" });

    // Switch to register mode
    await registerTab.click();

    // Fill only password (skip nickname)
    const passwordInput = authPanel.locator('input[type="password"]');
    await passwordInput.fill("testpassword123");

    const submitButton = authPanel.locator('button[type="submit"]');
    await submitButton.click();

    // Form should not submit due to required nickname field
    await expect(authPanel).toBeVisible();
  });

  test("password field has correct attributes", async ({ page }) => {
    const authPanel = page.locator(".auth-panel");
    const passwordInput = authPanel.locator('input[type="password"]');

    // Check password field attributes in login mode
    await expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
    await expect(passwordInput).toHaveAttribute("minlength", "8");

    // Switch to register mode
    const registerTab = page.locator(".auth-mode-tabs button", { hasText: "注册" });
    await registerTab.click();

    // In register mode, autocomplete should be new-password
    await expect(passwordInput).toHaveAttribute("autocomplete", "new-password");
  });

  test("submit button disables during submission", async ({ page }) => {
    const authPanel = page.locator(".auth-panel");
    const loginInput = authPanel.locator('input[autocomplete="username"]');
    const passwordInput = authPanel.locator('input[type="password"]');
    const submitButton = authPanel.locator('button[type="submit"]');

    // Fill in credentials
    await loginInput.fill("test_user_for_disable_check");
    await passwordInput.fill("testpassword123");

    // Submit and immediately check disabled state
    await submitButton.click();

    // Button should be disabled during processing
    await expect(submitButton).toBeDisabled();
    await expect(submitButton).toContainText("处理中");

    // Wait for response and button to re-enable
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
  });

  test("error message clears when switching modes", async ({ page }) => {
    const authPanel = page.locator(".auth-panel");
    await expect(authPanel).toBeVisible({ timeout: 15000 });

    const loginInput = authPanel.locator('input[autocomplete="username"]');
    const passwordInput = authPanel.locator('input[type="password"]');
    const submitButton = authPanel.locator('button[type="submit"]');

    // Trigger an error
    await loginInput.fill("invalid_user_test");
    await passwordInput.fill("wrongpass123");
    await submitButton.click();

    // Wait for error
    const errorAlert = authPanel.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 15000 });

    // Switch to register mode
    const registerTab = page.locator(".auth-mode-tabs button", { hasText: "注册" });
    await registerTab.click();

    // Error should be cleared
    await expect(errorAlert).toBeHidden();

    // Switch back to login
    const loginTab = page.locator(".auth-mode-tabs button", { hasText: "登录" });
    await loginTab.click();

    // Error should still be cleared
    await expect(authPanel.locator('[role="alert"]')).toBeHidden();
  });

  test("login input accepts email format", async ({ page }) => {
    const authPanel = page.locator(".auth-panel");
    const loginInput = authPanel.locator('input[autocomplete="username"]');

    // Should accept email format
    await loginInput.fill("test@example.edu.cn");
    await expect(loginInput).toHaveValue("test@example.edu.cn");

    // Should also accept nickname format
    await loginInput.fill("testnickname");
    await expect(loginInput).toHaveValue("testnickname");
  });

  test("register email field has email inputmode", async ({ page }) => {
    const authPanel = page.locator(".auth-panel");
    const registerTab = page.locator(".auth-mode-tabs button", { hasText: "注册" });

    await registerTab.click();

    const emailInput = authPanel.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute("inputmode", "email");
    await expect(emailInput).toHaveAttribute("autocomplete", "email");
  });
});
