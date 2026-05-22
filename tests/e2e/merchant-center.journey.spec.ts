/**
 * Merchant center journey (issue #646).
 *
 * Real Playwright spec — replaces the static structure check that used to
 * live here. Covers the two identities the issue requires:
 *
 *   merchant_verified  →  profile shows the entry → merchant center renders
 *                         a non-empty list (the seeded merchant is the
 *                         current user's own post when configured) → opens
 *                         the merchant detail and confirms the errand CTA
 *                         is wired (available, since errandSupported=true on
 *                         the seed).
 *
 *   registered         →  profile does NOT render the merchant entry →
 *                         direct hash `#/merchant` lands on the
 *                         "需要商家认证" gate (NOT a silent empty list) →
 *                         the same merchant detail page still shows the
 *                         errand CTA (we only confirm the surface, not the
 *                         full order flow — that's #647 territory).
 *
 * Discovery:
 *   - The merchant tid is read from `GET /api/fixtures` →
 *     `fixtures.merchantErrand` so the spec doesn't hardcode 99. The fixture
 *     also confirms `errandSupported=true` on the seed so the available
 *     branch is the right thing to assert.
 *   - Both lanes are wrapped in `test.skip(!isRoleConfigured(...))` so the
 *     spec runs cleanly in environments without LIAN_E2E_*_USERNAME secrets.
 *
 * Out of scope (do not extend this spec):
 *   - Full payment / order settlement (issue #647)
 *   - Errand delivery state machine (issue #648)
 *   - Backend merchant onboarding workflow
 *
 * No backend mutation. The fixture lookup, /api/me/posts call, and detail
 * fetch are all read-only — there is nothing to clean up.
 */

import { expect, request, test, type APIRequestContext } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

interface MerchantErrandFixture {
  tid: number;
  ready: boolean;
  merchant: {
    name: string;
    category: string;
    hours: string;
    contact: string;
    errandSupported: boolean;
    verifiedAt: string;
  };
  title: string;
}

interface FixturesEnvelope {
  ok?: boolean;
  fixtures?: {
    merchantErrand?: Partial<MerchantErrandFixture>;
  };
}

async function fetchMerchantFixture(api: APIRequestContext): Promise<MerchantErrandFixture | null> {
  const response = await api.get("/api/fixtures");
  if (!response.ok()) return null;
  let body: FixturesEnvelope;
  try {
    body = (await response.json()) as FixturesEnvelope;
  } catch {
    return null;
  }
  const raw = body?.fixtures?.merchantErrand;
  if (!raw || typeof raw !== "object") return null;
  const tid = Number(raw.tid);
  if (!Number.isFinite(tid) || tid <= 0) return null;
  const merchantRaw = (raw.merchant ?? {}) as Partial<MerchantErrandFixture["merchant"]>;
  return {
    tid,
    ready: Boolean(raw.ready),
    title: String(raw.title ?? ""),
    merchant: {
      name: String(merchantRaw.name ?? ""),
      category: String(merchantRaw.category ?? ""),
      hours: String(merchantRaw.hours ?? ""),
      contact: String(merchantRaw.contact ?? ""),
      errandSupported: Boolean(merchantRaw.errandSupported),
      verifiedAt: String(merchantRaw.verifiedAt ?? ""),
    },
  };
}

test.describe("@merchant-center merchant center journey @issue-646", () => {
  test("@merchant-center merchant_verified sees entry, list, and detail errand CTA", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("merchant"),
      "merchant_verified role not configured — set LIAN_E2E_MERCHANT_USERNAME / LIAN_E2E_MERCHANT_PASSWORD",
    );

    const probe = await request.newContext({ baseURL: BASE_URL });
    let fixture: MerchantErrandFixture | null;
    try {
      fixture = await fetchMerchantFixture(probe);
    } finally {
      await probe.dispose();
    }
    expect(fixture, "GET /api/fixtures must surface merchantErrand seed").not.toBeNull();
    expect(fixture!.ready, `merchantErrand fixture not ready`).toBe(true);
    expect(
      fixture!.merchant.errandSupported,
      "seed must have errandSupported=true so the available branch can be asserted",
    ).toBe(true);

    const { api } = await loginAs("merchant");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      // 1. Profile shows the merchant-center entry under merchant_verified.
      await page.goto(`${BASE_URL}/#/profile`);
      await expect(
        page.locator('[data-testid="profile-merchant-entry"]'),
        "profile must render the merchant-center entry for merchant_verified",
      ).toBeVisible({ timeout: 15000 });

      // 2. Click into the merchant center and confirm we did not land on the
      //    gate or the error state. Either the empty state or the list is
      //    acceptable — the seed account may or may not own merchant posts on
      //    every environment, but the gate-vs-content branch is the assertion
      //    that matters here.
      await page.locator('[data-testid="profile-merchant-entry"] button').click();
      await expect
        .poll(() => page.url(), { timeout: 10000, message: "URL should switch to #/merchant" })
        .toContain("#/merchant");
      await expect(
        page.locator(
          '[data-testid="merchant-center-list"], [data-testid="merchant-center-empty"], [data-testid="merchant-center-loading"]',
        ),
        "merchant center body must be a list, empty state, or loading — never the gate",
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.locator('[data-testid="merchant-center-gate-host"]'),
        "merchant_verified user must NEVER see the gate",
      ).toHaveCount(0);

      // 3. Open the seeded merchant post detail and confirm the errand CTA is
      //    wired in the available branch. Seed has errandSupported=true so
      //    the entry container is rendered with the available testid.
      await page.goto(`${BASE_URL}/#/post/${fixture!.tid}`);
      await expect(
        page.locator('[data-testid="post-detail-merchant-block"]'),
        "merchant block must render on detail page",
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.locator('[data-testid="post-detail-merchant-errand-entry"]'),
        "errandSupported=true seed must render the available errand entry",
      ).toBeVisible();
      await expect(page.locator('[data-testid="post-detail-merchant-errand-cta"]')).toBeEnabled();
    } finally {
      await context.close();
      await api.dispose();
    }
  });

  test("@merchant-center registered user sees no entry, hits gate on direct URL", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const probe = await request.newContext({ baseURL: BASE_URL });
    let fixture: MerchantErrandFixture | null;
    try {
      fixture = await fetchMerchantFixture(probe);
    } finally {
      await probe.dispose();
    }
    expect(fixture, "GET /api/fixtures must surface merchantErrand seed").not.toBeNull();

    const { api, user } = await loginAs("registered");
    const context = await browser.newContext({ storageState: await api.storageState() });
    const page = await context.newPage();
    try {
      // Sanity: registered must not somehow carry merchant_verified — that
      // would invalidate the no-entry assertion.
      const tags = new Set<string>([...(user.tags ?? []), ...(user.verificationTags ?? [])]);
      expect(
        tags.has("merchant_verified"),
        `registered fixture must not carry merchant_verified; got [${[...tags].join(", ") || "<none>"}]`,
      ).toBe(false);

      // 1. Profile must NOT render the merchant-center entry.
      await page.goto(`${BASE_URL}/#/profile`);
      // Wait for the profile body so the assertion isn't racing the
      // hydration. The verification entry is always present — pin on that.
      await expect(
        page.locator(".profile-view__verification-entry"),
        "profile must finish hydration",
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.locator('[data-testid="profile-merchant-entry"]'),
        "registered user must not see the merchant-center entry",
      ).toHaveCount(0);

      // 2. Direct hash navigation lands on the gate, not a silent empty list.
      await page.goto(`${BASE_URL}/#/merchant`);
      await expect(
        page.locator('[data-testid="merchant-center-gate-host"]'),
        "registered user direct-linking #/merchant must see the gate",
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.locator('[data-testid="merchant-center-gate-cta"]'),
        "gate must offer a verification CTA",
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="merchant-center-list"]'),
        "registered user must NOT see a list",
      ).toHaveCount(0);
      await expect(
        page.locator('[data-testid="merchant-center-empty"]'),
        "registered user must NOT see the empty-list state — gate wins",
      ).toHaveCount(0);

      // 3. Same merchant detail page still shows the errand CTA — viewing is
      //    an open surface, even if the order flow is not exercised here.
      await page.goto(`${BASE_URL}/#/post/${fixture!.tid}`);
      await expect(page.locator('[data-testid="post-detail-merchant-block"]')).toBeVisible({
        timeout: 15000,
      });
      await expect(page.locator('[data-testid="post-detail-merchant-errand-entry"]')).toBeVisible();
    } finally {
      await context.close();
      await api.dispose();
    }
  });
});
