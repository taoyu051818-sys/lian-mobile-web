import { expect, test } from "@playwright/test";

import {
  LOCAL_POST_TID,
  LOCAL_POST_TITLE,
  LOCAL_PUBLISHED_BODY,
  LOCAL_PUBLISHED_TID,
  LOCAL_PUBLISHED_TITLE,
  expectNoUnexpectedApiRequests,
  installLocalCoreApi,
  loginThroughUi,
} from "./core-fixture";

test.describe("@local-core deterministic core journeys", () => {
  test("anonymous opens the home page", async ({ page }) => {
    const state = await installLocalCoreApi(page);
    await page.goto("/");

    await expect(page.locator(".feed-view")).toBeVisible();
    await expect(page.locator('.bottom-tab-bar__item[aria-current="page"]')).toContainText("首页");
    expectNoUnexpectedApiRequests(state);
  });

  test("anonymous browses the deterministic feed", async ({ page }) => {
    const state = await installLocalCoreApi(page);
    const feedResponse = page.waitForResponse((response) => response.url().includes("/api/feed"));
    await page.goto("/");

    await expect((await feedResponse).ok()).toBe(true);
    const card = page.locator(".feed-item-card").filter({ hasText: LOCAL_POST_TITLE });
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    expectNoUnexpectedApiRequests(state);
  });

  test("anonymous opens the Konva campus map", async ({ page }) => {
    const state = await installLocalCoreApi(page);
    const mapResponse = page.waitForResponse((response) =>
      response.url().includes("/api/map/v2/items"),
    );

    await page.goto("/#/map");

    await expect((await mapResponse).ok()).toBe(true);
    await expect(page.locator('[data-testid="konva-map-stage"] canvas').first()).toBeVisible();
    await expect(page.locator('[data-testid="konva-map-zoom-controls"]')).toBeVisible();
    await page.locator('[data-testid="konva-map-zoom-in"]').click();
    await page.locator('[data-testid="konva-map-zoom-out"]').click();
    expectNoUnexpectedApiRequests(state);
  });

  test("anonymous opens a deterministic post detail", async ({ page }) => {
    const state = await installLocalCoreApi(page);
    await page.goto("/");
    const card = page.locator(".feed-item-card").filter({ hasText: LOCAL_POST_TITLE });
    await expect(card).toBeVisible();

    const detailResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/api/posts/${LOCAL_POST_TID}`),
    );
    await card.click();
    await expect((await detailResponse).ok()).toBe(true);
    await expect(page.locator("#post-detail-title")).toContainText(LOCAL_POST_TITLE);
    await expect(page.locator(".post-detail-panel__state")).toHaveCount(0);
    expectNoUnexpectedApiRequests(state);
  });

  test("profile performs an explicit anonymous login-state probe", async ({ page }) => {
    const state = await installLocalCoreApi(page);
    const authProbe = page.waitForResponse(
      (response) => response.url().endsWith("/api/auth/me") && response.status() === 200,
    );
    await page.goto("/#/profile");

    expect(await (await authProbe).json()).toEqual({ user: null });
    await expect(page.locator(".auth-panel")).toBeVisible();
    expect(state.authProbeCount).toBeGreaterThan(0);
    expectNoUnexpectedApiRequests(state);
  });

  test("registered fixture logs in through the UI", async ({ page }) => {
    const state = await installLocalCoreApi(page);
    await loginThroughUi(page, state);

    await expect(page.locator(".profile-view")).toBeVisible();
    await expect(page.locator(".auth-panel")).toHaveCount(0);
    expectNoUnexpectedApiRequests(state);
  });

  test("registered fixture publishes an ordinary text post through the UI", async ({ page }) => {
    const state = await installLocalCoreApi(page);
    await loginThroughUi(page, state);
    await page.goto("/#/publish");

    await expect(page.locator(".publish-view")).toBeVisible();
    await expect(page.getByTestId("publish-auth-gate")).toHaveCount(0);
    await page.locator(".publish-composer__headline input").fill(LOCAL_PUBLISHED_TITLE);
    await page.locator(".publish-composer__body-field textarea").fill(LOCAL_PUBLISHED_BODY);

    const submit = page.locator('.publish-action-bar button[type="submit"]');
    await expect(submit).toBeEnabled();
    const publishResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/ai/post-publish") && response.request().method() === "POST",
    );
    await submit.click();
    await expect((await publishResponse).ok()).toBe(true);
    expect(state.publishCount).toBe(1);

    const viewPost = page.getByTestId("publish-view-post-link");
    await expect(viewPost).toBeVisible();
    await expect(viewPost).toHaveAttribute("href", `#/post/${LOCAL_PUBLISHED_TID}`);
    await viewPost.click();
    await expect(page.locator("#post-detail-title")).toContainText(LOCAL_PUBLISHED_TITLE);
    expectNoUnexpectedApiRequests(state);
  });
});
