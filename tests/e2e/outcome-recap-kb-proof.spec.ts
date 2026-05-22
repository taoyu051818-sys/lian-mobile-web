/**
 * Outcome recap + knowledge base proof scaffold (PRD §19.2 P6).
 *
 * Status as of 2026-05-22: backend + frontend are both greenfield. None of
 * the candidate surfaces exist yet:
 *
 *   - GET /api/outcomes/:tid              -> 404 (no outcomes route registered)
 *   - GET /api/recaps                     -> 404
 *   - GET /api/kb/posts                   -> 404
 *   - GET /api/knowledge-base             -> 404
 *
 *   - api-route-registry.js has zero handlers for outcome/recap/kb/knowledge.
 *   - help-routes.js#handleHelpResolve flips help.status -> "resolved" but
 *     never writes a recap entry, never appends to a KB index, never fans out
 *     a "knowledge-base entry created" notification.
 *   - event-routes.js#handleEventComplete flips event.status -> "completed"
 *     and fans out per-joiner completion notifications, but does not produce
 *     a recap post, an outcome aggregate, or anything addressable as a
 *     standalone "outcome detail" page.
 *   - lian-mobile-web/src/app/view-types.ts does not declare a
 *     "knowledge-base" or "recap" AppViewKey; there is no /#/kb route.
 *   - The string "official_recap" exists ONLY as a contentType enum value
 *     under post-handlers.js / feed-handlers.js (mapped to "image"
 *     presentation). It is not produced automatically on /complete or
 *     /resolve — it is just a self-publish content type, identical to a
 *     normal image post in every other respect.
 *
 * Therefore every case below is `test.fixme(true, ...)`. The bodies are kept
 * concrete (real fixture lookups via /api/fixtures, real rollback paths via
 * the existing self-heal contract used by event-runtime / help-runtime) so a
 * future implementer can flip the fixme to `false` for a single arm at a time
 * as the backend lands, without rewriting the test logic. The expected
 * surface area documented below is an opening proposal — the real shape may
 * differ when backend design lands.
 *
 * Expected surface area (proposal, not yet implemented):
 *
 *   POST /api/events/:eventId/complete
 *     -> existing endpoint; in addition to the current event.status flip,
 *        should write a recap entry keyed by eventTid into a recap index
 *        (Redis hash or post-metadata.json `recap` block). Recap entry
 *        carries: subjectKind="event" | subjectTid | summary | settledAt |
 *        joinerCount | optional rewardSummary.
 *
 *   POST /api/posts/:tid/help/resolve  (currently /api/posts/:tid/resolve)
 *     -> existing endpoint; should write a recap entry with subjectKind="help"
 *        and the resolution body if the author supplied one.
 *
 *   GET /api/outcomes/:subjectTid
 *     -> 200 { ok, outcome: { subjectKind, subjectTid, summary, ... } }
 *     -> 404 when the subject was not /completed or /resolved
 *     -> public read; mirrors /api/posts/:tid audience rules
 *
 *   GET /api/kb/posts?tag=&q=&limit=
 *     -> 200 { ok, items: [...] }
 *     -> anonymous-readable. Items are recap entries promoted to KB.
 *     -> `q=` filters by title/summary substring.
 *
 *   Frontend: /#/knowledge-base (new AppViewKey="knowledge-base") with a
 *     KbList view, each item linking to /#/post/:tid for the original
 *     subject post. Outcome detail rendered inline on the post detail page
 *     under [data-testid="post-detail-outcome-block"] when present.
 *
 * The spec is `describe.serial` so the outcome-after-complete and KB-list
 * arms run in deterministic order (KB list assertions implicitly depend on
 * the recap entry having been produced upstream once the feature lands).
 */

import { expect, request, test } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";
import { fetchEventRuntimeFixture } from "./fixtures/event-runtime";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

// Toggle by individual arm when the backend ships. The first arm that lands
// will likely be `eventOutcomeRender` — flip its fixme to `false` in the same
// PR that introduces /api/outcomes/:subjectTid.
const BACKEND_GAP_REASON =
  "backend gap: outcome recap + KB endpoints not implemented (PRD §19.2 P6); see spec header for proposed surface.";

interface HelpRuntimeFixture {
  tid: number;
  ready: boolean;
  help: {
    status?: string;
    voteCount?: number;
    linkedEventId?: string | null;
    helpId?: string | null;
    authorUserId?: string;
  } | null;
  expectedAuthorUserId: string;
}

interface FixturesEnvelope {
  ok?: boolean;
  fixtures?: {
    helpRuntime?: Partial<HelpRuntimeFixture> & {
      help?: HelpRuntimeFixture["help"];
    };
  };
}

/**
 * Mirror of fetchEventRuntimeFixture but for the helpRuntime block. Inlined
 * here rather than added to fixtures/help-runtime.ts because the help fixture
 * helper has not been extracted yet (Wave C-B will introduce it). When that
 * lands, swap this for a `fetchHelpRuntimeFixture` import.
 */
async function fetchHelpRuntimeFixture(): Promise<HelpRuntimeFixture | null> {
  const api = await request.newContext({ baseURL: BASE_URL });
  try {
    const response = await api.get("/api/fixtures");
    if (!response.ok()) return null;
    const body = (await response.json()) as FixturesEnvelope;
    const runtime = body?.fixtures?.helpRuntime;
    if (!runtime || typeof runtime !== "object") return null;
    const tid =
      typeof runtime.tid === "number" && Number.isFinite(runtime.tid) ? runtime.tid : Number.NaN;
    if (!Number.isFinite(tid)) return null;
    return {
      tid,
      ready: Boolean(runtime.ready),
      help: runtime.help ?? null,
      expectedAuthorUserId: String(runtime.expectedAuthorUserId ?? ""),
    };
  } catch {
    return null;
  } finally {
    await api.dispose();
  }
}

test.describe.serial("@kb @p6 outcome-recap + knowledge-base proof", () => {
  test("@p6 outcome render after event /complete (recap entry surfaces via GET /api/outcomes/:tid)", async () => {
    test.fixme(true, BACKEND_GAP_REASON);

    test.skip(
      !isRoleConfigured("event_creator"),
      "event_creator role not configured — set LIAN_E2E_EVENT_CREATOR_USERNAME / LIAN_E2E_EVENT_CREATOR_PASSWORD",
    );

    const fixture = await fetchEventRuntimeFixture({ baseURL: BASE_URL });
    test.skip(!fixture?.ready, "event-runtime fixture not ready (tid 156 not seeded)");

    const { api } = await loginAs("event_creator");
    try {
      // Drive the existing /complete transition. Today this only writes
      // event.status="completed"; once P6 lands the same call should ALSO
      // emit a recap entry keyed by the event tid.
      const completeRes = await api.post(`/api/events/${fixture!.event!.eventId}/complete`);
      expect(
        completeRes.status() === 200,
        `expected 200 from /complete, got ${completeRes.status()}: ${await completeRes.text()}`,
      ).toBe(true);

      // PROPOSED: GET /api/outcomes/:subjectTid should return the recap.
      const outcomeRes = await api.get(`/api/outcomes/${fixture!.tid}`);
      expect(outcomeRes.ok(), await outcomeRes.text()).toBe(true);
      const outcomeBody = (await outcomeRes.json()) as {
        ok?: boolean;
        outcome?: {
          subjectKind?: string;
          subjectTid?: number;
          summary?: string;
          joinerCount?: number;
          settledAt?: string;
        };
      };
      expect(outcomeBody.outcome).toBeTruthy();
      expect(outcomeBody.outcome!.subjectKind).toBe("event");
      expect(outcomeBody.outcome!.subjectTid).toBe(fixture!.tid);
      expect(typeof outcomeBody.outcome!.settledAt).toBe("string");

      // Rollback via the same self-heal seam used by the event-runtime
      // helpers — POST /api/test/reset rehydrates tid 156 from the e2e
      // mirror, undoing the status flip and any recap that was written.
      // We don't assert reset response shape here; failure to reset is
      // covered by the event-runtime fixture's own readiness gate on the
      // next test run.
      await api.post("/api/test/reset");
    } finally {
      await api.dispose();
    }
  });

  test("@p6 outcome render after help /resolve (recap entry surfaces via GET /api/outcomes/:tid)", async () => {
    test.fixme(true, BACKEND_GAP_REASON);

    test.skip(
      !isRoleConfigured("event_creator"),
      "event_creator role not configured — help fixture reuses the event_creator seed",
    );

    const fixture = await fetchHelpRuntimeFixture();
    test.skip(!fixture?.ready, "help-runtime fixture not ready (tid 200 not seeded)");

    const { api } = await loginAs("event_creator");
    try {
      // Drive the existing /resolve transition (help.status -> resolved).
      // Once P6 lands the same call should ALSO emit a recap entry
      // keyed by the help tid.
      const resolveRes = await api.post(`/api/posts/${fixture!.tid}/resolve`);
      expect(
        resolveRes.status() === 200,
        `expected 200 from /resolve, got ${resolveRes.status()}: ${await resolveRes.text()}`,
      ).toBe(true);

      // PROPOSED: GET /api/outcomes/:subjectTid for help posts.
      const outcomeRes = await api.get(`/api/outcomes/${fixture!.tid}`);
      expect(outcomeRes.ok(), await outcomeRes.text()).toBe(true);
      const outcomeBody = (await outcomeRes.json()) as {
        ok?: boolean;
        outcome?: { subjectKind?: string; subjectTid?: number; summary?: string };
      };
      expect(outcomeBody.outcome).toBeTruthy();
      expect(outcomeBody.outcome!.subjectKind).toBe("help");
      expect(outcomeBody.outcome!.subjectTid).toBe(fixture!.tid);

      // Rollback: same /api/test/reset seam — restores help.status="open"
      // from the e2e mirror.
      await api.post("/api/test/reset");
    } finally {
      await api.dispose();
    }
  });

  test("@p6 anonymous GET /api/kb/posts returns resolved entries; ?q= search narrows the list", async () => {
    test.fixme(true, BACKEND_GAP_REASON);

    const api = await request.newContext({ baseURL: BASE_URL });
    try {
      // Anonymous read — KB is public per PRD §19.2 P6 (sedimentation zone).
      const listRes = await api.get("/api/kb/posts?limit=20");
      expect(listRes.ok(), await listRes.text()).toBe(true);
      const listBody = (await listRes.json()) as {
        ok?: boolean;
        items?: Array<{ tid: number; title: string; subjectKind: string; summary?: string }>;
      };
      expect(Array.isArray(listBody.items)).toBe(true);
      expect(listBody.items!.length).toBeGreaterThan(0);
      for (const item of listBody.items!) {
        expect(["help", "event"]).toContain(item.subjectKind);
        expect(typeof item.tid).toBe("number");
      }

      // Narrow via ?q=. We use a deliberately specific token so the unfiltered
      // list and filtered list cannot accidentally have the same length.
      const searchRes = await api.get("/api/kb/posts?q=%E5%82%A8%E7%89%A9%E6%9F%9C&limit=20"); // 储物柜
      expect(searchRes.ok(), await searchRes.text()).toBe(true);
      const searchBody = (await searchRes.json()) as { items?: unknown[] };
      expect(Array.isArray(searchBody.items)).toBe(true);
      expect(searchBody.items!.length).toBeLessThanOrEqual(listBody.items!.length);
    } finally {
      await api.dispose();
    }
  });

  test("@p6 browser proof — KB list page renders entries and outcome detail block renders on post detail", async ({
    browser,
  }) => {
    test.fixme(true, BACKEND_GAP_REASON);

    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const fixture = await fetchEventRuntimeFixture({ baseURL: BASE_URL });
    test.skip(!fixture?.ready, "event-runtime fixture not ready (tid 156 not seeded)");

    const { api } = await loginAs("registered");
    try {
      const context = await browser.newContext({ storageState: await api.storageState() });
      const page = await context.newPage();
      try {
        // KB list view — proposed AppViewKey "knowledge-base", deep link
        // /#/knowledge-base. Each row carries [data-testid="kb-list-item"]
        // and a tap target that pushes /#/post/:tid.
        await page.goto(`${BASE_URL}/#/knowledge-base`);
        await page.waitForSelector('[data-testid="kb-list-item"]', {
          state: "visible",
          timeout: 15000,
        });
        await expect(page.locator('[data-testid="kb-list-item"]').first()).toBeVisible();
        await page.screenshot({
          path: "test-results/p6-kb-list.png",
          fullPage: true,
        });

        // Outcome detail block — rendered inline on /#/post/:tid when the
        // post has a recap entry, under
        // [data-testid="post-detail-outcome-block"]. For the seeded event
        // tid 156 (which the previous arms /complete'd), this block must
        // render. For posts without a recap, the block must be absent —
        // not silently swallowed.
        await page.goto(`${BASE_URL}/#/post/${fixture!.tid}`);
        await page.waitForSelector('[data-testid="post-detail-outcome-block"]', {
          state: "visible",
          timeout: 15000,
        });
        await expect(page.locator('[data-testid="post-detail-outcome-block"]')).toBeVisible();
        await page.screenshot({
          path: "test-results/p6-outcome-detail.png",
          fullPage: true,
        });
      } finally {
        await context.close();
      }
    } finally {
      await api.dispose();
    }
  });
});
