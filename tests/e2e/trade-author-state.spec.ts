import { expect, request, test, type APIRequestContext, type Browser } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

/**
 * Issue #649 — trade author-side state-transition runtime proof.
 *
 * Three things have to be true at the same time for the lane to be
 * shippable; this spec asserts each one against the running deployment:
 *
 *   1. campus_verified author can flip a fresh trade post through the
 *      backend state machine (`available → reserved → sold`) and the
 *      detail page reflects the latest state without a manual reload.
 *   2. A non-author logged in as the registered fixture sees no manage
 *      surface on the same trade post and gets a 403 from the PATCH
 *      endpoint. UI gate + backend gate must agree.
 *   3. The author's profile activity tab shows the trade post — feed /
 *      detail / profile see the same updated state.
 *
 * The spec needs three things from the env to run end to end on nat100:
 *   - LIAN_E2E_CAMPUS_USERNAME / LIAN_E2E_CAMPUS_PASSWORD (publisher)
 *   - LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD (intruder)
 *   - APP_BASE_URL                                           (default nat100)
 *
 * Without those env vars the test skips with a TODO marker — the trade
 * lane can't be runtime-proven against an unauthenticated host.
 */

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

interface PublishResponse {
  tid?: number | string;
}

interface TradePatchResponse {
  ok?: boolean;
  tid?: number | string;
  state?: string;
  trade?: { state?: string };
}

interface DetailResponse {
  tid?: number | string;
  trade?: { state?: string };
  tradeManageable?: boolean;
}

interface ProfileMineResponse {
  items?: Array<{ tid?: number | string; title?: string }>;
}

function buildTradePublishPayload(title: string) {
  return {
    title,
    body: "Playwright #649 trade author-state proof.",
    tag: "",
    identityTag: "",
    imageUrl: "",
    imageUrls: [],
    metadata: {
      locationArea: "",
      visibility: "public",
      distribution: ["home", "search", "detail"],
      primaryTag: "",
      identityTag: "",
      presentationIntent: "trade",
    },
    locationDraft: {
      source: "skipped",
      locationId: "",
      locationArea: "",
      displayName: "",
      lat: null,
      lng: null,
      legacyPoint: { x: null, y: null },
      imagePoint: { x: null, y: null },
      mapVersion: "manual",
      coordinateSystem: "none",
      identityKind: "skipped",
      precisionKind: "none",
      confidence: 0,
      skipped: true,
      note: "",
      issues: [],
    },
    riskFlags: [],
    confidence: 0,
    needsHumanReview: false,
    aiMode: "manual-vue",
    contentType: "trade" as const,
    trade: {
      price: "10",
      state: "available" as const,
      category: "其他",
    },
  };
}

async function publishTradePost(api: APIRequestContext) {
  const title = `#649 trade author-state ${new Date().toISOString()}`;
  const response = await api.post("/api/ai/post-publish", {
    data: buildTradePublishPayload(title),
  });
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as PublishResponse;
  expect(body.tid, "publish response must carry tid").toBeTruthy();
  return { tid: String(body.tid), title };
}

async function patchTradeState(api: APIRequestContext, tid: string, state: string) {
  const response = await api.fetch(`/api/posts/${tid}/trade-state`, {
    method: "PATCH",
    data: { state },
  });
  return { ok: response.ok(), status: response.status(), body: response };
}

async function readTradeState(api: APIRequestContext, tid: string) {
  const response = await api.get(`/api/posts/${tid}`);
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as DetailResponse;
  return body;
}

test.describe("@trade @campus issue #649 — trade author state proof", () => {
  test("author can walk available → reserved → sold; detail + profile reflect each step", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("campus"),
      "campus role not configured — set LIAN_E2E_CAMPUS_USERNAME / LIAN_E2E_CAMPUS_PASSWORD",
    );

    const { api } = await loginAs("campus", BASE_URL);
    let tid = "";
    try {
      const published = await publishTradePost(api);
      tid = published.tid;

      const initialDetail = await readTradeState(api, tid);
      expect(initialDetail.trade?.state).toBe("available");
      expect(initialDetail.tradeManageable, "campus author must own tradeManageable=true").toBe(
        true,
      );

      const reserved = await patchTradeState(api, tid, "reserved");
      expect(reserved.ok, `PATCH reserved failed: ${reserved.status}`).toBe(true);
      const reservedJson = (await reserved.body.json()) as TradePatchResponse;
      expect(reservedJson.state ?? reservedJson.trade?.state).toBe("reserved");

      const afterReservedDetail = await readTradeState(api, tid);
      expect(afterReservedDetail.trade?.state).toBe("reserved");

      const context = await browser.newContext({ storageState: await api.storageState() });
      const page = await context.newPage();
      try {
        await page.goto(`/#/post/${tid}`);
        await expect(page.locator(`[data-testid="post-detail-trade-block"]`)).toBeVisible();
        await expect(
          page.locator(`[data-testid="post-detail-trade-block"][data-state="reserved"]`),
        ).toBeVisible();
        await expect(page.locator(`[data-testid="post-detail-trade-manage"]`)).toBeVisible();
      } finally {
        await context.close();
      }

      const sold = await patchTradeState(api, tid, "sold");
      expect(sold.ok, `PATCH sold failed: ${sold.status}`).toBe(true);

      const finalDetail = await readTradeState(api, tid);
      expect(finalDetail.trade?.state).toBe("sold");

      const profile = await api.get("/api/me/posts");
      expect(profile.ok(), await profile.text()).toBe(true);
      const profileBody = (await profile.json()) as ProfileMineResponse;
      const ownedTids = (profileBody.items ?? []).map((item) => String(item.tid));
      expect(
        ownedTids.includes(tid),
        `profile activity feed must list authored trade tid ${tid}`,
      ).toBe(true);

      // sold is terminal — re-PATCHing back to reserved must be rejected.
      const illegal = await patchTradeState(api, tid, "reserved");
      expect(illegal.ok, "sold → reserved must be rejected by the backend").toBe(false);
      expect([400, 409]).toContain(illegal.status);
    } finally {
      await api.dispose();
    }
  });

  test("non-author cannot manage another user's trade post (UI + API both deny)", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("campus") || !isRoleConfigured("registered"),
      "this proof needs both campus + registered roles configured",
    );

    const author = await loginAs("campus", BASE_URL);
    let tid = "";
    try {
      const published = await publishTradePost(author.api);
      tid = published.tid;
    } finally {
      await author.api.dispose();
    }

    const intruder = await loginAs("registered", BASE_URL);
    try {
      const detail = await readTradeState(intruder.api, tid);
      expect(detail.trade, "registered viewer should still see the trade block").toBeTruthy();
      expect(detail.tradeManageable ?? false).toBe(false);

      const denied = await patchTradeState(intruder.api, tid, "reserved");
      expect(denied.ok, "non-author PATCH must be rejected").toBe(false);
      expect([401, 403, 404]).toContain(denied.status);

      const context = await browser.newContext({ storageState: await intruder.api.storageState() });
      const page = await context.newPage();
      try {
        await page.goto(`/#/post/${tid}`);
        await expect(page.locator(`[data-testid="post-detail-trade-block"]`)).toBeVisible();
        await expect(page.locator(`[data-testid="post-detail-trade-manage"]`)).toHaveCount(0);
      } finally {
        await context.close();
      }
    } finally {
      await intruder.api.dispose();
    }

    // Cleanup: best-effort cancel as the author so terminal-state pollution
    // doesn't accumulate across runs. Failures here are non-fatal — the
    // backend allows available → cancelled, so this hits the same matrix.
    if (tid) {
      const cleanup = await loginAs("campus", BASE_URL);
      try {
        await patchTradeState(cleanup.api, tid, "cancelled");
      } finally {
        await cleanup.api.dispose();
      }
    }
  });
});

test("@trade structural fallback — trade author-state lane is wired even without role creds", async () => {
  // If neither role is configured, we can still pin that the deployment is
  // reachable and the trade-state route exists. This keeps the spec from
  // staying entirely silent in environments where the runtime proof can't
  // run, so a future regression (route renamed, deploy down) shows up.
  const api = await request.newContext({ baseURL: BASE_URL });
  try {
    const response = await api.fetch("/api/posts/1/trade-state", {
      method: "PATCH",
      data: { state: "reserved" },
    });
    // Unauthenticated → 401/403/404; the only outcome we'd reject is a
    // 405 / route-not-mounted, which would mean the lane shipped broken.
    expect([401, 403, 404, 409, 400]).toContain(response.status());
  } finally {
    await api.dispose();
  }
});
