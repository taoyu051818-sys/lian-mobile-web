import { expect, test } from "@playwright/test";

test.describe("@production-canary read-only availability", () => {
  test("home page is reachable", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.ok()).toBe(true);
    await expect(page.locator("#vue-root")).toBeAttached();
  });

  test("static manifest is loadable", async ({ request }) => {
    const response = await request.get("/manifest.json");
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("application");
  });

  test("system health endpoint reports status", async ({ request }) => {
    const response = await request.get("/api/system/health");
    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({
      status: expect.stringMatching(/^(ok|degraded)$/),
      redis: expect.any(Object),
    });
  });

  test("anonymous feed is readable", async ({ request }) => {
    const response = await request.get("/api/feed");
    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({ items: expect.any(Array) });
  });

  test("anonymous auth-me probe is readable", async ({ request }) => {
    const response = await request.get("/api/auth/me");
    expect(response.ok()).toBe(true);
    expect(await response.json()).toHaveProperty("user");
  });

  test("login surface opens without submitting credentials", async ({ page }) => {
    await page.goto("/#/profile");
    await expect(page.locator(".auth-panel")).toBeVisible();
    await expect(page.locator('.auth-panel button[type="submit"]')).toBeVisible();
  });
});
