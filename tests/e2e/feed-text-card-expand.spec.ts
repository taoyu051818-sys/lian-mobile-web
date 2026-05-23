/**
 * Feed text card expand/collapse E2E tests.
 *
 * Pure text posts (no cover image) display a body preview that can be
 * expanded/collapsed in the feed. This allows users to read the full
 * content without navigating to the detail page.
 *
 * Implementation: FeedItemCardShell.vue
 *   - bodyExpanded ref controls the expanded state
 *   - needsBodyClamp ref detects if content overflows
 *   - Toggle button shows FEED_EXPAND / FEED_COLLAPSE from brand config
 *
 * Test coverage:
 *   1. Text card with long body shows expand button
 *   2. Clicking expand shows full content + collapse button
 *   3. Clicking collapse returns to truncated state
 *   4. Cards with images do NOT show expand button
 *   5. Short text cards do NOT show expand button (no overflow)
 */

import { expect, test, type Page } from "@playwright/test";

import { FEED_COLLAPSE, FEED_EXPAND } from "../../src/config/brand/feed";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

async function goToFeed(page: Page) {
  await page.goto(`${BASE_URL}/#/`);
  await expect(page.locator(".feed-view")).toBeVisible({ timeout: 10_000 });
}

test.describe("feed text card expand/collapse", () => {
  test("text card with long body shows expand button and toggles correctly", async ({ page }) => {
    await goToFeed(page);

    // Find a text card (no cover image, has body preview)
    // Text cards have class feed-item-card--text
    const textCard = page.locator(".feed-item-card--text").first();

    // Skip if no text cards in feed
    const textCardCount = await textCard.count();
    if (textCardCount === 0) {
      test.skip(true, "No text cards in feed to test expand/collapse");
      return;
    }

    await expect(textCard).toBeVisible();

    // Check if this card has a body preview that needs clamping
    const bodyPreview = textCard.locator(".feed-item-card__body-preview");
    const expandButton = textCard.locator(".feed-item-card__body-toggle");

    // If no body preview or no expand button, the card content is short
    const hasBodyPreview = (await bodyPreview.count()) > 0;
    const hasExpandButton = (await expandButton.count()) > 0;

    if (!hasBodyPreview) {
      test.skip(true, "Text card has no body preview");
      return;
    }

    if (!hasExpandButton) {
      // Content is short enough, no expand needed - this is valid
      // Verify the body is visible but not expanded
      await expect(bodyPreview).toBeVisible();
      await expect(bodyPreview).not.toHaveClass(/is-expanded/);
      return;
    }

    // --- Test expand flow ---
    // Button should show "展开" initially
    await expect(expandButton).toHaveText(FEED_EXPAND);

    // Body should NOT have is-expanded class
    await expect(bodyPreview).not.toHaveClass(/is-expanded/);

    // Click expand
    await expandButton.click();

    // Body should now have is-expanded class
    await expect(bodyPreview).toHaveClass(/is-expanded/);

    // Button should show "收起"
    await expect(expandButton).toHaveText(FEED_COLLAPSE);

    // --- Test collapse flow ---
    await expandButton.click();

    // Body should NOT have is-expanded class
    await expect(bodyPreview).not.toHaveClass(/is-expanded/);

    // Button should show "展开" again
    await expect(expandButton).toHaveText(FEED_EXPAND);
  });

  test("image cards do not show expand button", async ({ page }) => {
    await goToFeed(page);

    // Find a card with cover image (not text-only)
    const imageCard = page.locator(".feed-item-card--with-cover").first();

    const imageCardCount = await imageCard.count();
    if (imageCardCount === 0) {
      test.skip(true, "No image cards in feed to verify no expand button");
      return;
    }

    await expect(imageCard).toBeVisible();

    // Image cards should NOT have the body toggle button
    const expandButton = imageCard.locator(".feed-item-card__body-toggle");
    await expect(expandButton).toHaveCount(0);
  });

  test("expand button click does not navigate to detail", async ({ page }) => {
    await goToFeed(page);

    const textCard = page.locator(".feed-item-card--text").first();
    const textCardCount = await textCard.count();
    if (textCardCount === 0) {
      test.skip(true, "No text cards in feed");
      return;
    }

    const expandButton = textCard.locator(".feed-item-card__body-toggle");
    const hasExpandButton = (await expandButton.count()) > 0;
    if (!hasExpandButton) {
      test.skip(true, "Text card has no expand button (content too short)");
      return;
    }

    // Record current URL
    const urlBefore = page.url();

    // Click expand button
    await expandButton.click();

    // URL should NOT change (button uses @click.stop)
    expect(page.url()).toBe(urlBefore);

    // Should still be on feed view
    await expect(page.locator(".feed-view")).toBeVisible();
  });
});
