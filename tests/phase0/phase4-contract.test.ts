import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { planEventAction } from "../../src/domain/eventActionPolicy";
import { normalizeEventExtension } from "../../src/platform/api-normalizers";
import { normalizePostDetail } from "../../src/api/posts";
import { DEFAULT_AUDIENCE, type Audience } from "../../src/types/audience";
import type { EventPostExtension } from "../../src/types/post-extensions";

function readRepoFile(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

function makeEvent(overrides: Partial<EventPostExtension> = {}): EventPostExtension {
  return {
    eventId: "evt-1",
    participantScope: { ...DEFAULT_AUDIENCE },
    allowedOrganizations: [],
    eventStatus: "open",
    participantCount: 0,
    joinPolicy: "open",
    ...overrides,
  };
}

const allow = (_scope: Audience) => true;
const deny = (_scope: Audience) => false;

describe("Phase 4: planEventAction (domain/eventActionPolicy)", () => {
  it("authenticated viewer with capacity left and matching scope can join", () => {
    const plan = planEventAction({
      event: makeEvent({ capacity: 10, participantCount: 3 }),
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
      event: makeEvent({ participantCount: 1 }),
      isAuthenticated: true,
      hasJoined: true,
      isEligibleForScope: allow,
    });
    expect(plan.mode).toBe("cancel");
    expect(plan.enabled).toBe(true);
  });

  it("non-open status disables join even when eligible and authenticated", () => {
    const plan = planEventAction({
      event: makeEvent({ eventStatus: "full" }),
      isAuthenticated: true,
      hasJoined: false,
      isEligibleForScope: allow,
    });
    expect(plan.mode).toBe("disabled");
    expect(plan.reasonKey).toBe("notOpen");
  });

  it("capacity reached disables join with `full` reason", () => {
    const plan = planEventAction({
      event: makeEvent({ capacity: 5, participantCount: 5 }),
      isAuthenticated: true,
      hasJoined: false,
      isEligibleForScope: allow,
    });
    expect(plan.mode).toBe("disabled");
    expect(plan.reasonKey).toBe("full");
  });

  it("ineligible scope disables join with `outOfScope` reason", () => {
    const plan = planEventAction({
      event: makeEvent({ capacity: 10, participantCount: 0 }),
      isAuthenticated: true,
      hasJoined: false,
      isEligibleForScope: deny,
    });
    expect(plan.mode).toBe("disabled");
    expect(plan.reasonKey).toBe("outOfScope");
  });

  it("terminal status (completed/cancelled/closed) disables both modes", () => {
    for (const status of ["completed", "cancelled", "closed"] as const) {
      const plan = planEventAction({
        event: makeEvent({ eventStatus: status }),
        isAuthenticated: true,
        hasJoined: false,
        isEligibleForScope: allow,
      });
      expect(plan.mode).toBe("disabled");
      expect(plan.reasonKey).toBe("alreadyEnded");
    }
  });

  it("capacity 0 means unlimited (no cap), not full", () => {
    const plan = planEventAction({
      event: makeEvent({ capacity: 0, participantCount: 999 }),
      isAuthenticated: true,
      hasJoined: false,
      isEligibleForScope: allow,
    });
    expect(plan.mode).toBe("join");
    expect(plan.enabled).toBe(true);
  });
});

describe("Phase 4: normalizeEventExtension (platform/api-normalizers)", () => {
  it("returns undefined when eventId is missing", () => {
    expect(normalizeEventExtension({ eventStatus: "open" })).toBeUndefined();
  });

  it("returns undefined when eventStatus is unknown", () => {
    expect(normalizeEventExtension({ eventId: "x", eventStatus: "wat" })).toBeUndefined();
  });

  it("normalizes a well-formed payload", () => {
    const ext = normalizeEventExtension({
      eventId: "evt-1",
      eventStatus: "open",
      joinPolicy: "approval_required",
      participantCount: 4,
      capacity: 10,
      participantScope: { visibility: "school", schoolIds: ["s1"] },
      allowedOrganizations: ["org-a"],
      reward: { type: "honor", amount: 5, label: "荣誉" },
      startAt: "2026-06-01T10:00:00Z",
      endAt: "2026-06-01T12:00:00Z",
    });
    expect(ext?.eventId).toBe("evt-1");
    expect(ext?.eventStatus).toBe("open");
    expect(ext?.joinPolicy).toBe("approval_required");
    expect(ext?.participantCount).toBe(4);
    expect(ext?.capacity).toBe(10);
    expect(ext?.participantScope.visibility).toBe("school");
    expect(ext?.participantScope.schoolIds).toEqual(["s1"]);
    expect(ext?.allowedOrganizations).toEqual(["org-a"]);
    expect(ext?.reward?.type).toBe("honor");
    expect(ext?.reward?.amount).toBe(5);
    expect(ext?.startAt).toBe("2026-06-01T10:00:00Z");
  });

  it("clamps participantCount to >= 0 and falls back joinPolicy → open", () => {
    const ext = normalizeEventExtension({
      eventId: "x",
      eventStatus: "open",
      participantCount: -3,
      joinPolicy: "made_up",
    });
    expect(ext?.participantCount).toBe(0);
    expect(ext?.joinPolicy).toBe("open");
  });

  it("drops malformed reward and unknown participant scope visibility", () => {
    const ext = normalizeEventExtension({
      eventId: "x",
      eventStatus: "open",
      reward: { type: "pizza" },
      participantScope: { visibility: "private-cult" },
    });
    expect(ext?.reward).toBeUndefined();
    expect(ext?.participantScope.visibility).toBe("public");
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
          eventStatus: "open",
          participantCount: 1,
          capacity: 20,
          participantScope: { visibility: "campus" },
          joinPolicy: "open",
        },
        eventJoined: true,
      },
      42,
    );
    expect(detail.event?.eventId).toBe("evt-1");
    expect(detail.event?.eventStatus).toBe("open");
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
    // The composable must not reinvent the rules — no embedded status checks.
    expect(composable).not.toMatch(/eventStatus\s*===\s*['"]open/);
    expect(composable).not.toMatch(/participantCount\s*>=\s*[A-Za-z0-9_.]*capacity/);
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

  it("PostDetailPanel wires useEventActions through to the content slot", () => {
    expect(panel).toMatch(/useEventActions/);
    expect(panel).toMatch(/EVENT_JOIN_SUCCESS/);
    expect(panel).toMatch(/EVENT_CANCEL_SUCCESS/);
    expect(panel).toMatch(/handleEventAct/);
  });
});
