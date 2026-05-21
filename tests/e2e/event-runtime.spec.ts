/**
 * Event-runtime fixture consumer (issue #707, depends on
 * lian-platform-server #437 / PR #443).
 *
 * Smallest truthful proof that the new event_creator / org_member fixture
 * accounts and the seeded rewarded event (tid 156, surfaced via
 * `GET /api/fixtures` -> `fixtures.eventRuntime`) are wired end-to-end:
 *
 *   1. Discovery — `/api/fixtures` returns a `ready` event-runtime payload
 *      whose tid matches `LIAN_E2E_SEEDED_EVENT_ID` (when set) and whose
 *      author/joiner ids match the seeder's stable ids.
 *   2. Owner login — `loginAs("event_creator")` succeeds and can fetch the
 *      seeded event detail; the response carries the event extension and
 *      reports the seeder's stable user id as the author.
 *   3. Joiner login — `loginAs("org_member")` succeeds and the seeded event
 *      reports the org_member's stable id inside `event.joinedUserIds`.
 *
 * Deliberately NOT in scope (handled by separate F1 / F4 / B1 streams):
 *   - Calls to `/api/events/:id/complete` or `/reward`
 *   - Any UI assertions beyond what `event-runtime-proof.spec.ts` already covers
 *   - New testids or rendered strings
 *
 * Skips (with a clear reason, never fails CI):
 *   - The role env vars are not set
 *   - `LIAN_E2E_SEEDED_EVENT_ID` is unset (dev-mode without an explicit seed
 *     pin — we still default to "156" inside helpers, but the spec opts to
 *     skip rather than implicitly bind to that constant)
 *   - `/api/fixtures` is gated off (production mode 404) or the discovery
 *     payload reports `ready === false` (fixture missing on this backend)
 */

import { expect, test } from "@playwright/test";

import { isRoleConfigured, loginAs } from "./fixtures/accounts";
import {
  fetchEventRuntimeFixture,
  getSeededEventId,
  isSeededEventIdConfigured,
} from "./fixtures/event-runtime";

interface PostDetail {
  tid?: number | string;
  authorUserId?: string;
  event?: {
    eventId?: string;
    joinedUserIds?: string[];
    joinedCount?: number;
  };
}

test.describe("@event-fixture event_creator / org_member fixture consumer", () => {
  test.beforeEach(() => {
    test.skip(
      !isSeededEventIdConfigured(),
      "LIAN_E2E_SEEDED_EVENT_ID not set — skipping event-runtime fixture consumer suite",
    );
  });

  test("@event-fixture /api/fixtures advertises a ready event-runtime payload", async () => {
    const fixture = await fetchEventRuntimeFixture();
    test.skip(
      fixture === null,
      "/api/fixtures unavailable (production mode 404 or transport error) — fixture consumer cannot run here",
    );
    expect(fixture!.ready, JSON.stringify(fixture, null, 2)).toBe(true);
    expect(String(fixture!.tid)).toBe(getSeededEventId());
    expect(fixture!.expectedAuthorUserId, "expectedAuthorUserId missing on /api/fixtures").toBe(
      "e2e-event-creator-001",
    );
    expect(fixture!.expectedJoinerUserId, "expectedJoinerUserId missing on /api/fixtures").toBe(
      "e2e-org-member-001",
    );
    expect(fixture!.event, "fixture.event missing").toBeTruthy();
    expect(fixture!.event!.authorUserId).toBe(fixture!.expectedAuthorUserId);
    expect(fixture!.event!.joinedUserIds).toContain(fixture!.expectedJoinerUserId);
  });

  test("@event-fixture event_creator can fetch the seeded event and is reported as its author", async () => {
    test.skip(
      !isRoleConfigured("event_creator"),
      "event_creator role not configured — set LIAN_E2E_EVENT_CREATOR_USERNAME / LIAN_E2E_EVENT_CREATOR_PASSWORD",
    );
    const fixture = await fetchEventRuntimeFixture();
    test.skip(
      fixture === null || !fixture.ready,
      "event-runtime fixture not ready on this backend",
    );

    const { api, user } = await loginAs("event_creator");
    try {
      expect(user.id, "event_creator login response missing user.id").toBeTruthy();
      expect(user.id).toBe(fixture!.expectedAuthorUserId);

      const response = await api.get(`/api/posts/${fixture!.tid}`);
      expect(response.ok(), await response.text()).toBe(true);
      const detail = (await response.json()) as PostDetail;
      expect(detail.event, "seeded event tid lacks an event extension").toBeTruthy();
      expect(String(detail.event!.eventId)).toBe(String(fixture!.tid));
      expect(String(detail.authorUserId ?? "")).toBe(fixture!.expectedAuthorUserId);
    } finally {
      await api.dispose();
    }
  });

  test("@event-fixture org_member can fetch the seeded event and appears in joinedUserIds", async () => {
    test.skip(
      !isRoleConfigured("org_member"),
      "org_member role not configured — set LIAN_E2E_ORG_MEMBER_USERNAME / LIAN_E2E_ORG_MEMBER_PASSWORD",
    );
    const fixture = await fetchEventRuntimeFixture();
    test.skip(
      fixture === null || !fixture.ready,
      "event-runtime fixture not ready on this backend",
    );

    const { api, user } = await loginAs("org_member");
    try {
      expect(user.id, "org_member login response missing user.id").toBeTruthy();
      expect(user.id).toBe(fixture!.expectedJoinerUserId);

      const response = await api.get(`/api/posts/${fixture!.tid}`);
      expect(response.ok(), await response.text()).toBe(true);
      const detail = (await response.json()) as PostDetail;
      expect(detail.event, "seeded event tid lacks an event extension").toBeTruthy();
      const joined = detail.event!.joinedUserIds ?? [];
      expect(
        joined.includes(fixture!.expectedJoinerUserId),
        `org_member ${fixture!.expectedJoinerUserId} not present in joinedUserIds: ${JSON.stringify(joined)}`,
      ).toBe(true);
    } finally {
      await api.dispose();
    }
  });
});
