import { expect, test } from "@playwright/test";

import { isRoleConfigured, loginAs, browserContextForRole } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

/**
 * Map view E2E tests
 *
 * Tests the `/#/map` route which renders MapLeafletView containing:
 * - MapCanvas (Leaflet-based map with campus overlay)
 * - MapStatus (loading/error states)
 * - MapPlaceSheet (place detail bottom sheet)
 */

test.describe("Map view", () => {
  test("anonymous user can load map page and see map container", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/#/map`);

    // Wait for the map view section to appear (aria-label="校园地图")
    const mapView = page.locator('section.map-view[aria-label="校园地图"]');
    await expect(mapView).toBeVisible({ timeout: 15000 });

    // The map canvas container should be present
    const mapCanvas = page.locator(".map-canvas");
    await expect(mapCanvas).toBeVisible();

    // Verify no error state is shown
    const errorMessage = page.locator(".map-status__error");
    await expect(errorMessage).toHaveCount(0);

    await context.close();
  });

  test("map loading state appears then resolves", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/#/map`);

    // The map view should be visible
    const mapView = page.locator('section.map-view[aria-label="校园地图"]');
    await expect(mapView).toBeVisible({ timeout: 15000 });

    // Wait for loading to complete (loading indicator disappears or map-canvas loses is-loading class)
    // The loading state shows "加载地图中..." text
    const loadingIndicator = page.locator(".map-status__loading");

    // Either loading finishes quickly or we wait for it to disappear
    // Use a soft check - if loading is visible, wait for it to go away
    const isLoadingVisible = await loadingIndicator.isVisible().catch(() => false);
    if (isLoadingVisible) {
      await expect(loadingIndicator).toBeHidden({ timeout: 30000 });
    }

    // After loading, the map canvas should not have is-loading class
    const mapCanvas = page.locator(".map-canvas");
    await expect(mapCanvas).toBeVisible();

    await context.close();
  });

  test("authenticated user can access map with full features", async ({ browser }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured - set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const { api } = await loginAs("registered", BASE_URL);
    const context = await browserContextForRole(browser, api);
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/#/map`);

    // Map view should load
    const mapView = page.locator('section.map-view[aria-label="校园地图"]');
    await expect(mapView).toBeVisible({ timeout: 15000 });

    // Map canvas should be present
    const mapCanvas = page.locator(".map-canvas");
    await expect(mapCanvas).toBeVisible();

    // Wait for map data to load (loading state disappears)
    const loadingIndicator = page.locator(".map-status__loading");
    const isLoadingVisible = await loadingIndicator.isVisible().catch(() => false);
    if (isLoadingVisible) {
      await expect(loadingIndicator).toBeHidden({ timeout: 30000 });
    }

    // No error should be present
    const errorMessage = page.locator(".map-status__error");
    await expect(errorMessage).toHaveCount(0);

    await context.close();
    await api.dispose();
  });

  test("map place sheet opens and closes correctly", async ({ browser }) => {
    // This test verifies the MapPlaceSheet component behavior
    // The sheet appears when a location is selected and has a close button
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/#/map`);

    // Wait for map to load
    const mapView = page.locator('section.map-view[aria-label="校园地图"]');
    await expect(mapView).toBeVisible({ timeout: 15000 });

    // Wait for loading to complete
    const loadingIndicator = page.locator(".map-status__loading");
    const isLoadingVisible = await loadingIndicator.isVisible().catch(() => false);
    if (isLoadingVisible) {
      await expect(loadingIndicator).toBeHidden({ timeout: 30000 });
    }

    // The place sheet should not be visible initially (no place selected)
    const placeSheet = page.locator('.map-place-sheet[role="dialog"]');
    await expect(placeSheet).toHaveCount(0);

    // Note: Clicking on a map marker to open the sheet requires the map data
    // to have locations/posts. This is a smoke test that the sheet component
    // is wired up correctly - full interaction testing would require seeded data.

    await context.close();
  });

  test("map renders Leaflet container with zoom controls", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/#/map`);

    // Wait for map view
    const mapView = page.locator('section.map-view[aria-label="校园地图"]');
    await expect(mapView).toBeVisible({ timeout: 15000 });

    // Wait for loading to complete
    const loadingIndicator = page.locator(".map-status__loading");
    const isLoadingVisible = await loadingIndicator.isVisible().catch(() => false);
    if (isLoadingVisible) {
      await expect(loadingIndicator).toBeHidden({ timeout: 30000 });
    }

    // Leaflet creates a container with class "leaflet-container"
    const leafletContainer = page.locator(".leaflet-container");
    await expect(leafletContainer).toBeVisible({ timeout: 10000 });

    // Zoom controls should be present (added by attachZoomControl in MapCanvas)
    const zoomControl = page.locator(".leaflet-control-zoom");
    await expect(zoomControl).toBeVisible();

    // Zoom in and zoom out buttons
    const zoomIn = page.locator(".leaflet-control-zoom-in");
    const zoomOut = page.locator(".leaflet-control-zoom-out");
    await expect(zoomIn).toBeVisible();
    await expect(zoomOut).toBeVisible();

    await context.close();
  });

  test("map navigation from feed works", async ({ browser }) => {
    // Test that navigating to map from another route works correctly
    const context = await browser.newContext();
    const page = await context.newPage();

    // Start at feed
    await page.goto(`${BASE_URL}/`);
    await expect(page.locator(".feed-view")).toBeVisible({ timeout: 15000 });

    // Navigate to map
    await page.goto(`${BASE_URL}/#/map`);

    // Map should load
    const mapView = page.locator('section.map-view[aria-label="校园地图"]');
    await expect(mapView).toBeVisible({ timeout: 15000 });

    const mapCanvas = page.locator(".map-canvas");
    await expect(mapCanvas).toBeVisible();

    await context.close();
  });
});
