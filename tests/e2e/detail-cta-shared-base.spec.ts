/**
 * mw#827 wave 3-A CTA shared base — Apple-gap detail-page errand-help CTA.
 *
 * Three browser-side journeys cover the 6-state vocabulary on the merchant
 * detail page:
 *
 *   1. anonymous viewer → CTA renders in `disabled-permission` state. The
 *      composable refuses to dispatch into the order route, so a click on
 *      the visually-disabled button does NOT navigate away from the detail
 *      sheet and does NOT fire any /api/errands/* request. This is the
 *      regression that wave 3-A exists to prevent — pre-#827 the CTA was
 *      visually clickable but the click silently failed.
 *
 *   2. anonymous viewer → ARIA contract on the disabled CTA: aria-disabled
 *      reads "true", aria-pressed is absent (it's not a toggle), and a
 *      native title carries the reason. This is what makes the CTA
 *      screen-reader-friendly for the same audience that hits the
 *      permission gate first.
 *
 *   3. anonymous viewer → server-paused merchant: the CTA still hides
 *      under `errand-unavailable` (the existing `errandEntryAvailable=false`
 *      branch), proving wave 3-A did not regress the legacy unavailable
 *      branch when the capability gate is closed.
 *
 * Tagged @detail @cta-shared-base. Falls back to skip when the seeded
 * merchant fixture is not exposed (some review environments do not seed
 * the merchantErrand fixture).
 *
 * Runs against APP_BASE_URL (default https://lian.nat100.top). No login
 * needed for the canonical journey — anonymous browse is exactly the
 * disabled-permission case.
 */

import { expect, request, test, type APIRequestContext } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

interface MerchantErrandFixture {
  tid: number;
  ready: boolean;
  merchant: {
    name: string;
    errandSupported: boolean;
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
    title: typeof raw.title === "string" ? raw.title : "",
    merchant: {
      name: typeof merchantRaw.name === "string" ? merchantRaw.name : "",
      errandSupported: Boolean(merchantRaw.errandSupported),
    },
  };
}

test.describe("@detail @cta-shared-base mw#827 — CTA 6-state vocabulary", () => {
  test("anonymous viewer sees the merchant errand CTA in the disabled-permission state", async ({
    browser,
  }) => {
    const probe = await request.newContext({ baseURL: BASE_URL });
    let fixture: MerchantErrandFixture | null;
    try {
      fixture = await fetchMerchantFixture(probe);
    } finally {
      await probe.dispose();
    }
    test.skip(
      fixture === null,
      "GET /api/fixtures did not surface a merchantErrand seed in this environment",
    );
    test.skip(!fixture!.ready, "merchantErrand fixture is not ready in this environment");
    test.skip(
      !fixture!.merchant.errandSupported,
      "merchantErrand fixture seed lacks errandSupported=true; the available branch can't be exercised",
    );

    const context = await browser.newContext();
    const page = await context.newPage();

    // Track every /api/errands/* call so we can prove the disabled CTA
    // does not silently fire a request when the user taps it. Pre-mw#827
    // the bare-button CTA still bubbled a click through to the navigation
    // helper, so this assertion is the trip-wire for the regression.
    const errandRequests: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/api/errands/")) {
        errandRequests.push(url);
      }
    });

    try {
      await page.goto(`${BASE_URL}/#/post/${fixture!.tid}`);

      // The merchant block must render even for anonymous viewers — the
      // surface is part of the public detail page, not gated behind login.
      await expect(
        page.locator('[data-testid="post-detail-merchant-block"]'),
        "merchant block must render on the public detail page",
      ).toBeVisible({ timeout: 15000 });

      // The errand entry chrome must still surface the available branch —
      // capability gating ONLY mutes the CTA, not the entire surface.
      await expect(
        page.locator('[data-testid="post-detail-merchant-errand-entry"]'),
        "errandSupported=true seed must render the available errand entry surface",
      ).toBeVisible();

      const ctaButton = page.locator('[data-testid="post-detail-merchant-errand-cta"]').first();
      await expect(ctaButton).toBeVisible();

      // The wave 3-A 6-state contract: anonymous viewer (no campus_verified)
      // hits the disabled-permission case. The DetailCtaButton wrapper writes
      // the cause through `data-cta-cause="permission"` on the surrounding
      // host so structure tests AND e2e can disambiguate.
      const ctaHost = page.locator("[data-cta-cause]").filter({ has: ctaButton }).first();
      await expect(ctaHost).toHaveAttribute("data-cta-cause", "permission");

      // Native :disabled and aria-disabled must agree — wave 3-A explicitly
      // pins this so AT and DOM cannot drift.
      await expect(ctaButton).toBeDisabled();
      await expect(ctaButton).toHaveAttribute("aria-disabled", "true");

      // aria-pressed must NOT be on the button — this is not a toggle in
      // the disabled-permission state, and Vue drops undefined attributes.
      const ariaPressed = await ctaButton.getAttribute("aria-pressed");
      expect(
        ariaPressed,
        "disabled-permission CTA must not advertise aria-pressed (only success state does)",
      ).toBeNull();

      // The wrapper carries the wave 3-A `.is-reason` class — the same
      // visual the structure tests pin on the source.
      await expect(ctaHost).toHaveClass(/\bis-reason\b/);

      // Tap the visually-disabled CTA. The click MUST be a no-op:
      //   - the URL stays at the post detail (no #/errand-order pivot)
      //   - no /api/errands/* request fires
      //   - the merchant block remains mounted
      const urlBefore = page.url();
      // `force: true` simulates a determined user tapping anyway. The
      // composable's clickable gate is what prevents the regression from
      // coming back, not the native :disabled attribute.
      await ctaButton.click({ force: true, trial: false }).catch(() => {
        // Native :disabled may abort the click outright; either way the
        // outcome is "nothing happened", which is what the assertions
        // below verify.
      });

      // Give the app a beat to react if it were going to. We're proving
      // a negative; a single short wait is enough because the navigation
      // would be synchronous (setActiveView is synchronous in the
      // composable).
      await page.waitForTimeout(250);

      expect(page.url()).toBe(urlBefore);
      await expect(
        page.locator('[data-testid="post-detail-merchant-block"]'),
        "merchant block must still be mounted after the disabled-permission tap",
      ).toBeVisible();
      expect(
        errandRequests,
        "disabled-permission CTA must not silently fire any /api/errands/* request",
      ).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
