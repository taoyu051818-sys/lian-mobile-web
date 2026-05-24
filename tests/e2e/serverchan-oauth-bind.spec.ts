/**
 * Server酱 (外部通知) settings — OAuth bind-url + callback E2E.
 *
 * Companion to serverchan-settings-unbound.spec.ts (PR #939, which only
 * covers the unbound UI). This spec exercises the OAuth one-click forward
 * path the manual-paste form sits next to:
 *
 *   1. Click 绑定 → frontend GETs /bind-url → server returns a sct.ftqq.com
 *      forward URL → composable opens it via window.open.
 *   2. ServerChan 302s back to /#/profile?...&serverchan=bound (or =manual)
 *      after the user authorizes (or aborts). The settings block reads the
 *      hash query on mount and either toasts success or pre-opens the manual
 *      paste form.
 *
 * Hermetic — every backend call is route-stubbed. window.open is overridden
 * via addInitScript so we can assert which URL the frontend tried to forward
 * to without spawning a real popup.
 *
 * Component under test: src/features/profile/ProfileServerChanBlock.vue
 * Composable under test: src/features/profile/useServerChanBinding.ts
 *
 * Why now: 2026-05-24 nat100 was missing LIAN_PUBLIC_BASE_URL +
 * SERVERCHAN_ENABLED + SERVERCHAN_API_BASE so the OAuth path silently 500'd
 * in prod. This spec locks in the frontend half of the contract so a future
 * regression in /bind-url or callback-redirect parsing fails CI instead of
 * bricking the channel again.
 *
 * @tag @serverchan @serverchan-oauth
 */

import { expect, test, type Page } from "@playwright/test";

/**
 * Hash query suffix the server appends after a successful OAuth callback.
 * Mirrors what `consumeCallbackSignal()` parses in useServerChanBinding.ts.
 */
const PROFILE_PATH = "/#/profile";
const PROFILE_PATH_BOUND = "/#/profile?settings=notifications&serverchan=bound";
const PROFILE_PATH_MANUAL = "/#/profile?settings=notifications&serverchan=manual";

/**
 * Obviously-fake forward URL. Mirrors the shape ServerChan's
 * `/appkey/create/forward` returns but never echoes a real placeholder
 * key, callback URL, or production base — keeps this spec safe to commit.
 */
const FAKE_FORWARD_URL =
  "https://sct.ftqq.com/appkey/create/forward?name=LIAN&url=https%3A%2F%2Flian.example.com%2Fapi%2Fnotifications%2Fserverchan%2Fcallback&state=fake-state-xyz";

interface StubOptions {
  /** GET /binding response. Default = clean unbound payload. */
  binding?: { bound: boolean; enabled: boolean; createdAt?: string; updatedAt?: string };
  /** Override the GET /bind-url response. Default = 200 + FAKE_FORWARD_URL. */
  bindUrlResponse?: { status: number; body: Record<string, unknown> };
}

async function stubProfileEndpoints(page: Page, options: StubOptions = {}) {
  // Override window.open so we can capture the forward URL without the
  // browser actually trying to navigate to sct.ftqq.com. The captured value
  // lives on window.__lastOpenedUrl and is read via page.evaluate below.
  await page.addInitScript(() => {
    type WindowWithCapture = Window & { __lastOpenedUrl?: string | null };
    const w = window as WindowWithCapture;
    w.__lastOpenedUrl = null;
    const realOpen = window.open.bind(window);
    window.open = ((url?: string | URL, target?: string, features?: string): Window | null => {
      w.__lastOpenedUrl = typeof url === "string" ? url : url ? url.toString() : "";
      // Return a benign stub so the caller's null-check passes.
      return realOpen("about:blank", target ?? "_blank", features ?? "");
    }) as typeof window.open;
  });

  // Authenticated user — the Server酱 block is gated on Boolean(user).
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      json: {
        user: {
          id: "u-serverchan-oauth-test",
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
    await route.fulfill({ json: { tabs: [], items: [], hasMore: false, nextPage: null } });
  });
  await page.route("**/api/channel**", async (route) => {
    await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
  });
  await page.route("**/api/messages**", async (route) => {
    await route.fulfill({ json: { items: [], hasMore: false } });
  });

  await page.route("**/api/notifications/serverchan/binding", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        json: options.binding ?? { bound: false, enabled: false },
      });
      return;
    }
    if (method === "DELETE") {
      await route.fulfill({ json: { ok: true } });
      return;
    }
    if (method === "POST") {
      await route.fulfill({ json: { bound: true, enabled: true } });
      return;
    }
    await route.fallback();
  });

  await page.route("**/api/notifications/serverchan/bind-url", async (route) => {
    const r = options.bindUrlResponse ?? {
      status: 200,
      body: {
        url: FAKE_FORWARD_URL,
        state: "fake-state-xyz",
        expiresAt: "2026-05-24T23:59:59.000Z",
      },
    };
    await route.fulfill({ status: r.status, json: r.body });
  });

  await page.route("**/api/notifications/serverchan/preferences", async (route) => {
    await route.fulfill({
      json: { eventStartingReminder: false, rewardSettledReminder: false },
    });
  });
}

async function readCapturedOpenUrl(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    type WindowWithCapture = Window & { __lastOpenedUrl?: string | null };
    return (window as WindowWithCapture).__lastOpenedUrl ?? null;
  });
}

test.describe("@serverchan @serverchan-oauth bind-url forward", () => {
  test("clicking 绑定 calls /bind-url then forwards to the returned URL", async ({ page }) => {
    await stubProfileEndpoints(page);
    await page.goto(PROFILE_PATH);

    // Wait for the unbound block to settle so the click hits the real handler.
    await expect(page.locator('[data-testid="serverchan-state-label"]')).toHaveText("未绑定");

    // Race-free: arm the request waiter BEFORE the click that triggers it.
    const bindUrlRequest = page.waitForRequest(
      (req) =>
        req.url().includes("/api/notifications/serverchan/bind-url") && req.method() === "GET",
    );

    await page.locator('[data-testid="serverchan-bind-button"]').click();

    await bindUrlRequest;

    // window.open should have been invoked with the forward URL the stub
    // returned — proves the composable consumed `body.url` and did not, for
    // example, send the user to a hardcoded sct.ftqq.com root.
    await expect.poll(() => readCapturedOpenUrl(page)).toBe(FAKE_FORWARD_URL);
  });

  test("/bind-url 500 surfaces the brand-string load error (PUBLIC_BASE_URL_MISSING fallback)", async ({
    page,
  }) => {
    await stubProfileEndpoints(page, {
      bindUrlResponse: {
        status: 500,
        body: {
          error: "LIAN_PUBLIC_BASE_URL is not configured",
          code: "PUBLIC_BASE_URL_MISSING",
        },
      },
    });
    await page.goto(PROFILE_PATH);

    await expect(page.locator('[data-testid="serverchan-state-label"]')).toHaveText("未绑定");

    await page.locator('[data-testid="serverchan-bind-button"]').click();

    // Composable funnels every /bind-url failure into SERVERCHAN_BIND_URL_FAILED
    // ("无法打开绑定页，请稍后再试"). The raw backend message + code is
    // intentionally NOT surfaced — that contract is the security boundary.
    const loadError = page.locator('[data-testid="serverchan-load-error"]');
    await expect(loadError).toBeVisible();
    await expect(loadError).toContainText("无法打开绑定页");
    // The backend code/message must not leak into the UI.
    await expect(loadError).not.toContainText("PUBLIC_BASE_URL_MISSING");
    await expect(loadError).not.toContainText("LIAN_PUBLIC_BASE_URL");

    // Manual paste affordance is still there as the documented fallback.
    await expect(page.locator('[data-testid="serverchan-manual-open"]')).toBeVisible();

    // window.open must NOT have been called when bind-url failed.
    expect(await readCapturedOpenUrl(page)).toBeNull();
  });

  test("/bind-url 200 with empty url falls back to the same brand-string error", async ({
    page,
  }) => {
    await stubProfileEndpoints(page, {
      bindUrlResponse: { status: 200, body: { url: "" } },
    });
    await page.goto(PROFILE_PATH);

    await expect(page.locator('[data-testid="serverchan-state-label"]')).toHaveText("未绑定");
    await page.locator('[data-testid="serverchan-bind-button"]').click();

    const loadError = page.locator('[data-testid="serverchan-load-error"]');
    await expect(loadError).toBeVisible();
    await expect(loadError).toContainText("无法打开绑定页");

    expect(await readCapturedOpenUrl(page)).toBeNull();
  });
});

test.describe("@serverchan @serverchan-oauth callback redirect", () => {
  test("?serverchan=bound + bound payload renders the 已绑定 state", async ({ page }) => {
    await stubProfileEndpoints(page, {
      binding: {
        bound: true,
        enabled: true,
        createdAt: "2026-05-24T10:00:00.000Z",
        updatedAt: "2026-05-24T10:00:00.000Z",
      },
    });
    await page.goto(PROFILE_PATH_BOUND);

    const stateLabel = page.locator('[data-testid="serverchan-state-label"]');
    await expect(stateLabel).toHaveText("已绑定");
    await expect(stateLabel).toHaveAttribute("data-state", "bound");

    // Bound state owns the unbind button; the manual paste form must NOT be
    // present (it only renders in the unbound branch).
    await expect(page.locator('[data-testid="serverchan-unbind-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="serverchan-manual-form"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="serverchan-bind-button"]')).toHaveCount(0);
  });

  test("?serverchan=manual + unbound payload auto-opens the manual paste form", async ({
    page,
  }) => {
    await stubProfileEndpoints(page, {
      binding: { bound: false, enabled: false },
    });
    await page.goto(PROFILE_PATH_MANUAL);

    // State stays unbound (the OAuth half didn't complete).
    await expect(page.locator('[data-testid="serverchan-state-label"]')).toHaveText("未绑定");

    // The hash signal "manual" must surface the paste form on mount —
    // without it the user would have to find and click 粘贴 SendKey again
    // after being bounced back by ServerChan, which is the exact UX
    // failure the redirect signal is meant to avoid.
    const form = page.locator('[data-testid="serverchan-manual-form"]');
    await expect(form).toBeVisible();
    await expect(form.locator('[data-testid="serverchan-manual-input"]')).toBeVisible();
  });
});

test.describe("@serverchan @serverchan-oauth unbind flips back to unbound", () => {
  test("DELETE /binding from the bound state restores the unbound UI", async ({ page }) => {
    await stubProfileEndpoints(page, {
      binding: {
        bound: true,
        enabled: true,
        createdAt: "2026-05-24T10:00:00.000Z",
        updatedAt: "2026-05-24T10:00:00.000Z",
      },
    });
    await page.goto(PROFILE_PATH_BOUND);

    await expect(page.locator('[data-testid="serverchan-state-label"]')).toHaveText("已绑定");

    // Two-tap unbind: first tap arms the confirm prompt, second tap fires
    // DELETE. Mirrors the prod copy contract from serverchan.ts.
    await page.locator('[data-testid="serverchan-unbind-button"]').click();
    const confirm = page.locator('[data-testid="serverchan-unbind-confirm"]');
    await expect(confirm).toBeVisible();

    const deleteRequest = page.waitForRequest(
      (req) =>
        req.url().includes("/api/notifications/serverchan/binding") && req.method() === "DELETE",
    );
    await page.locator('[data-testid="serverchan-unbind-confirm-button"]').click();
    await deleteRequest;

    await expect(page.locator('[data-testid="serverchan-state-label"]')).toHaveText("未绑定");
    await expect(page.locator('[data-testid="serverchan-bind-button"]')).toBeVisible();
  });
});
