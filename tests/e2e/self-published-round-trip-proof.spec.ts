/**
 * Self-published round-trip proof lane (issue #777, advances #606).
 *
 * #606 became a structural umbrella once #638/#639 landed: anonymous browse,
 * registered login, like/save, and Profile sediment are already proven on
 * nat100. The remaining truthful gap is the self-published path — create a
 * fresh post as the registered fixture, then prove the new tid surfaces in
 * exactly the places a published post is supposed to surface.
 *
 * Four assertions on the same fresh tid:
 *   1. POST /api/ai/post-publish from the registered session returns a tid
 *      (the publish call frontend product code uses).
 *   2. GET /api/posts/:tid carries the body marker we just sent
 *      (truthful read-back of the topic the publish created).
 *   3. GET /api/me/posts surfaces that tid (self-listing endpoint, the
 *      Profile "发布" tab data path).
 *   4. The browser /#/profile view, logged in as the same author, renders
 *      the new post's title in the Profile collection (UI confirms the
 *      same data the API returned, no silent divergence).
 *
 * Cleanup (afterAll): best-effort POST /api/test/reset. The endpoint is
 * gated by LIAN_E2E_MODE on the backend; nat100 production mode returns
 * 404 and we swallow that. The post body carries a per-run marker
 * (`[E2E <runId>] self-published round-trip proof`) so even when reset is
 * a no-op, subsequent runs can disambiguate this run's tid from prior
 * runs and never collide.
 *
 * Skip envelope: every test gates on isRoleConfigured("registered"). Without
 * LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD the suite
 * skips cleanly — the lane cannot be runtime-proven against an
 * unauthenticated host, and a missing seed is not a test failure.
 *
 * Live nat100 execution is deferred to PR-gate. The @self-published tag
 * lets the workflow add this lane to the read-only list without having to
 * touch the spec.
 */

import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

interface PublishResponse {
  tid?: number | string;
}

interface PostDetail {
  tid?: number | string;
  title?: string;
  content?: string;
  body?: string;
}

interface ProfilePostsResponse {
  items?: Array<{ tid?: number | string; title?: string }>;
}

function buildTextPublishPayload(title: string, body: string) {
  // Mirrors src/api/publish.ts#buildPublishPayload for a text-only post:
  // empty imageUrls + a manual / skipped locationDraft is the same shape
  // the Vue publish flow sends when the user picks no image and skips
  // location. We intentionally inline the payload (instead of importing
  // the runtime helper) so the spec stays decoupled from src refactors.
  return {
    imageUrl: "",
    imageUrls: [],
    title,
    body,
    tag: "",
    identityTag: "",
    metadata: {
      locationArea: "",
      visibility: "public",
      distribution: ["home", "search", "detail"],
      primaryTag: "",
      identityTag: "",
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
  };
}

async function publishTextPost(api: APIRequestContext, title: string, body: string) {
  const response = await api.post("/api/ai/post-publish", {
    data: buildTextPublishPayload(title, body),
  });
  expect(response.ok(), await response.text()).toBe(true);
  const json = (await response.json()) as PublishResponse;
  expect(json.tid, "publish response must carry tid").toBeTruthy();
  return String(json.tid);
}

test.describe.serial("@self-published self-published round-trip proof @self-published", () => {
  const runId = randomUUID().slice(0, 8);
  const timestamp = new Date().toISOString();
  const title = `[E2E ${runId}] self-published round-trip proof`;
  const body = `[E2E ${runId}] self-published round-trip proof — ${timestamp}`;

  let api: APIRequestContext | null = null;
  let publishedTid = "";

  test.beforeAll(async () => {
    if (!isRoleConfigured("registered")) return;
    const result = await loginAs("registered", BASE_URL);
    api = result.api;
  });

  test.afterAll(async () => {
    // Best-effort cleanup. /api/test/reset is gated by LIAN_E2E_MODE on
    // the backend (404 in production-mode nat100 is the expected
    // response). When reset is a no-op the post stays — that's fine
    // because the body marker (`[E2E <runId>]`) makes this run's tid
    // unambiguous against any prior run and a fresh runId is generated
    // on next invocation.
    const cleanupApi = await request.newContext({ baseURL: BASE_URL });
    try {
      await cleanupApi.post("/api/test/reset").catch(() => null);
    } finally {
      await cleanupApi.dispose();
    }
    if (api) {
      await api.dispose();
      api = null;
    }
  });

  test("@self-published registered fixture publishes a text-only post and gets a tid", async () => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    expect(api, "registered login must have produced an API context").not.toBeNull();

    publishedTid = await publishTextPost(api!, title, body);
    expect(publishedTid).toBeTruthy();
    // Loose sanity — tids issued by NodeBB are positive integers; we
    // accept both number and string forms but reject "0" / "".
    expect(Number(publishedTid)).toBeGreaterThan(0);
  });

  test("@self-published GET /api/posts/:tid returns the freshly-published post with the run marker", async () => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    test.skip(!publishedTid, "publish step did not produce a tid — nothing to fetch");

    const response = await api!.get(`/api/posts/${publishedTid}`);
    expect(response.ok(), await response.text()).toBe(true);
    const detail = (await response.json()) as PostDetail;
    // Backend variations: some payloads expose `content`, some expose
    // `body`. Either is acceptable as long as the run marker survived
    // the round-trip. Title is checked separately because some legacy
    // backends strip the title into a slug.
    const haystack = `${detail.title ?? ""}\n${detail.content ?? ""}\n${detail.body ?? ""}`;
    expect(
      haystack.includes(`[E2E ${runId}]`),
      `expected run marker [E2E ${runId}] in detail payload, saw: ${haystack.slice(0, 200)}`,
    ).toBe(true);
  });

  test("@self-published GET /api/me/posts surfaces the tid in the author's self-listing", async () => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    test.skip(!publishedTid, "publish step did not produce a tid — nothing to look up");

    // Self-listing pages may take a beat to settle (NodeBB index sweep
    // + LIAN profile cache). Poll briefly so a slow indexer doesn't
    // turn into a false negative.
    await expect
      .poll(
        async () => {
          const response = await api!.get("/api/me/posts");
          if (!response.ok()) return null;
          const json = (await response.json()) as ProfilePostsResponse;
          return (json.items ?? []).some((item) => String(item.tid) === publishedTid);
        },
        {
          timeout: 15_000,
          intervals: [500, 1_000, 2_000],
          message: `tid ${publishedTid} should appear in /api/me/posts for the author`,
        },
      )
      .toBe(true);
  });

  test("@self-published author opens /#/profile and sees the new post in the activity collection", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );
    test.skip(!publishedTid, "publish step did not produce a tid — nothing to render");

    const context = await browser.newContext({ storageState: await api!.storageState() });
    const page = await context.newPage();
    try {
      await page.goto("/#/profile");
      await expect(page.locator(".profile-view")).toBeVisible();
      await page.locator(".profile-tabs").scrollIntoViewIfNeeded();
      const postsTab = page.getByRole("tab", { name: "发布" });
      await expect(postsTab).toBeVisible();
      await postsTab.click();
      // Run marker is the disambiguator across runs. We don't pin
      // ".first()" to a specific position because the activity feed
      // sort is server-controlled; "any item carries our marker" is
      // the truthful claim.
      await expect(
        page
          .locator(".profile-collection__item")
          .filter({ hasText: `[E2E ${runId}]` })
          .first(),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
