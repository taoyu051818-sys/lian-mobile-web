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
 * Runs against APP_BASE_URL (default https://lian.nat100.top) — no login
 * needed; we use the first public feed item so anonymous browse works.
 */

import { expect, request, test, type APIRequestContext } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

interface FeedItem {
  tid?: number | string;
  title?: string;
}
interface FeedResponse {
  items?: FeedItem[];
}

async function firstPublicFeedTid(api: APIRequestContext) {
  const response = await api.get("/api/feed?tab=%E6%AD%A4%E5%88%BB&page=1&limit=12");
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as FeedResponse;
  const item = body.items?.find((candidate) => candidate.tid && candidate.title);
  expect(item, "nat100 feed must expose at least one public item").toBeTruthy();
  return { tid: String(item!.tid), title: String(item!.title) };
}

test.describe("@detail cold-start contract (#636)", () => {
  test("feed-card tap opens the App-level DetailSurface without moving the active tab", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

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
    const api = await request.newContext({ baseURL: BASE_URL });
    const { tid, title } = await firstPublicFeedTid(api);
    await api.dispose();

    const context = await browser.newContext();
    const page = await context.newPage();

    // Cold navigation directly to a post URL — the FSM has to bootstrap from
    // the hash on first paint, with no prior tab state.
    await page.goto(`/#/post/${tid}`);

    const detailSurface = page.locator("body > .detail-surface");
    await expect(detailSurface).toBeVisible();
    await expect(detailSurface.locator("#post-detail-title")).toContainText(title);
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
    const api = await request.newContext({ baseURL: BASE_URL });
    const { tid, title } = await firstPublicFeedTid(api);
    await api.dispose();

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`/#/post/${tid}`);
    await expect(page.locator("body > .detail-surface")).toBeVisible();
    await expect(page.locator("#post-detail-title")).toContainText(title);

    // Hard reload — exercises the cold-start path again. The shell slot DOM
    // (#lian-shell-top-slot / #lian-shell-bottom-slot) must be present before
    // PostDetailPanel's teleport tries to target them, on every load.
    await page.reload();

    const detailSurface = page.locator("body > .detail-surface");
    await expect(detailSurface).toBeVisible();
    await expect(page.locator("#lian-shell-top-slot")).toHaveCount(1);
    await expect(page.locator("#lian-shell-bottom-slot")).toHaveCount(1);
    await expect(detailSurface.locator("#post-detail-title")).toContainText(title);

    // No stuck loading state — the FSM finished its fetch, didn't leave us on
    // the loading sentinel that pre-#636 used to surface as a flake.
    await expect(page.locator('[data-testid="post-detail-loading"]')).toHaveCount(0);
    await expect(page.getByText("详情加载失败")).toHaveCount(0);

    await context.close();
  });
});
