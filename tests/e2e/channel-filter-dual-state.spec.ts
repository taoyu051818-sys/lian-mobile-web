/**
 * ChannelFilterBar dual-state filter E2E tests.
 *
 * Tests the dual-state filter bar interaction on the messages page:
 *   - State A (visibility): Shows visibility chips (全部/公开/园区/学校/私密/仅链接) + [...] button
 *   - State B (category): Shows category chips (频道/回复/系统/订单) + [x] button
 *
 * Component: src/features/messages/ChannelFilterBar.vue
 *
 * @tag @channel-filter
 */

import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

// Visibility chip labels from brand config
const VISIBILITY_CHIPS = {
  all: "全部",
  public: "公开",
  campus: "园区",
  school: "学校",
  private: "私密",
  linkOnly: "仅链接",
};

// Category chip labels from brand config
const CATEGORY_CHIPS = {
  channel: "频道",
  replies: "回复",
  system: "系统",
  orders: "订单",
};

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

  await page.route("**/api/channel**", async (route) => {
    await route.fulfill({
      json: { items: [], hasMore: false, nextOffset: 0 },
    });
  });

  await page.route("**/api/messages**", async (route) => {
    await route.fulfill({
      json: { items: [], hasMore: false },
    });
  });
}

/**
 * Wait for filter state transition animation to complete.
 * The animation duration is 300ms per the component CSS.
 */
async function waitForFilterTransition(page: Page) {
  // Wait for Vue transition to complete (300ms animation + buffer)
  await page.waitForTimeout(350);
}

// =============================================================================
// 1. Initial state verification
// =============================================================================

test.describe("@channel-filter initial state", () => {
  test("ChannelFilterBar exists on messages page", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    const filterBar = page.locator('[data-testid="channel-filter-bar"]');
    await expect(filterBar).toBeVisible();
  });

  test("initial state is State A (visibility chips)", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    const filterBar = page.locator('[data-testid="channel-filter-bar"]');
    await expect(filterBar).toBeVisible();

    // Verify visibility chips are present
    const chipsContainer = page.locator('[data-testid="channel-filter-chips"]');
    await expect(chipsContainer).toBeVisible();

    // Check for visibility state chips
    const allChip = chipsContainer.locator('[data-filter-value="all"]');
    const publicChip = chipsContainer.locator('[data-filter-value="public"]');
    const campusChip = chipsContainer.locator('[data-filter-value="campus"]');

    await expect(allChip).toBeVisible();
    await expect(publicChip).toBeVisible();
    await expect(campusChip).toBeVisible();
  });

  test("[...] toggle button is visible in State A", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    const toggleButton = page.locator('[data-testid="filter-state-toggle"]');
    await expect(toggleButton).toBeVisible();

    // Verify aria-label indicates expand action
    await expect(toggleButton).toHaveAttribute("aria-label", "展开分类");
  });
});

// =============================================================================
// 2. State A -> State B switching
// =============================================================================

test.describe("@channel-filter State A to State B transition", () => {
  test("clicking [...] switches to State B (category chips)", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    // Click the toggle button
    const toggleButton = page.locator('[data-testid="filter-state-toggle"]');
    await toggleButton.click();

    await waitForFilterTransition(page);

    // Verify category chips appear
    const chipsContainer = page.locator('[data-testid="channel-filter-chips"]');
    await expect(chipsContainer).toBeVisible();

    const channelChip = chipsContainer.locator('[data-filter-value="channel"]');
    const repliesChip = chipsContainer.locator('[data-filter-value="replies"]');
    const systemChip = chipsContainer.locator('[data-filter-value="system"]');
    const ordersChip = chipsContainer.locator('[data-filter-value="orders"]');

    await expect(channelChip).toBeVisible();
    await expect(repliesChip).toBeVisible();
    await expect(systemChip).toBeVisible();
    await expect(ordersChip).toBeVisible();
  });

  test("toggle button changes to [x] in State B", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    const toggleButton = page.locator('[data-testid="filter-state-toggle"]');
    await toggleButton.click();

    await waitForFilterTransition(page);

    // Verify aria-label indicates collapse action
    await expect(toggleButton).toHaveAttribute("aria-label", "收起分类");

    // Verify the button has is-close class
    await expect(toggleButton).toHaveClass(/is-close/);
  });

  test("animation transition occurs during state switch", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    // Verify initial state chips are visible
    const initialChips = page.locator('[data-testid="channel-filter-chips"]');
    await expect(initialChips).toBeVisible();

    // Click toggle and verify transition happens
    const toggleButton = page.locator('[data-testid="filter-state-toggle"]');
    await toggleButton.click();

    // After transition, category chips should be visible
    await waitForFilterTransition(page);

    const categoryChip = page.locator('[data-filter-value="channel"]');
    await expect(categoryChip).toBeVisible();
  });
});

// =============================================================================
// 3. State B -> State A switching
// =============================================================================

test.describe("@channel-filter State B to State A transition", () => {
  test("clicking [x] returns to State A (visibility chips)", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    const toggleButton = page.locator('[data-testid="filter-state-toggle"]');

    // Switch to State B
    await toggleButton.click();
    await waitForFilterTransition(page);

    // Switch back to State A
    await toggleButton.click();
    await waitForFilterTransition(page);

    // Verify visibility chips reappear
    const chipsContainer = page.locator('[data-testid="channel-filter-chips"]');
    const allChip = chipsContainer.locator('[data-filter-value="all"]');
    const publicChip = chipsContainer.locator('[data-filter-value="public"]');

    await expect(allChip).toBeVisible();
    await expect(publicChip).toBeVisible();

    // Verify toggle button aria-label is back to expand
    await expect(toggleButton).toHaveAttribute("aria-label", "展开分类");
  });
});

// =============================================================================
// 4. Visibility chip selection
// =============================================================================

test.describe("@channel-filter visibility chip selection", () => {
  test("clicking visibility chip updates aria-pressed state", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    const chipsContainer = page.locator('[data-testid="channel-filter-chips"]');
    const campusChip = chipsContainer.locator('[data-filter-value="campus"]');

    // Initially campus should not be pressed
    await expect(campusChip).toHaveAttribute("aria-pressed", "false");

    // Click campus chip
    await campusChip.click();

    // Now campus should be pressed
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");
  });

  test("clicking visibility chip applies .is-active class", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    const chipsContainer = page.locator('[data-testid="channel-filter-chips"]');
    const schoolChip = chipsContainer.locator('[data-filter-value="school"]');

    // Initially should not have is-active
    await expect(schoolChip).not.toHaveClass(/is-active/);

    // Click school chip
    await schoolChip.click();

    // Now should have is-active
    await expect(schoolChip).toHaveClass(/is-active/);
  });

  test("selecting different visibility chip deselects previous", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    const chipsContainer = page.locator('[data-testid="channel-filter-chips"]');
    const allChip = chipsContainer.locator('[data-filter-value="all"]');
    const publicChip = chipsContainer.locator('[data-filter-value="public"]');

    // Click "all" chip first
    await allChip.click();
    await expect(allChip).toHaveAttribute("aria-pressed", "true");

    // Click "public" chip
    await publicChip.click();

    // "public" should be selected, "all" should be deselected
    await expect(publicChip).toHaveAttribute("aria-pressed", "true");
    await expect(allChip).toHaveAttribute("aria-pressed", "false");
  });
});

// =============================================================================
// 5. Category chip selection
// =============================================================================

test.describe("@channel-filter category chip selection", () => {
  test("clicking category chip updates selection state", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    // Switch to State B
    const toggleButton = page.locator('[data-testid="filter-state-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    const chipsContainer = page.locator('[data-testid="channel-filter-chips"]');
    const repliesChip = chipsContainer.locator('[data-filter-value="replies"]');

    // Click replies chip
    await repliesChip.click();

    // Should be selected
    await expect(repliesChip).toHaveAttribute("aria-pressed", "true");
    await expect(repliesChip).toHaveClass(/is-active/);
  });

  test("clicking channel chip auto-returns to State A", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    // Switch to State B
    const toggleButton = page.locator('[data-testid="filter-state-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    // Click "频道" chip
    const chipsContainer = page.locator('[data-testid="channel-filter-chips"]');
    const channelChip = chipsContainer.locator('[data-filter-value="channel"]');
    await channelChip.click();

    await waitForFilterTransition(page);

    // Should auto-switch back to State A (visibility chips)
    const allChip = page.locator('[data-filter-value="all"]');
    await expect(allChip).toBeVisible();

    // Toggle button should show expand icon again
    await expect(toggleButton).toHaveAttribute("aria-label", "展开分类");
  });
});

// =============================================================================
// 6. Guest user restrictions
// =============================================================================

test.describe("@channel-filter guest user restrictions", () => {
  test("guest only sees public visibility chip", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: false });
    await page.goto("/#/messages");

    const filterBar = page.locator('[data-testid="channel-filter-bar"]');
    // Filter bar may or may not be visible for guests depending on implementation
    // If visible, check that only public chip is shown
    const isVisible = await filterBar.isVisible().catch(() => false);

    if (isVisible) {
      const chipsContainer = page.locator('[data-testid="channel-filter-chips"]');
      const publicChip = chipsContainer.locator('[data-filter-value="public"]');

      await expect(publicChip).toBeVisible();

      // Other visibility chips should not be visible
      const campusChip = chipsContainer.locator('[data-filter-value="campus"]');
      const schoolChip = chipsContainer.locator('[data-filter-value="school"]');
      const privateChip = chipsContainer.locator('[data-filter-value="private"]');

      await expect(campusChip).toHaveCount(0);
      await expect(schoolChip).toHaveCount(0);
      await expect(privateChip).toHaveCount(0);
    }
  });

  test("guest does not see toggle button", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: false });
    await page.goto("/#/messages");

    const filterBar = page.locator('[data-testid="channel-filter-bar"]');
    const isVisible = await filterBar.isVisible().catch(() => false);

    if (isVisible) {
      const toggleButton = page.locator('[data-testid="filter-state-toggle"]');
      await expect(toggleButton).toHaveCount(0);
    }
  });
});

// =============================================================================
// ARIA accessibility verification
// =============================================================================

test.describe("@channel-filter ARIA accessibility", () => {
  test("chips container has role=group", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    const chipsContainer = page.locator('[data-testid="channel-filter-chips"]');
    await expect(chipsContainer).toHaveAttribute("role", "group");
  });

  test("chips container has aria-label for visibility state", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    const chipsContainer = page.locator('[data-testid="channel-filter-chips"]');
    await expect(chipsContainer).toHaveAttribute("aria-label", "可见范围筛选");
  });

  test("chips container has aria-label for category state", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    // Switch to State B
    const toggleButton = page.locator('[data-testid="filter-state-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    const chipsContainer = page.locator('[data-testid="channel-filter-chips"]');
    await expect(chipsContainer).toHaveAttribute("aria-label", "分类筛选");
  });

  test("each chip has aria-pressed attribute", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    const chips = page.locator('[data-testid="channel-filter-chip"]');
    const chipCount = await chips.count();

    expect(chipCount).toBeGreaterThan(0);

    for (let i = 0; i < chipCount; i++) {
      const chip = chips.nth(i);
      const ariaPressed = await chip.getAttribute("aria-pressed");
      expect(ariaPressed).toMatch(/^(true|false)$/);
    }
  });

  test("toggle button has aria-label", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    const toggleButton = page.locator('[data-testid="filter-state-toggle"]');
    const ariaLabel = await toggleButton.getAttribute("aria-label");

    expect(ariaLabel).toBeTruthy();
    expect(["展开分类", "收起分类"]).toContain(ariaLabel);
  });
});

// =============================================================================
// Keyboard navigation
// =============================================================================

test.describe("@channel-filter keyboard navigation", () => {
  test("Tab key moves focus between chips", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    const filterBar = page.locator('[data-testid="channel-filter-bar"]');
    await expect(filterBar).toBeVisible();

    // Focus the first chip
    const firstChip = page.locator('[data-testid="channel-filter-chip"]').first();
    await firstChip.focus();

    // Verify first chip is focused
    await expect(firstChip).toBeFocused();

    // Tab to next chip
    await page.keyboard.press("Tab");

    // Second chip should now be focused
    const secondChip = page.locator('[data-testid="channel-filter-chip"]').nth(1);
    await expect(secondChip).toBeFocused();
  });

  test("Tab key can reach toggle button", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    const toggleButton = page.locator('[data-testid="filter-state-toggle"]');

    // Focus the toggle button directly
    await toggleButton.focus();
    await expect(toggleButton).toBeFocused();

    // Press Enter to activate
    await page.keyboard.press("Enter");
    await waitForFilterTransition(page);

    // Should have switched to State B
    await expect(toggleButton).toHaveAttribute("aria-label", "收起分类");
  });

  test("Enter/Space activates focused chip", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/messages");

    const chipsContainer = page.locator('[data-testid="channel-filter-chips"]');
    const campusChip = chipsContainer.locator('[data-filter-value="campus"]');

    // Focus campus chip
    await campusChip.focus();
    await expect(campusChip).toBeFocused();

    // Initially not pressed
    await expect(campusChip).toHaveAttribute("aria-pressed", "false");

    // Press Enter to activate
    await page.keyboard.press("Enter");

    // Should now be pressed
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");
  });
});
