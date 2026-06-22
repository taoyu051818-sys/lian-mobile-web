/**
 * Issue #828 — messages page is the pilot surface for the Apple-polish lane.
 *
 * The previous "channel readout" UI exposed engineering chrome ("当前收件箱来源"
 * with `已接入` / `未接入` chips, `查看对应 issue` GitHub deep links, etc.) at
 * the top of every notification tab. That copy is the single biggest tell that
 * the inbox was a debugging surface, not a product surface. Issue #830 §1
 * locked the lint blacklist for this PR; this spec is the runtime equivalent.
 *
 * Coverage:
 *   1. Happy path — 4 tabs cycle, page chrome stable, no engineering strings
 *      anywhere in the visible DOM.
 *   2. Fail-loud — `/api/messages` 500 surfaces a distinct error state
 *      (`[data-testid="messages-error"]`) AND emits a `console.error`. The
 *      page MUST NOT silently render a 5xx as "暂无通知".
 *   3. Login-expired — 401 surfaces `[data-testid="messages-auth-required"]`
 *      with a 重新登录 button that routes to the profile view's auth panel.
 *   4. Empty per tab — 200 with `items: []` shows the locked-down product
 *      empty copy, distinct from the error state.
 *
 * Hermetic via `page.route` stubs against `/api/channel`, `/api/messages`,
 * `/api/auth/me`, and `/api/feed` (shell prefetch). Same pattern as
 * `messages-notification-proof.spec.ts` and `post-detail-cold-start.spec.ts`.
 */

import { expect, test, type Page } from "@playwright/test";

const FORBIDDEN_ENGINEERING_STRINGS = [
  "Authentication required",
  "Service unavailable",
  "Not implemented",
  "未接入",
  "查看 issue",
  "查看对应 issue",
  "当前收件箱来源",
];

// PR #945 moved the inbox tabs into ChannelFilterBar State-B chips (teleported).
const LABEL_TO_CATEGORY_KEY: Record<string, string> = {
  频道: "channel",
  回复: "replies",
  系统: "system",
  订单: "orders",
};

async function openMessagesTab(page: Page, label: string) {
  const key = LABEL_TO_CATEGORY_KEY[label] ?? label;
  const chip = page.locator(`[data-filter-value="${key}"]:visible`);
  if (!(await chip.isVisible())) {
    await page.locator('[data-testid="filter-state-toggle"]:visible').click();
  }
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
}

async function stubChannelEmpty(page: Page) {
  await page.route("**/api/channel?*", async (route) => {
    await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
  });
}

async function stubFeedEmpty(page: Page) {
  await page.route("**/api/feed**", async (route) => {
    await route.fulfill({
      json: {
        tabs: [{ id: "此刻", label: "此刻" }],
        items: [],
        hasMore: false,
        nextPage: null,
      },
    });
  });
}

async function expectNoEngineeringStrings(page: Page) {
  const html = await page.locator("body").innerText();
  for (const offender of FORBIDDEN_ENGINEERING_STRINGS) {
    expect(html, `engineering string "${offender}" leaked into product UI`).not.toContain(offender);
  }
  // GitHub issue links must not be in user-visible chrome either.
  const githubLinks = await page.locator('a[href*="github.com"]:visible').count();
  expect(githubLinks, "GitHub issue link leaked into product UI").toBe(0);
}

test.describe("messages product inbox @anonymous @messages", () => {
  test("4-tab happy path: chrome stable, no engineering copy", async ({ page }) => {
    await stubChannelEmpty(page);
    await stubFeedEmpty(page);
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        json: {
          user: {
            id: "u1",
            username: "tester",
            displayName: "测试同学",
            avatarText: "测",
            identityTags: [],
            aliases: [],
          },
        },
      });
    });
    await page.route("**/api/messages**", async (route) => {
      await route.fulfill({ json: { items: [] } });
    });

    await page.goto("/#/messages");

    // The chrome (filter bar + bottom nav) must be present on every tab.
    const filterBar = page.locator('[data-testid="channel-filter-bar"]');
    await expect(filterBar).toBeVisible();
    const bottomBar = page.locator(".bottom-tab-bar");
    await expect(bottomBar).toBeVisible();

    for (const label of ["频道", "回复", "系统", "订单"]) {
      await openMessagesTab(page, label);
      await expect(filterBar).toBeVisible();
      await expect(bottomBar).toBeVisible();
      // Active tab still resolves to messages — the chrome must not drift.
      await expect(page.locator('.bottom-tab-bar__item[aria-current="page"]')).toContainText(
        "消息",
      );
      await expectNoEngineeringStrings(page);
    }
  });

  test("5xx fail-loud: distinct error surface + console.error preserved", async ({ page }) => {
    await stubChannelEmpty(page);
    await stubFeedEmpty(page);
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        json: {
          user: {
            id: "u1",
            username: "tester",
            displayName: "测试同学",
            identityTags: [],
            aliases: [],
          },
        },
      });
    });

    let messagesHits = 0;
    await page.route("**/api/messages**", async (route) => {
      messagesHits += 1;
      if (messagesHits === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "internal error" }),
        });
        return;
      }
      // Retry path returns success so the surface clears.
      await route.fulfill({ json: { items: [] } });
    });

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/#/messages");
    await openMessagesTab(page, "回复");

    // The error surface must be distinct from the empty state.
    const errorSurface = page.locator('[data-testid="messages-error"]');
    await expect(errorSurface).toBeVisible();
    await expect(page.locator('[data-testid="messages-empty"]')).toHaveCount(0);

    // 5xx never silently renders as "暂无通知".
    expect(await page.locator("body").innerText()).not.toContain("暂无通知");
    expect(await page.locator("body").innerText()).not.toContain("还没有新的回复");

    // console.error preserved for diagnostics (fail-loud contract).
    expect(consoleErrors.some((m) => /messages.*fetch failed/i.test(m))).toBe(true);

    // Retry recovers — the surface flips from error to empty.
    await errorSurface.locator("button", { hasText: /重试|重新加载/ }).click();
    await expect(page.locator('[data-testid="messages-empty"]')).toBeVisible();
    await expect(errorSurface).toHaveCount(0);
  });

  test("401 login-expired: distinct auth surface routes to login", async ({ page }) => {
    await stubChannelEmpty(page);
    await stubFeedEmpty(page);
    // Logged-in fixture: simulates session-expired (auth/me succeeds, then
    // /api/messages 401s). Guests would have the filter-bar toggle hidden, so
    // a guest fixture can no longer reach a non-channel tab through the UI.
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        json: {
          user: {
            id: "u1",
            username: "tester",
            displayName: "测试同学",
            identityTags: [],
            aliases: [],
          },
        },
      });
    });
    await page.route("**/api/messages**", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "session expired" }),
      });
    });

    await page.goto("/#/messages");
    await openMessagesTab(page, "回复");

    const authSurface = page.locator('[data-testid="messages-auth-required"]');
    await expect(authSurface).toBeVisible();
    // Must not appear as a generic "暂无通知" silent landing.
    await expect(page.locator('[data-testid="messages-empty"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="messages-error"]')).toHaveCount(0);

    // The CTA routes to the profile view (AuthPanel auto-shows for anonymous users).
    const reLoginButton = authSurface.locator("button", { hasText: /重新登录|去登录/ });
    await expect(reLoginButton).toBeVisible();
    await reLoginButton.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/#\/profile/);
  });

  test("empty per tab: locked-down product copy, distinguishable from error", async ({ page }) => {
    await stubChannelEmpty(page);
    await stubFeedEmpty(page);
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        json: {
          user: {
            id: "u1",
            username: "tester",
            displayName: "测试同学",
            identityTags: [],
            aliases: [],
          },
        },
      });
    });
    await page.route("**/api/messages**", async (route) => {
      await route.fulfill({ json: { items: [] } });
    });

    await page.goto("/#/messages");

    const expectedEmptyCopy: Record<string, RegExp> = {
      回复: /还没有新的回复/,
      系统: /暂时没有新的系统反馈/,
      订单: /暂时没有新的订单提醒/,
    };

    for (const [tab, copy] of Object.entries(expectedEmptyCopy)) {
      await openMessagesTab(page, tab);
      const emptySurface = page.locator('[data-testid="messages-empty"]');
      await expect(emptySurface).toBeVisible();
      await expect(emptySurface).toContainText(copy);
      await expect(page.locator('[data-testid="messages-error"]')).toHaveCount(0);
    }
  });
});
