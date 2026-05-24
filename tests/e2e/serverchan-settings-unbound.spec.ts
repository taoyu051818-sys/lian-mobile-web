/**
 * Server酱 (外部通知) settings — unbound state E2E.
 *
 * Covers the profile settings panel when the user has NOT yet bound a
 * Server酱 SendKey. Hermetic: stubs /api/auth/me +
 * /api/notifications/serverchan/* so it runs without any live Server酱
 * wiring on the target environment.
 *
 * Component under test: src/features/profile/ProfileServerChanBlock.vue
 *
 * @tag @serverchan
 */

import { expect, test, type Page } from "@playwright/test";

const PROFILE_PATH = "/#/profile";

interface StubOptions {
  /** Override the GET /binding response. Default = clean unbound payload. */
  binding?: { bound: boolean; enabled: boolean };
  /** Override the POST /binding response. Default = 400 BINDING_KEY_INVALID. */
  bindResponse?: { status: number; body: Record<string, unknown> };
  /** When true, the initial GET /binding fails so the load-error path is observable. */
  loadFails?: boolean;
}

async function stubProfileEndpoints(page: Page, options: StubOptions = {}) {
  // Authenticated user — ProfileView gates the Server酱 block on
  // `Boolean(user)`, so the unbound UI does not render for guests.
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: {
        user: {
          id: "u-serverchan-test",
          username: "tester",
          displayName: "测试同学",
          avatarText: "测",
          identityTags: [],
          aliases: [],
        },
      },
    });
  });

  // Quiet down the rest of the profile page so it doesn't fight the spec.
  await page.route(/\/api\/profile\/(posts|likes|saves|stats)/, async (route) => {
    await route.fulfill({ json: { items: [], hasMore: false } });
  });
  await page.route("**/api/feed**", async (route) => {
    await route.fulfill({
      json: { tabs: [], items: [], hasMore: false, nextPage: null },
    });
  });

  await page.route("**/api/notifications/serverchan/binding", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      if (options.loadFails) {
        await route.fulfill({
          status: 500,
          json: { error: "boom", code: "INTERNAL_ERROR" },
        });
        return;
      }
      await route.fulfill({
        json: options.binding ?? { bound: false, enabled: false },
      });
      return;
    }
    if (method === "POST") {
      const r = options.bindResponse ?? {
        status: 400,
        body: { error: "invalid sendkey", code: "BINDING_KEY_INVALID" },
      };
      await route.fulfill({ status: r.status, json: r.body });
      return;
    }
    if (method === "DELETE") {
      await route.fulfill({ json: { ok: true } });
      return;
    }
    await route.fallback();
  });

  // bind-url GET — the primary "绑定" button calls this before window.open.
  await page.route("**/api/notifications/serverchan/bind-url", async (route) => {
    await route.fulfill({ json: { url: "https://sct.ftqq.com/" } });
  });

  // Preferences should not be hit while unbound, but if something does
  // probe it the response stays valid so the spec stays focused.
  await page.route("**/api/notifications/serverchan/preferences", async (route) => {
    await route.fulfill({
      json: { eventStartingReminder: false, rewardSettledReminder: false },
    });
  });
}

test.describe("@serverchan unbound state — Server酱 not configured", () => {
  test("settings block renders with 未绑定 label", async ({ page }) => {
    await stubProfileEndpoints(page);
    await page.goto(PROFILE_PATH);

    const block = page.locator('[data-testid="serverchan-settings-block"]');
    await expect(block).toBeVisible();

    const stateLabel = block.locator('[data-testid="serverchan-state-label"]');
    await expect(stateLabel).toHaveText("未绑定");
    await expect(stateLabel).toHaveAttribute("data-state", "unbound");

    await expect(block.locator('[data-testid="serverchan-helper"]')).toBeVisible();
  });

  test("primary 绑定 button is enabled and visible", async ({ page }) => {
    await stubProfileEndpoints(page);
    await page.goto(PROFILE_PATH);

    const bindBtn = page.locator('[data-testid="serverchan-bind-button"]');
    await expect(bindBtn).toBeVisible();
    await expect(bindBtn).toBeEnabled();
    await expect(bindBtn).toContainText("绑定");
  });

  test("manual SendKey form is hidden until the open button is clicked", async ({ page }) => {
    await stubProfileEndpoints(page);
    await page.goto(PROFILE_PATH);

    await expect(page.locator('[data-testid="serverchan-manual-form"]')).toHaveCount(0);

    await page.locator('[data-testid="serverchan-manual-open"]').click();
    const form = page.locator('[data-testid="serverchan-manual-form"]');
    await expect(form).toBeVisible();
    await expect(form.locator('[data-testid="serverchan-manual-input"]')).toBeVisible();
    await expect(form.locator('[data-testid="serverchan-manual-submit"]')).toBeVisible();
  });

  test("manual cancel closes the form and clears the input", async ({ page }) => {
    await stubProfileEndpoints(page);
    await page.goto(PROFILE_PATH);

    await page.locator('[data-testid="serverchan-manual-open"]').click();
    const input = page.locator('[data-testid="serverchan-manual-input"]');
    await input.fill("SCT-test-1234");
    await expect(input).toHaveValue("SCT-test-1234");

    await page.locator('[data-testid="serverchan-manual-cancel"]').click();
    await expect(page.locator('[data-testid="serverchan-manual-form"]')).toHaveCount(0);

    // Re-opening must not recover the typed value.
    await page.locator('[data-testid="serverchan-manual-open"]').click();
    await expect(page.locator('[data-testid="serverchan-manual-input"]')).toHaveValue("");
  });

  test("submitting an empty SendKey shows the format-invalid error inline", async ({ page }) => {
    await stubProfileEndpoints(page);
    await page.goto(PROFILE_PATH);

    await page.locator('[data-testid="serverchan-manual-open"]').click();
    await page.locator('[data-testid="serverchan-manual-submit"]').click();

    const error = page.locator('[data-testid="serverchan-submit-error"]');
    await expect(error).toBeVisible();
    await expect(error).toContainText("格式不正确");
  });

  test("backend BINDING_KEY_INVALID surfaces the same brand-string error", async ({ page }) => {
    await stubProfileEndpoints(page, {
      bindResponse: {
        status: 400,
        body: { error: "invalid", code: "BINDING_KEY_INVALID" },
      },
    });
    await page.goto(PROFILE_PATH);

    await page.locator('[data-testid="serverchan-manual-open"]').click();
    await page.locator('[data-testid="serverchan-manual-input"]').fill("malformed-key");
    await page.locator('[data-testid="serverchan-manual-submit"]').click();

    await expect(page.locator('[data-testid="serverchan-submit-error"]')).toContainText(
      "格式不正确",
    );
    // Form stays open so the user can correct the key without retyping.
    await expect(page.locator('[data-testid="serverchan-manual-form"]')).toBeVisible();
  });

  test("reminder toggles are NOT rendered while unbound", async ({ page }) => {
    await stubProfileEndpoints(page);
    await page.goto(PROFILE_PATH);

    await expect(page.locator('[data-testid="serverchan-toggles"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="serverchan-toggle-event-start"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="serverchan-toggle-reward"]')).toHaveCount(0);
  });

  test("binding GET failure surfaces the load error + reload recovers", async ({ page }) => {
    await stubProfileEndpoints(page, { loadFails: true });
    await page.goto(PROFILE_PATH);

    const err = page.locator('[data-testid="serverchan-load-error"]');
    await expect(err).toBeVisible();
    const reloadBtn = err.locator("button");
    await expect(reloadBtn).toBeVisible();

    // Swap the stub to the clean payload, then reload.
    await page.unroute("**/api/notifications/serverchan/binding");
    await page.route("**/api/notifications/serverchan/binding", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { bound: false, enabled: false } });
        return;
      }
      await route.fallback();
    });
    await reloadBtn.click();

    await expect(err).toHaveCount(0);
    await expect(page.locator('[data-testid="serverchan-state-label"]')).toHaveText("未绑定");
  });
});
