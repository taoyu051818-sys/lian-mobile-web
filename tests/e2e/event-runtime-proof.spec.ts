/**
 * Event runtime proof lane (issue #650).
 *
 * Verifies the smallest truthful slice of the event journey that ships today:
 *   1. The public feed exposes event-shaped posts (or skips when none seeded).
 *   2. Anonymous + authenticated viewers can fetch event detail and see the
 *      `event` extension on the post (status, time, capacity, joinedCount,
 *      and rewardSummary when set).
 *   3. The join endpoint enforces the no-permission path: anonymous => 401,
 *      authenticated => 200 OR a typed eligibility error (full/closed/etc.).
 *   4. The detail page renders the event block + reward readout end-to-end.
 *
 * What this spec deliberately does NOT cover (product gaps, see issue #650
 * comment): creator-side completion UI, reward ledger settlement, completion
 * notifications. Those need backend extensions before frontend proof is
 * possible.
 */

import { expect, request, test } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

interface FeedItem {
  tid?: number;
  contentType?: string;
  title?: string;
  event?: {
    eventId?: string;
    joinedCount?: number;
    capacity?: number;
    startsAt?: string;
    endsAt?: string;
    rewardSummary?: string;
  };
}

interface FeedResponse {
  items?: FeedItem[];
}

interface PostDetail {
  tid?: number;
  event?: FeedItem["event"];
  eventJoined?: boolean;
}

async function findEventPost(): Promise<FeedItem | null> {
  const api = await request.newContext({ baseURL: BASE_URL });
  try {
    const response = await api.get("/api/feed?limit=50");
    if (!response.ok()) return null;
    const body = (await response.json()) as FeedResponse;
    const items = body.items ?? [];
    const event = items.find((it) => it.event && it.event.eventId);
    return event ?? null;
  } finally {
    await api.dispose();
  }
}

test.describe("@event event runtime proof @event-runtime", () => {
  test("@event public feed surfaces at least one event-shaped post (skips when no seed)", async () => {
    const sample = await findEventPost();
    test.skip(
      sample === null,
      "no event-shaped post in the public feed; seed at least one event before running",
    );
    expect(sample!.event!.eventId).toBeTruthy();
    expect(typeof sample!.event!.joinedCount).toBe("number");
  });

  test("@event GET /api/posts/:tid surfaces the event extension end-to-end", async () => {
    const sample = await findEventPost();
    test.skip(sample === null, "no event-shaped post available");

    const api = await request.newContext({ baseURL: BASE_URL });
    try {
      const response = await api.get(`/api/posts/${sample!.tid}`);
      expect(response.ok(), await response.text()).toBe(true);
      const detail = (await response.json()) as PostDetail;
      expect(detail.event).toBeTruthy();
      expect(detail.event!.eventId).toBe(sample!.event!.eventId);
      expect(typeof detail.event!.joinedCount).toBe("number");
      expect(detail.event!.joinedCount).toBeGreaterThanOrEqual(0);
    } finally {
      await api.dispose();
    }
  });

  test("@event /api/events/:id/join requires login (anonymous denial path)", async () => {
    const sample = await findEventPost();
    test.skip(sample === null, "no event-shaped post available");

    const api = await request.newContext({ baseURL: BASE_URL });
    try {
      const response = await api.post(`/api/events/${sample!.event!.eventId}/join`);
      expect(
        [401, 403].includes(response.status()),
        `expected 401/403 for anonymous join, got ${response.status()}`,
      ).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test("@event campus-verified viewer sees join button and can call join (success or typed denial)", async ({
    browser,
  }) => {
    test.skip(
      !isRoleConfigured("campus"),
      "campus role not configured — set LIAN_E2E_CAMPUS_USERNAME / LIAN_E2E_CAMPUS_PASSWORD",
    );

    const sample = await findEventPost();
    test.skip(sample === null, "no event-shaped post available");

    const { api } = await loginAs("campus");
    try {
      // Truthful runtime claim: the join endpoint either succeeds OR returns
      // a typed eligibility error. We accept any of those — what we DON'T
      // accept is a 5xx or a hang (signals frontend wired to a dead route).
      const response = await api.post(`/api/events/${sample!.event!.eventId}/join`);
      const status = response.status();
      expect(
        status === 200 || status === 400 || status === 403 || status === 409,
        `expected 200 or typed denial (400/403/409), got ${status}: ${await response.text()}`,
      ).toBe(true);

      // Browser proof: detail page renders the event block.
      const context = await browser.newContext({ storageState: await api.storageState() });
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/#/post/${sample!.tid}`);
        await page.waitForSelector('[data-testid="post-detail-event-block"]', {
          state: "visible",
          timeout: 15000,
        });
        await expect(page.locator('[data-testid="post-detail-event-action"]')).toBeVisible();
        // Reward block is conditional — only assert that the testid is
        // present iff the API returned rewardSummary, otherwise confirm it
        // is genuinely absent (not silently swallowed).
        const expectReward = Boolean(sample!.event!.rewardSummary);
        await expect(page.locator('[data-testid="post-detail-event-reward"]')).toHaveCount(
          expectReward ? 1 : 0,
        );
      } finally {
        await context.close();
      }
    } finally {
      await api.dispose();
    }
  });
});
