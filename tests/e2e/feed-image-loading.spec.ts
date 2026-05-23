/**
 * Feed image loading E2E tests.
 *
 * Verifies that feed cards with cover images load correctly and display
 * properly, preventing regressions in image rendering.
 *
 * Implementation: FeedItemCardMedia.vue
 *   - coverUrl prop determines if image or placeholder is shown
 *   - img.feed-item-card__cover renders the actual image
 *   - .feed-item-card__placeholder shows when no cover exists
 *   - loading="lazy" attribute for performance
 *
 * Test coverage:
 *   1. Cards with cover show img element with Cloudinary URL
 *   2. Images load successfully (naturalWidth > 0)
 *   3. Images have lazy loading attribute
 *   4. Cards without cover show placeholder
 */

import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

async function goToFeed(page: Page) {
  await page.goto(`${BASE_URL}/#/`);
  await expect(page.locator(".feed-view")).toBeVisible({ timeout: 10_000 });
}

test.describe("feed image loading", () => {
  test("card with cover renders image with Cloudinary URL", async ({ page }) => {
    await goToFeed(page);

    // Find a card with cover image
    const imageCard = page.locator(".feed-item-card--with-cover").first();

    const imageCardCount = await imageCard.count();
    if (imageCardCount === 0) {
      test.skip(true, "No image cards in feed to test cover rendering");
      return;
    }

    await expect(imageCard).toBeVisible();

    // Verify img element exists within the card
    const coverImg = imageCard.locator("img.feed-item-card__cover");
    await expect(coverImg).toBeVisible();

    // Verify src contains Cloudinary URL
    const src = await coverImg.getAttribute("src");
    expect(src).toBeTruthy();
    expect(src).toContain("cloudinary");
  });

  test("image loads successfully without broken state", async ({ page }) => {
    await goToFeed(page);

    const imageCard = page.locator(".feed-item-card--with-cover").first();

    const imageCardCount = await imageCard.count();
    if (imageCardCount === 0) {
      test.skip(true, "No image cards in feed to test image loading");
      return;
    }

    await expect(imageCard).toBeVisible();

    const coverImg = imageCard.locator("img.feed-item-card__cover");
    await expect(coverImg).toBeVisible();

    // Wait for image to load and verify it loaded successfully
    // naturalWidth > 0 indicates the image loaded (broken images have naturalWidth = 0)
    await expect(coverImg).toHaveJSProperty("complete", true);

    const naturalWidth = await coverImg.evaluate(
      (img: HTMLImageElement) => img.naturalWidth
    );
    expect(naturalWidth).toBeGreaterThan(0);
  });

  test("image has lazy loading attribute", async ({ page }) => {
    await goToFeed(page);

    const imageCard = page.locator(".feed-item-card--with-cover").first();

    const imageCardCount = await imageCard.count();
    if (imageCardCount === 0) {
      test.skip(true, "No image cards in feed to test lazy loading");
      return;
    }

    await expect(imageCard).toBeVisible();

    const coverImg = imageCard.locator("img.feed-item-card__cover");
    await expect(coverImg).toBeVisible();

    // Verify loading="lazy" attribute exists
    await expect(coverImg).toHaveAttribute("loading", "lazy");
  });

  test("card without cover shows placeholder", async ({ page }) => {
    await goToFeed(page);

    // Find a text card (no cover image)
    // These cards use the placeholder element instead of img
    const textCard = page.locator(".feed-item-card--text").first();

    const textCardCount = await textCard.count();
    if (textCardCount === 0) {
      test.skip(true, "No text cards in feed to test placeholder");
      return;
    }

    await expect(textCard).toBeVisible();

    // Text cards should NOT have a cover image
    const coverImg = textCard.locator("img.feed-item-card__cover");
    await expect(coverImg).toHaveCount(0);

    // Check if placeholder exists (only shown for non-text templates without cover)
    // For pure text cards, the media section may not render at all
    const placeholder = textCard.locator(".feed-item-card__placeholder");
    const mediaSection = textCard.locator(".feed-item-card__media");

    // Either no media section at all, or placeholder is shown
    const hasMedia = (await mediaSection.count()) > 0;
    if (hasMedia) {
      await expect(placeholder).toBeVisible();
    }
    // If no media section, that's also valid for text-only cards
  });

  test("multiple images in feed all load correctly", async ({ page }) => {
    await goToFeed(page);

    // Get all image cards (up to 5 for reasonable test time)
    const imageCards = page.locator(".feed-item-card--with-cover");
    const count = await imageCards.count();

    if (count === 0) {
      test.skip(true, "No image cards in feed to test multiple images");
      return;
    }

    const testCount = Math.min(count, 5);

    for (let i = 0; i < testCount; i++) {
      const card = imageCards.nth(i);
      const coverImg = card.locator("img.feed-item-card__cover");

      // Scroll into view to trigger lazy loading
      await card.scrollIntoViewIfNeeded();

      // Wait for image to be visible and loaded
      await expect(coverImg).toBeVisible({ timeout: 5_000 });
      await expect(coverImg).toHaveJSProperty("complete", true);

      const naturalWidth = await coverImg.evaluate(
        (img: HTMLImageElement) => img.naturalWidth
      );
      expect(naturalWidth).toBeGreaterThan(0);
    }
  });
});
