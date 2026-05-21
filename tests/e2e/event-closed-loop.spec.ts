/**
 * Event closed-loop journey (issue #738).
 *
 * End-to-end proof that the event lifecycle works edge-to-edge after Wave 1/2/3
 * landed: creator publishes a rewarded event → joiner is seated → creator
 * `/complete` → `/reward` settle → three notifications fan out to the messages
 * center → settlement readout shows up on the detail page → replaying both
 * `/reward` and `/admin/events/expire-scan` is idempotent.
 *
 * This spec is the concrete `event` arm of #604 / #606. It does NOT close them.
 *
 * Dependencies (all merged on origin/main as of 2026-05-21):
 *   - F1 (#716, closes #703)        creator/admin "结束活动" + completeEvent()
 *   - F2 (#715, closes #704)        normalizer event.status round-trip
 *   - F3 (#740, closes #706)        messages center renders the three event types
 *   - F4 (#719, closes #705)        post-detail settlement readout
 *   - T1-frontend (#720, closes #707) loginAs(role) + fetchEventRuntimeFixture
 *   - B1 lian-platform-server#444   /api/events/:id/reward V0.2 settlement
 *   - B2 lian-platform-server#445   /api/messages fan-out for completed/settled/expired
 *   - T1-backend lian-platform-server#443  seeded event_creator/org_member +
 *     stable rewarded event tid 156 + GET /api/fixtures.eventRuntime
 *
 * Skip semantics (matches #738 spec table — never silent):
 *   - LIAN_E2E_SEEDED_EVENT_ID unset                    → skip with reason
 *   - LIAN_E2E_EVENT_CREATOR_USERNAME/PASSWORD missing  → skip with reason
 *   - LIAN_E2E_ORG_MEMBER_USERNAME/PASSWORD missing     → skip with reason
 *   - GET /api/fixtures returns 404 (production mode)   → skip with reason
 *   - fixture.ready === false                            → skip with reason
 *   - LIAN_E2E_ADMIN_TOKEN unset (expired-arm only)     → skip step 10 only
 *
 * Hard fails (no skip allowed once Wave 2 has landed — these are regressions):
 *   - /complete returns non-2xx for the event author
 *   - /reward returns 501 (Wave 1 fallback signature gone)
 *   - /reward returns perJoiner === 0 with a ready fixture (fixture misconfig)
 *   - settlement payload missing settlementId / perJoiner / joinerCount / totalPaid
 *   - notifications missing actor.displayName === "活动小助手"
 *   - notifications missing data.targetType === "event" or wrong data.transition
 *   - replay /reward produces a different settlementId or duplicate fan-out
 */

import { expect, request, test, type APIRequestContext } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";
import {
  fetchEventRuntimeFixture,
  isSeededEventIdConfigured,
  type EventRuntimeFixture,
} from "./fixtures/event-runtime";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

const EXPECTED_ACTOR_DISPLAY_NAME = "活动小助手";

interface EventExtension {
  eventId?: string;
  status?: string;
  authorUserId?: string;
  joinedUserIds?: string[];
  joinedCount?: number;
  rewardSettlement?: {
    settlementId?: string;
    settledAt?: string;
    perJoiner?: number;
    joinerCount?: number;
    totalPaid?: number;
    remainder?: number;
    joinerIds?: string[];
    honorAwarded?: Record<string, number>;
  };
}

interface PostDetail {
  tid?: number | string;
  authorUserId?: string;
  event?: EventExtension;
}

interface CompleteResponse {
  ok?: boolean;
  eventId?: string;
  status?: string;
  joinedCount?: number;
  completedAt?: string;
}

interface SettlementPayload {
  settlementId: string;
  settledAt: string;
  perJoiner: number;
  joinerCount: number;
  totalPaid: number;
  remainder: number;
  joinerIds: string[];
  honorAwarded?: Record<string, number>;
}

interface RewardResponse {
  ok?: boolean;
  eventId?: string;
  status?: string;
  settlement?: SettlementPayload;
}

interface NotificationItem {
  id?: string | number;
  type?: string;
  tid?: number | string;
  title?: string;
  excerpt?: string;
  read?: boolean;
  timestampISO?: string;
  actor?: { displayName?: string };
  data?: {
    eventId?: string;
    eventTitle?: string;
    hostPostTid?: number | string;
    transition?: string;
    targetType?: string;
    settlementId?: string;
    perJoiner?: number | string;
    points?: number | string;
  };
}

interface MessagesResponse {
  items?: NotificationItem[];
}

interface ExpireScanSummary {
  ok?: boolean;
  scannedCount?: number;
  expiredCount?: number;
}

function fixtureSkipReason(fixture: EventRuntimeFixture | null): string | null {
  if (fixture === null) {
    return "/api/fixtures unavailable (production-mode 404 or transport error) — closed-loop spec cannot run";
  }
  if (!fixture.ready) {
    return "fixture seeded but not ready on this backend — closed-loop spec cannot run";
  }
  return null;
}

function findEventNotification(
  items: NotificationItem[] | undefined,
  type: string,
  hostPostTid: number,
): NotificationItem | null {
  if (!items) return null;
  return (
    items.find((item) => {
      if (item.type !== type) return false;
      const itemTid =
        typeof item.tid === "number" ? item.tid : Number.parseInt(String(item.tid ?? ""), 10);
      const dataTid =
        typeof item.data?.hostPostTid === "number"
          ? item.data.hostPostTid
          : Number.parseInt(String(item.data?.hostPostTid ?? ""), 10);
      return itemTid === hostPostTid || dataTid === hostPostTid;
    }) ?? null
  );
}

function countEventNotifications(
  items: NotificationItem[] | undefined,
  type: string,
  hostPostTid: number,
): number {
  if (!items) return 0;
  return items.filter((item) => {
    if (item.type !== type) return false;
    const itemTid =
      typeof item.tid === "number" ? item.tid : Number.parseInt(String(item.tid ?? ""), 10);
    const dataTid =
      typeof item.data?.hostPostTid === "number"
        ? item.data.hostPostTid
        : Number.parseInt(String(item.data?.hostPostTid ?? ""), 10);
    return itemTid === hostPostTid || dataTid === hostPostTid;
  }).length;
}

function assertEventNotificationContract(item: NotificationItem, transition: string): void {
  expect(item.actor?.displayName, "notification actor.displayName must be the brand string").toBe(
    EXPECTED_ACTOR_DISPLAY_NAME,
  );
  expect(item.data?.targetType, "data.targetType must be 'event'").toBe("event");
  expect(item.data?.transition, `data.transition must be ${transition}`).toBe(transition);
  expect(item.id, "notification id must be present (idempotency key)").toBeTruthy();
}

test.describe("@event-closed-loop event end-to-end journey", () => {
  test.beforeEach(() => {
    test.skip(
      !isSeededEventIdConfigured(),
      "LIAN_E2E_SEEDED_EVENT_ID not set — closed-loop spec opts out of implicit defaults",
    );
    test.skip(
      !isRoleConfigured("event_creator"),
      "event_creator role not configured — set LIAN_E2E_EVENT_CREATOR_USERNAME / LIAN_E2E_EVENT_CREATOR_PASSWORD",
    );
    test.skip(
      !isRoleConfigured("org_member"),
      "org_member role not configured — set LIAN_E2E_ORG_MEMBER_USERNAME / LIAN_E2E_ORG_MEMBER_PASSWORD",
    );
  });

  test("@event-closed-loop creator completes -> settles -> notifications -> readout -> idempotent replay", async ({
    browser,
  }) => {
    // -----------------------------------------------------------------------
    // Step 1 — discovery (fixture readiness)
    // -----------------------------------------------------------------------
    const fixture = await fetchEventRuntimeFixture({ baseURL: BASE_URL });
    const skipReason = fixtureSkipReason(fixture);
    test.skip(skipReason !== null, skipReason ?? "");
    const f = fixture!;
    expect(f.tid, "fixture.tid must be a positive integer").toBeGreaterThan(0);
    expect(f.expectedAuthorUserId).toBe("e2e-event-creator-001");
    expect(f.expectedJoinerUserId).toBe("e2e-org-member-001");
    expect(f.event, "fixture.event missing — backend seeder did not finish").toBeTruthy();

    // -----------------------------------------------------------------------
    // Step 2 — owner login
    // -----------------------------------------------------------------------
    const owner = await loginAs("event_creator", BASE_URL);
    expect(owner.user.id, "event_creator login response missing user.id").toBe(
      f.expectedAuthorUserId,
    );

    const ownerApi: APIRequestContext = owner.api;
    let joinerApi: APIRequestContext | null = null;

    try {
      // ---------------------------------------------------------------------
      // Step 3 — detail open (asserts seeded shape)
      // ---------------------------------------------------------------------
      const detailResponse = await ownerApi.get(`/api/posts/${f.tid}`);
      expect(detailResponse.ok(), await detailResponse.text()).toBe(true);
      const detailBefore = (await detailResponse.json()) as PostDetail;
      expect(detailBefore.event, "seeded event extension missing on /api/posts/:tid").toBeTruthy();
      // Pre-settle status is whatever the seeder left behind (open / completed
      // from a previous run). We only require it is NOT "expired" here so the
      // happy-path arm has a chance — expired is its own arm in step 10.
      expect(detailBefore.event!.status).not.toBe("expired");
      expect(String(detailBefore.authorUserId ?? "")).toBe(f.expectedAuthorUserId);
      expect(detailBefore.event!.joinedUserIds ?? []).toContain(f.expectedJoinerUserId);

      const eventId = String(detailBefore.event!.eventId ?? f.event!.eventId);
      expect(eventId, "eventId missing from detail payload").toBeTruthy();

      // ---------------------------------------------------------------------
      // Step 4 — complete (idempotent on the backend per F1 contract)
      // ---------------------------------------------------------------------
      const completeResponse = await ownerApi.post(
        `/api/events/${encodeURIComponent(eventId)}/complete`,
      );
      expect(
        completeResponse.ok(),
        `expected /complete to succeed for the author, got ${completeResponse.status()}: ${await completeResponse.text()}`,
      ).toBe(true);
      const completeBody = (await completeResponse.json()) as CompleteResponse;
      expect(completeBody.status).toBe("completed");
      expect(completeBody.completedAt, "completedAt must be present").toBeTruthy();
      expect(
        new Date(String(completeBody.completedAt)).toString(),
        `completedAt must be a valid ISO date, got ${completeBody.completedAt}`,
      ).not.toBe("Invalid Date");

      // ---------------------------------------------------------------------
      // Step 5 — settle (V0.2 settlement payload, hard-fail on 501)
      // ---------------------------------------------------------------------
      const rewardResponse = await ownerApi.post(
        `/api/events/${encodeURIComponent(eventId)}/reward`,
      );
      expect(
        rewardResponse.status(),
        `Wave 2 has landed; /reward must not return 501. Body: ${await rewardResponse.text()}`,
      ).not.toBe(501);
      expect(rewardResponse.ok(), await rewardResponse.text()).toBe(true);
      const rewardBody = (await rewardResponse.json()) as RewardResponse;
      const settlement = rewardBody.settlement;
      expect(settlement, "reward response must carry a settlement payload").toBeTruthy();
      expect(settlement!.settlementId, "settlementId required").toBeTruthy();
      expect(
        new Date(String(settlement!.settledAt)).toString(),
        `settledAt must be a valid ISO date, got ${settlement!.settledAt}`,
      ).not.toBe("Invalid Date");
      expect(typeof settlement!.perJoiner, "perJoiner must be numeric").toBe("number");
      expect(typeof settlement!.joinerCount, "joinerCount must be numeric").toBe("number");
      expect(typeof settlement!.totalPaid, "totalPaid must be numeric").toBe("number");
      expect(typeof settlement!.remainder, "remainder must be numeric").toBe("number");
      expect(Array.isArray(settlement!.joinerIds), "joinerIds must be an array").toBe(true);
      expect(
        settlement!.perJoiner,
        "fixture is marked ready but perJoiner came back 0 — seeded reward budget is misconfigured",
      ).toBeGreaterThan(0);
      expect(
        settlement!.joinerIds,
        "settlement.joinerIds must include the seeded org_member",
      ).toContain(f.expectedJoinerUserId);

      // ---------------------------------------------------------------------
      // Step 6 — owner-side notification fan-out
      // ---------------------------------------------------------------------
      const ownerMessagesResponse = await ownerApi.get("/api/messages");
      expect(ownerMessagesResponse.ok(), await ownerMessagesResponse.text()).toBe(true);
      const ownerMessages = (await ownerMessagesResponse.json()) as MessagesResponse;
      const ownerCompleted = findEventNotification(ownerMessages.items, "event-completed", f.tid);
      expect(
        ownerCompleted,
        "owner inbox must include an event-completed notification for the host post",
      ).toBeTruthy();
      assertEventNotificationContract(ownerCompleted!, "completed");
      expect(String(ownerCompleted!.id)).toMatch(
        new RegExp(`^evt-${eventId}-[^-]+-completed$`),
        `owner event-completed id must follow evt-<eventId>-<uid>-completed format, got ${ownerCompleted!.id}`,
      );

      // ---------------------------------------------------------------------
      // Step 7 — joiner-side notification fan-out (completed + reward-settled)
      // ---------------------------------------------------------------------
      const joiner = await loginAs("org_member", BASE_URL);
      joinerApi = joiner.api;
      expect(joiner.user.id).toBe(f.expectedJoinerUserId);

      const joinerMessagesResponse = await joinerApi.get("/api/messages");
      expect(joinerMessagesResponse.ok(), await joinerMessagesResponse.text()).toBe(true);
      const joinerMessages = (await joinerMessagesResponse.json()) as MessagesResponse;

      const joinerCompleted = findEventNotification(joinerMessages.items, "event-completed", f.tid);
      expect(
        joinerCompleted,
        "joiner inbox must include an event-completed notification",
      ).toBeTruthy();
      assertEventNotificationContract(joinerCompleted!, "completed");

      const joinerSettled = findEventNotification(
        joinerMessages.items,
        "event-reward-settled",
        f.tid,
      );
      expect(
        joinerSettled,
        "joiner inbox must include an event-reward-settled notification",
      ).toBeTruthy();
      assertEventNotificationContract(joinerSettled!, "reward_settled");
      expect(String(joinerSettled!.id)).toBe(
        `evt-${eventId}-${f.expectedJoinerUserId}-settlement-${settlement!.settlementId}`,
      );
      // points / perJoiner: backend ships either field; renderer reads either.
      const settledPoints =
        typeof joinerSettled!.data?.perJoiner === "number"
          ? joinerSettled!.data!.perJoiner
          : typeof joinerSettled!.data?.points === "number"
            ? joinerSettled!.data!.points
            : Number.parseInt(
                String(joinerSettled!.data?.perJoiner ?? joinerSettled!.data?.points ?? ""),
                10,
              );
      expect(
        settledPoints,
        "settlement notification points/perJoiner must equal settlement.perJoiner",
      ).toBe(settlement!.perJoiner);

      // ---------------------------------------------------------------------
      // Step 8 — detail readout (joiner viewer; UI assertion)
      // ---------------------------------------------------------------------
      const detailAfterResponse = await joinerApi.get(`/api/posts/${f.tid}`);
      expect(detailAfterResponse.ok(), await detailAfterResponse.text()).toBe(true);
      const detailAfter = (await detailAfterResponse.json()) as PostDetail;
      expect(
        detailAfter.event?.rewardSettlement,
        "rewardSettlement must round-trip on detail",
      ).toBeTruthy();
      expect(detailAfter.event!.rewardSettlement!.settlementId).toBe(settlement!.settlementId);
      expect(detailAfter.event!.rewardSettlement!.perJoiner).toBe(settlement!.perJoiner);

      const browserContext = await browser.newContext({
        storageState: await joinerApi.storageState(),
      });
      const page = await browserContext.newPage();
      try {
        await page.goto(`${BASE_URL}/#/post/${f.tid}`);
        await page.waitForSelector('[data-testid="post-detail-event-block"]', {
          state: "visible",
          timeout: 15_000,
        });
        const settlementBlock = page.locator('[data-testid="post-detail-event-reward-settlement"]');
        await expect(settlementBlock).toBeVisible();
        // perJoiner number renders inside the per-joiner sub-field.
        await expect(settlementBlock.locator('[data-settlement-field="per-joiner"]')).toContainText(
          String(settlement!.perJoiner),
        );
        await expect(settlementBlock.locator('[data-settlement-field="total"]')).toContainText(
          String(settlement!.totalPaid),
        );
        await expect(settlementBlock.locator('[data-settlement-field="settled-at"]')).toBeVisible();
      } finally {
        await browserContext.close();
      }

      // ---------------------------------------------------------------------
      // Step 9 — idempotency replay (/reward + notification de-dup)
      // ---------------------------------------------------------------------
      // Switch back to owner — only the author can settle.
      const replayResponse = await ownerApi.post(
        `/api/events/${encodeURIComponent(eventId)}/reward`,
      );
      expect(replayResponse.ok(), await replayResponse.text()).toBe(true);
      const replayBody = (await replayResponse.json()) as RewardResponse;
      expect(
        replayBody.settlement?.settlementId,
        "replay must reuse the original settlementId — no second payout",
      ).toBe(settlement!.settlementId);

      // Re-fetch joiner inbox; settlement notification count must stay at 1.
      const joinerMessagesAfter = (await (
        await joinerApi.get("/api/messages")
      ).json()) as MessagesResponse;
      const settledCount = countEventNotifications(
        joinerMessagesAfter.items,
        "event-reward-settled",
        f.tid,
      );
      expect(
        settledCount,
        "settlement notification must NOT be fanned out twice — idempotency key should de-dup",
      ).toBe(1);
    } finally {
      if (ownerApi) {
        await ownerApi.dispose();
      }
      if (joinerApi) {
        await joinerApi.dispose();
      }
    }
  });

  // -------------------------------------------------------------------------
  // Step 10 — expired arm (admin scan; #438 arm 3)
  // -------------------------------------------------------------------------
  // Independent test so it can skip cleanly when no admin token is available
  // without dropping the happy path on the floor. Verifies the admin endpoint
  // is reachable and replays produce no duplicate fan-out.
  test("@event-closed-loop @event-expired admin expire-scan is reachable and idempotent on replay", async () => {
    const adminToken = process.env.LIAN_E2E_ADMIN_TOKEN;
    test.skip(
      !adminToken,
      "LIAN_E2E_ADMIN_TOKEN not set — admin expire-scan arm cannot exercise without an admin bearer",
    );

    const fixture = await fetchEventRuntimeFixture({ baseURL: BASE_URL });
    const skipReason = fixtureSkipReason(fixture);
    test.skip(skipReason !== null, skipReason ?? "");

    const adminApi = await request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { authorization: `Bearer ${adminToken}` },
    });
    try {
      const firstResponse = await adminApi.post("/api/admin/events/expire-scan");
      expect(firstResponse.ok(), await firstResponse.text()).toBe(true);
      const firstSummary = (await firstResponse.json()) as ExpireScanSummary;
      expect(typeof firstSummary.scannedCount, "scannedCount must be numeric").toBe("number");
      expect(typeof firstSummary.expiredCount, "expiredCount must be numeric").toBe("number");

      // Replay: same shape, expiredCount must not regrow.
      const replayResponse = await adminApi.post("/api/admin/events/expire-scan");
      expect(replayResponse.ok(), await replayResponse.text()).toBe(true);
      const replaySummary = (await replayResponse.json()) as ExpireScanSummary;
      expect(
        replaySummary.expiredCount ?? 0,
        "replay expiredCount must be <= first run; idempotency key should suppress repeat fan-out",
      ).toBeLessThanOrEqual(firstSummary.expiredCount ?? 0);
    } finally {
      await adminApi.dispose();
    }
  });
});
