/**
 * E2E tests for ShareCardSheet share-card preview functionality.
 *
 * Tests the share-card flow:
 *   1. Open a post detail page
 *   2. Click the share button in the topbar
 *   3. Verify ShareCardSheet renders with loading → ready states
 *   4. Verify card preview content (title, summary, author, audience)
 *   5. Verify confirm/cancel interactions
 *
 * Uses page.route stubs for /api/feed and /api/posts/:tid/share-card to ensure
 * hermetic tests that don't depend on live backend data.
 */

import { expect, test, type Page } from "@playwright/test";
import { loginAs, browserContextForRole, skipIfRoleMissing } from "./fixtures/accounts";

const STUB_TID = 888_888;
const STUB_TITLE = "分享卡片测试帖";
const STUB_SUMMARY = "这是一段用于测试分享卡片的摘要文本。";
const STUB_AUTHOR = "测试作者";
const STUB_AUDIENCE = "校园可见";

const FEED_STUB = {
  tabs: [
    { id: "此刻", label: "此刻" },
    { id: "精选", label: "精选" },
  ],
  items: [
    {
      tid: STUB_TID,
      title: STUB_TITLE,
      bodyPreview: "分享卡片测试内容。",
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
  contentHtml: "<p>分享卡片测试内容。</p>",
  imageUrls: [],
  replies: [],
  likeCount: 0,
  liked: false,
  bookmarked: false,
  locationArea: "校园",
};

const SHARE_CARD_STUB = {
  ok: true,
  card: {
    tid: STUB_TID,
    title: STUB_TITLE,
    summary: STUB_SUMMARY,
    thumbnailUrl: "",
    url: `https://lian.nat100.top/#/post/${STUB_TID}`,
    kind: "post",
    authorName: STUB_AUTHOR,
    audienceLabel: STUB_AUDIENCE,
    channel: {},
  },
};

async function installShareCardStubs(page: Page): Promise<void> {
  await page.route(/\/api\/feed(\?|$)/, async (route) => {
    await route.fulfill({ json: FEED_STUB });
  });
  await page.route(new RegExp(`/api/posts/${STUB_TID}(\\?|$)`), async (route) => {
    await route.fulfill({ json: POST_STUB });
  });
  await page.route(new RegExp(`/api/posts/${STUB_TID}/share-card(\\?|$)`), async (route) => {
    // Simulate a small network delay for loading state visibility
    await new Promise((r) => setTimeout(r, 100));
    await route.fulfill({ json: SHARE_CARD_STUB });
  });
}

async function installShareCardErrorStub(
  page: Page,
  errorType: "not-found" | "network",
): Promise<void> {
  await page.route(/\/api\/feed(\?|$)/, async (route) => {
    await route.fulfill({ json: FEED_STUB });
  });
  await page.route(new RegExp(`/api/posts/${STUB_TID}(\\?|$)`), async (route) => {
    await route.fulfill({ json: POST_STUB });
  });
  await page.route(new RegExp(`/api/posts/${STUB_TID}/share-card(\\?|$)`), async (route) => {
    if (errorType === "not-found") {
      await route.fulfill({ status: 404, json: { ok: false, error: "not found" } });
    } else {
      await route.fulfill({ status: 500, json: { ok: false, error: "server error" } });
    }
  });
}

test.describe("@share ShareCardSheet E2E", () => {
  test("opens share-card sheet and displays card preview on share button click", async ({
    browser,
  }) => {
    skipIfRoleMissing("registered");
    const { api } = await loginAs("registered");
    const context = await browserContextForRole(browser, api);
    const page = await context.newPage();
    await installShareCardStubs(page);

    // Navigate to post detail
    await page.goto(`/#/post/${STUB_TID}`);
    const detailSurface = page.locator("body > .detail-surface");
    await expect(detailSurface).toBeVisible();
    await expect(page.locator("#post-detail-title")).toContainText(STUB_TITLE);

    // Click share button in topbar
    const shareButton = page.locator(".post-detail-topbar__share");
    await expect(shareButton).toBeVisible();
    await shareButton.click();

    // Verify ShareCardSheet opens
    const sheet = page.locator('[data-testid="share-card-sheet"]');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute("role", "dialog");
    await expect(sheet).toHaveAttribute("aria-modal", "true");

    // Verify card preview content renders (after loading completes)
    const cardPreview = page.locator('[data-testid="share-card-preview"]');
    await expect(cardPreview).toBeVisible();

    // Verify title and summary
    await expect(cardPreview.locator(".share-card-sheet__title")).toContainText(STUB_TITLE);
    await expect(cardPreview.locator(".share-card-sheet__summary")).toContainText(STUB_SUMMARY);

    // Verify author name
    await expect(cardPreview.locator(".share-card-sheet__author")).toContainText(STUB_AUTHOR);

    // Verify audience label
    const audienceLabel = page.locator('[data-testid="share-card-audience"]');
    await expect(audienceLabel).toContainText(STUB_AUDIENCE);

    // Verify confirm button is enabled
    const confirmButton = page.locator('[data-testid="share-card-confirm"]');
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toBeEnabled();

    await api.dispose();
    await context.close();
  });

  test("closes share-card sheet when cancel button is clicked", async ({ browser }) => {
    skipIfRoleMissing("registered");
    const { api } = await loginAs("registered");
    const context = await browserContextForRole(browser, api);
    const page = await context.newPage();
    await installShareCardStubs(page);

    await page.goto(`/#/post/${STUB_TID}`);
    await expect(page.locator("body > .detail-surface")).toBeVisible();

    // Open share sheet
    await page.locator(".post-detail-topbar__share").click();
    const sheet = page.locator('[data-testid="share-card-sheet"]');
    await expect(sheet).toBeVisible();

    // Wait for card to load
    await expect(page.locator('[data-testid="share-card-preview"]')).toBeVisible();

    // Click cancel button (ghost variant in footer)
    const cancelButton = sheet.locator(".share-card-sheet__footer button").first();
    await cancelButton.click();

    // Verify sheet closes
    await expect(sheet).toHaveCount(0);

    await api.dispose();
    await context.close();
  });

  test("closes share-card sheet when backdrop is clicked", async ({ browser }) => {
    skipIfRoleMissing("registered");
    const { api } = await loginAs("registered");
    const context = await browserContextForRole(browser, api);
    const page = await context.newPage();
    await installShareCardStubs(page);

    await page.goto(`/#/post/${STUB_TID}`);
    await expect(page.locator("body > .detail-surface")).toBeVisible();

    // Open share sheet
    await page.locator(".post-detail-topbar__share").click();
    const sheet = page.locator('[data-testid="share-card-sheet"]');
    await expect(sheet).toBeVisible();

    // Click backdrop
    const backdrop = sheet.locator(".share-card-sheet__backdrop");
    await backdrop.click({ position: { x: 10, y: 10 } });

    // Verify sheet closes
    await expect(sheet).toHaveCount(0);

    await api.dispose();
    await context.close();
  });

  test("closes share-card sheet when close button (x) is clicked", async ({ browser }) => {
    skipIfRoleMissing("registered");
    const { api } = await loginAs("registered");
    const context = await browserContextForRole(browser, api);
    const page = await context.newPage();
    await installShareCardStubs(page);

    await page.goto(`/#/post/${STUB_TID}`);
    await expect(page.locator("body > .detail-surface")).toBeVisible();

    // Open share sheet
    await page.locator(".post-detail-topbar__share").click();
    const sheet = page.locator('[data-testid="share-card-sheet"]');
    await expect(sheet).toBeVisible();

    // Click close button in header
    const closeButton = sheet.locator(".share-card-sheet__close");
    await closeButton.click();

    // Verify sheet closes
    await expect(sheet).toHaveCount(0);

    await api.dispose();
    await context.close();
  });

  test("shows error state with retry button on network error", async ({ browser }) => {
    skipIfRoleMissing("registered");
    const { api } = await loginAs("registered");
    const context = await browserContextForRole(browser, api);
    const page = await context.newPage();
    await installShareCardErrorStub(page, "network");

    await page.goto(`/#/post/${STUB_TID}`);
    await expect(page.locator("body > .detail-surface")).toBeVisible();

    // Open share sheet
    await page.locator(".post-detail-topbar__share").click();
    const sheet = page.locator('[data-testid="share-card-sheet"]');
    await expect(sheet).toBeVisible();

    // Verify error state
    const errorState = page.locator('[data-testid="share-card-error"]');
    await expect(errorState).toBeVisible();

    // Verify retry button is visible for network errors
    const retryButton = page.locator('[data-testid="share-card-retry"]');
    await expect(retryButton).toBeVisible();

    // Verify confirm button is disabled in error state
    const confirmButton = page.locator('[data-testid="share-card-confirm"]');
    await expect(confirmButton).toBeDisabled();

    await api.dispose();
    await context.close();
  });

  test("shows error state without retry button on not-found error", async ({ browser }) => {
    skipIfRoleMissing("registered");
    const { api } = await loginAs("registered");
    const context = await browserContextForRole(browser, api);
    const page = await context.newPage();
    await installShareCardErrorStub(page, "not-found");

    await page.goto(`/#/post/${STUB_TID}`);
    await expect(page.locator("body > .detail-surface")).toBeVisible();

    // Open share sheet
    await page.locator(".post-detail-topbar__share").click();
    const sheet = page.locator('[data-testid="share-card-sheet"]');
    await expect(sheet).toBeVisible();

    // Verify error state
    const errorState = page.locator('[data-testid="share-card-error"]');
    await expect(errorState).toBeVisible();

    // Verify retry button is NOT visible for not-found errors
    const retryButton = page.locator('[data-testid="share-card-retry"]');
    await expect(retryButton).toHaveCount(0);

    await api.dispose();
    await context.close();
  });

  test("confirm button triggers share flow and closes sheet", async ({ browser }) => {
    skipIfRoleMissing("registered");
    const { api } = await loginAs("registered");
    const context = await browserContextForRole(browser, api);
    const page = await context.newPage();
    await installShareCardStubs(page);

    await page.goto(`/#/post/${STUB_TID}`);
    await expect(page.locator("body > .detail-surface")).toBeVisible();

    // Open share sheet
    await page.locator(".post-detail-topbar__share").click();
    const sheet = page.locator('[data-testid="share-card-sheet"]');
    await expect(sheet).toBeVisible();

    // Wait for card preview to load
    await expect(page.locator('[data-testid="share-card-preview"]')).toBeVisible();

    // Click confirm button
    const confirmButton = page.locator('[data-testid="share-card-confirm"]');
    await confirmButton.click();

    // Sheet should close after confirm (share flow completes)
    await expect(sheet).toHaveCount(0);

    await api.dispose();
    await context.close();
  });
});
