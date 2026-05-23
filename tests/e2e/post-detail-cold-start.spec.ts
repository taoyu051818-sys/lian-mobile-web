/**
 * Cold-start contract for the App-level DetailSurface (#636).
 *
 * PR1 lifted PostDetailPanel to an App-level overlay; PR2 split the deep-link
 * singleton so the FSM is the only owner of "is a detail open" state. These
 * three specs are the trip wire on a real browser:
 *
 *   1. feed-card open  — tapping a card mounts the detail at the body level,
 *      writes #/post/{tid}, but does NOT change the active bottom tab.
 *   2. deep-link cold start — navigating directly to #/post/{tid} renders the
 *      detail and leaves the underlying tab at feed; closing the panel returns
 *      the URL to the view hash.
 *   3. refresh on a detail URL — reloading at #/post/{tid} re-mounts cleanly,
 *      no shell-slot race, panel comes back without a stale loading state.
 *
 * Tagged @detail. Picked up by the e2e-journey.yml grep matrix.
 *
 * Hermetic via page.route stubs against /api/feed and /api/posts/:tid. The
 * shipping #636 contract (body-level mount, role=dialog, hash transitions,
 * underlying tab bar untouched, shell slot DOM mounted before teleport) still
 * runs end-to-end against the real browser; only the data plane is mocked so
 * the gate does not depend on whether nat100's feed currently exposes a public
 * topic. Without the stubs the spec was the dominant PR-gate red because
 * nat100 `/api/feed` is returning `items: []` for every tab right now, which
 * starves the original `firstPublicFeedTid()` precondition.
 */

import { expect, test, type Page } from "@playwright/test";

const STUB_TID = 999_999;
const STUB_TITLE = "冷启动契约验证帖";

// Shape mirrors what the real backend ships and what `normalizeFeedItem` /
// `normalizePostDetail` accept. Only the fields the cold-start contract reads
// (tid + title + a renderable text card) need to be populated; everything else
// is normalized to safe defaults by the adapters in src/api/{feed,posts}.ts.
const FEED_STUB = {
  tabs: [
    { id: "此刻", label: "此刻" },
    { id: "精选", label: "精选" },
  ],
  items: [
    {
      tid: STUB_TID,
      title: STUB_TITLE,
      bodyPreview: "page.route 注入的稳定数据。",
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

const POST_STUB = {
  tid: STUB_TID,
  type: "text",
  title: STUB_TITLE,
  cover: "",
  primaryTag: "",
  timeLabel: "刚刚",
  timestampISO: new Date().toISOString(),
  contentHtml: "<p>page.route 注入的稳定 PostDetail。</p>",
  imageUrls: [],
  replies: [],
  likeCount: 0,
  liked: false,
  bookmarked: false,
  locationArea: "校园",
};

async function installColdStartStubs(page: Page): Promise<void> {
  // Match `/api/feed` with or without a query string. The detail-related
  // sibling endpoints (/api/posts/:tid/like, /save, /report, /replies) are
  // intentionally NOT stubbed so attempting to trigger them from the cold-
  // start contract surfaces as a network error instead of silently passing.
  await page.route(/\/api\/feed(\?|$)/, async (route) => {
    await route.fulfill({ json: FEED_STUB });
  });
  await page.route(new RegExp(`/api/posts/${STUB_TID}(\\?|$)`), async (route) => {
    await route.fulfill({ json: POST_STUB });
  });
}

test.describe("@detail cold-start contract (#636)", () => {
  test("feed-card tap opens the App-level DetailSurface without moving the active tab", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installColdStartStubs(page);

    await page.goto("/");
    await expect(page.locator(".feed-view")).toBeVisible();

    // The bottom tab bar must report feed as active before AND after the open.
    // aria-current="page" is the single semantic signal we rely on.
    const activeTab = page.locator('.bottom-tab-bar__item[aria-current="page"]');
    await expect(activeTab).toContainText("首页");

    const card = page.locator(".feed-item-card").first();
    await card.scrollIntoViewIfNeeded();
    await card.click();

    // App-level: the detail surface must be a direct child of <body>, not nested
    // inside .feed-view / .messages-view / .profile-view.
    const detailSurface = page.locator("body > .detail-surface");
    await expect(detailSurface).toBeVisible();
    await expect(detailSurface).toHaveAttribute("role", "dialog");
    await expect(detailSurface).toHaveAttribute("aria-modal", "true");
    await expect(detailSurface.locator(".post-detail-panel")).toBeVisible();
    await expect(page.locator(".feed-view .post-detail-panel")).toHaveCount(0);

    // Hash advanced to #/post/{tid} with a real numeric tid.
    await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#\/post\/\d+$/);
    // Active tab unchanged — pre-#636 useActiveView would force-route here.
    await expect(activeTab).toContainText("首页");

    // Closing the detail clears the post hash without touching the active tab.
    await page.goBack();
    await expect(detailSurface).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#\/feed\/?$|^$/);
    await expect(activeTab).toContainText("首页");

    await context.close();
  });

  test("deep-link cold start renders detail and underlying tab is feed", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installColdStartStubs(page);

    // Cold navigation directly to a post URL — the FSM has to bootstrap from
    // the hash on first paint, with no prior tab state.
    await page.goto(`/#/post/${STUB_TID}`);

    const detailSurface = page.locator("body > .detail-surface");
    await expect(detailSurface).toBeVisible();
    await expect(detailSurface.locator("#post-detail-title")).toContainText(STUB_TITLE);
    await expect(page.locator(".post-detail-panel__state")).toHaveCount(0);
    await expect(page.getByText("详情加载失败")).toHaveCount(0);

    // The underlying tab defaults to feed — pre-#636 this was a flake source
    // because useActiveView read the detail FSM and could land on an unrelated
    // tab depending on hashchange timing.
    await expect(page.locator('.bottom-tab-bar__item[aria-current="page"]')).toContainText("首页");

    // Closing the detail returns to the view hash, not an empty hash.
    await page.evaluate(() => history.back());
    await expect(detailSurface).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#\/feed\/?$|^$/);
    await expect(page.locator(".feed-view")).toBeVisible();

    await context.close();
  });

  test("refresh on #/post/{tid} re-mounts detail cleanly (no shell-slot race)", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installColdStartStubs(page);

    await page.goto(`/#/post/${STUB_TID}`);
    await expect(page.locator("body > .detail-surface")).toBeVisible();
    await expect(page.locator("#post-detail-title")).toContainText(STUB_TITLE);

    // Hard reload — exercises the cold-start path again. The shell slot DOM
    // (#lian-shell-top-slot / #lian-shell-bottom-slot) must be present before
    // PostDetailPanel's teleport tries to target them, on every load.
    await page.reload();

    const detailSurface = page.locator("body > .detail-surface");
    await expect(detailSurface).toBeVisible();
    await expect(page.locator("#lian-shell-top-slot")).toHaveCount(1);
    await expect(page.locator("#lian-shell-bottom-slot")).toHaveCount(1);
    await expect(detailSurface.locator("#post-detail-title")).toContainText(STUB_TITLE);

    // No stuck loading state — the FSM finished its fetch, didn't leave us on
    // the loading sentinel that pre-#636 used to surface as a flake.
    await expect(page.locator('[data-testid="post-detail-loading"]')).toHaveCount(0);
    await expect(page.getByText("详情加载失败")).toHaveCount(0);

    await context.close();
  });
});
