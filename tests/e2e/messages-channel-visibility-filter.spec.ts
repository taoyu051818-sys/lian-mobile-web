/**
 * Messages page channel visibility filter E2E tests (TDD red phase).
 *
 * This spec tests the channel visibility filtering feature on the messages page.
 * The feature allows users to filter channel messages by visibility level
 * (public, campus, school, private) and by category.
 *
 * Visibility levels (src/types/audience.ts):
 *   - public    — visible to everyone including guests
 *   - campus    — visible to users with campus verification
 *   - school    — visible to users with same school verification
 *   - private   — visible only to the author
 *   - linkOnly  — visible only via direct link
 *
 * Test structure:
 *   1. Guest scenarios — anonymous users with clientId
 *   2. Logged-in user scenarios — authenticated users with various permissions
 *   3. Dual-state filter UI — visibility vs category chip states
 *
 * These tests are expected to FAIL (red) because the feature is not yet
 * implemented. Use `test.fixme()` for tests that depend on unimplemented
 * functionality.
 */

import { expect, request, test, type Page } from "@playwright/test";

import { CLIENT_ID_KEY } from "../../src/platform/clientIdentity";

import { loginAs, skipIfRoleMissing } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

/**
 * Open a top-region shell tab by its visible label.
 * Mirrors the pattern from messages-notification-proof.spec.ts.
 */
async function openMessagesTab(page: Page, label: string) {
  const tab = page.locator(".shell-chrome__tab", { hasText: new RegExp(`^\\s*${label}\\s*$`) });
  await expect(tab).toBeVisible();
  await tab.click();
}

/**
 * Stub common endpoints to make tests hermetic.
 */
async function stubCommonEndpoints(
  page: Page,
  options: { loggedIn: boolean } = { loggedIn: false },
) {
  await page.route("**/api/feed**", async (route) => {
    await route.fulfill({
      json: {
        tabs: [{ id: "此刻", label: "此刻" }],
        items: [],
        hasMore: false,
        nextPage: null,
      },
    });
  });

  await page.route("**/api/auth/me", async (route) => {
    if (options.loggedIn) {
      await route.fulfill({
        json: {
          user: {
            id: "u1",
            username: "tester",
            displayName: "测试同学",
            avatarText: "测",
            identityTags: ["campus_verified"],
            aliases: [],
          },
        },
      });
    } else {
      await route.fulfill({ json: { user: null } });
    }
  });
}

/**
 * Inject a clientId into localStorage before navigation.
 * Guests use clientId for anonymous message sending.
 */
async function injectClientId(page: Page, clientId: string) {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    { key: CLIENT_ID_KEY, value: clientId },
  );
}

// =============================================================================
// Guest scenarios
// =============================================================================

test.describe("@channel-visibility guest scenarios", () => {
  test.fixme("guest can view public channel messages", async ({ page }) => {
    // Arrange: stub channel endpoint with public messages
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({
        json: {
          items: [
            {
              id: "msg-public-1",
              content: "这是一条公开消息",
              visibility: "public",
              author: { displayName: "某同学" },
              timestampISO: new Date().toISOString(),
            },
          ],
          hasMore: false,
          nextOffset: 0,
        },
      });
    });
    await stubCommonEndpoints(page, { loggedIn: false });

    // Act: navigate to messages and open channel tab
    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Assert: public message is visible
    const messageItem = page.locator('[data-testid="channel-message-item"]');
    await expect(messageItem).toBeVisible();
    await expect(messageItem).toContainText("这是一条公开消息");
  });

  test.fixme("guest can send public message with clientId", async ({ page }) => {
    const testClientId = "e2e-test-client-" + Date.now();
    await injectClientId(page, testClientId);

    let capturedRequest: { clientId?: string; visibility?: string } | null = null;
    await page.route("**/api/channel/send", async (route) => {
      const postData = route.request().postDataJSON();
      capturedRequest = postData;
      await route.fulfill({
        json: { success: true, messageId: "msg-new-1" },
      });
    });
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await stubCommonEndpoints(page, { loggedIn: false });

    // Act: navigate and attempt to send a message
    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Find and fill the message input
    const messageInput = page.locator('[data-testid="channel-message-input"]');
    await expect(messageInput).toBeVisible();
    await messageInput.fill("测试消息内容");

    // Click send button
    const sendButton = page.locator('[data-testid="channel-send-button"]');
    await sendButton.click();

    // Assert: request includes clientId and defaults to public visibility
    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest?.clientId).toBe(testClientId);
    expect(capturedRequest?.visibility).toBe("public");
  });

  test.fixme("guest cannot see non-public messages", async ({ page }) => {
    // Arrange: stub channel endpoint with mixed visibility messages
    await page.route("**/api/channel?*", async (route) => {
      // Backend should filter these, but we verify UI doesn't show them if leaked
      await route.fulfill({
        json: {
          items: [
            {
              id: "msg-public-1",
              content: "公开消息",
              visibility: "public",
              author: { displayName: "某同学" },
              timestampISO: new Date().toISOString(),
            },
            // These should NOT appear for guests (backend filters, but UI should also guard)
            {
              id: "msg-campus-1",
              content: "校园消息",
              visibility: "campus",
              author: { displayName: "校友" },
              timestampISO: new Date().toISOString(),
            },
          ],
          hasMore: false,
          nextOffset: 0,
        },
      });
    });
    await stubCommonEndpoints(page, { loggedIn: false });

    // Act
    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Assert: only public message is visible
    const publicMessage = page.locator('[data-testid="channel-message-item"]', {
      hasText: "公开消息",
    });
    await expect(publicMessage).toBeVisible();

    // Campus message should not be visible to guest
    const campusMessage = page.locator('[data-testid="channel-message-item"]', {
      hasText: "校园消息",
    });
    await expect(campusMessage).toHaveCount(0);
  });
});

// =============================================================================
// Logged-in user scenarios
// =============================================================================

test.describe("@channel-visibility logged-in user scenarios", () => {
  test.fixme("campus user can see campus-visible messages", async ({ page }) => {
    // Arrange: stub with campus-visible messages
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({
        json: {
          items: [
            {
              id: "msg-campus-1",
              content: "校园专属消息",
              visibility: "campus",
              author: { displayName: "校友" },
              timestampISO: new Date().toISOString(),
            },
          ],
          hasMore: false,
          nextOffset: 0,
        },
      });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    // Act
    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Assert: campus message is visible
    const campusMessage = page.locator('[data-testid="channel-message-item"]', {
      hasText: "校园专属消息",
    });
    await expect(campusMessage).toBeVisible();
  });

  test.fixme("user can send message with specified visibility", async ({ page }) => {
    let capturedRequest: { visibility?: string } | null = null;
    await page.route("**/api/channel/send", async (route) => {
      capturedRequest = route.request().postDataJSON();
      await route.fulfill({ json: { success: true, messageId: "msg-new-1" } });
    });
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    // Act
    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Select campus visibility before sending
    const visibilitySelector = page.locator('[data-testid="visibility-selector"]');
    await visibilitySelector.click();
    const campusOption = page.locator('[data-testid="visibility-option-campus"]');
    await campusOption.click();

    // Fill and send message
    const messageInput = page.locator('[data-testid="channel-message-input"]');
    await messageInput.fill("校园消息测试");
    const sendButton = page.locator('[data-testid="channel-send-button"]');
    await sendButton.click();

    // Assert: request includes campus visibility
    expect(capturedRequest?.visibility).toBe("campus");
  });

  test.fixme("user cannot see messages above their permission level", async ({ page }) => {
    // Arrange: user is campus-verified but not school-verified
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        json: {
          user: {
            id: "u1",
            username: "tester",
            displayName: "测试同学",
            identityTags: ["campus_verified"], // No school_verified
            aliases: [],
          },
        },
      });
    });
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({
        json: {
          items: [
            {
              id: "msg-campus-1",
              content: "校园消息",
              visibility: "campus",
              author: { displayName: "校友" },
              timestampISO: new Date().toISOString(),
            },
            // School-only message should not be visible
            {
              id: "msg-school-1",
              content: "本校专属消息",
              visibility: "school",
              author: { displayName: "本校同学" },
              timestampISO: new Date().toISOString(),
            },
          ],
          hasMore: false,
          nextOffset: 0,
        },
      });
    });
    await page.route("**/api/feed**", async (route) => {
      await route.fulfill({
        json: { tabs: [], items: [], hasMore: false, nextPage: null },
      });
    });

    // Act
    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Assert: campus message visible, school message not visible
    const campusMessage = page.locator('[data-testid="channel-message-item"]', {
      hasText: "校园消息",
    });
    await expect(campusMessage).toBeVisible();

    const schoolMessage = page.locator('[data-testid="channel-message-item"]', {
      hasText: "本校专属消息",
    });
    await expect(schoolMessage).toHaveCount(0);
  });
});

// =============================================================================
// Dual-state filter UI
// =============================================================================

test.describe("@channel-visibility dual-state filter UI", () => {
  test.fixme("State A (visibility) chips render correctly", async ({ page }) => {
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    // Act
    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Assert: visibility filter chips are present
    const filterChips = page.locator('[data-testid="channel-filter-chips"]');
    await expect(filterChips).toBeVisible();

    // Check for visibility state chips
    const publicChip = filterChips.locator('[data-filter-value="public"]');
    const campusChip = filterChips.locator('[data-filter-value="campus"]');
    const schoolChip = filterChips.locator('[data-filter-value="school"]');

    await expect(publicChip).toBeVisible();
    await expect(campusChip).toBeVisible();
    await expect(schoolChip).toBeVisible();

    // Public should be selected by default
    await expect(publicChip).toHaveAttribute("aria-pressed", "true");
  });

  test.fixme("State B (category) chips render correctly", async ({ page }) => {
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    // Act
    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Switch to category filter state
    const stateToggle = page.locator('[data-testid="filter-state-toggle"]');
    await stateToggle.click();

    // Assert: category filter chips are present
    const filterChips = page.locator('[data-testid="channel-filter-chips"]');
    await expect(filterChips).toBeVisible();

    // Check for category state chips (example categories)
    const allChip = filterChips.locator('[data-filter-value="all"]');
    await expect(allChip).toBeVisible();
  });

  test.fixme("switching states preserves filter selection", async ({ page }) => {
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    // Act
    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Select campus visibility
    const filterChips = page.locator('[data-testid="channel-filter-chips"]');
    const campusChip = filterChips.locator('[data-filter-value="campus"]');
    await campusChip.click();
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");

    // Switch to category state
    const stateToggle = page.locator('[data-testid="filter-state-toggle"]');
    await stateToggle.click();

    // Switch back to visibility state
    await stateToggle.click();

    // Assert: campus selection is preserved
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");
  });

  test.fixme("multi-select chips filter messages correctly", async ({ page }) => {
    let capturedUrl: string | null = null;
    await page.route("**/api/channel?*", async (route) => {
      capturedUrl = route.request().url();
      await route.fulfill({
        json: {
          items: [
            {
              id: "msg-1",
              content: "测试消息",
              visibility: "public",
              author: { displayName: "某同学" },
              timestampISO: new Date().toISOString(),
            },
          ],
          hasMore: false,
          nextOffset: 0,
        },
      });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    // Act
    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Select multiple visibility levels
    const filterChips = page.locator('[data-testid="channel-filter-chips"]');
    const publicChip = filterChips.locator('[data-filter-value="public"]');
    const campusChip = filterChips.locator('[data-filter-value="campus"]');

    await publicChip.click();
    await campusChip.click();

    // Assert: both chips are selected
    await expect(publicChip).toHaveAttribute("aria-pressed", "true");
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");

    // Assert: API request includes both visibility values
    expect(capturedUrl).toContain("visibility=public");
    expect(capturedUrl).toContain("visibility=campus");
  });

  test.fixme("filter request includes visibility param", async ({ page }) => {
    let capturedUrl: string | null = null;
    await page.route("**/api/channel?*", async (route) => {
      capturedUrl = route.request().url();
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    // Act
    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Select campus visibility
    const filterChips = page.locator('[data-testid="channel-filter-chips"]');
    const campusChip = filterChips.locator('[data-filter-value="campus"]');
    await campusChip.click();

    // Wait for the request to be made
    await page.waitForTimeout(100);

    // Assert: API request includes visibility param
    expect(capturedUrl).not.toBeNull();
    expect(capturedUrl).toContain("visibility=campus");
  });
});

// =============================================================================
// Integration tests with real API (skipped if roles not configured)
// =============================================================================

test.describe("@channel-visibility integration tests", () => {
  test.skip("campus user can fetch real channel messages", async () => {
    skipIfRoleMissing("campus");

    const { api } = await loginAs("campus", BASE_URL);
    try {
      const response = await api.get("/api/channel?visibility=campus");
      expect(response.ok()).toBe(true);

      const json = await response.json();
      expect(json).toHaveProperty("items");
      expect(Array.isArray(json.items)).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test.skip("anonymous user can only fetch public channel messages", async () => {
    const anonApi = await request.newContext({ baseURL: BASE_URL });
    try {
      // Public visibility should work
      const publicResponse = await anonApi.get("/api/channel?visibility=public");
      expect(publicResponse.ok()).toBe(true);

      // Campus visibility should be denied or return empty
      const campusResponse = await anonApi.get("/api/channel?visibility=campus");
      // Either 403 or empty items is acceptable
      if (campusResponse.ok()) {
        const json = await campusResponse.json();
        expect(json.items).toHaveLength(0);
      } else {
        expect(campusResponse.status()).toBe(403);
      }
    } finally {
      await anonApi.dispose();
    }
  });
});
