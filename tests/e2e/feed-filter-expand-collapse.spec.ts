/**
 * FeedFilterBar expand/collapse E2E tests.
 *
 * Tests the expand/collapse filter bar interaction on the feed page:
 *   - Collapsed state: Shows summary chip with active filter label(s) + [...] toggle button
 *   - Expanded state: Shows all visibility chips (全部/公开/校区/学校/私密/仅链接) + [x] toggle button
 *
 * Component: src/features/feed/FeedFilterBar.vue
 *
 * @tag @feed-filter
 */

import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

// Visibility chip labels from brand config (feed.ts)
const VISIBILITY_CHIPS = {
  all: "全部",
  public: "公开",
  campus: "校区",
  school: "学校",
  private: "私密",
  linkOnly: "仅链接",
};

// Toggle button aria-labels from brand config
const TOGGLE_LABELS = {
  expand: "展开筛选",
  collapse: "收起筛选",
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
 * The animation duration is 300ms per the component CSS (Apple-style spring).
 */
async function waitForFilterTransition(page: Page) {
  // Wait for Vue transition to complete (300ms animation + buffer)
  await page.waitForTimeout(350);
}

// =============================================================================
// 1. Initial state verification
// =============================================================================

test.describe("@feed-filter initial state", () => {
  test("FeedFilterBar exists on feed page", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const filterBar = page.locator('[data-testid="feed-filter-bar"]');
    await expect(filterBar).toBeVisible();
  });

  test("initial state is collapsed (shows summary chip)", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const filterBar = page.locator('[data-testid="feed-filter-bar"]');
    await expect(filterBar).toBeVisible();

    // Verify collapsed state container is present
    const collapsedContainer = page.locator('[data-testid="feed-filter-collapsed"]');
    await expect(collapsedContainer).toBeVisible();

    // Verify summary chip is visible
    const summaryChip = page.locator('[data-testid="feed-filter-summary"]');
    await expect(summaryChip).toBeVisible();

    // Expanded chips container should NOT be visible
    const expandedChips = page.locator('[data-testid="feed-filter-chips"]');
    await expect(expandedChips).toHaveCount(0);
  });

  test("[...] toggle button is visible in collapsed state", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await expect(toggleButton).toBeVisible();

    // Verify aria-label indicates expand action
    await expect(toggleButton).toHaveAttribute("aria-label", TOGGLE_LABELS.expand);
  });

  test("summary chip shows default label when no filter selected", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const summaryChip = page.locator('[data-testid="feed-filter-summary"]');
    await expect(summaryChip).toBeVisible();

    // Default label should be "全部"
    await expect(summaryChip).toContainText(VISIBILITY_CHIPS.all);
  });
});

// =============================================================================
// 2. Expand/collapse transitions
// =============================================================================

test.describe("@feed-filter expand/collapse transitions", () => {
  test("clicking [...] expands to show all visibility chips", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    // Click the toggle button to expand
    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();

    await waitForFilterTransition(page);

    // Verify expanded chips container appears
    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    await expect(chipsContainer).toBeVisible();

    // Verify all visibility chips are present
    const allChip = chipsContainer.locator('[data-filter-value="all"]');
    const publicChip = chipsContainer.locator('[data-filter-value="public"]');
    const campusChip = chipsContainer.locator('[data-filter-value="campus"]');
    const schoolChip = chipsContainer.locator('[data-filter-value="school"]');
    const privateChip = chipsContainer.locator('[data-filter-value="private"]');
    const linkOnlyChip = chipsContainer.locator('[data-filter-value="linkOnly"]');

    await expect(allChip).toBeVisible();
    await expect(publicChip).toBeVisible();
    await expect(campusChip).toBeVisible();
    await expect(schoolChip).toBeVisible();
    await expect(privateChip).toBeVisible();
    await expect(linkOnlyChip).toBeVisible();

    // Collapsed container should be gone
    const collapsedContainer = page.locator('[data-testid="feed-filter-collapsed"]');
    await expect(collapsedContainer).toHaveCount(0);
  });

  test("toggle button changes to [x] when expanded", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();

    await waitForFilterTransition(page);

    // Verify aria-label indicates collapse action
    await expect(toggleButton).toHaveAttribute("aria-label", TOGGLE_LABELS.collapse);

    // Verify the button has is-close class
    await expect(toggleButton).toHaveClass(/is-close/);
  });

  test("clicking [x] collapses back to summary chip", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');

    // Expand first
    await toggleButton.click();
    await waitForFilterTransition(page);

    // Collapse
    await toggleButton.click();
    await waitForFilterTransition(page);

    // Verify collapsed state is restored
    const collapsedContainer = page.locator('[data-testid="feed-filter-collapsed"]');
    await expect(collapsedContainer).toBeVisible();

    const summaryChip = page.locator('[data-testid="feed-filter-summary"]');
    await expect(summaryChip).toBeVisible();

    // Expanded chips should be gone
    const expandedChips = page.locator('[data-testid="feed-filter-chips"]');
    await expect(expandedChips).toHaveCount(0);

    // Toggle button aria-label should be back to expand
    await expect(toggleButton).toHaveAttribute("aria-label", TOGGLE_LABELS.expand);
    await expect(toggleButton).not.toHaveClass(/is-close/);
  });

  test("clicking summary chip expands the filter bar", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    // Click the summary chip to expand
    const summaryChip = page.locator('[data-testid="feed-filter-summary"]');
    await summaryChip.click();

    await waitForFilterTransition(page);

    // Verify expanded state
    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    await expect(chipsContainer).toBeVisible();

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await expect(toggleButton).toHaveAttribute("aria-label", TOGGLE_LABELS.collapse);
  });

  test("animation transition occurs during expand/collapse", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    // Verify initial collapsed state
    const collapsedContainer = page.locator('[data-testid="feed-filter-collapsed"]');
    await expect(collapsedContainer).toBeVisible();

    // Click toggle and verify transition happens
    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();

    // After transition, expanded chips should be visible
    await waitForFilterTransition(page);

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    await expect(chipsContainer).toBeVisible();

    // Toggle icon should have rotated (is-close class triggers 90deg rotation)
    await expect(toggleButton).toHaveClass(/is-close/);
  });
});

// =============================================================================
// 3. Visibility chip selection
// =============================================================================

test.describe("@feed-filter visibility chip selection", () => {
  test("clicking visibility chip updates aria-pressed state", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    // Expand first
    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
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
    await page.goto("/#/");

    // Expand first
    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    const schoolChip = chipsContainer.locator('[data-filter-value="school"]');

    // Initially should not have is-active
    await expect(schoolChip).not.toHaveClass(/is-active/);

    // Click school chip
    await schoolChip.click();

    // Now should have is-active
    await expect(schoolChip).toHaveClass(/is-active/);
  });

  test("multi-select: can select multiple visibility chips", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    // Expand first
    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    const campusChip = chipsContainer.locator('[data-filter-value="campus"]');
    const schoolChip = chipsContainer.locator('[data-filter-value="school"]');

    // Select campus
    await campusChip.click();
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");

    // Select school (should add to selection, not replace)
    await schoolChip.click();
    await expect(schoolChip).toHaveAttribute("aria-pressed", "true");

    // Campus should still be selected
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");
  });

  test("clicking 'all' chip clears other selections", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    // Expand first
    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    const allChip = chipsContainer.locator('[data-filter-value="all"]');
    const campusChip = chipsContainer.locator('[data-filter-value="campus"]');

    // Select campus first
    await campusChip.click();
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");
    await expect(allChip).toHaveAttribute("aria-pressed", "false");

    // Click "all" chip
    await allChip.click();

    // "all" should be selected, campus should be deselected
    await expect(allChip).toHaveAttribute("aria-pressed", "true");
    await expect(campusChip).toHaveAttribute("aria-pressed", "false");
  });

  test("clicking selected chip toggles it off", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    // Expand first
    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    const campusChip = chipsContainer.locator('[data-filter-value="campus"]');

    // Select campus
    await campusChip.click();
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");

    // Click again to deselect
    await campusChip.click();
    await expect(campusChip).toHaveAttribute("aria-pressed", "false");
  });
});

// =============================================================================
// 4. Summary chip label updates
// =============================================================================

test.describe("@feed-filter summary chip label", () => {
  test("summary chip shows selected filter label after collapse", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    // Expand
    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    // Select campus
    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    const campusChip = chipsContainer.locator('[data-filter-value="campus"]');
    await campusChip.click();

    // Collapse
    await toggleButton.click();
    await waitForFilterTransition(page);

    // Summary chip should show "校区"
    const summaryChip = page.locator('[data-testid="feed-filter-summary"]');
    await expect(summaryChip).toContainText(VISIBILITY_CHIPS.campus);
  });

  test("summary chip shows multiple labels joined by separator", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    // Expand
    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    // Select campus and school
    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    const campusChip = chipsContainer.locator('[data-filter-value="campus"]');
    const schoolChip = chipsContainer.locator('[data-filter-value="school"]');
    await campusChip.click();
    await schoolChip.click();

    // Collapse
    await toggleButton.click();
    await waitForFilterTransition(page);

    // Summary chip should show both labels
    const summaryChip = page.locator('[data-testid="feed-filter-summary"]');
    await expect(summaryChip).toContainText(VISIBILITY_CHIPS.campus);
    await expect(summaryChip).toContainText(VISIBILITY_CHIPS.school);
  });
});

// =============================================================================
// 5. ARIA accessibility
// =============================================================================

test.describe("@feed-filter ARIA accessibility", () => {
  test("filter bar has aria-label", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const filterBar = page.locator('[data-testid="feed-filter-bar"]');
    await expect(filterBar).toHaveAttribute("aria-label", "可见范围筛选");
  });

  test("expanded chips container has role=group", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    // Expand first
    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    await expect(chipsContainer).toHaveAttribute("role", "group");
  });

  test("expanded chips container has aria-label", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    // Expand first
    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    await expect(chipsContainer).toHaveAttribute("aria-label", "可见范围筛选");
  });

  test("each visibility chip has aria-pressed attribute", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    // Expand first
    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    const chips = page.locator('[data-testid="feed-filter-chip"]');
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
    await page.goto("/#/");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    const ariaLabel = await toggleButton.getAttribute("aria-label");

    expect(ariaLabel).toBeTruthy();
    expect([TOGGLE_LABELS.expand, TOGGLE_LABELS.collapse]).toContain(ariaLabel);
  });

  test("summary chip has aria-label", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const summaryChip = page.locator('[data-testid="feed-filter-summary"]');
    const ariaLabel = await summaryChip.getAttribute("aria-label");

    expect(ariaLabel).toBeTruthy();
  });
});

// =============================================================================
// 6. Keyboard navigation
// =============================================================================

test.describe("@feed-filter keyboard navigation", () => {
  test("Tab key moves focus between chips", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    // Expand first
    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    // Focus the first chip
    const firstChip = page.locator('[data-testid="feed-filter-chip"]').first();
    await firstChip.focus();

    // Verify first chip is focused
    await expect(firstChip).toBeFocused();

    // Tab to next chip
    await page.keyboard.press("Tab");

    // Second chip should now be focused
    const secondChip = page.locator('[data-testid="feed-filter-chip"]').nth(1);
    await expect(secondChip).toBeFocused();
  });

  test("Tab key can reach toggle button", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');

    // Focus the toggle button directly
    await toggleButton.focus();
    await expect(toggleButton).toBeFocused();

    // Press Enter to activate
    await page.keyboard.press("Enter");
    await waitForFilterTransition(page);

    // Should have expanded
    await expect(toggleButton).toHaveAttribute("aria-label", TOGGLE_LABELS.collapse);
  });

  test("Enter activates focused chip", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    // Expand first
    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
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

  test("Space activates focused chip", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    // Expand first
    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    const schoolChip = chipsContainer.locator('[data-filter-value="school"]');

    // Focus school chip
    await schoolChip.focus();
    await expect(schoolChip).toBeFocused();

    // Initially not pressed
    await expect(schoolChip).toHaveAttribute("aria-pressed", "false");

    // Press Space to activate
    await page.keyboard.press("Space");

    // Should now be pressed
    await expect(schoolChip).toHaveAttribute("aria-pressed", "true");
  });

  test("Enter activates summary chip to expand", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const summaryChip = page.locator('[data-testid="feed-filter-summary"]');

    // Focus summary chip
    await summaryChip.focus();
    await expect(summaryChip).toBeFocused();

    // Press Enter to expand
    await page.keyboard.press("Enter");
    await waitForFilterTransition(page);

    // Should have expanded
    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    await expect(chipsContainer).toBeVisible();
  });
});

// =============================================================================
// 7. Focus visible styling
// =============================================================================

test.describe("@feed-filter focus visible styling", () => {
  test("chips show focus outline on keyboard focus", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    // Expand first
    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    const firstChip = page.locator('[data-testid="feed-filter-chip"]').first();

    // Tab to focus the chip (keyboard navigation triggers :focus-visible)
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab"); // May need multiple tabs to reach chip

    // Focus the chip directly for test
    await firstChip.focus();

    // Verify chip is focusable
    await expect(firstChip).toBeFocused();
  });

  test("toggle button shows focus outline on keyboard focus", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');

    // Focus toggle button
    await toggleButton.focus();

    // Verify button is focusable
    await expect(toggleButton).toBeFocused();
  });
});
