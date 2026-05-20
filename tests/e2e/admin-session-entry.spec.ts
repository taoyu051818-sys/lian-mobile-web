import { expect, request, test } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

interface AdminMeResponse {
  ok?: boolean;
  viaToken?: boolean;
  user?: {
    id?: string;
    username?: string;
    roleIds?: string[];
  } | null;
}

test.describe("@admin admin session entry @admin-session", () => {
  test("@admin /api/admin/me returns ok + admin/moderator roleIds for the e2e-admin fixture", async () => {
    test.skip(
      !isRoleConfigured("admin"),
      "admin role not configured — set LIAN_E2E_ADMIN_USERNAME / LIAN_E2E_ADMIN_PASSWORD",
    );

    const { api } = await loginAs("admin");
    try {
      const response = await api.get("/api/admin/me");
      expect(response.ok(), await response.text()).toBe(true);
      const body = (await response.json()) as AdminMeResponse;
      expect(body.ok).toBe(true);
      expect(body.viaToken).toBe(false);
      const roleIds = body.user?.roleIds ?? [];
      const hasAdminRole = roleIds.some((role) => {
        const normalized = String(role || "")
          .trim()
          .toLowerCase();
        return normalized === "admin" || normalized === "moderator";
      });
      expect(
        hasAdminRole,
        `admin probe must surface admin/moderator role; got roleIds=${JSON.stringify(roleIds)}`,
      ).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test("@admin authenticated admin session can mount #/admin without pasting ADMIN_TOKEN", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("admin"),
      "admin role not configured — set LIAN_E2E_ADMIN_USERNAME / LIAN_E2E_ADMIN_PASSWORD",
    );

    const { api } = await loginAs("admin");
    try {
      const context = await browser.newContext({ storageState: await api.storageState() });
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/#/admin`);
        // The bug being fixed is the gate showing up *despite* a valid admin
        // session. Wait for the probe to settle (probe-state element gone)
        // and then assert the token gate is not rendered.
        await page.waitForSelector(".admin-view__probe-state", {
          state: "detached",
          timeout: 15000,
        });
        await expect(page.locator(".admin-token-gate")).toHaveCount(0);
        await expect(page.locator(".admin-view")).toBeVisible();
      } finally {
        await context.close();
      }
    } finally {
      await api.dispose();
    }
  });

  test("@admin /api/admin/me rejects a non-admin session with 401/403", async () => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const { api } = await loginAs("registered");
    try {
      const response = await api.get("/api/admin/me");
      expect(
        [401, 403].includes(response.status()),
        `expected 401/403 for non-admin session, got ${response.status()}`,
      ).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test("@admin /api/admin/me rejects an anonymous visitor", async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    try {
      const response = await api.get("/api/admin/me");
      expect(
        [401, 403].includes(response.status()),
        `expected 401/403 for anonymous, got ${response.status()}`,
      ).toBe(true);
    } finally {
      await api.dispose();
    }
  });
});
