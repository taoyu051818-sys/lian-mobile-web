/**
 * Help-manage runtime proof lane (issue #771, Wave C-B).
 *
 * Builds on the Wave C-A read-only journey (#770) by consuming the
 * deterministic `helpRuntime` fixture surfaced at `/api/fixtures` (backend
 * lian-platform-server #472). Where Wave C-A fell back to a feed scan to find
 * any help-shaped post, this lane targets the seeded tid 200 directly so it
 * can prove the help-manage actions: link-event, unlink-event, resolve, close.
 *
 * Truthful runtime claims (assert nothing the backend cannot honor):
 *   1. The `helpRuntime` fixture surface exists, returns ready=true with the
 *      canonical fresh state (status: "open", linkedEventId: null) — the
 *      backend self-heal contract guarantees this on every discovery call.
 *   2. The post detail at the fixture tid surfaces the help extension and
 *      the `helpId` we'll use against the manage endpoints matches the
 *      fixture's seeded id.
 *   3. The help-manage endpoints (`/api/help/:helpId/{link-event,
 *      unlink-event,resolve}`) require login — anonymous calls return 401/403,
 *      not 5xx.
 *   4. An authenticated viewer can hit `/resolve` and the call either
 *      succeeds (200) or returns a typed denial (400/403/409). 5xx or hangs
 *      are refused — they signal a frontend wired to a dead route.
 *
 * Wave C-B deliberately does NOT mutate state beyond what the fixture self-
 * heal can restore: we drive the manage endpoints with the seeded author and
 * trust the backend's next-call patch to bring helpRuntime back to "open" for
 * the following run. We do NOT assert pre/post status flips on the live store
 * here, because the spec must be safely re-runnable on the same nat100 host
 * without a manual reset between runs.
 */

import { expect, request, test } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";
import { fetchHelpRuntimeFixture } from "./fixtures/help-runtime";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

interface PostDetail {
  tid?: number;
  help?: {
    helpId?: string;
    status?: string;
    voteCount?: number;
    linkedEventTid?: number | null;
  };
}

test.describe("@help help-manage runtime proof @help-manage", () => {
  test("@help-manage helpRuntime fixture is ready with canonical fresh state", async () => {
    const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
    test.skip(
      fixture === null,
      "helpRuntime fixture surface unavailable (production-mode 404 on /api/fixtures)",
    );

    expect(fixture!.ready, "fixture must self-heal to ready=true on every discovery").toBe(true);
    expect(fixture!.help).not.toBeNull();
    // Canonical fresh state — backend #472 self-heal patches this back even
    // if a previous run resolved or linked the seed.
    expect(fixture!.help!.status).toBe("open");
    expect(fixture!.help!.linkedEventId).toBeNull();
    expect(fixture!.help!.helpId).toBe(String(fixture!.tid));
    expect(fixture!.help!.authorUserId).toBe(fixture!.expectedAuthorUserId);
    // Recognition contract mirrors src/server/help-routes.js — either the
    // intent flag or one of the four help content types.
    const helpShaped =
      fixture!.help!.presentationIntent === "help" ||
      ["campus_tip", "guide", "opportunity", "signup"].includes(fixture!.help!.contentType);
    expect(helpShaped, "fixture must satisfy backend help recognition").toBe(true);
  });

  test("@help-manage GET /api/posts/:tid surfaces the help extension at the fixture tid", async () => {
    const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
    test.skip(fixture === null || !fixture.ready, "helpRuntime fixture not ready");

    const api = await request.newContext({ baseURL: BASE_URL });
    try {
      const response = await api.get(`/api/posts/${fixture!.tid}`);
      expect(response.ok(), await response.text()).toBe(true);
      const detail = (await response.json()) as PostDetail;
      expect(detail.help, "post detail must carry the help extension").toBeTruthy();
      expect(detail.help!.helpId).toBe(fixture!.help!.helpId);
      expect(["open", "linked_event", "resolved", "closed"]).toContain(String(detail.help!.status));
      expect(typeof detail.help!.voteCount).toBe("number");
    } finally {
      await api.dispose();
    }
  });

  test("@help-manage anonymous manage endpoints are denied (401/403)", async () => {
    const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
    test.skip(fixture === null || !fixture.ready, "helpRuntime fixture not ready");

    const helpId = fixture!.help!.helpId;
    const api = await request.newContext({ baseURL: BASE_URL });
    try {
      const linkResp = await api.post(`/api/help/${encodeURIComponent(helpId)}/link-event`, {
        data: { eventTid: 156 },
      });
      const unlinkResp = await api.post(`/api/help/${encodeURIComponent(helpId)}/unlink-event`);
      const resolveResp = await api.post(`/api/help/${encodeURIComponent(helpId)}/resolve`, {
        data: { status: "resolved" },
      });
      for (const [label, response] of [
        ["link-event", linkResp],
        ["unlink-event", unlinkResp],
        ["resolve", resolveResp],
      ] as const) {
        expect(
          [401, 403].includes(response.status()),
          `expected 401/403 for anonymous ${label}, got ${response.status()}: ${await response.text()}`,
        ).toBe(true);
      }
    } finally {
      await api.dispose();
    }
  });

  test("@help-manage authenticated author can call /resolve (success or typed denial)", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("event_creator"),
      "event_creator role not configured — set LIAN_E2E_EVENT_CREATOR_USERNAME / LIAN_E2E_EVENT_CREATOR_PASSWORD",
    );

    const fixture = await fetchHelpRuntimeFixture({ baseURL: BASE_URL });
    test.skip(fixture === null || !fixture.ready, "helpRuntime fixture not ready");

    // Seeded author is `e2e-event-creator-001` (shared with eventRuntime per
    // backend #472), so loginAs("event_creator") is the truthful manage actor.
    const { api, user } = await loginAs("event_creator");
    try {
      expect(String(user.id ?? ""), "logged-in user must match the seeded help author").toBe(
        fixture!.expectedAuthorUserId,
      );

      // Truthful runtime claim: the manage endpoint either succeeds OR
      // returns a typed denial. We refuse 5xx — that signals a dead route.
      // We do NOT assert post-call fixture state, because backend #472's
      // self-heal contract patches helpRuntime back to "open" on the next
      // discovery call, which makes a same-run pre/post check unreliable.
      const helpId = fixture!.help!.helpId;
      const response = await api.post(`/api/help/${encodeURIComponent(helpId)}/resolve`, {
        data: { status: "resolved" },
      });
      const status = response.status();
      expect(
        status === 200 || status === 400 || status === 403 || status === 409,
        `expected 200 or typed denial (400/403/409) for /resolve, got ${status}: ${await response.text()}`,
      ).toBe(true);

      // Browser proof: detail page renders the help block + manage-capable
      // help action button for the seeded author. Status pill reflects
      // whatever the backend currently holds (post-resolve flip or self-heal
      // restored open) — we just assert the block + action testids exist.
      const context = await browser.newContext({ storageState: await api.storageState() });
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/#/post/${fixture!.tid}`);
        await page.waitForSelector('[data-testid="post-detail-help-block"]', {
          state: "visible",
          timeout: 15000,
        });
        await expect(page.locator('[data-testid="post-detail-help-action"]')).toBeVisible();
      } finally {
        await context.close();
      }
    } finally {
      await api.dispose();
    }
  });
});
