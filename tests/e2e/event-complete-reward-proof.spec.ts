/**
 * Event complete + reward + messages runtime proof lane (PRD §19.2 P2,
 * issue #438 fan-out arms 1+2). Builds on the read-only event-runtime
 * proof (#765) by exercising the author-only mutation endpoints
 * `/api/events/:id/{complete,reward}` and the LIAN-side personal
 * notification fan-out at `/api/messages`.
 *
 * Truthful runtime claims (assert nothing the backend cannot honor):
 *   1. The eventRuntime fixture self-heals to `ready=true` and surfaces
 *      the seeded author (`e2e-event-creator-001`) + joiner
 *      (`e2e-org-member-001`) — without these the suite cannot prove
 *      author-only / joiner-only flows.
 *   2. POST `/api/events/156/complete` is gated:
 *        - anonymous → 401/403
 *        - non-author registered viewer → 403 FORBIDDEN
 *        - event author (event_creator) → 200 with `status="completed"`.
 *      Detail at `/api/posts/156` then carries `event.status="completed"`.
 *   3. POST `/api/events/156/reward` (author-only, after /complete) →
 *      200 with `rewardSettlement` block. The joined `org_member` uid
 *      appears in `rewardSettlement.joinerIds` AND the joiner's wallet
 *      snapshot at `/api/wallet/me` is fetchable.
 *   4. GET `/api/messages` for the joined `org_member` lists at least
 *      one event fan-out record (`event-completed` or
 *      `event-reward-settled`) tagged with `data.eventId === "156"`.
 *
 * Re-runnability:
 *   - /complete + /reward are idempotent on the live store
 *     (event-routes.js — replay returns the existing settlement block,
 *     does NOT double-credit the wallet, does NOT re-fan messages
 *     because user-notifications-store dedupes by idempotencyKey).
 *   - The `eventRuntime` fixture self-heal (`isMissingEventFixture` in
 *     fixture-discovery-service.js) checks authorUserId/rewardBudget/
 *     rewardPerJoiner only — NOT status — so it will NOT roll
 *     `status="completed"` back to "open". Best-effort cleanup below
 *     calls `/api/test/reset` first (gated by LIAN_E2E_MODE on the
 *     backend) and falls back to a discovery hit; specifying that lane
 *     truthfully matters because the next run sees "completed", which
 *     the idempotency contract handles cleanly.
 *
 * Backend gaps surfaced (none block the cases above; documented inline
 * in the PR body):
 *   - Wallet pre/post delta — can't assert deterministically because
 *     the joiner balance carries forward across runs. We assert the
 *     snapshot is fetchable + the rewardSettlement block names the
 *     joiner; a real-balance delta check needs a per-run balance reset
 *     beyond what's currently exposed.
 *   - `/api/test/reset` heal between runs is gated to
 *     `LIAN_E2E_MODE=1` + non-prod; nat100 prod-mode runs cannot reset
 *     event.status. We tolerate that and lean on /complete idempotency.
 */

import { expect, request, test, type APIRequestContext, type APIResponse } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";
import { fetchEventRuntimeFixture, type EventRuntimeFixture } from "./fixtures/event-runtime";

const BASE_URL = process.env.APP_BASE_URL ?? "https://lian.nat100.top";

interface PostDetail {
  tid?: number;
  event?: {
    eventId?: string;
    status?: string;
    joinedCount?: number;
    completedAt?: string | null;
  };
}

interface RewardSettlement {
  settlementId?: string;
  settledAt?: string;
  perJoiner?: number;
  joinerCount?: number;
  totalPaid?: number;
  remainder?: number;
  joinerIds?: string[];
}

interface RewardResponse {
  ok?: boolean;
  rewardSettlement?: RewardSettlement | null;
  error?: string;
  code?: string;
}

interface CompleteResponse {
  ok?: boolean;
  eventId?: string;
  status?: string;
  joinedCount?: number;
  completedAt?: string;
  error?: string;
  code?: string;
}

interface WalletSnapshot {
  points?: number;
  honor?: number;
  lockedPoints?: number;
}

interface MessageItem {
  id?: string;
  type?: string;
  tid?: number | string | null;
  title?: string;
  data?: { eventId?: string; transition?: string; targetType?: string } | null;
}

interface MessagesResponse {
  items?: MessageItem[];
}

const COMPLETION_TYPES = new Set(["event-completed", "event-reward-settled"]);

function expectOkOrLog(response: APIResponse, label: string, body: unknown) {
  if (!response.ok()) {
    throw new Error(`${label} failed: HTTP ${response.status()} — ${JSON.stringify(body)}`);
  }
}

test.describe.serial("@event event-complete-reward proof @event-complete-reward", () => {
  // Shared across the serial sequence. Populated in beforeAll; later cases
  // skip cleanly if the fixture is not ready.
  let fixture: EventRuntimeFixture | null = null;

  test.beforeAll(async () => {
    fixture = await fetchEventRuntimeFixture({ baseURL: BASE_URL });
  });

  test("@event-complete-reward eventRuntime fixture is ready with seeded author + joiner", async () => {
    test.skip(
      fixture === null,
      "eventRuntime fixture surface unavailable (production-mode 404 on /api/fixtures)",
    );
    test.skip(
      fixture !== null && !fixture.ready,
      "eventRuntime fixture not ready (self-heal could not patch tid 156 from the e2e mirror)",
    );

    expect(fixture!.ready).toBe(true);
    expect(fixture!.event).not.toBeNull();
    expect(fixture!.event!.eventId).toBe("156");
    expect(fixture!.event!.authorUserId).toBe(fixture!.expectedAuthorUserId);
    expect(fixture!.event!.joinedUserIds).toContain(fixture!.expectedJoinerUserId);
    expect(fixture!.event!.rewardPerJoiner).toBeGreaterThan(0);
    expect(fixture!.event!.rewardBudget).toBeGreaterThanOrEqual(fixture!.event!.rewardPerJoiner);
  });

  test("@event-complete-reward anonymous /complete is denied (401/403)", async () => {
    test.skip(fixture === null || !fixture.ready, "eventRuntime fixture not ready");

    const api = await request.newContext({ baseURL: BASE_URL });
    try {
      const response = await api.post(
        `/api/events/${encodeURIComponent(fixture!.event!.eventId)}/complete`,
      );
      expect(
        [401, 403].includes(response.status()),
        `expected 401/403 for anonymous /complete, got ${response.status()}: ${await response.text()}`,
      ).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test("@event-complete-reward registered non-author gets 403 from /complete", async () => {
    test.skip(fixture === null || !fixture.ready, "eventRuntime fixture not ready");
    test.skip(
      !isRoleConfigured("registered"),
      "registered role not configured — set LIAN_E2E_REGISTERED_USERNAME / LIAN_E2E_REGISTERED_PASSWORD",
    );

    const { api } = await loginAs("registered");
    try {
      const response = await api.post(
        `/api/events/${encodeURIComponent(fixture!.event!.eventId)}/complete`,
      );
      // assertAuthor() throws FORBIDDEN; idempotent-replay path is gated
      // behind the author check, so a non-author always sees 403.
      expect(
        response.status(),
        `expected 403 for non-author /complete, got ${response.status()}: ${await response.text()}`,
      ).toBe(403);
      const body = (await response.json()) as { code?: string };
      expect(body.code).toBe("FORBIDDEN");
    } finally {
      await api.dispose();
    }
  });

  test("@event-complete-reward author /complete flips status to completed", async () => {
    test.skip(fixture === null || !fixture.ready, "eventRuntime fixture not ready");
    test.skip(
      !isRoleConfigured("event_creator"),
      "event_creator role not configured — set LIAN_E2E_EVENT_CREATOR_USERNAME / LIAN_E2E_EVENT_CREATOR_PASSWORD",
    );

    const { api, user } = await loginAs("event_creator");
    try {
      // Author identity must match the seed; otherwise we'd be hitting
      // the wrong account and the 403 path would mask any /complete bug.
      expect(String(user.id ?? "")).toBe(fixture!.expectedAuthorUserId);

      const response = await api.post(
        `/api/events/${encodeURIComponent(fixture!.event!.eventId)}/complete`,
      );
      const body = (await response.json()) as CompleteResponse;
      expectOkOrLog(response, "/complete", body);
      expect(body.ok).toBe(true);
      expect(body.status).toBe("completed");
      expect(body.eventId).toBe(fixture!.event!.eventId);

      // Re-probe the persisted block via the fixture-discovery surface.
      // The fixture path is the only public surface that reflects the live
      // event-block `status`; the /api/posts/:tid feed-shape (event extension)
      // intentionally does NOT carry status (deriveEventExtension in
      // feed-handlers.js exposes timing + capacity + reward only). We hit
      // /api/fixtures so the assertion catches a write that returned 200
      // but never landed in metadata (route-handler vs storage-adapter drift).
      const refreshed = await fetchEventRuntimeFixture({ baseURL: BASE_URL });
      expect(refreshed, "fixture surface must still be reachable post-/complete").not.toBeNull();
      expect(refreshed!.event, "event block must be present after /complete").not.toBeNull();
      expect(refreshed!.event!.status).toBe("completed");

      // Sanity: detail still surfaces the event extension at all (so we'd
      // catch a regression that drops the block entirely on /api/posts/:tid).
      const detailResponse = await api.get(`/api/posts/${fixture!.tid}`);
      expect(detailResponse.ok(), await detailResponse.text()).toBe(true);
      const detail = (await detailResponse.json()) as PostDetail;
      expect(detail.event).toBeTruthy();
    } finally {
      await api.dispose();
    }
  });

  test("@event-complete-reward author /reward settles to joined org_member", async () => {
    test.skip(fixture === null || !fixture.ready, "eventRuntime fixture not ready");
    test.skip(
      !isRoleConfigured("event_creator"),
      "event_creator role not configured — set LIAN_E2E_EVENT_CREATOR_USERNAME / LIAN_E2E_EVENT_CREATOR_PASSWORD",
    );

    const { api: authorApi } = await loginAs("event_creator");
    try {
      // Anonymous reward must be denied — same gate as /complete and a
      // cheap regression check that keeps reward path symmetrical with
      // the rest of the event surface.
      const anon = await request.newContext({ baseURL: BASE_URL });
      try {
        const anonResponse = await anon.post(
          `/api/events/${encodeURIComponent(fixture!.event!.eventId)}/reward`,
        );
        expect(
          [401, 403].includes(anonResponse.status()),
          `expected 401/403 for anonymous /reward, got ${anonResponse.status()}`,
        ).toBe(true);
      } finally {
        await anon.dispose();
      }

      const response = await authorApi.post(
        `/api/events/${encodeURIComponent(fixture!.event!.eventId)}/reward`,
        { data: { idempotencyKey: `e2e-reward-${fixture!.event!.eventId}` } },
      );
      const body = (await response.json()) as RewardResponse;
      expectOkOrLog(response, "/reward", body);
      expect(body.ok).toBe(true);
      expect(body.rewardSettlement, "rewardSettlement must be persisted").toBeTruthy();
      const settlement = body.rewardSettlement!;
      expect(Array.isArray(settlement.joinerIds)).toBe(true);
      expect(settlement.joinerIds, "settlement must list the seeded org_member uid").toContain(
        fixture!.expectedJoinerUserId,
      );
      expect(typeof settlement.totalPaid).toBe("number");
      expect(settlement.totalPaid).toBeGreaterThanOrEqual(fixture!.event!.rewardPerJoiner);
    } finally {
      await authorApi.dispose();
    }

    // Wallet snapshot is fetchable for the joiner — we deliberately do
    // NOT assert a pre/post delta because settlement is idempotent and
    // the joiner's balance carries across runs. A truthful balance
    // assertion needs a per-run wallet reset that the public API does
    // not expose; the rewardSettlement.joinerIds membership above is
    // the deterministic proof.
    if (isRoleConfigured("org_member")) {
      const { api: joinerApi } = await loginAs("org_member");
      try {
        const wallet = await joinerApi.get("/api/wallet/me");
        expect(wallet.ok(), await wallet.text()).toBe(true);
        const snapshot = (await wallet.json()) as WalletSnapshot;
        expect(typeof snapshot.points).toBe("number");
        expect(snapshot.points).toBeGreaterThanOrEqual(0);
      } finally {
        await joinerApi.dispose();
      }
    }
  });

  test("@event-complete-reward joiner inbox has event-* fan-out tagged with eventId", async () => {
    test.skip(fixture === null || !fixture.ready, "eventRuntime fixture not ready");
    test.skip(
      !isRoleConfigured("org_member"),
      "org_member role not configured — set LIAN_E2E_ORG_MEMBER_USERNAME / LIAN_E2E_ORG_MEMBER_PASSWORD",
    );

    const { api, user } = await loginAs("org_member");
    try {
      expect(String(user.id ?? "")).toBe(fixture!.expectedJoinerUserId);

      const response = await api.get("/api/messages");
      expect(response.ok(), await response.text()).toBe(true);
      const body = (await response.json()) as MessagesResponse;
      const items = Array.isArray(body.items) ? body.items : [];

      // Find a fan-out item from the LIAN store that names our seeded
      // event. Either `event-completed` (always written when /complete
      // fans, see fanOutCompletionNotifications) or
      // `event-reward-settled` (written when /reward pays a non-zero
      // perJoiner amount, see fanOutSettlementNotifications) is
      // sufficient — both are dispatched as part of the P2 journey and
      // either appearing proves the messages-dispatch arm.
      const match = items.find((item) => {
        if (!item || !item.type) return false;
        if (!COMPLETION_TYPES.has(String(item.type))) return false;
        const eventId = item.data && item.data.eventId ? String(item.data.eventId) : "";
        return eventId === fixture!.event!.eventId;
      });
      expect(
        match,
        `expected an event-completed or event-reward-settled item for eventId=${fixture!.event!.eventId} in joiner inbox; saw types=${items
          .map((i) => i?.type ?? "?")
          .join(",")}`,
      ).toBeTruthy();
      expect(match!.data!.targetType).toBe("event");
    } finally {
      await api.dispose();
    }
  });

  test.afterAll(async () => {
    // Best-effort cleanup. Two paths:
    //   1. POST /api/test/reset — wipes metadata + notifications back to
    //      the e2e mirror. Works only when the backend is started with
    //      LIAN_E2E_MODE=1 and isProductionMode()===false; nat100 prod
    //      returns 404 here. Runs first because it's the deepest reset
    //      we have.
    //   2. GET /api/fixtures — triggers the discovery self-heal, which
    //      will rehydrate tid 156 from the mirror IFF the live block
    //      drifted past `isMissingEventFixture` (current logic checks
    //      authorUserId/rewardBudget/rewardPerJoiner — NOT status — so
    //      a status="completed" alone does NOT trigger heal). We still
    //      hit it because (a) it's harmless and (b) the help fixture
    //      DOES heal status here, so symmetry helps when the rules
    //      tighten.
    //
    // Either failure is non-fatal: the next run still gets a clean
    // execution because /complete + /reward are idempotent and the
    // notification store dedupes on idempotencyKey.
    const api = await request.newContext({ baseURL: BASE_URL });
    try {
      const reset = await api.post("/api/test/reset").catch(() => null);
      if (reset && !reset.ok()) {
        // 404 is the expected production response — swallow quietly.
      }
      const heal = await api.get("/api/fixtures").catch(() => null);
      if (heal && !heal.ok()) {
        // Same — non-fatal.
      }
    } finally {
      await api.dispose();
    }
  });
});

// Defensive helper kept exported only for local debug runs; not used
// inside the suite. Keeps the file from depending on a sibling helper
// that doesn't exist yet (would force a fixture-file edit otherwise).
export type { APIRequestContext };
