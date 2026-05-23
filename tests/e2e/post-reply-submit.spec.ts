import { expect, request, test, type Browser, type APIRequestContext } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

interface FeedItem {
  tid?: number | string;
  title?: string;
}

interface FeedResponse {
  items?: FeedItem[];
}

async function firstPublicFeedItem(api: APIRequestContext) {
  const response = await api.get("/api/feed?tab=%E6%AD%A4%E5%88%BB&page=1&limit=12");
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as FeedResponse;
  const item = body.items?.find((candidate) => candidate.tid && candidate.title);
  expect(item, "nat100 feed must expose at least one public item").toBeTruthy();
  return { tid: String(item!.tid), title: String(item!.title) };
}

async function openAuthenticatedPage(browser: Browser, api: APIRequestContext) {
  const context = await browser.newContext({ storageState: await api.storageState() });
  const page = await context.newPage();
  return { context, page };
}

test.describe("post reply submit flow", () => {
  test("login -> open post detail -> expand reply dock -> type content -> submit reply (stubbed)", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const anonApi = await request.newContext({ baseURL: BASE_URL });
    const item = await firstPublicFeedItem(anonApi);
    await anonApi.dispose();

    const { api } = await loginAs("registered", BASE_URL);
    const { context, page } = await openAuthenticatedPage(browser, api);

    // Track reply API calls
    let replyRequestCaptured = false;
    let capturedReplyContent = "";

    // Stub the reply endpoint to avoid real writes
    await page.route(`**/api/posts/${item.tid}/replies`, async (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        const postData = request.postDataJSON() as { content?: string };
        replyRequestCaptured = true;
        capturedReplyContent = postData?.content ?? "";
        // Return success response
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to post detail
    await page.goto(`/#/post/${item.tid}`);
    await expect(page.locator("#post-detail-title")).toContainText(item.title);

    // Verify reply dock is visible
    const replyDock = page.locator(".post-reply-dock");
    await expect(replyDock).toBeVisible();

    // Click on the reply placeholder to expand the dock
    const replyPlaceholder = page.locator(".post-reply-dock__reply-placeholder");
    await expect(replyPlaceholder).toBeVisible();
    await replyPlaceholder.click();

    // Wait for the dock to expand and textarea to appear
    await expect(replyDock).toHaveClass(/is-expanded/);
    const textarea = replyDock.locator("textarea");
    await expect(textarea).toBeVisible();

    // Type reply content
    const testReplyContent = `E2E test reply ${Date.now()}`;
    await textarea.fill(testReplyContent);

    // Click submit button
    const submitButton = replyDock.locator(".post-reply-dock__send");
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Verify the API request was made with correct content
    await expect.poll(() => replyRequestCaptured, { timeout: 5000 }).toBe(true);
    expect(capturedReplyContent).toBe(testReplyContent);

    // Cleanup
    await context.close();
    await api.dispose();
  });

  test("reply submit button is disabled when textarea is empty", async ({ browser }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const anonApi = await request.newContext({ baseURL: BASE_URL });
    const item = await firstPublicFeedItem(anonApi);
    await anonApi.dispose();

    const { api } = await loginAs("registered", BASE_URL);
    const { context, page } = await openAuthenticatedPage(browser, api);

    await page.goto(`/#/post/${item.tid}`);
    await expect(page.locator("#post-detail-title")).toContainText(item.title);

    const replyDock = page.locator(".post-reply-dock");
    await expect(replyDock).toBeVisible();

    // Expand the reply dock
    await page.locator(".post-reply-dock__reply-placeholder").click();
    await expect(replyDock).toHaveClass(/is-expanded/);

    // Verify submit button is disabled when textarea is empty
    const submitButton = replyDock.locator(".post-reply-dock__send");
    await expect(submitButton).toBeDisabled();

    // Type some content
    const textarea = replyDock.locator("textarea");
    await textarea.fill("test content");
    await expect(submitButton).toBeEnabled();

    // Clear the content
    await textarea.fill("");
    await expect(submitButton).toBeDisabled();

    // Cleanup
    await context.close();
    await api.dispose();
  });
});
