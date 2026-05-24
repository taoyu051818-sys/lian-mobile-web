/**
 * Regression: top floating chrome must survive view switches.
 *
 * Bug history: PR #943 (feed-filter slot) and #945 (channel-filter slot)
 * staked the top slot via `chrome.setSlot("top", kind)` on mount but never
 * released it on unmount. Switching to any other view inherited
 * `state.top.slot === "feed-filter"` (or "channel-filter"), which made
 * ShellChrome suppress regular chrome rendering — the floating top bar
 * (tabs / identity / buttons) disappeared everywhere except the home feed.
 *
 * The fix lives in `src/shell/usePageChromeSlot.ts`: stake on mount,
 * release on unmount, yield to the detail FSM. This spec asserts the
 * top floating chrome is visible after every bottom-tab switch.
 *
 * Hermetic via page.route stubs against feed/channel/auth so the test
 * does not depend on live backend state.
 */

import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

const TOP_CHROME = '[data-floating-chrome="top"]';

const FEED_STUB = {
  tabs: [{ id: "此刻", label: "此刻" }],
  items: [],
  hasMore: false,
  nextPage: null,
};

async function installCommonStubs(page: Page) {
  await page.route(/\/api\/feed(\?|$)/, async (route) => {
    await route.fulfill({ json: FEED_STUB });
  });
  await page.route("**/api/channel?*", async (route) => {
    await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
  });
  await page.route("**/api/messages**", async (route) => {
    await route.fulfill({ json: { items: [] } });
  });
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
  await page.route(/\/api\/profile(\?|$)/, async (route) => {
    await route.fulfill({
      json: {
        user: {
          id: "u1",
          username: "tester",
          displayName: "测试同学",
          identityTags: [],
        },
        items: [],
      },
    });
  });
  await page.route(/\/api\/map(\?|$)/, async (route) => {
    await route.fulfill({ json: { points: [] } });
  });
}

async function expectTopChromeVisible(page: Page, label: string) {
  // The shell renders #lian-shell-top-slot unconditionally; what we care
  // about is that *something* is carrying the floating-chrome surface,
  // which only happens when `data-floating-chrome="top"` is set. That
  // attribute is bound to "is this region rendering chrome content?"
  // (typed tabs, detail-topbar, feed-filter, channel-filter). When the
  // slot leak hits, the top region renders an empty stable target with
  // no `data-floating-chrome` attribute and the user sees nothing.
  await expect(page.locator(TOP_CHROME), `top chrome missing on ${label}`).toBeVisible();
}

test.describe("@chrome floating chrome slot lifecycle", () => {
  test("top chrome survives view switch from feed → messages → publish → profile → map", async ({
    page,
  }) => {
    await installCommonStubs(page);
    await page.goto(`${BASE_URL}/#/`);

    // Start on feed — the slot should be claimed by FeedView.
    await expect(page.locator(".feed-view")).toBeVisible({ timeout: 10_000 });
    await expectTopChromeVisible(page, "feed (initial)");

    // Switch through every other tab and assert the top chrome stays painted.
    for (const tab of ["map", "publish", "messages", "profile"] as const) {
      // Bottom nav tabs are rendered by BottomTabBar — they do not have
      // explicit testids, so we drive them via the shared hash route to
      // exercise the same setActiveView path. Either entry point hits
      // AppViewHost which mounts/unmounts the view component.
      await page.evaluate((target) => {
        window.location.hash = `#/${target}`;
      }, tab);
      // Wait for the new view to mount. We don't need a deep selector — the
      // host swaps components synchronously, so the chrome should refresh
      // on the next paint.
      await page.waitForFunction((expected) => window.location.hash === `#/${expected}`, tab);
      await expectTopChromeVisible(page, tab);
    }

    // Back to feed.
    await page.evaluate(() => {
      window.location.hash = "#/";
    });
    await expect(page.locator(".feed-view")).toBeVisible();
    await expectTopChromeVisible(page, "feed (return)");
  });
});
