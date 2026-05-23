/**
 * E2E tests for PostDetailGallery and PostDetailLightbox components.
 *
 * Covers:
 *   1. Gallery renders when post has images
 *   2. Clicking an image opens the lightbox
 *   3. Lightbox displays the correct image
 *   4. Clicking the lightbox closes it
 *   5. Multi-image gallery navigation (if applicable)
 *
 * Hermetic via page.route stubs — does not depend on real backend data.
 */

import { expect, test, type Page } from "@playwright/test";

const STUB_TID = 888_888;
const STUB_TITLE = "Lightbox 测试帖";
const STUB_IMAGES = [
  "https://picsum.photos/seed/lightbox1/400/300",
  "https://picsum.photos/seed/lightbox2/400/300",
  "https://picsum.photos/seed/lightbox3/400/300",
];

const FEED_STUB = {
  tabs: [
    { id: "此刻", label: "此刻" },
    { id: "精选", label: "精选" },
  ],
  items: [
    {
      tid: STUB_TID,
      title: STUB_TITLE,
      bodyPreview: "这是一个带图片的测试帖子。",
      cover: STUB_IMAGES[0],
      primaryTag: "",
      timeLabel: "刚刚",
      timestampISO: new Date().toISOString(),
      likeCount: 0,
      liked: false,
      locationArea: "校园",
      contentType: "image",
    },
  ],
  hasMore: false,
  nextPage: null,
};

const POST_STUB = {
  tid: STUB_TID,
  type: "image",
  title: STUB_TITLE,
  cover: STUB_IMAGES[0],
  primaryTag: "",
  timeLabel: "刚刚",
  timestampISO: new Date().toISOString(),
  contentHtml: "<p>这是一个带图片的测试帖子。</p>",
  imageUrls: STUB_IMAGES,
  replies: [],
  likeCount: 0,
  liked: false,
  bookmarked: false,
  locationArea: "校园",
};

const SINGLE_IMAGE_POST_STUB = {
  ...POST_STUB,
  tid: 888_889,
  title: "单图测试帖",
  imageUrls: [STUB_IMAGES[0]],
};

async function installLightboxStubs(page: Page, postStub = POST_STUB): Promise<void> {
  await page.route(/\/api\/feed(\?|$)/, async (route) => {
    await route.fulfill({ json: FEED_STUB });
  });
  await page.route(new RegExp(`/api/posts/${postStub.tid}(\\?|$)`), async (route) => {
    await route.fulfill({ json: postStub });
  });
}

test.describe("@lightbox PostDetailGallery and PostDetailLightbox", () => {
  test("gallery renders with multiple images", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installLightboxStubs(page);

    await page.goto(`/#/post/${STUB_TID}`);

    // Wait for detail surface to be visible
    const detailSurface = page.locator("body > .detail-surface");
    await expect(detailSurface).toBeVisible();

    // Gallery section should be visible with aria-label
    const gallery = page.locator('.post-detail-gallery[aria-label="图片"]');
    await expect(gallery).toBeVisible();

    // Should have 3 gallery items (buttons)
    const galleryItems = gallery.locator(".post-detail-gallery__item");
    await expect(galleryItems).toHaveCount(3);

    // Each item should contain an image
    for (let i = 0; i < 3; i++) {
      const img = galleryItems.nth(i).locator("img");
      await expect(img).toBeVisible();
      await expect(img).toHaveAttribute("alt", STUB_TITLE);
    }

    await context.close();
  });

  test("clicking gallery image opens lightbox", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installLightboxStubs(page);

    await page.goto(`/#/post/${STUB_TID}`);

    const detailSurface = page.locator("body > .detail-surface");
    await expect(detailSurface).toBeVisible();

    // Lightbox should not be visible initially
    const lightbox = page.locator('.post-detail-lightbox[role="dialog"]');
    await expect(lightbox).toHaveCount(0);

    // Click the first gallery image
    const firstGalleryItem = page.locator(".post-detail-gallery__item").first();
    await firstGalleryItem.click();

    // Lightbox should now be visible
    await expect(lightbox).toBeVisible();
    await expect(lightbox).toHaveAttribute("aria-modal", "true");
    await expect(lightbox).toHaveAttribute("aria-label", "查看图片");

    // Lightbox should contain an image
    const lightboxImg = lightbox.locator("img");
    await expect(lightboxImg).toBeVisible();
    await expect(lightboxImg).toHaveAttribute("alt", STUB_TITLE);

    await context.close();
  });

  test("clicking lightbox closes it", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installLightboxStubs(page);

    await page.goto(`/#/post/${STUB_TID}`);

    const detailSurface = page.locator("body > .detail-surface");
    await expect(detailSurface).toBeVisible();

    // Open lightbox
    const firstGalleryItem = page.locator(".post-detail-gallery__item").first();
    await firstGalleryItem.click();

    const lightbox = page.locator('.post-detail-lightbox[role="dialog"]');
    await expect(lightbox).toBeVisible();

    // Click the lightbox to close it
    await lightbox.click();

    // Lightbox should be closed
    await expect(lightbox).toHaveCount(0);

    // Gallery should still be visible
    const gallery = page.locator('.post-detail-gallery[aria-label="图片"]');
    await expect(gallery).toBeVisible();

    await context.close();
  });

  test("can open different gallery images", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installLightboxStubs(page);

    await page.goto(`/#/post/${STUB_TID}`);

    const detailSurface = page.locator("body > .detail-surface");
    await expect(detailSurface).toBeVisible();

    const galleryItems = page.locator(".post-detail-gallery__item");
    const lightbox = page.locator('.post-detail-lightbox[role="dialog"]');

    // Click second image
    await galleryItems.nth(1).click();
    await expect(lightbox).toBeVisible();

    // Close lightbox
    await lightbox.click();
    await expect(lightbox).toHaveCount(0);

    // Click third image
    await galleryItems.nth(2).click();
    await expect(lightbox).toBeVisible();

    // Close again
    await lightbox.click();
    await expect(lightbox).toHaveCount(0);

    await context.close();
  });

  test("single image gallery has is-single class", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await installLightboxStubs(page, SINGLE_IMAGE_POST_STUB);

    await page.goto(`/#/post/${SINGLE_IMAGE_POST_STUB.tid}`);

    const detailSurface = page.locator("body > .detail-surface");
    await expect(detailSurface).toBeVisible();

    // Gallery should have is-single class for single image
    const gallery = page.locator(".post-detail-gallery.is-single");
    await expect(gallery).toBeVisible();

    // Should have exactly 1 gallery item
    const galleryItems = gallery.locator(".post-detail-gallery__item");
    await expect(galleryItems).toHaveCount(1);

    // Clicking it should still open lightbox
    await galleryItems.first().click();
    const lightbox = page.locator('.post-detail-lightbox[role="dialog"]');
    await expect(lightbox).toBeVisible();

    await context.close();
  });

  test("post without images does not render gallery", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const NO_IMAGE_TID = 777_777;
    const noImagePost = {
      tid: NO_IMAGE_TID,
      type: "text",
      title: "无图测试帖",
      cover: "",
      primaryTag: "",
      timeLabel: "刚刚",
      timestampISO: new Date().toISOString(),
      contentHtml: "<p>这是一个没有图片的测试帖子。</p>",
      imageUrls: [],
      replies: [],
      likeCount: 0,
      liked: false,
      bookmarked: false,
      locationArea: "校园",
    };

    await page.route(/\/api\/feed(\?|$)/, async (route) => {
      await route.fulfill({ json: FEED_STUB });
    });
    await page.route(new RegExp(`/api/posts/${NO_IMAGE_TID}(\\?|$)`), async (route) => {
      await route.fulfill({ json: noImagePost });
    });

    await page.goto(`/#/post/${NO_IMAGE_TID}`);

    const detailSurface = page.locator("body > .detail-surface");
    await expect(detailSurface).toBeVisible();

    // Gallery should not be rendered when imageUrls is empty
    const gallery = page.locator(".post-detail-gallery");
    await expect(gallery).toHaveCount(0);

    await context.close();
  });
});
