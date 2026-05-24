/**
 * Profile page complete user journey E2E tests.
 *
 * Covers the full profile experience for authenticated users:
 *   - Basic rendering (ProfileHeader, ProfileTabs)
 *   - Tab switching with ARIA state verification
 *   - Profile editor panel toggle and interaction
 *   - Identity/alias picker (if user has multiple aliases)
 *   - Merchant entry visibility based on verification status
 *
 * The spec uses two roles:
 *   - registered: baseline user without merchant_verified
 *   - merchant: user with merchant_verified tag
 *
 * Both lanes are wrapped in `test.skip(!isRoleConfigured(...))` so the spec
 * runs cleanly in environments without LIAN_E2E_*_USERNAME secrets.
 */

import { expect, test, type APIRequestContext } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

test.describe.serial("@profile-journey Profile page user journey", () => {
  let registeredApi: APIRequestContext | null = null;

  test.beforeAll(async () => {
    if (!isRoleConfigured("registered")) return;
    const result = await loginAs("registered", BASE_URL);
    registeredApi = result.api;
  });

  test.afterAll(async () => {
    if (registeredApi) {
      await registeredApi.dispose();
      registeredApi = null;
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Profile basic rendering
  // ─────────────────────────────────────────────────────────────────────────

  test("@profile-journey basic rendering: ProfileHeader and ProfileTabs visible", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    expect(registeredApi, "registered login must have produced an API context").not.toBeNull();

    const context = await browser.newContext({ storageState: await registeredApi!.storageState() });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/#/profile`);
      await expect(page.locator(".profile-view")).toBeVisible();

      // ProfileHeader should display user information
      const header = page.locator(".profile-header");
      await expect(header).toBeVisible({ timeout: 15000 });
      await expect(header.locator(".profile-header__name")).toBeVisible();
      await expect(header.locator(".profile-header__avatar")).toBeVisible();

      // ProfileTabs should exist with expected tabs
      const tablist = page.locator('.profile-tabs[role="tablist"]');
      await expect(tablist).toBeVisible();

      // Verify core tabs exist: history (浏览), saved (收藏), liked (点赞)
      await expect(page.getByRole("tab", { name: "浏览" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "收藏" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "点赞" })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Tab switching and content loading
  // ─────────────────────────────────────────────────────────────────────────

  test("@profile-journey tab switching updates aria-selected and loads content", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    expect(registeredApi, "registered login must have produced an API context").not.toBeNull();

    const context = await browser.newContext({ storageState: await registeredApi!.storageState() });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/#/profile`);
      await expect(page.locator(".profile-header")).toBeVisible({ timeout: 15000 });

      // Default tab is "history" (浏览)
      const historyTab = page.getByRole("tab", { name: "浏览" });
      await expect(historyTab).toHaveAttribute("aria-selected", "true");

      // Click "收藏" (saved) tab
      const savedTab = page.getByRole("tab", { name: "收藏" });
      await savedTab.click();
      await expect(savedTab).toHaveAttribute("aria-selected", "true");
      await expect(historyTab).toHaveAttribute("aria-selected", "false");

      // Verify content area shows list or empty state (not error)
      await expect(page.locator(".profile-collection-list, .profile-view__state")).toBeVisible({
        timeout: 10000,
      });

      // Click "点赞" (liked) tab
      const likedTab = page.getByRole("tab", { name: "点赞" });
      await likedTab.click();
      await expect(likedTab).toHaveAttribute("aria-selected", "true");
      await expect(savedTab).toHaveAttribute("aria-selected", "false");

      // Switch back to history
      await historyTab.click();
      await expect(historyTab).toHaveAttribute("aria-selected", "true");
      await expect(likedTab).toHaveAttribute("aria-selected", "false");
    } finally {
      await context.close();
    }
  });

  test("@profile-journey posts tab shows content filter chip strip", async ({ browser }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    expect(registeredApi, "registered login must have produced an API context").not.toBeNull();

    const context = await browser.newContext({ storageState: await registeredApi!.storageState() });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/#/profile`);
      await expect(page.locator(".profile-header")).toBeVisible({ timeout: 15000 });

      // Content filter chip strip should not be visible on history tab
      await expect(page.locator('[data-testid="profile-posts-content-filter"]')).toHaveCount(0);

      // Switch to posts tab (发布)
      const postsTab = page.getByRole("tab", { name: "发布" });
      await postsTab.click();
      await expect(postsTab).toHaveAttribute("aria-selected", "true");

      // Content filter chip strip should now be visible
      const chipStrip = page.locator('[data-testid="profile-posts-content-filter"]');
      await expect(chipStrip).toBeVisible({ timeout: 10000 });

      // Default selection is "all"
      await expect(chipStrip.locator('[data-filter-value="all"]')).toHaveAttribute(
        "aria-selected",
        "true",
      );
    } finally {
      await context.close();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Profile editor flow
  // ─────────────────────────────────────────────────────────────────────────

  test("@profile-journey editor panel toggle via chrome button", async ({ browser }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    expect(registeredApi, "registered login must have produced an API context").not.toBeNull();

    const context = await browser.newContext({ storageState: await registeredApi!.storageState() });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/#/profile`);
      await expect(page.locator(".profile-header")).toBeVisible({ timeout: 15000 });

      // Editor panel should not be visible initially
      await expect(page.locator(".profile-editor")).toHaveCount(0);

      // Find and click the "编辑资料" button
      const editButton = page.locator(".shell-chrome .lian-button", { hasText: "编辑资料" });
      await expect(editButton).toBeVisible();
      await editButton.click();

      // Editor panel should now be visible
      const editorPanel = page.locator(".profile-editor");
      await expect(editorPanel).toBeVisible();

      // Verify editor sections exist
      // Avatar section
      await expect(
        editorPanel.locator('section[aria-labelledby="profile-avatar-title"]'),
      ).toBeVisible();

      // Alias section (发布身份)
      await expect(
        editorPanel.locator('section[aria-labelledby="profile-alias-title"]'),
      ).toBeVisible();

      // Close editor via collapse button
      const collapseButton = page.locator(".shell-chrome .lian-button", { hasText: "收起编辑" });
      await expect(collapseButton).toBeVisible();
      await collapseButton.click();

      // Editor panel should be hidden
      await expect(page.locator(".profile-editor")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Identity/alias picker interaction
  // ─────────────────────────────────────────────────────────────────────────

  test("@profile-journey alias card renders and picker toggles if multiple aliases", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    expect(registeredApi, "registered login must have produced an API context").not.toBeNull();

    const context = await browser.newContext({ storageState: await registeredApi!.storageState() });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/#/profile`);
      await expect(page.locator(".profile-header")).toBeVisible({ timeout: 15000 });

      // Check if alias card exists (it may not if user has no aliases configured)
      const aliasCard = page.locator(".profile-header__alias-card");
      const aliasCardCount = await aliasCard.count();

      if (aliasCardCount > 0) {
        // Alias card is present
        await expect(aliasCard).toBeVisible();

        // Check if it's clickable (has multiple aliases)
        const isClickable = await aliasCard.evaluate((el) =>
          el.classList.contains("profile-header__alias-card--clickable"),
        );

        if (isClickable) {
          // Should have aria-expanded attribute
          await expect(aliasCard).toHaveAttribute("aria-expanded", "false");
          await expect(aliasCard).toHaveAttribute("aria-haspopup", "listbox");

          // Click to open picker
          await aliasCard.click();
          await expect(aliasCard).toHaveAttribute("aria-expanded", "true");

          // Picker should be visible with listbox role
          const picker = page.locator('.profile-header__alias-picker[role="listbox"]');
          await expect(picker).toBeVisible();

          // Should have at least the real identity option
          const realIdentityOption = picker.locator('[role="option"]').first();
          await expect(realIdentityOption).toBeVisible();

          // Click again to close
          await aliasCard.click();
          await expect(aliasCard).toHaveAttribute("aria-expanded", "false");
        }
      }
      // If no alias card, the test passes — user simply has no aliases
    } finally {
      await context.close();
    }
  });

  test("@profile-journey alias selector in editor shows radio options", async ({ browser }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    expect(registeredApi, "registered login must have produced an API context").not.toBeNull();

    const context = await browser.newContext({ storageState: await registeredApi!.storageState() });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/#/profile`);
      await expect(page.locator(".profile-header")).toBeVisible({ timeout: 15000 });

      // Open editor panel
      await page.locator(".shell-chrome .lian-button", { hasText: "编辑资料" }).click();
      const editorPanel = page.locator(".profile-editor");
      await expect(editorPanel).toBeVisible();

      // Alias section should be present
      const aliasSection = editorPanel.locator('section[aria-labelledby="profile-alias-title"]');
      await expect(aliasSection).toBeVisible();
      await expect(aliasSection.locator("#profile-alias-title")).toContainText("发布身份");

      // Real identity radio (value="") should always exist
      const realIdentityRadio = aliasSection.locator('input[type="radio"][value=""]');
      await expect(realIdentityRadio).toBeAttached();

      // The label should contain "真实身份"
      await expect(aliasSection.locator(".profile-editor__alias").first()).toContainText(
        "真实身份",
      );
    } finally {
      await context.close();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Merchant entry visibility
// ─────────────────────────────────────────────────────────────────────────────

test.describe("@profile-journey merchant entry visibility", () => {
  test("@profile-journey merchant_verified user sees merchant center entry", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("merchant"),
      "merchant role not configured — set LIAN_E2E_MERCHANT_USERNAME / LIAN_E2E_MERCHANT_PASSWORD",
    );

    const { api, user } = await loginAs("merchant", BASE_URL);
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      // Sanity check: user should have merchant_verified tag
      const tags = new Set<string>([...(user.tags ?? []), ...(user.verificationTags ?? [])]);
      expect(
        tags.has("merchant_verified"),
        `merchant fixture must carry merchant_verified; got [${[...tags].join(", ") || "<none>"}]`,
      ).toBe(true);

      await page.goto(`${BASE_URL}/#/profile`);
      await expect(page.locator(".profile-header")).toBeVisible({ timeout: 15000 });

      // Merchant entry should be visible
      const merchantEntry = page.locator('[data-testid="profile-merchant-entry"]');
      await expect(merchantEntry).toBeVisible();

      // The button inside should be clickable
      await expect(merchantEntry.locator("button")).toBeEnabled();
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  test("@profile-journey registered user does NOT see merchant center entry", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const { api, user } = await loginAs("registered", BASE_URL);
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      // Sanity check: user should NOT have merchant_verified tag
      const tags = new Set<string>([...(user.tags ?? []), ...(user.verificationTags ?? [])]);
      expect(
        tags.has("merchant_verified"),
        `registered fixture must NOT carry merchant_verified; got [${[...tags].join(", ") || "<none>"}]`,
      ).toBe(false);

      await page.goto(`${BASE_URL}/#/profile`);
      // Wait for profile to fully load — verification entry is always present
      await expect(page.locator(".profile-view__verification-entry")).toBeVisible({
        timeout: 15000,
      });

      // Merchant entry should NOT be visible
      await expect(page.locator('[data-testid="profile-merchant-entry"]')).toHaveCount(0);
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});
