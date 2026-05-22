import { describe, expect, it } from "vitest";

import {
  normalizeNotificationItem,
  normalizeNotificationResponse,
} from "../../src/api/notifications";
import {
  NOTIF_EVENT_COMPLETED_BODY,
  NOTIF_EVENT_COMPLETED_TITLE,
  NOTIF_EVENT_EXPIRED_BODY,
  NOTIF_EVENT_EXPIRED_TITLE,
  NOTIF_EVENT_REWARD_SETTLED_TITLE,
  NOTIF_EVENT_TITLE_FALLBACK,
} from "../../src/config/brand/notification";

/**
 * QA #739 — F3 (#706 / merged at 5cb54c0) regression-cliff pin for the three
 * event-lifecycle notification types that B2 (lian-platform-server#445) ships
 * onto `/api/messages`:
 *
 *   - "event-completed"
 *   - "event-reward-settled"
 *   - "event-expired"
 *
 * Goal: lock the F3 dispatcher (`EVENT_TYPE_TO_KIND` + `buildEventNotificationCopy`)
 * against silent regressions. Sibling file `notification-routing.test.ts` covers
 * the happy paths F3's own PR shipped; this file targets the 6 case classes
 * called out by the issue spec — round-trip, missing-required, unknown
 * transition, settlement-only, idempotency-key shape, numeric robustness.
 *
 * IMPORTANT — what "round-trip" actually means for F3:
 *   F3's `NotificationItem` output type has NO `data` field (see
 *   `src/types/messages.ts`). The wire-shape `data.{transition,targetType,
 *   eventId,hostPostTid,settlementId,perJoiner,points}` are PROJECTED into
 *   `kind` / `target.tid` / `excerpt` rather than carried through verbatim.
 *   So "round-trip" here means: every field the renderer needs survives the
 *   projection, with no field invented from thin air. Anything F3 does not
 *   project is documented in the PR body's "Findings" section, not asserted.
 *
 * Drop vs. fallback:
 *   F3 NEVER drops items. `normalizeNotificationItem` always returns a
 *   `NotificationItem` — missing required fields manifest as undefined props
 *   or `target.kind === "none"`. We pin that policy here.
 */

const EVENT_ACTOR = { displayName: "活动小助手" } as const;

function completedWire(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-evt-1-uid-7-completed",
    type: "event-completed",
    tid: 156,
    title: "周末桌游夜 活动已结束",
    data: {
      eventId: "evt-1",
      eventTitle: "周末桌游夜",
      hostPostTid: 156,
      transition: "completed",
      targetType: "event",
    },
    actor: EVENT_ACTOR,
    timestampISO: "2026-05-21T08:00:00Z",
    read: false,
    ...overrides,
  };
}

function settledWire(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-evt-1-uid-7-settlement-s-1",
    type: "event-reward-settled",
    tid: 156,
    title: "周末桌游夜 活动奖励已发放",
    data: {
      eventId: "evt-1",
      eventTitle: "周末桌游夜",
      hostPostTid: 156,
      transition: "reward_settled",
      targetType: "event",
      settlementId: "s-1",
      perJoiner: 50,
      joinerCount: 3,
      totalPaid: 150,
      currency: "积分",
    },
    actor: EVENT_ACTOR,
    timestampISO: "2026-05-21T08:05:00Z",
    read: false,
    ...overrides,
  };
}

function expiredWire(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-evt-2-uid-7-expired",
    type: "event-expired",
    tid: 200,
    title: "过期活动 活动已过期",
    data: {
      eventId: "evt-2",
      eventTitle: "过期活动",
      hostPostTid: 200,
      transition: "expired",
      targetType: "event",
    },
    actor: EVENT_ACTOR,
    timestampISO: "2026-05-21T09:00:00Z",
    read: false,
    ...overrides,
  };
}

describe("event-notifications-normalizer / case 1 — round-trip happy path", () => {
  it("event-completed projects all renderer-needed fields and preserves id/actor/read/timestampISO", () => {
    const wire = completedWire();
    const item = normalizeNotificationItem(wire);

    expect(item.kind).toBe("event-completed");
    expect(item.id).toBe(wire.id);
    expect(item.tid).toBe(156);
    expect(item.title).toBe(NOTIF_EVENT_COMPLETED_TITLE);
    expect(item.excerpt).toBe(NOTIF_EVENT_COMPLETED_BODY.replace("{title}", "周末桌游夜"));
    expect(item.target).toEqual({ kind: "detail", tid: 156 });
    expect(item.actionLabel).toBe("查看详情");
    expect(item.actor?.displayName).toBe("活动小助手");
    expect(item.read).toBe(false);
    expect(item.timestampISO).toBe("2026-05-21T08:00:00Z");
    // raw.type is propagated to NotificationItem.type even though kind owns
    // the renderer dispatch — used downstream by analytics breadcrumbs.
    expect(item.type).toBe("event-completed");
  });

  it("event-reward-settled projects perJoiner / totalPaid / currency into excerpt and routes to detail", () => {
    const wire = settledWire();
    const item = normalizeNotificationItem(wire);

    expect(item.kind).toBe("event-reward-settled");
    expect(item.id).toBe(wire.id);
    expect(item.tid).toBe(156);
    expect(item.title).toBe(NOTIF_EVENT_REWARD_SETTLED_TITLE);
    // The renderer template substitutes title/perJoiner/currency/totalPaid.
    // We assert each substitution rather than the full string so a brand-copy
    // tweak doesn't false-fail.
    expect(item.excerpt).toContain("周末桌游夜");
    expect(item.excerpt).toContain("50");
    expect(item.excerpt).toContain("150");
    expect(item.excerpt).toContain("积分");
    expect(item.target).toEqual({ kind: "detail", tid: 156 });
  });

  it("event-expired projects event title into the expired body and routes to detail", () => {
    const wire = expiredWire();
    const item = normalizeNotificationItem(wire);

    expect(item.kind).toBe("event-expired");
    expect(item.id).toBe(wire.id);
    expect(item.tid).toBe(200);
    expect(item.title).toBe(NOTIF_EVENT_EXPIRED_TITLE);
    expect(item.excerpt).toBe(NOTIF_EVENT_EXPIRED_BODY.replace("{title}", "过期活动"));
    expect(item.target).toEqual({ kind: "detail", tid: 200 });
  });
});

describe("event-notifications-normalizer / case 2 — missing required fields (drop vs fallback)", () => {
  // F3 chose "always emit, never drop" — verified against
  // `normalizeNotificationItem` in src/api/notifications.ts (no early return path).
  // Each missing-field test pins the specific fallback so a regression where
  // F3 starts dropping (or starts inventing a value) goes red.

  it("missing actor.displayName: emits item with actor preserved verbatim (undefined or empty)", () => {
    const item = normalizeNotificationItem(completedWire({ actor: undefined }));
    expect(item.kind).toBe("event-completed");
    expect(item.title).toBe(NOTIF_EVENT_COMPLETED_TITLE);
    expect(item.actor).toBeUndefined();
    // Critical: item is NOT dropped. The mixed-inbox response renderer relies
    // on this so a malformed actor never blacks out adjacent notifications.
    expect(item.target).toEqual({ kind: "detail", tid: 156 });
  });

  it("missing data.targetType: kind dispatch still works (kind comes from raw.type, not data.targetType)", () => {
    const wire = completedWire();
    delete (wire.data as Record<string, unknown>).targetType;
    const item = normalizeNotificationItem(wire);

    expect(item.kind).toBe("event-completed");
    expect(item.title).toBe(NOTIF_EVENT_COMPLETED_TITLE);
    expect(item.target).toEqual({ kind: "detail", tid: 156 });
  });

  it("missing data.transition: kind dispatch unaffected (transition is wire metadata, not used by F3 routing)", () => {
    const wire = completedWire();
    delete (wire.data as Record<string, unknown>).transition;
    const item = normalizeNotificationItem(wire);

    // F3 routes purely on raw.type via EVENT_TYPE_TO_KIND, so missing
    // data.transition does NOT downgrade the kind. If a future change starts
    // using data.transition for dispatch, this assertion goes red and forces
    // a deliberate decision.
    expect(item.kind).toBe("event-completed");
    expect(item.title).toBe(NOTIF_EVENT_COMPLETED_TITLE);
  });

  it("missing id: emits item with id falling back to raw.targetId / tid / title (in that order)", () => {
    const wire = completedWire();
    delete (wire as Record<string, unknown>).id;
    const item = normalizeNotificationItem(wire);

    // F3 fallback chain: raw.id || raw.targetId || tid || title.
    // With nothing else set, we get tid(156).
    expect(item.kind).toBe("event-completed");
    expect(item.id).toBe(156);
  });

  it("missing tid: emits item with target.kind='none' and a fallbackText reason", () => {
    const wire = completedWire();
    delete (wire as Record<string, unknown>).tid;
    delete (wire.data as Record<string, unknown>).hostPostTid;
    const item = normalizeNotificationItem(wire);

    expect(item.kind).toBe("event-completed");
    expect(item.title).toBe(NOTIF_EVENT_COMPLETED_TITLE);
    expect(item.target.kind).toBe("none");
    if (item.target.kind === "none") {
      expect(item.target.reason).toBeTruthy();
    }
    // fallbackText mirrors target.reason when target.kind === "none" — pin
    // both so a renderer that drops one stays loud.
    expect(item.fallbackText).toBeTruthy();
    expect(item.fallbackText).toBe(item.target.kind === "none" ? item.target.reason : undefined);
  });

  it("missing tid AND missing data.hostPostTid does NOT cause an exception", () => {
    expect(() =>
      normalizeNotificationItem({
        type: "event-completed",
        data: { eventId: "evt-1", transition: "completed", targetType: "event" },
      }),
    ).not.toThrow();
  });
});

describe("event-notifications-normalizer / case 3 — unknown transition", () => {
  it("data.transition === 'garbage' (with valid raw.type) does not throw and stays in event-completed", () => {
    // F3 dispatches on raw.type only, so a garbage data.transition leaves kind
    // alone. We pin that so a future "trust data.transition over raw.type"
    // refactor surfaces here instead of in production.
    const item = normalizeNotificationItem(
      completedWire({
        data: {
          eventId: "evt-1",
          eventTitle: "周末桌游夜",
          hostPostTid: 156,
          transition: "garbage",
          targetType: "event",
        },
      }),
    );

    expect(item.kind).toBe("event-completed");
    expect(item.title).toBe(NOTIF_EVENT_COMPLETED_TITLE);
  });

  it("garbage raw.type that does not match any event slug falls back to a non-event kind without crashing", () => {
    const item = normalizeNotificationItem({
      id: "garbage-1",
      type: "event-cancelled",
      tid: 42,
      title: "未来类型",
      data: {
        eventId: "evt-x",
        hostPostTid: 42,
        transition: "cancelled",
        targetType: "event",
      },
    });

    expect(item.kind).not.toBe("event-completed");
    expect(item.kind).not.toBe("event-reward-settled");
    expect(item.kind).not.toBe("event-expired");
    // F3 must still emit a renderable item rather than throw or drop.
    expect(item.id).toBe("garbage-1");
  });
});

describe("event-notifications-normalizer / case 4 — settlement-only fields", () => {
  it("event-reward-settled with perJoiner renders the perJoiner number into the excerpt", () => {
    const item = normalizeNotificationItem(settledWire());
    expect(item.excerpt).toContain("50");
    expect(item.excerpt).toContain("150");
    expect(item.excerpt).toContain("积分");
  });

  it("event-reward-settled falls back to legacy `points` when perJoiner is absent", () => {
    // B2 wire ships `points`; F3 also tolerates `perJoiner` from a future
    // server. firstNumber(data.perJoiner, data.points) means `points` is read
    // when perJoiner is missing.
    const item = normalizeNotificationItem({
      type: "event-reward-settled",
      tid: 156,
      data: {
        eventId: "evt-1",
        hostPostTid: 156,
        transition: "reward_settled",
        targetType: "event",
        settlementId: "s-1",
        points: 25,
      },
    });

    expect(item.kind).toBe("event-reward-settled");
    expect(item.excerpt).toContain("25");
  });

  it("event-completed without settlementId / perJoiner / points emits no warnings and renders the completed body", () => {
    const item = normalizeNotificationItem(completedWire());

    expect(item.kind).toBe("event-completed");
    // The completed body template is `「{title}」的活动已结束。` — it does NOT
    // reference perJoiner/totalPaid/currency, so settlement-only field absence
    // here is legal and must not corrupt the excerpt.
    expect(item.excerpt).toBe("「周末桌游夜」的活动已结束。");
    expect(item.excerpt).not.toContain("undefined");
    expect(item.excerpt).not.toContain("null");
    expect(item.excerpt).not.toContain("NaN");
  });

  it("event-reward-settled with NEITHER perJoiner NOR points renders 0 rather than NaN/undefined", () => {
    // Pin firstNumber(...) ?? 0 contract so a future refactor that drops the
    // `?? 0` doesn't silently leak `NaN` into the excerpt.
    const item = normalizeNotificationItem({
      type: "event-reward-settled",
      tid: 156,
      data: {
        eventId: "evt-1",
        eventTitle: "活动",
        hostPostTid: 156,
        transition: "reward_settled",
        targetType: "event",
        settlementId: "s-1",
      },
    });

    expect(item.kind).toBe("event-reward-settled");
    expect(item.excerpt).toContain("0");
    expect(item.excerpt).not.toContain("NaN");
    expect(item.excerpt).not.toContain("undefined");
  });
});

describe("event-notifications-normalizer / case 5 — idempotency-key shape", () => {
  // F3 does NOT parse the id string. NotificationItem.id is preserved
  // verbatim from raw.id (see normalizeNotificationItem in src/api/notifications.ts).
  // The wire format `evt-<eventId>-<uid>-<arm>[-<settlementId>]` is therefore
  // an opaque idempotency key as far as the frontend renderer is concerned —
  // we pin that opacity here so a parser added later has to update this test.

  it("evt-<eventId>-<uid>-completed id is preserved verbatim and item still routes correctly", () => {
    const id = "evt-evt-99-uid-42-completed";
    const item = normalizeNotificationItem(
      completedWire({
        id,
        data: {
          eventId: "evt-99",
          eventTitle: "活动",
          hostPostTid: 156,
          transition: "completed",
          targetType: "event",
        },
      }),
    );
    expect(item.id).toBe(id);
    expect(item.kind).toBe("event-completed");
  });

  it("evt-<eventId>-<uid>-settlement-<settlementId> id is preserved verbatim", () => {
    const id = "evt-evt-99-uid-42-settlement-s-7";
    const item = normalizeNotificationItem(settledWire({ id }));
    expect(item.id).toBe(id);
    expect(item.kind).toBe("event-reward-settled");
  });

  it("evt-<eventId>-<uid>-expired id is preserved verbatim", () => {
    const id = "evt-evt-99-uid-42-expired";
    const item = normalizeNotificationItem(expiredWire({ id }));
    expect(item.id).toBe(id);
    expect(item.kind).toBe("event-expired");
  });

  it("when id eventId disagrees with data.eventId, F3 trusts the wire id verbatim and uses data.* for body copy", () => {
    // Concrete decision pin: id field is opaque, body copy comes from data.
    // Disagreement is allowed; renderer is not the layer that resolves it.
    // See "Findings" in the PR body for whether the backend should reject
    // this on the way in.
    const item = normalizeNotificationItem(
      completedWire({
        id: "evt-MISMATCH-uid-7-completed",
        data: {
          eventId: "evt-1",
          eventTitle: "周末桌游夜",
          hostPostTid: 156,
          transition: "completed",
          targetType: "event",
        },
      }),
    );

    expect(item.id).toBe("evt-MISMATCH-uid-7-completed");
    expect(item.excerpt).toContain("周末桌游夜");
  });
});

describe("event-notifications-normalizer / case 6 — numeric robustness", () => {
  // Mirror F2 #715's "decide and pin" stance: F3 normalizes both tid and
  // data.points through firstNumber(), so string and number inputs converge
  // on the same numeric output. We pin that convergence here.

  it("tid as string '156' normalizes to numeric 156 on output and routes to detail", () => {
    const item = normalizeNotificationItem(completedWire({ tid: "156" }));
    expect(item.tid).toBe(156);
    expect(typeof item.tid).toBe("number");
    expect(item.target).toEqual({ kind: "detail", tid: 156 });
  });

  it("tid as numeric 156 stays numeric 156", () => {
    const item = normalizeNotificationItem(completedWire({ tid: 156 }));
    expect(item.tid).toBe(156);
    expect(typeof item.tid).toBe("number");
  });

  it("data.points as string '25' renders as 25 in excerpt", () => {
    // The body template substitutes {perJoiner}; firstNumber coerces "25" → 25
    // before the template runs, so the excerpt contains "25" not "\"25\"".
    const item = normalizeNotificationItem({
      type: "event-reward-settled",
      tid: 156,
      data: {
        eventId: "evt-1",
        hostPostTid: 156,
        transition: "reward_settled",
        targetType: "event",
        settlementId: "s-1",
        points: "25",
      },
    });

    expect(item.kind).toBe("event-reward-settled");
    expect(item.excerpt).toContain("25");
    expect(item.excerpt).not.toContain('"25"');
  });

  it("data.points as numeric 25 stays numeric in excerpt", () => {
    const item = normalizeNotificationItem({
      type: "event-reward-settled",
      tid: 156,
      data: {
        eventId: "evt-1",
        hostPostTid: 156,
        transition: "reward_settled",
        targetType: "event",
        settlementId: "s-1",
        points: 25,
      },
    });
    expect(item.excerpt).toContain("25");
  });

  it("data.perJoiner '50' (string) wins over data.points 999 (number) — firstNumber order pin", () => {
    // F3: firstNumber(data?.perJoiner, data?.points). String "50" still parses
    // to numeric 50 and takes precedence over `points`. If firstNumber is ever
    // re-ordered or if the perJoiner-string branch is dropped, this goes red.
    const item = normalizeNotificationItem({
      type: "event-reward-settled",
      tid: 156,
      data: {
        eventId: "evt-1",
        eventTitle: "活动",
        hostPostTid: 156,
        transition: "reward_settled",
        targetType: "event",
        settlementId: "s-1",
        perJoiner: "50",
        points: 999,
      },
    });
    expect(item.excerpt).toContain("50");
    expect(item.excerpt).not.toContain("999");
  });
});

describe("event-notifications-normalizer / cross-case — mixed inbox stays sorted by source order", () => {
  it("normalizeNotificationResponse keeps event items in the order they arrive, alongside legacy types", () => {
    const response = normalizeNotificationResponse({
      items: [
        completedWire(),
        settledWire(),
        expiredWire(),
        { id: "v-1", type: "verification-approved", title: "校园认证已通过" },
        { id: "r-1", type: "reply", tid: 88, title: "有人回复了你的帖子" },
      ],
    });

    const kinds = (response.items || []).map((it) => it.kind);
    expect(kinds).toEqual([
      "event-completed",
      "event-reward-settled",
      "event-expired",
      "verification",
      "reply",
    ]);
  });

  it("event title fallback applies when no structured eventTitle is present anywhere", () => {
    const item = normalizeNotificationItem({
      type: "event-completed",
      tid: 156,
      data: {
        eventId: "evt-1",
        hostPostTid: 156,
        transition: "completed",
        targetType: "event",
      },
    });

    expect(item.excerpt).toContain(NOTIF_EVENT_TITLE_FALLBACK);
    expect(item.excerpt).not.toContain("undefined");
  });
});
