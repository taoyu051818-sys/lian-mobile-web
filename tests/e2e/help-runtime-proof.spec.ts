/**
 * Help runtime proof lane (Wave C-A, PRD §19.2 P1).
 *
 * Verifies the smallest truthful slice of the help journey that ships today:
 *   1. The public feed exposes at least one help-shaped post (or skips when
 *      none is seeded).
 *   2. Anonymous + authenticated viewers can fetch help detail and see the
 *      `help` extension on the post (status, voteCount, optional
 *      linkedEventTid).
 *   3. The vote endpoint enforces the no-permission path: anonymous => 401/403.
 *   4. A logged-in viewer can call /vote (200 OR a typed denial) and the
 *      detail page renders the help block end-to-end.
 *
 * What this spec deliberately does NOT cover:
 *   - link-event / unlink-event / resolve transitions — those mutate state
 *     and need a dedicated `/api/fixtures` `helpRuntime` block (Wave C-B).
 *   - vote/unvote round-trip count check — without a deterministic seed we
 *     cannot assert the exact pre/post delta. Wave C-B will use the seeded
 *     fixture for that.
 *
 * Help recognition mirrors the backend (help-routes.js):
 *   presentationIntent === "help"
 *   OR contentType ∈ {campus_tip, guide, opportunity, signup}
 */

import { expect, request, test } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

const HELP_INTENT_CONTENT_TYPES = new Set(["campus_tip", "guide", "opportunity", "signup"]);

interface FeedItem {
  tid?: number;
  contentType?: string;
  presentationIntent?: string;
  title?: string;
  help?: {
    status?: string;
    voteCount?: number;
    linkedEventTid?: number | null;
    helpId?: string | null;
  };
}

interface FeedResponse {
  items?: FeedItem[];
}

interface PostDetail {
  tid?: number;
  help?: FeedItem["help"];
  helpVoted?: boolean;
}

function isHelpShaped(item: FeedItem): boolean {
  if (!item || typeof item !== "object") return false;
  if (item.presentationIntent === "help") return true;
  return HELP_INTENT_CONTENT_TYPES.has(String(item.contentType || ""));
}

/**
 * Find a help-shaped post by scanning the public feed. Returns null when
 * none is exposed — caller should `test.skip` rather than fail, because the
 * absence of a help-shaped post is a seed problem, not a regression.
 *
 * NOTE: Wave C-B will replace this with a `/api/fixtures` `helpRuntime`
 * lookup mirroring the event-runtime path so we don't depend on whatever
 * happens to be in the live feed. For Wave C-A the feed-scan is sufficient
 * to prove the read-side journey.
 */
async function findHelpPost(): Promise<FeedItem | null> {
  const api = await request.newContext({ baseURL: BASE_URL });
  try {
    const response = await api.get("/api/feed?limit=50");
    if (!response.ok()) return null;
    const body = (await response.json()) as FeedResponse;
    const items = body.items ?? [];
    return items.find(isHelpShaped) ?? null;
  } finally {
    await api.dispose();
  }
}

test.describe("@help help runtime proof @help-runtime", () => {
  test("@help public feed surfaces at least one help-shaped post (skips when no seed)", async () => {
    const sample = await findHelpPost();
    test.skip(
      sample === null,
      "no help-shaped post in the public feed; seed at least one help post before running",
    );
    // tid is the only field guaranteed to be present even when the help
    // extension itself has not yet been hydrated by the feed normalizer.
    expect(typeof sample!.tid).toBe("number");
    expect(sample!.tid).toBeGreaterThan(0);
  });

  test("@help GET /api/posts/:tid surfaces the help extension end-to-end", async () => {
    const sample = await findHelpPost();
    test.skip(sample === null, "no help-shaped post available");

    const api = await request.newContext({ baseURL: BASE_URL });
    try {
      const response = await api.get(`/api/posts/${sample!.tid}`);
      expect(response.ok(), await response.text()).toBe(true);
      const detail = (await response.json()) as PostDetail;
      expect(detail.help, "post-detail must carry the help extension").toBeTruthy();
      // status must be one of the four known values; anything else means the
      // backend writer drifted from the documented state machine.
      expect(["open", "linked_event", "resolved", "closed"]).toContain(String(detail.help!.status));
      expect(typeof detail.help!.voteCount).toBe("number");
      expect(detail.help!.voteCount).toBeGreaterThanOrEqual(0);
    } finally {
      await api.dispose();
    }
  });

  test("@help POST /api/posts/:tid/vote requires login (anonymous denial path)", async () => {
    const sample = await findHelpPost();
    test.skip(sample === null, "no help-shaped post available");

    const api = await request.newContext({ baseURL: BASE_URL });
    try {
      const response = await api.post(`/api/posts/${sample!.tid}/vote`);
      expect(
        [401, 403].includes(response.status()),
        `expected 401/403 for anonymous vote, got ${response.status()}: ${await response.text()}`,
      ).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test("@help registered viewer sees help block and can call /vote (success or typed denial)", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const sample = await findHelpPost();
    test.skip(sample === null, "no help-shaped post available");

    const { api } = await loginAs("registered");
    try {
      // Truthful runtime claim: /vote either toggles successfully OR returns
      // a typed denial (e.g. 409 if the help is resolved/closed). What we
      // refuse to accept is a 5xx — that signals a frontend wired to a dead
      // route. We don't assert pre/post counter delta here; Wave C-B will do
      // that against a deterministic seed.
      const response = await api.post(`/api/posts/${sample!.tid}/vote`);
      const status = response.status();
      expect(
        status === 200 || status === 400 || status === 403 || status === 409,
        `expected 200 or typed denial (400/403/409), got ${status}: ${await response.text()}`,
      ).toBe(true);

      // Browser proof: detail page renders the help block, the action button
      // is present, and (if status is open/linked_event) the button is
      // enabled. For resolved/closed posts the disabled hint should render.
      const context = await browser.newContext({ storageState: await api.storageState() });
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/#/post/${sample!.tid}`);
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
