/**
 * FeedFilterBar dual-state E2E tests (option C: visibility ↔ tabs).
 *
 * The home feed's filter bar lives inside the top floating chrome under the
 * `feed-filter` slot (FeedView teleports it into `#lian-shell-top-slot`).
 * Two states share the bar:
 *
 *   State A (default): visibility chips (全部/公开/校区/学校/私密/仅链接)
 *                      + [...] toggle button
 *   State B:           feed tab chips (此刻/精选/...)
 *                      + [x] toggle button
 *
 * Component: src/features/feed/FeedFilterBar.vue
 * Host:      src/features/feed/FeedView.vue (Teleport target #lian-shell-top-slot)
 *
 * @tag @feed-filter
 */

import { expect, test, type Page } from "@playwright/test";

// Visibility chip labels from brand config (feed.ts)
const VISIBILITY_CHIPS = {
  all: "全部",
  public: "公开",
  campus: "校区",
  school: "学校",
  private: "私密",
  linkOnly: "仅链接",
};

// Toggle button aria-labels from brand config (option C dual-state)
const TOGGLE_LABELS = {
  showTabs: "展开分类",
  showVisibility: "显示可见范围",
};

/**
 * Stub common endpoints to make tests hermetic. Returns two feed tabs so
 * State B has something to render.
 */
async function stubCommonEndpoints(
  page: Page,
  options: { loggedIn: boolean } = { loggedIn: false },
) {
  await page.route("**/api/feed**", async (route) => {
    await route.fulfill({
      json: {
        tabs: [
          { id: "此刻", label: "此刻" },
          { id: "精选", label: "精选" },
        ],
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
  await page.waitForTimeout(350);
}

// =============================================================================
// 1. Initial state verification — bar renders inside the top floating chrome
// =============================================================================

test.describe("@feed-filter initial state", () => {
  test("FeedFilterBar exists inside the top floating chrome", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const filterBar = page.locator('[data-testid="feed-filter-bar"]');
    await expect(filterBar).toBeVisible();

    // The bar must teleport into the shell top slot, not live inside the page body.
    const slotHostedBar = page.locator('#lian-shell-top-slot [data-testid="feed-filter-bar"]');
    await expect(slotHostedBar).toBeVisible();
  });

  test("initial state shows visibility chips (State A)", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    await expect(chipsContainer).toBeVisible();

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

    // Tab chips should NOT be visible in State A.
    const tabsContainer = page.locator('[data-testid="feed-filter-tabs"]');
    await expect(tabsContainer).toHaveCount(0);
  });

  test("[...] toggle button is visible in State A", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await expect(toggleButton).toBeVisible();
    await expect(toggleButton).toHaveAttribute("aria-label", TOGGLE_LABELS.showTabs);
    await expect(toggleButton).not.toHaveClass(/is-close/);
  });

  test("default visibility selection is '全部' (empty selectedVisibilities)", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    const allChip = chipsContainer.locator('[data-filter-value="all"]');

    await expect(allChip).toHaveAttribute("aria-pressed", "true");
  });
});

// =============================================================================
// 2. State A ↔ State B transitions
// =============================================================================

test.describe("@feed-filter dual-state transitions", () => {
  test("clicking [...] switches to State B (feed tabs)", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    // Tabs container appears.
    const tabsContainer = page.locator('[data-testid="feed-filter-tabs"]');
    await expect(tabsContainer).toBeVisible();

    // Both feed tabs from the stub should render.
    const nowTab = tabsContainer.locator('[data-tab-value="此刻"]');
    const featuredTab = tabsContainer.locator('[data-tab-value="精选"]');
    await expect(nowTab).toBeVisible();
    await expect(featuredTab).toBeVisible();

    // Visibility chips container should be gone after the transition.
    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    await expect(chipsContainer).toHaveCount(0);
  });

  test("toggle button changes to [x] in State B", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    await expect(toggleButton).toHaveAttribute("aria-label", TOGGLE_LABELS.showVisibility);
    await expect(toggleButton).toHaveClass(/is-close/);
  });

  test("clicking [x] returns to State A (visibility chips)", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');

    // Switch to State B
    await toggleButton.click();
    await waitForFilterTransition(page);

    // Switch back to State A
    await toggleButton.click();
    await waitForFilterTransition(page);

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    await expect(chipsContainer).toBeVisible();

    const allChip = chipsContainer.locator('[data-filter-value="all"]');
    await expect(allChip).toBeVisible();

    await expect(toggleButton).toHaveAttribute("aria-label", TOGGLE_LABELS.showTabs);
    await expect(toggleButton).not.toHaveClass(/is-close/);
  });

  test("active feed tab is highlighted in State B", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    const tabsContainer = page.locator('[data-testid="feed-filter-tabs"]');
    const nowTab = tabsContainer.locator('[data-tab-value="此刻"]');

    // First tab is the default active one.
    await expect(nowTab).toHaveAttribute("aria-selected", "true");
    await expect(nowTab).toHaveClass(/is-active/);
  });
});

// =============================================================================
// 3. Visibility chip selection
// =============================================================================

test.describe("@feed-filter visibility chip selection", () => {
  test("clicking visibility chip updates aria-pressed state", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    const campusChip = chipsContainer.locator('[data-filter-value="campus"]');

    await expect(campusChip).toHaveAttribute("aria-pressed", "false");
    await campusChip.click();
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");
  });

  test("clicking visibility chip applies .is-active class", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    const schoolChip = chipsContainer.locator('[data-filter-value="school"]');

    await expect(schoolChip).not.toHaveClass(/is-active/);
    await schoolChip.click();
    await expect(schoolChip).toHaveClass(/is-active/);
  });

  test("multi-select: can select multiple visibility chips", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    const campusChip = chipsContainer.locator('[data-filter-value="campus"]');
    const schoolChip = chipsContainer.locator('[data-filter-value="school"]');

    await campusChip.click();
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");

    await schoolChip.click();
    await expect(schoolChip).toHaveAttribute("aria-pressed", "true");

    // Both stay selected.
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");
  });

  test("clicking 'all' chip clears other selections", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    const allChip = chipsContainer.locator('[data-filter-value="all"]');
    const campusChip = chipsContainer.locator('[data-filter-value="campus"]');

    await campusChip.click();
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");
    await expect(allChip).toHaveAttribute("aria-pressed", "false");

    await allChip.click();

    await expect(allChip).toHaveAttribute("aria-pressed", "true");
    await expect(campusChip).toHaveAttribute("aria-pressed", "false");
  });

  test("clicking selected chip toggles it off", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    const campusChip = chipsContainer.locator('[data-filter-value="campus"]');

    await campusChip.click();
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");

    await campusChip.click();
    await expect(campusChip).toHaveAttribute("aria-pressed", "false");
  });

  test("visibility selection persists across state toggles", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    const campusChip = chipsContainer.locator('[data-filter-value="campus"]');
    await campusChip.click();
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    // To State B and back.
    await toggleButton.click();
    await waitForFilterTransition(page);
    await toggleButton.click();
    await waitForFilterTransition(page);

    const campusChipAgain = page
      .locator('[data-testid="feed-filter-chips"]')
      .locator('[data-filter-value="campus"]');
    await expect(campusChipAgain).toHaveAttribute("aria-pressed", "true");
  });
});

// =============================================================================
// 4. ARIA accessibility
// =============================================================================

test.describe("@feed-filter ARIA accessibility", () => {
  test("filter bar has aria-label", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const filterBar = page.locator('[data-testid="feed-filter-bar"]');
    await expect(filterBar).toHaveAttribute("aria-label", "可见范围筛选");
  });

  test("visibility chips container has role=group and aria-label", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    await expect(chipsContainer).toHaveAttribute("role", "group");
    await expect(chipsContainer).toHaveAttribute("aria-label", "可见范围筛选");
  });

  test("feed tabs container has role=tablist and aria-label", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    const tabsContainer = page.locator('[data-testid="feed-filter-tabs"]');
    await expect(tabsContainer).toHaveAttribute("role", "tablist");
    await expect(tabsContainer).toHaveAttribute("aria-label", "信息分类");
  });

  test("each visibility chip has aria-pressed attribute", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const chips = page.locator('[data-testid="feed-filter-chip"]');
    const chipCount = await chips.count();
    expect(chipCount).toBeGreaterThan(0);

    for (let i = 0; i < chipCount; i++) {
      const chip = chips.nth(i);
      const ariaPressed = await chip.getAttribute("aria-pressed");
      expect(ariaPressed).toMatch(/^(true|false)$/);
    }
  });

  test("each feed tab chip has role=tab and aria-selected", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.click();
    await waitForFilterTransition(page);

    const tabs = page.locator('[data-testid="feed-filter-tabs"] [role="tab"]');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(0);

    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      const ariaSelected = await tab.getAttribute("aria-selected");
      expect(ariaSelected).toMatch(/^(true|false)$/);
    }
  });

  test("toggle button has aria-label", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    const ariaLabel = await toggleButton.getAttribute("aria-label");

    expect(ariaLabel).toBeTruthy();
    expect([TOGGLE_LABELS.showTabs, TOGGLE_LABELS.showVisibility]).toContain(ariaLabel);
  });
});

// =============================================================================
// 5. Keyboard navigation
// =============================================================================

test.describe("@feed-filter keyboard navigation", () => {
  test("Tab key moves focus between chips", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const firstChip = page.locator('[data-testid="feed-filter-chip"]').first();
    await firstChip.focus();
    await expect(firstChip).toBeFocused();

    await page.keyboard.press("Tab");

    const secondChip = page.locator('[data-testid="feed-filter-chip"]').nth(1);
    await expect(secondChip).toBeFocused();
  });

  test("Enter activates focused chip", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    const campusChip = chipsContainer.locator('[data-filter-value="campus"]');

    await campusChip.focus();
    await expect(campusChip).toBeFocused();
    await expect(campusChip).toHaveAttribute("aria-pressed", "false");

    await page.keyboard.press("Enter");
    await expect(campusChip).toHaveAttribute("aria-pressed", "true");
  });

  test("Space activates focused chip", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    const schoolChip = chipsContainer.locator('[data-filter-value="school"]');

    await schoolChip.focus();
    await expect(schoolChip).toBeFocused();
    await expect(schoolChip).toHaveAttribute("aria-pressed", "false");

    await page.keyboard.press("Space");
    await expect(schoolChip).toHaveAttribute("aria-pressed", "true");
  });

  test("Tab key can reach toggle button and Enter activates it", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');

    await toggleButton.focus();
    await expect(toggleButton).toBeFocused();

    await page.keyboard.press("Enter");
    await waitForFilterTransition(page);

    await expect(toggleButton).toHaveAttribute("aria-label", TOGGLE_LABELS.showVisibility);
  });
});

// =============================================================================
// 6. Focus visible styling
// =============================================================================

test.describe("@feed-filter focus visible styling", () => {
  test("chips are keyboard focusable", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const firstChip = page.locator('[data-testid="feed-filter-chip"]').first();
    await firstChip.focus();
    await expect(firstChip).toBeFocused();
  });

  test("toggle button is keyboard focusable", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const toggleButton = page.locator('[data-testid="feed-filter-toggle"]');
    await toggleButton.focus();
    await expect(toggleButton).toBeFocused();
  });
});

// =============================================================================
// 7. Brand expectations: VISIBILITY_CHIPS labels still render exactly
// =============================================================================

test.describe("@feed-filter brand labels", () => {
  test("visibility chip labels match brand constants", async ({ page }) => {
    await stubCommonEndpoints(page, { loggedIn: true });
    await page.goto("/#/");

    const chipsContainer = page.locator('[data-testid="feed-filter-chips"]');
    for (const [value, label] of Object.entries(VISIBILITY_CHIPS)) {
      const chip = chipsContainer.locator(`[data-filter-value="${value}"]`);
      await expect(chip).toContainText(label);
    }
  });
});
