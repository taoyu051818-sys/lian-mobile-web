/**
 * PR-C of profile redesign #611 — posts-tab content filter chip strip.
 *
 * Backend `profile-activity-service.js#parseActivityContentFilter` already
 * accepts `?presentationIntent=` on `/api/me/posts`; the frontend chip strip
 * just emits the chosen value through `useProfileTabs.selectPostsContentFilter`
 * and lets the next list refresh fetch the narrowed collection.
 *
 * One e2e proof point: as the registered fixture, open `/#/profile`, switch
 * to the 发布 tab, click each chip, and verify the request that lands on
 * `/api/me/posts` carries the matching `?presentationIntent=` query param.
 * The chip's `data-filter-value` attribute is the test id surface (kept
 * stable across the structure test) so the spec doesn't depend on the
 * Chinese label drifting.
 *
 * Skip envelope: gated on `isRoleConfigured("registered")`. Without
 * LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD the suite
 * skips cleanly — the lane cannot be runtime-proven against an
 * unauthenticated host.
 */

import { expect, test, type APIRequestContext } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

test.describe
  .serial("@profile-posts-content-filter posts-tab content-filter chip strip (#611 PR-C)", () => {
  let api: APIRequestContext | null = null;

  test.beforeAll(async () => {
    if (!isRoleConfigured("registered")) return;
    const result = await loginAs("registered", BASE_URL);
    api = result.api;
  });

  test.afterAll(async () => {
    if (api) {
      await api.dispose();
      api = null;
    }
  });

  test("@profile-posts-content-filter chip strip renders only on the posts tab", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    expect(api, "registered login must have produced an API context").not.toBeNull();

    const context = await browser.newContext({ storageState: await api!.storageState() });
    const page = await context.newPage();
    try {
      await page.goto("/#/profile");
      await expect(page.locator(".profile-view")).toBeVisible();

      // History tab is the default — chip strip must not render.
      await expect(page.locator('[data-testid="profile-posts-content-filter"]')).toHaveCount(0);

      // Switch to 发布 → chip strip appears with the four expected
      // options. The data-filter-value attribute is the stable test id
      // surface (Chinese labels could drift; the value enum is locked
      // by the ProfilePostsContentFilter union).
      await page.locator(".profile-tabs").scrollIntoViewIfNeeded();
      const postsTab = page.getByRole("tab", { name: "发布" });
      await expect(postsTab).toBeVisible();
      await postsTab.click();

      const strip = page.locator('[data-testid="profile-posts-content-filter"]');
      await expect(strip).toBeVisible();
      for (const value of ["all", "merchant", "trade", "help"]) {
        await expect(strip.locator(`[data-filter-value="${value}"]`)).toBeVisible();
      }
      // Default selection is "all".
      await expect(strip.locator('[data-filter-value="all"]')).toHaveAttribute(
        "aria-selected",
        "true",
      );

      // Switch away → chip strip disappears.
      await page.getByRole("tab", { name: "浏览" }).click();
      await expect(page.locator('[data-testid="profile-posts-content-filter"]')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("@profile-posts-content-filter clicking a chip narrows /api/me/posts via ?presentationIntent=", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    expect(api, "registered login must have produced an API context").not.toBeNull();

    const context = await browser.newContext({ storageState: await api!.storageState() });
    const page = await context.newPage();
    try {
      await page.goto("/#/profile");
      await expect(page.locator(".profile-view")).toBeVisible();
      await page.getByRole("tab", { name: "发布" }).click();

      for (const value of ["merchant", "trade", "help"] as const) {
        // waitForRequest before the click so we don't miss a fast
        // request. The matcher is the literal query param the chip is
        // expected to attach.
        const request = page.waitForRequest(
          (req) =>
            req.method() === "GET" &&
            req.url().includes("/api/me/posts") &&
            req.url().includes(`presentationIntent=${value}`),
        );
        await page
          .locator(`[data-testid="profile-posts-content-filter"] [data-filter-value="${value}"]`)
          .click();
        await request;
        // aria-selected flips to the picked chip after the click.
        await expect(
          page.locator(
            `[data-testid="profile-posts-content-filter"] [data-filter-value="${value}"]`,
          ),
        ).toHaveAttribute("aria-selected", "true");
      }

      // Picking "all" clears the query → request URL ends at /api/me/posts
      // with no presentationIntent.
      const request = page.waitForRequest(
        (req) =>
          req.method() === "GET" &&
          req.url().includes("/api/me/posts") &&
          !req.url().includes("presentationIntent"),
      );
      await page
        .locator('[data-testid="profile-posts-content-filter"] [data-filter-value="all"]')
        .click();
      await request;
    } finally {
      await context.close();
    }
  });
});
