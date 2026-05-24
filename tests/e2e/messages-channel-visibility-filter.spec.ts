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
// Dual-state filter UI — Design Spec Lock
// =============================================================================
//
// 设计规格（锁定）：
//
// 状态 A（频道展开态）：显示频道的 visibility 筛选
// ┌─────────────────────────────────────────────────────────────┐
// │  [全部] [公开] [园区] [学校] [私密] [仅链接]       [•••]    │
// └─────────────────────────────────────────────────────────────┘
//
// 状态 B（分类展开态）：显示消息分类（回复/系统/订单）
// ┌─────────────────────────────────────────────────────────────┐
// │  [频道] [回复] [系统] [订单]                        [✕]     │
// └─────────────────────────────────────────────────────────────┘
//
// 交互流程：
// 1. 用户进入消息页面 → 默认在频道，显示状态 A
// 2. 点击 [•••] → 切换到状态 B，显示分类选择
// 3. 点击 [回复] / [系统] / [订单] → 切换到对应分类，状态 B 保持
// 4. 点击 [频道] → 回到频道，自动切换到状态 A
// 5. 点击 [✕] → 如果当前在频道，回到状态 A；否则保持状态 B
//
// 动效设计（Apple 风格）：
// - A → B：visibility chips 向左滑出 + fade out，分类 chips 从右滑入 + fade in
// - [•••] 旋转 90° 变成 [✕]
// - 整体 300ms spring(0.34, 1.56, 0.64, 1)
//
// 游客限制：
// - 游客：仅显示 [公开]，无 [•••] 按钮
// - 登录用户：按权限显示 visibility，显示全部分类

test.describe("@channel-visibility dual-state filter UI", () => {
  // ---------------------------------------------------------------------------
  // 状态 A（频道展开态）
  // ---------------------------------------------------------------------------

  test.fixme("State A: visibility chips render with all options for logged-in user", async ({
    page,
  }) => {
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Assert: visibility filter bar is visible
    const filterBar = page.locator('[data-testid="channel-filter-bar"]');
    await expect(filterBar).toBeVisible();

    // Assert: all visibility chips are present
    const filterChips = page.locator('[data-testid="channel-filter-chips"]');
    await expect(filterChips.locator('[data-filter-value="public"]')).toBeVisible();
    await expect(filterChips.locator('[data-filter-value="campus"]')).toBeVisible();
    await expect(filterChips.locator('[data-filter-value="school"]')).toBeVisible();
    await expect(filterChips.locator('[data-filter-value="private"]')).toBeVisible();
    await expect(filterChips.locator('[data-filter-value="linkOnly"]')).toBeVisible();

    // Assert: mode toggle button shows [•••] icon
    const modeToggle = page.locator('[data-testid="channel-filter-mode-toggle"]');
    await expect(modeToggle).toBeVisible();
    await expect(modeToggle).toHaveAttribute("data-mode", "visibility");
  });

  test.fixme("State A: guest only sees public chip, no mode toggle", async ({ page }) => {
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await stubCommonEndpoints(page, { loggedIn: false });

    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    const filterBar = page.locator('[data-testid="channel-filter-bar"]');
    await expect(filterBar).toBeVisible();

    // Assert: only public chip is visible for guest
    const filterChips = page.locator('[data-testid="channel-filter-chips"]');
    await expect(filterChips.locator('[data-filter-value="public"]')).toBeVisible();
    await expect(filterChips.locator('[data-filter-value="campus"]')).toHaveCount(0);
    await expect(filterChips.locator('[data-filter-value="school"]')).toHaveCount(0);

    // Assert: mode toggle is NOT visible for guest
    const modeToggle = page.locator('[data-testid="channel-filter-mode-toggle"]');
    await expect(modeToggle).toHaveCount(0);
  });

  // ---------------------------------------------------------------------------
  // 状态 B（分类展开态）
  // ---------------------------------------------------------------------------

  test.fixme("State B: category chips render after clicking mode toggle", async ({ page }) => {
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Click mode toggle to switch to State B
    const modeToggle = page.locator('[data-testid="channel-filter-mode-toggle"]');
    await modeToggle.click();

    // Assert: category chips are now visible
    const filterChips = page.locator('[data-testid="channel-filter-chips"]');
    await expect(filterChips.locator('[data-filter-value="channel"]')).toBeVisible();
    await expect(filterChips.locator('[data-filter-value="reply"]')).toBeVisible();
    await expect(filterChips.locator('[data-filter-value="system"]')).toBeVisible();
    await expect(filterChips.locator('[data-filter-value="order"]')).toBeVisible();

    // Assert: mode toggle now shows [✕] icon
    await expect(modeToggle).toHaveAttribute("data-mode", "category");
  });

  test.fixme("State B: channel chip has special highlight style", async ({ page }) => {
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Switch to State B
    const modeToggle = page.locator('[data-testid="channel-filter-mode-toggle"]');
    await modeToggle.click();

    // Assert: channel chip has special "back-to-channel" style
    const channelChip = page.locator('[data-filter-value="channel"]');
    await expect(channelChip).toHaveClass(/is-back-action/);
  });

  // ---------------------------------------------------------------------------
  // 交互流程
  // ---------------------------------------------------------------------------

  test.fixme("clicking category chip switches to that category, stays in State B", async ({
    page,
  }) => {
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await page.route("**/api/notifications**", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false } });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Switch to State B
    const modeToggle = page.locator('[data-testid="channel-filter-mode-toggle"]');
    await modeToggle.click();

    // Click "回复" category
    const replyChip = page.locator('[data-filter-value="reply"]');
    await replyChip.click();

    // Assert: reply chip is now active
    await expect(replyChip).toHaveAttribute("aria-pressed", "true");

    // Assert: still in State B (category mode)
    await expect(modeToggle).toHaveAttribute("data-mode", "category");
  });

  test.fixme("clicking channel chip returns to channel AND switches to State A", async ({
    page,
  }) => {
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await page.route("**/api/notifications**", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false } });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Switch to State B
    const modeToggle = page.locator('[data-testid="channel-filter-mode-toggle"]');
    await modeToggle.click();

    // Click "频道" chip
    const channelChip = page.locator('[data-filter-value="channel"]');
    await channelChip.click();

    // Assert: automatically switched back to State A (visibility mode)
    await expect(modeToggle).toHaveAttribute("data-mode", "visibility");

    // Assert: visibility chips are now visible
    const filterChips = page.locator('[data-testid="channel-filter-chips"]');
    await expect(filterChips.locator('[data-filter-value="public"]')).toBeVisible();
  });

  test.fixme("clicking [✕] when in channel returns to State A", async ({ page }) => {
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Switch to State B
    const modeToggle = page.locator('[data-testid="channel-filter-mode-toggle"]');
    await modeToggle.click();
    await expect(modeToggle).toHaveAttribute("data-mode", "category");

    // Click [✕] (mode toggle in State B)
    await modeToggle.click();

    // Assert: back to State A
    await expect(modeToggle).toHaveAttribute("data-mode", "visibility");
  });

  test.fixme("clicking [✕] when in other category stays in State B", async ({ page }) => {
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await page.route("**/api/notifications**", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false } });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Switch to State B and select "回复"
    const modeToggle = page.locator('[data-testid="channel-filter-mode-toggle"]');
    await modeToggle.click();
    const replyChip = page.locator('[data-filter-value="reply"]');
    await replyChip.click();

    // Click [✕]
    await modeToggle.click();

    // Assert: stays in State B (because we're in "回复", not "频道")
    await expect(modeToggle).toHaveAttribute("data-mode", "category");
  });

  // ---------------------------------------------------------------------------
  // 动效设计
  // ---------------------------------------------------------------------------

  test.fixme("State A → B transition has slide animation", async ({ page }) => {
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Assert: filter chips container has transition class
    const filterChips = page.locator('[data-testid="channel-filter-chips"]');
    await expect(filterChips).toHaveClass(/has-transition/);

    // Click mode toggle
    const modeToggle = page.locator('[data-testid="channel-filter-mode-toggle"]');
    await modeToggle.click();

    // Assert: animation class is applied during transition
    // (The actual animation is CSS-based, we just verify the class)
    await expect(filterChips).toHaveClass(/is-transitioning|has-transition/);
  });

  test.fixme("mode toggle icon rotates 90° during transition", async ({ page }) => {
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    const modeToggle = page.locator('[data-testid="channel-filter-mode-toggle"]');

    // Assert: toggle has rotation transition style
    const hasTransition = await modeToggle.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.transition.includes("transform") || style.transition.includes("all");
    });
    expect(hasTransition).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 状态保持
  // ---------------------------------------------------------------------------

  test.fixme("switching states preserves visibility filter selection", async ({ page }) => {
    await page.route("**/api/channel?*", async (route) => {
      await route.fulfill({ json: { items: [], hasMore: false, nextOffset: 0 } });
    });
    await stubCommonEndpoints(page, { loggedIn: true });

    await page.goto("/#/messages");
    await openMessagesTab(page, "频道");

    // Select campus visibility
    const filterChips = page.locator('[data-testid="channel-filter-chips"]');
    const campusChip = filterChips.locator('[data-filter-value="campus"]');
    await campusChip.click();
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");

    // Switch to State B
    const modeToggle = page.locator('[data-testid="channel-filter-mode-toggle"]');
    await modeToggle.click();

    // Switch back to State A
    await modeToggle.click();

    // Assert: campus selection is preserved
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");
  });

  test.fixme("multi-select visibility chips work correctly", async ({ page }) => {
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
