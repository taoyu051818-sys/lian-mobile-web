import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { derivedEventStatus, planEventAction } from "../../src/domain/eventActionPolicy";
import {
  normalizeEventExtension,
  normalizeEventJoinResult,
} from "../../src/platform/api-normalizers";
import { normalizePostDetail } from "../../src/api/posts";
import type { Audience } from "../../src/types/audience";
import type { EventPostExtension } from "../../src/types/post-extensions";

function readRepoFile(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

function makeEvent(overrides: Partial<EventPostExtension> = {}): EventPostExtension {
  return {
    eventId: "evt-1",
    joinedCount: 0,
    ...overrides,
  };
}

const allow = (_scope: Audience) => true;
const deny = (_scope: Audience) => false;

// Wall-clock anchor used in derivedEventStatus tests so they're stable.
const WALL_2026_06_01_11Z = () => Date.parse("2026-06-01T11:00:00Z");

describe("Phase 4: derivedEventStatus", () => {
  it("returns 'completed' when endsAt is in the past", () => {
    const e = makeEvent({ endsAt: "2026-06-01T10:00:00Z" });
    expect(derivedEventStatus(e, WALL_2026_06_01_11Z)).toBe("completed");
  });

  it("returns 'full' when capacity reached and endsAt is future/absent", () => {
    const e = makeEvent({ capacity: 5, joinedCount: 5 });
    expect(derivedEventStatus(e)).toBe("full");
  });

  it("treats capacity 0 as unlimited (not full)", () => {
    const e = makeEvent({ capacity: 0, joinedCount: 999 });
    expect(derivedEventStatus(e)).toBe("open");
  });

  it("returns 'open' when capacity not reached and end is future", () => {
    const e = makeEvent({ capacity: 10, joinedCount: 3, endsAt: "2030-01-01T00:00:00Z" });
    expect(derivedEventStatus(e)).toBe("open");
  });
});

describe("Phase 4 / issue #704: derivedEventStatus honors backend status", () => {
  it("server 'completed' wins even when endsAt is absent", () => {
    const e = makeEvent({ status: "completed" });
    expect(derivedEventStatus(e)).toBe("completed");
  });

  it("server 'completed' wins even when endsAt is in the future", () => {
    const e = makeEvent({ status: "completed", endsAt: "2030-01-01T00:00:00Z" });
    expect(derivedEventStatus(e, WALL_2026_06_01_11Z)).toBe("completed");
  });

  it("server 'cancelled' wins regardless of time and capacity", () => {
    const e = makeEvent({
      status: "cancelled",
      endsAt: "2030-01-01T00:00:00Z",
      capacity: 10,
      joinedCount: 0,
    });
    expect(derivedEventStatus(e, WALL_2026_06_01_11Z)).toBe("cancelled");
  });

  it("server 'closed' wins over time inference", () => {
    const e = makeEvent({ status: "closed", endsAt: "2030-01-01T00:00:00Z" });
    expect(derivedEventStatus(e, WALL_2026_06_01_11Z)).toBe("closed");
  });

  it("server status unset, endsAt past → 'completed' (legacy fallback preserved)", () => {
    const e = makeEvent({ endsAt: "2026-06-01T10:00:00Z" });
    expect(derivedEventStatus(e, WALL_2026_06_01_11Z)).toBe("completed");
  });

  it("server status unset, endsAt future, capacity full → 'full'", () => {
    const e = makeEvent({ capacity: 5, joinedCount: 5, endsAt: "2030-01-01T00:00:00Z" });
    expect(derivedEventStatus(e, WALL_2026_06_01_11Z)).toBe("full");
  });

  it("server status unset, endsAt future, capacity ok → 'open'", () => {
    const e = makeEvent({ capacity: 10, joinedCount: 3, endsAt: "2030-01-01T00:00:00Z" });
    expect(derivedEventStatus(e, WALL_2026_06_01_11Z)).toBe("open");
  });

  it("server 'open' does not mask a freshly-elapsed endsAt — time still wins for non-terminal server values", () => {
    // A stale server snapshot saying "open" must not override a clearly-elapsed window.
    const e = makeEvent({ status: "open", endsAt: "2026-06-01T10:00:00Z" });
    expect(derivedEventStatus(e, WALL_2026_06_01_11Z)).toBe("completed");
  });

  it("server 'full' does not mask a freshly-elapsed endsAt", () => {
    const e = makeEvent({
      status: "full",
      endsAt: "2026-06-01T10:00:00Z",
      capacity: 5,
      joinedCount: 2,
    });
    expect(derivedEventStatus(e, WALL_2026_06_01_11Z)).toBe("completed");
  });
});

describe("Phase 4: planEventAction (domain/eventActionPolicy)", () => {
  it("authenticated viewer with capacity left and matching scope can join", () => {
    const plan = planEventAction({
      event: makeEvent({ capacity: 10, joinedCount: 3 }),
      isAuthenticated: true,
      hasJoined: false,
      isEligibleForScope: allow,
    });
    expect(plan.mode).toBe("join");
    expect(plan.enabled).toBe(true);
    expect(plan.reasonKey).toBe("");
  });

  it("guest viewer cannot join — surfaced as notSignedIn", () => {
    const plan = planEventAction({
      event: makeEvent(),
      isAuthenticated: false,
      hasJoined: false,
      isEligibleForScope: allow,
    });
    expect(plan.mode).toBe("disabled");
    expect(plan.reasonKey).toBe("notSignedIn");
  });

  it("event already joined → cancel button enabled", () => {
    const plan = planEventAction({
      event: makeEvent({ joinedCount: 1 }),
      isAuthenticated: true,
      hasJoined: true,
      isEligibleForScope: allow,
    });
    expect(plan.mode).toBe("cancel");
    expect(plan.enabled).toBe(true);
  });

  it("derived 'full' disables join with `full` reason", () => {
    const plan = planEventAction({
      event: makeEvent({ capacity: 5, joinedCount: 5 }),
      isAuthenticated: true,
      hasJoined: false,
      isEligibleForScope: allow,
    });
    expect(plan.mode).toBe("disabled");
    expect(plan.reasonKey).toBe("full");
  });

  it("derived 'completed' (endsAt in the past) disables both modes", () => {
    const plan = planEventAction({
      event: makeEvent({ endsAt: "2026-06-01T10:00:00Z" }),
      isAuthenticated: true,
      hasJoined: false,
      isEligibleForScope: allow,
      now: WALL_2026_06_01_11Z,
    });
    expect(plan.mode).toBe("disabled");
    expect(plan.reasonKey).toBe("alreadyEnded");
  });

  it("ineligible scope disables join with `outOfScope` reason", () => {
    const plan = planEventAction({
      event: makeEvent({ capacity: 10, joinedCount: 0 }),
      isAuthenticated: true,
      hasJoined: false,
      isEligibleForScope: deny,
    });
    expect(plan.mode).toBe("disabled");
    expect(plan.reasonKey).toBe("outOfScope");
  });
});

describe("Phase 4: normalizeEventExtension (platform/api-normalizers)", () => {
  it("returns undefined when eventId is missing", () => {
    expect(normalizeEventExtension({ joinedCount: 3 })).toBeUndefined();
  });

  it("normalizes a well-formed PR-V4b payload", () => {
    const ext = normalizeEventExtension({
      eventId: "evt-1",
      startsAt: "2026-06-01T10:00:00Z",
      endsAt: "2026-06-01T12:00:00Z",
      location: "图书馆三层",
      capacity: 10,
      rewardSummary: "义工时 +1",
      joinedCount: 4,
    });
    expect(ext?.eventId).toBe("evt-1");
    expect(ext?.startsAt).toBe("2026-06-01T10:00:00Z");
    expect(ext?.endsAt).toBe("2026-06-01T12:00:00Z");
    expect(ext?.location).toBe("图书馆三层");
    expect(ext?.capacity).toBe(10);
    expect(ext?.rewardSummary).toBe("义工时 +1");
    expect(ext?.joinedCount).toBe(4);
  });

  it("clamps joinedCount to >= 0 and tolerates missing optionals", () => {
    const ext = normalizeEventExtension({
      eventId: "x",
      joinedCount: -3,
    });
    expect(ext?.joinedCount).toBe(0);
    expect(ext?.startsAt).toBeUndefined();
    expect(ext?.location).toBeUndefined();
    expect(ext?.capacity).toBeUndefined();
  });

  it("falls back to legacy startAt/endAt/participantCount field names", () => {
    const ext = normalizeEventExtension({
      eventId: "x",
      startAt: "2026-06-01T10:00:00Z",
      endAt: "2026-06-01T12:00:00Z",
      participantCount: 7,
    });
    expect(ext?.startsAt).toBe("2026-06-01T10:00:00Z");
    expect(ext?.endsAt).toBe("2026-06-01T12:00:00Z");
    expect(ext?.joinedCount).toBe(7);
  });

  it("issue #704 — round-trips backend-authoritative status when present", () => {
    const ext = normalizeEventExtension({
      eventId: "x",
      joinedCount: 0,
      status: "completed",
    });
    expect(ext?.status).toBe("completed");
  });

  it("issue #704 — accepts every known EventStatus value", () => {
    for (const s of ["open", "full", "closed", "completed", "cancelled"] as const) {
      const ext = normalizeEventExtension({ eventId: "x", joinedCount: 0, status: s });
      expect(ext?.status).toBe(s);
    }
  });

  it("issue #704 — drops unknown / malformed status without inventing a value", () => {
    const ext = normalizeEventExtension({
      eventId: "x",
      joinedCount: 0,
      status: "garbage",
    });
    expect(ext?.status).toBeUndefined();

    const noStatus = normalizeEventExtension({ eventId: "x", joinedCount: 0 });
    expect(noStatus?.status).toBeUndefined();

    const numeric = normalizeEventExtension({ eventId: "x", joinedCount: 0, status: 42 });
    expect(numeric?.status).toBeUndefined();
  });

  it("issue #973 — backend 'expired' status is treated as ended via endsAt fallback", () => {
    const ext = normalizeEventExtension({
      eventId: "x",
      joinedCount: 3,
      status: "expired",
      endsAt: "2026-06-01T10:00:00Z",
    });
    expect(ext?.status).toBeUndefined();
    expect(derivedEventStatus(ext!, WALL_2026_06_01_11Z)).toBe("completed");
  });
});

describe("Phase 4: normalizeEventJoinResult (join/cancel-join response)", () => {
  it("extracts eventId/joinedCount/joined", () => {
    const r = normalizeEventJoinResult({
      ok: true,
      eventId: "evt-7",
      joinedCount: 12,
      joined: true,
    });
    expect(r.eventId).toBe("evt-7");
    expect(r.joinedCount).toBe(12);
    expect(r.joined).toBe(true);
  });

  it("clamps joinedCount and falls back joined=false on garbage", () => {
    const r = normalizeEventJoinResult({ joinedCount: -5 });
    expect(r.eventId).toBe("");
    expect(r.joinedCount).toBe(0);
    expect(r.joined).toBe(false);
  });
});

describe("Phase 4: post detail wires the event extension", () => {
  it("normalizePostDetail surfaces event + eventJoined when present", () => {
    const detail = normalizePostDetail(
      {
        tid: 42,
        title: "Trail run",
        event: {
          eventId: "evt-1",
          startsAt: "2026-06-01T10:00:00Z",
          endsAt: "2026-06-01T12:00:00Z",
          location: "图书馆门口",
          capacity: 20,
          rewardSummary: "",
          joinedCount: 1,
        },
        eventJoined: true,
      },
      42,
    );
    expect(detail.event?.eventId).toBe("evt-1");
    expect(detail.event?.joinedCount).toBe(1);
    expect(detail.event?.location).toBe("图书馆门口");
    expect(detail.eventJoined).toBe(true);
  });

  it("normalizePostDetail leaves event undefined for non-event posts", () => {
    const detail = normalizePostDetail({ tid: 1, title: "Just text" }, 1);
    expect(detail.event).toBeUndefined();
    expect(detail.eventJoined).toBeUndefined();
  });
});

describe("Phase 4: composable + view wiring", () => {
  const composable = readRepoFile("../../src/composables/useEventActions.ts");
  const view = readRepoFile("../../src/features/detail/PostDetailEventBlock.vue");
  const panel = readRepoFile("../../src/features/detail/PostDetailPanel.vue");

  it("useEventActions delegates the rule decision to planEventAction", () => {
    expect(composable).toMatch(/planEventAction/);
    // Composable must not reinvent rules — no embedded status checks.
    expect(composable).not.toMatch(/joinedCount\s*>=\s*[A-Za-z0-9_.]*capacity/);
  });

  it("useEventActions merges join response (does not replace the event block)", () => {
    // Guard against regressing back to `options.onChange({ event: next, ... })`
    // where `next` was the join response — that would drop time/location/etc.
    expect(composable).toMatch(/\.\.\.event/);
    expect(composable).toMatch(/joinedCount:\s*result\.joinedCount/);
  });

  it("useEventActions falls back to brand string on action failure (soft-fail)", () => {
    expect(composable).toMatch(/EVENT_ACTION_UNAVAILABLE/);
    expect(composable).not.toMatch(/活动操作暂时不可用/);
  });

  it("PostDetailEventBlock sources every label from brand constants", () => {
    expect(view).toMatch(/EVENT_BLOCK_LABEL/);
    expect(view).toMatch(/EVENT_JOIN/);
    expect(view).toMatch(/EVENT_CANCEL_JOIN/);
    expect(view).toMatch(/EVENT_DISABLED_NOT_OPEN/);
    expect(view).toMatch(/EVENT_DISABLED_FULL/);
    expect(view).toMatch(/EVENT_DISABLED_OUT_OF_SCOPE/);
    expect(view).not.toMatch(/活动信息/);
    expect(view).not.toMatch(/'报名'/);
  });

  it("PostDetailEventBlock derives status from time + capacity (no eventStatus field on wire)", () => {
    expect(view).toMatch(/derivedEventStatus/);
    expect(view).not.toMatch(/event\.eventStatus/);
  });

  it("PostDetailPanel wires useEventActions through usePostDetailExtensions", () => {
    const extensions = readRepoFile("../../src/composables/usePostDetailExtensions.ts");
    expect(panel).toMatch(/usePostDetailExtensions/);
    expect(panel).toMatch(/handleEventAct/);
    expect(extensions).toMatch(/useEventActions/);
    expect(extensions).toMatch(/EVENT_JOIN_SUCCESS/);
    expect(extensions).toMatch(/EVENT_CANCEL_SUCCESS/);
  });
});
