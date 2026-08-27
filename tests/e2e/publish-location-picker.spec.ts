/**
 * mw#943 — Publish form location picker entry-point smoke test.
 *
 * The full picker round-trip exercises Konva (map mount + long-press
 * gesture detection) and `navigator.geolocation`, both of which are
 * fragile in headless Playwright + jsdom. The composables are unit-tested
 * directly in `tests/publish/use*.test.ts` and `tests/map/useMapPickerMode.test.ts`,
 * so this spec narrows to three e2e-only invariants:
 *
 *   1. The "在地图上选" button on the publish form navigates to the map
 *      view in picker mode (`#/map?picker=1`) and surfaces the picker
 *      overlay.
 *   2. Cancelling the picker returns to the same in-memory publish draft,
 *      including non-serializable image preview state.
 *   3. The "使用当前位置" button lives on the publish form alongside it.
 *
 * What is intentionally not covered here:
 *   - Long-press → free pin (canvas event timing in headless mode is flaky;
 *     covered in `useMapPickerMode.test.ts` via `dropPin()`).
 *   - Geolocation success/error paths (covered in
 *     `useGeolocation.test.ts` with a stubbed `navigator.geolocation`).
 *   - The handoff round-trip (covered in
 *     `usePublishLocationHandoff.test.ts` with a memory storage).
 *
 * Skip envelope mirrors the other publish e2e specs — `loginAs("registered")`
 * requires LIAN_E2E_REGISTERED_USERNAME / _PASSWORD; missing seed is a clean
 * skip.
 */

import { expect, test } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

test.describe("@registered publish location picker entry", () => {
  test.beforeEach(() => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / _PASSWORD",
    );
  });

  test("publish form exposes map-picker and current-location buttons", async ({ browser }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();

    try {
      await page.goto("/#/publish");
      await expect(page.locator(".publish-view")).toBeVisible();

      // The location panel only mounts once the user opens it. Tap the
      // location toolbar pill to surface the panel + the new buttons.
      const locationToolbar = page.getByRole("button", { name: "地点" }).first();
      await locationToolbar.click();

      const useCurrentBtn = page.locator('[data-testid="publish-location-use-current"]');
      const pickOnMapBtn = page.locator('[data-testid="publish-location-pick-on-map"]');

      await expect(useCurrentBtn).toBeVisible();
      await expect(pickOnMapBtn).toBeVisible();
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  test("tapping pick-on-map navigates to map picker mode and surfaces the overlay", async ({
    browser,
  }) => {
    const { api } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();

    try {
      await context.route("**/api/upload/image*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            url: "https://example.invalid/uploads/publish-picker-continuity.png",
          }),
        });
      });

      await page.goto("/#/publish");
      await expect(page.locator(".publish-view")).toBeVisible();

      const titleInput = page.locator(".publish-composer__headline input").first();
      const bodyInput = page.locator(".publish-composer__body-field textarea").first();
      await titleInput.fill("Picker continuity title");
      await bodyInput.fill("Picker continuity body");

      // Open the location panel.
      const locationToolbar = page.getByRole("button", { name: "地点" }).first();
      await locationToolbar.click();

      const png1x1 = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=",
        "base64",
      );
      await page.locator(".publish-composer__hidden-input").setInputFiles({
        name: "picker-continuity.png",
        mimeType: "image/png",
        buffer: png1x1,
      });
      const imagePreview = page.locator(".publish-image-preview__item img");
      await expect(imagePreview).toHaveCount(1);

      const pickOnMapBtn = page.locator('[data-testid="publish-location-pick-on-map"]');
      await expect(pickOnMapBtn).toBeVisible();
      await pickOnMapBtn.click();

      // URL flips to the picker hash.
      await expect.poll(() => page.url()).toContain("#/map?picker=1");

      // Map view mounted in picker mode → the floating overlay is visible.
      const overlay = page.locator('[data-testid="map-picker-overlay"]');
      await expect(overlay).toBeVisible({ timeout: 15_000 });

      // Confirm button is disabled until a location or pin is selected.
      const confirmBtn = page.locator('[data-testid="map-picker-confirm"]');
      await expect(confirmBtn).toBeDisabled();

      // Cancel returns to the publish form without writing a handoff.
      const cancelBtn = page.locator('[data-testid="map-picker-cancel"]');
      await cancelBtn.click();
      await expect.poll(() => page.url()).toContain("#/publish");
      await expect(page.locator(".publish-view")).toBeVisible();
      await expect(titleInput).toHaveValue("Picker continuity title");
      await expect(bodyInput).toHaveValue("Picker continuity body");
      await expect(imagePreview).toHaveCount(1);
      await expect(page.locator('[data-testid="publish-draft-notice"]')).toHaveCount(0);

      // Re-enter the picker, then select the already-active Map tab. That
      // path uses history.pushState (no hashchange/popstate), so it is the
      // same-view lease-release edge. A later Publish visit must restore the
      // serializable draft but not the previous component's File/object URL.
      await pickOnMapBtn.click();
      await expect.poll(() => page.url()).toContain("#/map?picker=1");
      await page.locator('.bottom-tab-bar__item[aria-current="page"]').click();
      await expect.poll(() => new URL(page.url()).hash).toBe("#/map");
      await page.locator(".bottom-tab-bar__item").filter({ hasText: "发布" }).click();
      await expect(page.locator(".publish-view")).toBeVisible();
      await expect(imagePreview).toHaveCount(0);
      await expect(page.locator('[data-testid="publish-draft-notice"]')).toContainText(
        "图片需要重新选择",
      );
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});
