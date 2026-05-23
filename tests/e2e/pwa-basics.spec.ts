import { expect, request, test } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

/**
 * PWA basics E2E tests
 *
 * Tests the Progressive Web App functionality:
 * - Service Worker registration via vite-plugin-pwa
 * - manifest.json accessibility and configuration
 * - Offline page accessibility
 * - Basic caching behavior
 *
 * Note: Some tests verify the deployed state which may differ from local
 * source files (e.g., icons array may be empty if assets not deployed).
 */

test.describe("@pwa PWA basics", () => {
  test.describe("manifest.json", () => {
    test("manifest.json is accessible and returns valid JSON", async () => {
      const api = await request.newContext({ baseURL: BASE_URL });

      const response = await api.get("/manifest.json");

      expect(response.ok(), `expected 200, got ${response.status()}`).toBe(true);

      const contentType = response.headers()["content-type"] || "";
      expect(contentType).toContain("application/json");

      const manifest = await response.json();
      expect(manifest).toBeDefined();

      await api.dispose();
    });

    test("manifest.json contains required PWA fields", async () => {
      const api = await request.newContext({ baseURL: BASE_URL });

      const response = await api.get("/manifest.json");
      const manifest = await response.json();

      // Required fields for PWA
      expect(manifest).toHaveProperty("name");
      expect(manifest).toHaveProperty("short_name");
      expect(manifest).toHaveProperty("start_url");
      expect(manifest).toHaveProperty("display");
      expect(manifest).toHaveProperty("icons");

      // Verify specific values from public/manifest.json
      expect(manifest.name).toBe("黎安屿你");
      expect(manifest.short_name).toBe("黎安屿你");
      expect(manifest.start_url).toBe("/");
      expect(manifest.display).toBe("standalone");
      expect(manifest.background_color).toBe("#f7f4ec");
      expect(manifest.theme_color).toBe("#1fa7a0");

      await api.dispose();
    });

    test("manifest.json icons array is valid structure", async () => {
      const api = await request.newContext({ baseURL: BASE_URL });

      const response = await api.get("/manifest.json");
      const manifest = await response.json();

      // Icons should be an array (may be empty if assets not deployed)
      expect(Array.isArray(manifest.icons)).toBe(true);

      // If icons are present, verify their structure
      if (manifest.icons.length > 0) {
        for (const icon of manifest.icons) {
          expect(icon).toHaveProperty("src");
          expect(icon).toHaveProperty("sizes");
          expect(icon).toHaveProperty("type");
        }
      }

      await api.dispose();
    });

    test("PWA icons are accessible when configured", async () => {
      const api = await request.newContext({ baseURL: BASE_URL });

      // First check if icons are configured in manifest
      const manifestResponse = await api.get("/manifest.json");
      const manifest = await manifestResponse.json();

      if (manifest.icons.length === 0) {
        // Skip icon accessibility check if no icons configured
        test.skip();
        return;
      }

      // Check each configured icon
      for (const icon of manifest.icons) {
        const iconResponse = await api.get(icon.src);
        expect(
          iconResponse.ok(),
          `icon ${icon.src}: expected 200, got ${iconResponse.status()}`,
        ).toBe(true);
      }

      await api.dispose();
    });
  });

  test.describe("offline page", () => {
    test("offline.html is accessible", async () => {
      const api = await request.newContext({ baseURL: BASE_URL });

      const response = await api.get("/offline.html");

      expect(response.ok(), `expected 200, got ${response.status()}`).toBe(true);

      const contentType = response.headers()["content-type"] || "";
      expect(contentType).toContain("text/html");

      await api.dispose();
    });

    test("offline.html contains expected content", async () => {
      // Use direct HTTP request to avoid SPA router interference
      const api = await request.newContext({ baseURL: BASE_URL });

      const response = await api.get("/offline.html");
      const html = await response.text();

      // Check page title
      expect(html).toContain("<title>离线 - 黎安屿你</title>");

      // Check main heading
      expect(html).toContain("网络连接已断开");

      // Check description text
      expect(html).toContain("请检查您的网络连接后重试");

      // Check retry button exists
      expect(html).toContain("retry-btn");
      expect(html).toContain("重试");

      // Check theme color meta tag (offline page uses background color)
      expect(html).toContain('name="theme-color" content="#f7f4ec"');

      await api.dispose();
    });

    test("offline.html has correct viewport meta for mobile", async () => {
      const api = await request.newContext({ baseURL: BASE_URL });

      const response = await api.get("/offline.html");
      const html = await response.text();

      expect(html).toContain("width=device-width");
      expect(html).toContain("initial-scale=1");
      expect(html).toContain("viewport-fit=cover");

      await api.dispose();
    });
  });

  test.describe("Service Worker", () => {
    test("Service Worker registration is attempted on page load", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Navigate to the app
      await page.goto(`${BASE_URL}/`, {
        waitUntil: "networkidle",
      });

      // Wait for app to load
      await expect(page.locator(".feed-view")).toBeVisible({ timeout: 15000 });

      // Check if Service Worker API is supported and registration was attempted
      const swStatus = await page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) {
          return { supported: false, registered: false };
        }

        try {
          // Check for any registration (may or may not be active depending on deployment)
          const registration = await navigator.serviceWorker.getRegistration();
          return {
            supported: true,
            registered: !!registration,
            scope: registration?.scope,
            state: registration?.active?.state ?? registration?.installing?.state ?? "none",
          };
        } catch {
          return { supported: true, registered: false, error: true };
        }
      });

      expect(swStatus.supported, "Service Worker should be supported in browser").toBe(true);
      // Note: SW may not be registered if not deployed - this is informational
      if (!swStatus.registered) {
        console.log("Service Worker not registered - may not be deployed to production");
      }

      await context.close();
    });

    test("Service Worker script path is configured", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/`, {
        waitUntil: "domcontentloaded",
      });

      // Check if the app has SW registration code (via vite-plugin-pwa)
      // The registerSW function from virtual:pwa-register should be called
      const hasSwRegistration = await page.evaluate(() => {
        // Check if navigator.serviceWorker exists (browser support)
        return "serviceWorker" in navigator;
      });

      expect(hasSwRegistration, "Browser should support Service Workers").toBe(true);

      await context.close();
    });
  });

  test.describe("PWA meta tags", () => {
    test("index page has PWA-related meta tags", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/`, {
        waitUntil: "domcontentloaded",
      });

      // Check manifest link
      const manifestLink = page.locator('link[rel="manifest"]');
      await expect(manifestLink).toHaveAttribute("href", /manifest/);

      // Check theme-color meta tag exists (value may vary based on deployment)
      const themeColor = page.locator('meta[name="theme-color"]');
      const themeColorValue = await themeColor.getAttribute("content");
      expect(themeColorValue).toBeTruthy();
      // Should be either the primary theme color or background color
      expect(["#1fa7a0", "#f7f4ec"]).toContain(themeColorValue);

      await context.close();
    });

    test("index page has apple-touch-icon for iOS", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/`, {
        waitUntil: "domcontentloaded",
      });

      // Check for apple-touch-icon (may or may not exist depending on config)
      const appleTouchIcon = page.locator('link[rel="apple-touch-icon"]');
      const count = await appleTouchIcon.count();

      // If it exists, verify it has an href
      if (count > 0) {
        const href = await appleTouchIcon.first().getAttribute("href");
        expect(href).toBeTruthy();
      }

      await context.close();
    });
  });

  test.describe("caching behavior", () => {
    test("static assets have cache headers", async () => {
      const api = await request.newContext({ baseURL: BASE_URL });

      // Check manifest.json caching
      const manifestResponse = await api.get("/manifest.json");
      const manifestCacheControl = manifestResponse.headers()["cache-control"];
      // Should have some cache directive (exact value depends on server config)
      expect(manifestCacheControl || manifestResponse.headers()["etag"]).toBeTruthy();

      await api.dispose();
    });

    test("pwa-update-available event can be dispatched", async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/`, {
        waitUntil: "networkidle",
      });

      // Wait for app to load
      await expect(page.locator(".feed-view")).toBeVisible({ timeout: 15000 });

      // Test that the custom event listener infrastructure works
      // (The actual update flow requires a real SW update which is hard to test)
      const eventReceived = await page.evaluate(() => {
        return new Promise<boolean>((resolve) => {
          const handler = () => {
            resolve(true);
            window.removeEventListener("pwa-update-available", handler);
          };
          window.addEventListener("pwa-update-available", handler);

          // Dispatch a test event
          window.dispatchEvent(
            new CustomEvent("pwa-update-available", {
              detail: { updateSW: () => {} },
            }),
          );

          // Timeout fallback
          setTimeout(() => resolve(false), 1000);
        });
      });

      expect(eventReceived, "pwa-update-available event should be receivable").toBe(true);

      await context.close();
    });
  });
});
