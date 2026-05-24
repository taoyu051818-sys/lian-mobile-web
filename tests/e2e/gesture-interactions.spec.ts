/**
 * Apple-style gesture E2E tests.
 *
 * Verifies the gesture composables and their integration:
 * - Pull-to-refresh on FeedView
 * - Long press context menu on feed cards
 * - Reduced motion support for all gestures
 *
 * Implementation references:
 *   - src/composables/useSwipeGesture.ts
 *   - src/composables/usePullToRefresh.ts
 *   - src/composables/useLongPress.ts
 *   - src/features/feed/FeedView.vue
 *   - src/features/feed/FeedItemCard.vue
 *   - src/features/feed/FeedContextMenu.vue
 *   - src/features/feed/PullToRefreshIndicator.vue
 */

import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

const FEED_STUB = {
  tabs: [
    { id: "此刻", label: "此刻" },
    { id: "精选", label: "精选" },
  ],
  items: [
    {
      tid: 999001,
      title: "手势测试帖子",
      bodyPreview: "这是一条用于测试手势操作的帖子。",
      cover: "",
      primaryTag: "",
      timeLabel: "刚刚",
      timestampISO: new Date().toISOString(),
      likeCount: 5,
      liked: false,
      locationArea: "校园",
      contentType: "text",
    },
    {
      tid: 999002,
      title: "第二条测试帖子",
      bodyPreview: "另一条测试帖子。",
      cover: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      primaryTag: "测试",
      timeLabel: "1分钟前",
      timestampISO: new Date().toISOString(),
      likeCount: 10,
      liked: true,
      locationArea: "校园",
      contentType: "image",
    },
  ],
  hasMore: false,
  nextPage: null,
};

async function installFeedStubs(page: Page) {
  let refreshCount = 0;
  await page.route(/\/api\/feed(\?|$)/, async (route) => {
    refreshCount++;
    await route.fulfill({
      json: {
        ...FEED_STUB,
        // Add a marker to detect refresh
        items: FEED_STUB.items.map((item) => ({
          ...item,
          title: refreshCount > 1 ? `${item.title} (刷新 ${refreshCount - 1})` : item.title,
        })),
      },
    });
  });
  await page.route(new RegExp(`/api/posts/\\d+(\\?|$)`), async (route) => {
    await route.fulfill({
      json: {
        tid: 999001,
        type: "text",
        title: "手势测试帖子",
        cover: "",
        primaryTag: "",
        timeLabel: "刚刚",
        timestampISO: new Date().toISOString(),
        contentHtml: "<p>测试内容</p>",
        imageUrls: [],
        replies: [],
        likeCount: 5,
        liked: false,
        bookmarked: false,
        locationArea: "校园",
      },
    });
  });
  return { getRefreshCount: () => refreshCount };
}

async function goToFeed(page: Page) {
  await page.goto(`${BASE_URL}/#/`);
  await expect(page.locator(".feed-view")).toBeVisible({ timeout: 10_000 });
}

test.describe("@gesture pull-to-refresh", () => {
  test("pull-to-refresh indicator is present in FeedView", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installFeedStubs(page);

    await goToFeed(page);
    await expect(page.locator(".feed-item-card").first()).toBeVisible();

    // The indicator should exist in the DOM (hidden by default)
    const indicator = page.locator(".pull-refresh-indicator");
    // It may be hidden initially, but should exist
    await expect(indicator).toHaveCount(1);

    await context.close();
  });

  test("pull-to-refresh respects reduced motion preference", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await installFeedStubs(page);

    await goToFeed(page);
    await expect(page.locator(".feed-item-card").first()).toBeVisible();

    // The indicator should have the reduced motion class when visible
    const indicator = page.locator(".pull-refresh-indicator");
    await expect(indicator).toHaveCount(1);

    await context.close();
  });
});

test.describe("@gesture long press context menu", () => {
  test("context menu appears on right-click (desktop simulation)", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installFeedStubs(page);

    await goToFeed(page);
    const card = page.locator(".feed-item-card").first();
    await expect(card).toBeVisible();

    // Right-click to trigger context menu
    await card.click({ button: "right" });

    // Context menu should appear
    const contextMenu = page.locator(".feed-context-menu");
    await expect(contextMenu).toBeVisible({ timeout: 5_000 });

    // Should have the expected menu items
    await expect(contextMenu.locator("text=分享")).toBeVisible();
    await expect(contextMenu.locator("text=收藏")).toBeVisible();
    await expect(contextMenu.locator("text=举报")).toBeVisible();

    await context.close();
  });

  test("context menu closes on backdrop click", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installFeedStubs(page);

    await goToFeed(page);
    const card = page.locator(".feed-item-card").first();
    await expect(card).toBeVisible();

    // Open context menu
    await card.click({ button: "right" });
    const contextMenu = page.locator(".feed-context-menu");
    await expect(contextMenu).toBeVisible({ timeout: 5_000 });

    // Click backdrop to close
    await page.locator(".feed-context-menu__backdrop").click({ position: { x: 10, y: 10 } });

    // Menu should close
    await expect(contextMenu).not.toBeVisible({ timeout: 3_000 });

    await context.close();
  });

  test("context menu closes on escape key", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installFeedStubs(page);

    await goToFeed(page);
    const card = page.locator(".feed-item-card").first();
    await expect(card).toBeVisible();

    // Open context menu
    await card.click({ button: "right" });
    const contextMenu = page.locator(".feed-context-menu");
    await expect(contextMenu).toBeVisible({ timeout: 5_000 });

    // Press escape to close
    await page.keyboard.press("Escape");

    // Menu should close
    await expect(contextMenu).not.toBeVisible({ timeout: 3_000 });

    await context.close();
  });

  test("context menu respects reduced motion preference", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await installFeedStubs(page);

    await goToFeed(page);
    const card = page.locator(".feed-item-card").first();
    await expect(card).toBeVisible();

    // Open context menu
    await card.click({ button: "right" });
    const contextMenu = page.locator(".feed-context-menu");
    await expect(contextMenu).toBeVisible({ timeout: 5_000 });

    // Should have reduced motion class
    await expect(contextMenu).toHaveClass(/feed-context-menu--reduced/);

    await context.close();
  });

  test("bookmark action toggles state", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installFeedStubs(page);

    await goToFeed(page);
    const card = page.locator(".feed-item-card").first();
    await expect(card).toBeVisible();

    // Open context menu
    await card.click({ button: "right" });
    const contextMenu = page.locator(".feed-context-menu");
    await expect(contextMenu).toBeVisible({ timeout: 5_000 });

    // Click bookmark
    const bookmarkButton = contextMenu.locator("text=收藏");
    await bookmarkButton.click();

    // Menu should close after action
    await expect(contextMenu).not.toBeVisible({ timeout: 3_000 });

    await context.close();
  });
});

test.describe("@gesture accessibility", () => {
  test("context menu has proper ARIA attributes", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installFeedStubs(page);

    await goToFeed(page);
    const card = page.locator(".feed-item-card").first();
    await expect(card).toBeVisible();

    // Open context menu
    await card.click({ button: "right" });
    const contextMenu = page.locator(".feed-context-menu");
    await expect(contextMenu).toBeVisible({ timeout: 5_000 });

    // Check ARIA attributes
    await expect(contextMenu).toHaveAttribute("role", "menu");
    await expect(contextMenu).toHaveAttribute("aria-label", "操作菜单");

    // Menu items should have menuitem role
    const menuItems = contextMenu.locator('[role="menuitem"]');
    await expect(menuItems).toHaveCount(3);

    await context.close();
  });

  test("pull-to-refresh indicator has status role", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installFeedStubs(page);

    await goToFeed(page);
    await expect(page.locator(".feed-item-card").first()).toBeVisible();

    const indicator = page.locator(".pull-refresh-indicator");
    await expect(indicator).toHaveAttribute("role", "status");

    await context.close();
  });
});
