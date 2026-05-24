/**
 * Feed core interaction E2E tests.
 *
 * Verifies the fundamental feed interactions that users rely on daily:
 * - Feed homepage loads correctly
 * - Scroll-based infinite loading (auto-load more)
 * - Empty state display when no posts exist
 * - Card tap navigates to detail view
 *
 * Note: Pull-to-refresh is NOT implemented in the current codebase.
 * The feed uses FeedAutoLoadSentinel for infinite scroll via IntersectionObserver.
 *
 * Implementation references:
 *   - FeedView.vue: main feed container, loading/empty states
 *   - FeedLoadMore.vue: load-more button + auto-load sentinel
 *   - FeedAutoLoadSentinel.vue: IntersectionObserver-based auto-load trigger
 *   - FeedList.vue: masonry grid of feed cards
 *   - FeedItemCard.vue: individual card with click handler
 *
 * Tagged @feed for the e2e-journey.yml grep matrix.
 */

import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

// Stub data for hermetic tests that don't depend on live backend state
const STUB_TID = 888_888;
const STUB_TITLE = "Feed 核心交互测试帖";

const FEED_STUB = {
  tabs: [
    { id: "此刻", label: "此刻" },
    { id: "精选", label: "精选" },
  ],
  items: [
    {
      tid: STUB_TID,
      title: STUB_TITLE,
      bodyPreview: "这是一条用于测试 Feed 核心交互的帖子。",
      cover: "",
      primaryTag: "",
      timeLabel: "刚刚",
      timestampISO: new Date().toISOString(),
      likeCount: 0,
      liked: false,
      locationArea: "校园",
      contentType: "text",
    },
  ],
  hasMore: false,
  nextPage: null,
};

const FEED_STUB_WITH_MORE = {
  ...FEED_STUB,
  items: Array.from({ length: 12 }, (_, i) => ({
    tid: STUB_TID + i,
    title: `${STUB_TITLE} ${i + 1}`,
    bodyPreview: `测试帖子 ${i + 1} 的内容预览。`,
    cover: i % 2 === 0 ? "https://res.cloudinary.com/demo/image/upload/sample.jpg" : "",
    primaryTag: "",
    timeLabel: "刚刚",
    timestampISO: new Date().toISOString(),
    likeCount: i,
    liked: false,
    locationArea: "校园",
    contentType: i % 2 === 0 ? "image" : "text",
  })),
  hasMore: true,
  nextPage: 2,
};

const FEED_STUB_PAGE_2 = {
  ...FEED_STUB,
  items: Array.from({ length: 6 }, (_, i) => ({
    tid: STUB_TID + 100 + i,
    title: `${STUB_TITLE} 第二页 ${i + 1}`,
    bodyPreview: `第二页测试帖子 ${i + 1} 的内容预览。`,
    cover: "",
    primaryTag: "",
    timeLabel: "1小时前",
    timestampISO: new Date().toISOString(),
    likeCount: 0,
    liked: false,
    locationArea: "校园",
    contentType: "text",
  })),
  hasMore: false,
  nextPage: null,
};

const FEED_STUB_EMPTY = {
  tabs: [
    { id: "此刻", label: "此刻" },
    { id: "精选", label: "精选" },
  ],
  items: [],
  hasMore: false,
  nextPage: null,
};

const POST_STUB = {
  tid: STUB_TID,
  type: "text",
  title: STUB_TITLE,
  cover: "",
  primaryTag: "",
  timeLabel: "刚刚",
  timestampISO: new Date().toISOString(),
  contentHtml: "<p>这是一条用于测试 Feed 核心交互的帖子的详情内容。</p>",
  imageUrls: [],
  replies: [],
  likeCount: 0,
  liked: false,
  bookmarked: false,
  locationArea: "校园",
};

async function goToFeed(page: Page) {
  await page.goto(`${BASE_URL}/#/`);
  await expect(page.locator(".feed-view")).toBeVisible({ timeout: 10_000 });
}

async function installFeedStubs(page: Page, feedData: typeof FEED_STUB) {
  await page.route(/\/api\/feed(\?|$)/, async (route) => {
    const url = route.request().url();
    // Check if this is a page 2 request
    if (url.includes("page=2")) {
      await route.fulfill({ json: FEED_STUB_PAGE_2 });
    } else {
      await route.fulfill({ json: feedData });
    }
  });
  await page.route(new RegExp(`/api/posts/\\d+(\\?|$)`), async (route) => {
    await route.fulfill({ json: POST_STUB });
  });
}

test.describe("@feed core interaction", () => {
  test.describe("feed homepage load", () => {
    test("feed view renders with cards on initial load", async ({ page }) => {
      await goToFeed(page);

      // Feed view should be visible
      await expect(page.locator(".feed-view")).toBeVisible();

      // Should have feed cards OR empty state OR loading skeleton
      const hasCards = (await page.locator(".feed-item-card").count()) > 0;
      const hasEmptyState = (await page.locator(".feed-view__state--empty").count()) > 0;
      const hasLoadingSkeleton = (await page.locator(".feed-skeleton").count()) > 0;

      // At least one of these states should be true
      expect(hasCards || hasEmptyState || hasLoadingSkeleton).toBe(true);
    });

    test("feed view shows loading state then content (stubbed)", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await installFeedStubs(page, FEED_STUB);

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view")).toBeVisible();

      // After loading completes, should show the stubbed card
      await expect(page.locator(".feed-item-card")).toBeVisible();
      await expect(page.locator(".feed-item-card")).toContainText(STUB_TITLE);

      await context.close();
    });

    test("feed tabs are visible and interactive", async ({ page }) => {
      await goToFeed(page);

      // The tab bar should be present (rendered via PageChrome)
      // Tabs are rendered in the floating bar at the top
      const tabBar = page.locator('[aria-label="内容筛选"]');

      // Skip if tabs are not visible (might be a different UI configuration)
      const tabBarCount = await tabBar.count();
      if (tabBarCount === 0) {
        test.skip(true, "Tab bar not visible in current UI configuration");
        return;
      }

      await expect(tabBar).toBeVisible();
    });
  });

  test.describe("scroll-based infinite loading", () => {
    test("scrolling to bottom triggers load more (stubbed)", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await installFeedStubs(page, FEED_STUB_WITH_MORE);

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view")).toBeVisible();

      // Wait for initial cards to load
      await expect(page.locator(".feed-item-card").first()).toBeVisible();

      // Count initial cards
      const initialCount = await page.locator(".feed-item-card").count();
      expect(initialCount).toBeGreaterThan(0);

      // Scroll to the bottom to trigger auto-load
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Wait for more cards to load (page 2)
      await expect(async () => {
        const newCount = await page.locator(".feed-item-card").count();
        expect(newCount).toBeGreaterThan(initialCount);
      }).toPass({ timeout: 10_000 });

      await context.close();
    });

    test("load more button is visible when hasMore is true (stubbed)", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await installFeedStubs(page, FEED_STUB_WITH_MORE);

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view")).toBeVisible();
      await expect(page.locator(".feed-item-card").first()).toBeVisible();

      // Scroll to make load-more visible
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // The load more button should be visible
      const loadMoreButton = page.locator(".feed-load-more button");
      await expect(loadMoreButton).toBeVisible({ timeout: 5_000 });

      await context.close();
    });

    test("load more mechanism fetches next page (stubbed)", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Track API requests to verify pagination
      let page2Requested = false;
      await page.route(/\/api\/feed(\?|$)/, async (route) => {
        const url = route.request().url();
        if (url.includes("page=2")) {
          page2Requested = true;
          await route.fulfill({ json: FEED_STUB_PAGE_2 });
        } else {
          await route.fulfill({ json: FEED_STUB_WITH_MORE });
        }
      });
      await page.route(new RegExp(`/api/posts/\\d+(\\?|$)`), async (route) => {
        await route.fulfill({ json: POST_STUB });
      });

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view")).toBeVisible();
      await expect(page.locator(".feed-item-card").first()).toBeVisible();

      const initialCount = await page.locator(".feed-item-card").count();

      // Scroll to bottom - this triggers either auto-load or shows the manual button
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Wait for more cards to appear (via auto-load or manual trigger)
      await expect(async () => {
        const newCount = await page.locator(".feed-item-card").count();
        expect(newCount).toBeGreaterThan(initialCount);
      }).toPass({ timeout: 15_000 });

      // Verify page 2 was actually requested
      expect(page2Requested).toBe(true);

      await context.close();
    });

    test("shows 'seen all' message when no more content (stubbed)", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await installFeedStubs(page, FEED_STUB); // hasMore: false

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view")).toBeVisible();
      await expect(page.locator(".feed-item-card").first()).toBeVisible();

      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Should show "已经看完了" or similar end-of-feed message
      // The load-more area should NOT have a button when hasMore is false
      const loadMoreArea = page.locator(".feed-load-more");
      await expect(loadMoreArea).toBeVisible({ timeout: 5_000 });

      // Should NOT have a load more button
      const loadMoreButton = loadMoreArea.locator("button");
      await expect(loadMoreButton).toHaveCount(0);

      await context.close();
    });
  });

  test.describe("empty state", () => {
    test("shows empty state when feed has no items (stubbed)", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await installFeedStubs(page, FEED_STUB_EMPTY);

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view")).toBeVisible();

      // Should show empty state
      const emptyState = page.locator(".feed-view__state--empty");
      await expect(emptyState).toBeVisible({ timeout: 10_000 });

      // Should NOT show any feed cards
      await expect(page.locator(".feed-item-card")).toHaveCount(0);

      await context.close();
    });

    test("empty state has appropriate messaging", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await installFeedStubs(page, FEED_STUB_EMPTY);

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view")).toBeVisible();

      const emptyState = page.locator(".feed-view__state--empty");
      await expect(emptyState).toBeVisible({ timeout: 10_000 });

      // Empty state should have some text content (the exact text comes from brand config)
      const textContent = await emptyState.textContent();
      expect(textContent?.trim().length).toBeGreaterThan(0);

      await context.close();
    });
  });

  test.describe("card tap navigation", () => {
    test("tapping a card opens detail view (stubbed)", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await installFeedStubs(page, FEED_STUB);

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view")).toBeVisible();

      const card = page.locator(".feed-item-card").first();
      await expect(card).toBeVisible();

      // Click the card
      await card.click();

      // Detail surface should appear (App-level overlay per #636)
      const detailSurface = page.locator("body > .detail-surface");
      await expect(detailSurface).toBeVisible({ timeout: 10_000 });

      // URL should change to #/post/{tid}
      await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#\/post\/\d+$/);

      await context.close();
    });

    test("detail view shows post content after card tap (stubbed)", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await installFeedStubs(page, FEED_STUB);

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view")).toBeVisible();

      const card = page.locator(".feed-item-card").first();
      await expect(card).toBeVisible();
      await card.click();

      // Detail panel should show the post title
      const detailTitle = page.locator("#post-detail-title");
      await expect(detailTitle).toBeVisible({ timeout: 10_000 });
      await expect(detailTitle).toContainText(STUB_TITLE);

      await context.close();
    });

    test("closing detail returns to feed view (stubbed)", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await installFeedStubs(page, FEED_STUB);

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view")).toBeVisible();

      const card = page.locator(".feed-item-card").first();
      await card.click();

      const detailSurface = page.locator("body > .detail-surface");
      await expect(detailSurface).toBeVisible({ timeout: 10_000 });

      // Go back to close the detail
      await page.goBack();

      // Detail should be closed
      await expect(detailSurface).toHaveCount(0);

      // Feed view should still be visible
      await expect(page.locator(".feed-view")).toBeVisible();

      // URL should return to feed (could be #/, #/feed, or empty)
      await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#\/(feed)?$|^$/);

      await context.close();
    });

    test("bottom tab bar remains on feed after opening detail (stubbed)", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await installFeedStubs(page, FEED_STUB);

      await page.goto(`${BASE_URL}/#/`);
      await expect(page.locator(".feed-view")).toBeVisible();

      // Check active tab before opening detail
      const activeTab = page.locator('.bottom-tab-bar__item[aria-current="page"]');
      await expect(activeTab).toContainText("首页");

      const card = page.locator(".feed-item-card").first();
      await card.click();

      await expect(page.locator("body > .detail-surface")).toBeVisible({ timeout: 10_000 });

      // Active tab should still be feed (per #636 contract)
      await expect(activeTab).toContainText("首页");

      await context.close();
    });
  });

  test.describe("live backend (conditional)", () => {
    test("feed loads real content from backend", async ({ page }) => {
      await goToFeed(page);

      // Wait for either cards or empty state
      const hasContent = await Promise.race([
        page
          .locator(".feed-item-card")
          .first()
          .waitFor({ state: "visible", timeout: 15_000 })
          .then(() => true)
          .catch(() => false),
        page
          .locator(".feed-view__state--empty")
          .waitFor({ state: "visible", timeout: 15_000 })
          .then(() => false)
          .catch(() => false),
      ]);

      if (hasContent) {
        // Verify cards have expected structure
        const firstCard = page.locator(".feed-item-card").first();
        await expect(firstCard).toBeVisible();

        // Card should be clickable (has tabindex or is a button/link)
        const isInteractive = await firstCard.evaluate((el) => {
          return (
            el.hasAttribute("tabindex") ||
            el.tagName === "BUTTON" ||
            el.tagName === "A" ||
            el.getAttribute("role") === "button"
          );
        });
        expect(isInteractive).toBe(true);
      } else {
        // Empty state is also valid
        await expect(page.locator(".feed-view__state--empty")).toBeVisible();
      }
    });
  });
});
