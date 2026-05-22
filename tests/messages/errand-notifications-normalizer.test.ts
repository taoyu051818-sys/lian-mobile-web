import { describe, expect, it } from "vitest";

import { normalizeNotificationItem, normalizeNotificationResponse } from "../../src/api/messages";
import {
  NOTIF_ERRAND_ORDER_ACCEPTED_BODY,
  NOTIF_ERRAND_ORDER_ACCEPTED_TITLE,
  NOTIF_ERRAND_ORDER_CANCELLED_BODY,
  NOTIF_ERRAND_ORDER_CANCELLED_TITLE,
  NOTIF_ERRAND_ORDER_COMPLETED_BODY,
  NOTIF_ERRAND_ORDER_COMPLETED_TITLE,
  NOTIF_ERRAND_ORDER_DELIVERED_BODY,
  NOTIF_ERRAND_ORDER_DELIVERED_TITLE,
  NOTIF_ERRAND_ORDER_DELIVERING_BODY,
  NOTIF_ERRAND_ORDER_DELIVERING_TITLE,
  NOTIF_ERRAND_ORDER_PICKED_UP_BODY,
  NOTIF_ERRAND_ORDER_PICKED_UP_TITLE,
  NOTIF_ERRAND_ORDER_REFUNDED_BODY,
  NOTIF_ERRAND_ORDER_REFUNDED_TITLE,
  NOTIF_ERRAND_ORDER_TITLE_FALLBACK,
} from "../../src/config/brand/notification";

/**
 * Errand-order normalizer cliff — sibling of `event-notifications-normalizer.test.ts`.
 * Pins the seven `errand-order-*` wire types ps#477 / ps#495 fan out onto
 * `/api/messages` against silent regressions in the F3 dispatcher
 * (`ERRAND_ORDER_TYPE_TO_STATUS` + `buildErrandNotificationCopy`).
 *
 * Wire envelope (per ps#477):
 *   { id, type: "errand-order-<status>",  // kebab-case on the wire
 *     tid, title, excerpt, actor:{id,name},
 *     read, timestampISO, data, idempotencyKey }
 *   data: { status, previousStatus, orderId, merchantPostId,
 *           triggeredBy, targetType }
 *   status enum (snake_case): accepted | picked_up | delivering |
 *                             delivered | completed | cancelled | refunded
 *   idempotencyKey: errand-{orderId}-{status}-{recipientUid}-{triggeredAtISO}
 *
 * Round-trip semantics:
 *   F3's NotificationItem has NO `data` field — wire `data.*` is projected
 *   into kind / target / fallback copy rather than carried verbatim.
 *   Every renderer-needed field must survive the projection; nothing is
 *   invented. F3 NEVER drops items.
 */

const ERRAND_ACTOR = { id: "system", name: "LIAN", displayName: "LIAN" } as const;

function acceptedWire(overrides: Record<string, unknown> = {}) {
  return {
    id: "errand-order-1-accepted-uid-7-2026-05-22T08:00:00Z",
    type: "errand-order-accepted",
    title: "跑腿订单已被接单",
    excerpt: "「奶茶代购」已被跑腿员接单，请保持联系。",
    data: {
      status: "accepted",
      previousStatus: "paid_locked",
      orderId: "order-1",
      merchantPostId: "42",
      triggeredBy: "uid-runner-9",
      targetType: "errand-order",
      orderTitle: "奶茶代购",
    },
    actor: ERRAND_ACTOR,
    timestampISO: "2026-05-22T08:00:00Z",
    read: false,
    idempotencyKey: "errand-order-1-accepted-uid-7-2026-05-22T08:00:00Z",
    ...overrides,
  };
}

function completedWire(overrides: Record<string, unknown> = {}) {
  return {
    id: "errand-order-77-completed-runner-99-2026-05-22T08:30:00Z",
    type: "errand-order-completed",
    title: "跑腿订单已完成结算",
    excerpt: "「奶茶代购」订单已完成，报酬已入账。",
    data: {
      status: "completed",
      previousStatus: "delivered",
      orderId: "order-77",
      merchantPostId: "150",
      triggeredBy: "uid-requester-3",
      targetType: "errand-order",
      orderTitle: "奶茶代购",
    },
    actor: ERRAND_ACTOR,
    timestampISO: "2026-05-22T08:30:00Z",
    read: false,
    idempotencyKey: "errand-order-77-completed-runner-99-2026-05-22T08:30:00Z",
    ...overrides,
  };
}

describe("errand-notifications-normalizer / case 1 — round-trip happy path", () => {
  it("errand-order-accepted projects renderer fields and preserves id/actor/read/timestampISO", () => {
    const wire = acceptedWire();
    const item = normalizeNotificationItem(wire);

    expect(item.kind).toBe("order");
    expect(item.id).toBe(wire.id);
    expect(item.title).toBe("跑腿订单已被接单");
    expect(item.excerpt).toBe("「奶茶代购」已被跑腿员接单，请保持联系。");
    expect(item.actor?.displayName).toBe("LIAN");
    expect(item.read).toBe(false);
    expect(item.timestampISO).toBe("2026-05-22T08:00:00Z");
    // raw.type propagates verbatim — analytics/breadcrumbs depend on the slug.
    expect(item.type).toBe("errand-order-accepted");
    expect(item.target).toEqual({ kind: "errand-order", orderId: "order-1" });
    expect(item.actionLabel).toBe("查看订单详情");
  });

  it("errand-order-completed (ps#495) round-trip — recipient = runner, body mentions settlement", () => {
    const wire = completedWire();
    const item = normalizeNotificationItem(wire);

    expect(item.kind).toBe("order");
    expect(item.id).toBe(wire.id);
    expect(item.type).toBe("errand-order-completed");
    expect(item.title).toBe("跑腿订单已完成结算");
    expect(item.excerpt).toBe("「奶茶代购」订单已完成，报酬已入账。");
    expect(item.target).toEqual({ kind: "errand-order", orderId: "order-77" });
  });
});

describe("errand-notifications-normalizer / case 2 — fallback copy when envelope is sparse", () => {
  // F3 trusts backend title/excerpt when present, but synthesises locked
  // copy from the status enum when the envelope ships them empty. Pin the
  // seven status → fallback pairs so a brand-string drift goes red.

  const fallbackCases: Array<[string, string, string, string, string]> = [
    [
      "errand-order-accepted",
      "accepted",
      NOTIF_ERRAND_ORDER_ACCEPTED_TITLE,
      NOTIF_ERRAND_ORDER_ACCEPTED_BODY.replace("{title}", "奶茶代购"),
      "order-stripped",
    ],
    [
      "errand-order-picked-up",
      "picked_up",
      NOTIF_ERRAND_ORDER_PICKED_UP_TITLE,
      NOTIF_ERRAND_ORDER_PICKED_UP_BODY.replace("{title}", "奶茶代购"),
      "order-stripped",
    ],
    [
      "errand-order-delivering",
      "delivering",
      NOTIF_ERRAND_ORDER_DELIVERING_TITLE,
      NOTIF_ERRAND_ORDER_DELIVERING_BODY.replace("{title}", "奶茶代购"),
      "order-stripped",
    ],
    [
      "errand-order-delivered",
      "delivered",
      NOTIF_ERRAND_ORDER_DELIVERED_TITLE,
      NOTIF_ERRAND_ORDER_DELIVERED_BODY.replace("{title}", "奶茶代购"),
      "order-stripped",
    ],
    [
      "errand-order-completed",
      "completed",
      NOTIF_ERRAND_ORDER_COMPLETED_TITLE,
      NOTIF_ERRAND_ORDER_COMPLETED_BODY.replace("{title}", "奶茶代购"),
      "order-stripped",
    ],
    [
      "errand-order-cancelled",
      "cancelled",
      NOTIF_ERRAND_ORDER_CANCELLED_TITLE,
      NOTIF_ERRAND_ORDER_CANCELLED_BODY.replace("{title}", "奶茶代购"),
      "order-stripped",
    ],
    [
      "errand-order-refunded",
      "refunded",
      NOTIF_ERRAND_ORDER_REFUNDED_TITLE,
      NOTIF_ERRAND_ORDER_REFUNDED_BODY.replace("{title}", "奶茶代购"),
      "order-stripped",
    ],
  ];

  it.each(fallbackCases)(
    "%s — server omits title+excerpt → frontend synthesises locked copy",
    (type, status, expectedTitle, expectedBody, orderId) => {
      const item = normalizeNotificationItem({
        id: `${type}-stripped`,
        type,
        data: {
          status,
          previousStatus: "",
          orderId,
          merchantPostId: "1",
          triggeredBy: "uid-x",
          targetType: "errand-order",
          orderTitle: "奶茶代购",
        },
        actor: ERRAND_ACTOR,
        timestampISO: "2026-05-22T08:00:00Z",
        read: false,
      });

      expect(item.kind).toBe("order");
      expect(item.title).toBe(expectedTitle);
      expect(item.excerpt).toBe(expectedBody);
      expect(item.target).toEqual({ kind: "errand-order", orderId });
    },
  );

  it("missing data.orderTitle falls back to a placeholder (no `「」` blanks)", () => {
    const item = normalizeNotificationItem({
      type: "errand-order-completed",
      data: {
        status: "completed",
        orderId: "order-x",
        targetType: "errand-order",
      },
      actor: ERRAND_ACTOR,
    });

    expect(item.kind).toBe("order");
    expect(item.title).toBe(NOTIF_ERRAND_ORDER_COMPLETED_TITLE);
    expect(item.excerpt).toContain(NOTIF_ERRAND_ORDER_TITLE_FALLBACK);
    expect(item.excerpt).not.toContain("「」");
    expect(item.excerpt).not.toContain("undefined");
    expect(item.excerpt).not.toContain("null");
    expect(item.target).toEqual({ kind: "errand-order", orderId: "order-x" });
  });

  it("backend-supplied title+excerpt wins over fallback synthesis", () => {
    // Source-of-truth contract — when the backend ships copy, F3 does not
    // overwrite it. Pin so a future "always synthesise" refactor goes red.
    const item = normalizeNotificationItem({
      type: "errand-order-completed",
      title: "服务端定制标题",
      excerpt: "服务端定制正文。",
      data: {
        status: "completed",
        orderId: "order-9",
        orderTitle: "奶茶代购",
        targetType: "errand-order",
      },
    });

    expect(item.kind).toBe("order");
    expect(item.title).toBe("服务端定制标题");
    expect(item.excerpt).toBe("服务端定制正文。");
    expect(item.target).toEqual({ kind: "errand-order", orderId: "order-9" });
  });
});

describe("errand-notifications-normalizer / case 3 — kind-locking (no fuzzy poach)", () => {
  // The exact slug is what locks `kind="order"` — an unrelated payload that
  // happens to contain the word "order" in its body must NOT be routed onto
  // the orders inbox. Pin both directions.

  it("seven errand-order-* slugs all route onto kind='order'", () => {
    const slugs = [
      "errand-order-accepted",
      "errand-order-picked-up",
      "errand-order-delivering",
      "errand-order-delivered",
      "errand-order-completed",
      "errand-order-cancelled",
      "errand-order-refunded",
    ];
    for (const type of slugs) {
      const item = normalizeNotificationItem({
        id: `${type}-1`,
        type,
        data: {
          status: type.replace("errand-order-", "").replace(/-/g, "_"),
          orderId: "order-1",
          targetType: "errand-order",
        },
      });
      expect(item.kind).toBe("order");
      expect(item.target).toEqual({ kind: "errand-order", orderId: "order-1" });
    }
  });

  it("legacy 'errand-order-status' routes to the errand-order target when orderId is present", () => {
    const item = normalizeNotificationItem({
      id: "legacy-1",
      type: "errand-order-status",
      title: "跑腿订单状态更新",
      excerpt: "骑手已接单。",
      data: {
        orderId: "legacy-order-1",
        targetType: "errand-order",
      },
    });
    expect(item.kind).toBe("order");
    expect(item.target).toEqual({ kind: "errand-order", orderId: "legacy-order-1" });
  });

  it("unrelated slug containing 'order' does NOT inherit errand fallback copy", () => {
    // E.g. an admin-side audit notification using the word "order" elsewhere.
    // It can land in the orders bucket via fuzzy match (legacy behaviour),
    // but the errand-specific synthesis path must NOT fire — that path is
    // gated behind ERRAND_ORDER_TYPE_TO_STATUS.
    const item = normalizeNotificationItem({
      id: "audit-1",
      type: "audit-order-flagged",
      title: "审核记录",
      excerpt: "原文摘要。",
    });
    expect(item.kind).toBe("order");
    expect(item.title).toBe("审核记录");
    expect(item.excerpt).toBe("原文摘要。");
    expect(item.title).not.toBe(NOTIF_ERRAND_ORDER_ACCEPTED_TITLE);
    expect(item.target).toEqual({
      kind: "none",
      reason: "订单类通知会在后续版本接入目标页。",
    });
  });
});

describe("errand-notifications-normalizer / case 4 — idempotency-key shape opacity", () => {
  // F3 does not parse the idempotencyKey or the id. Both are preserved
  // verbatim. Pin so a downstream parser added later updates this test.

  it("envelope idempotencyKey field is ignored by NotificationItem (not surfaced)", () => {
    const item = normalizeNotificationItem(
      acceptedWire({
        idempotencyKey: "errand-order-1-accepted-uid-7-2026-05-22T08:00:00Z",
      }),
    );
    // NotificationItem has no idempotencyKey field — pin shape stability.
    expect("idempotencyKey" in item).toBe(false);
  });

  it("id is preserved verbatim, regardless of internal layout", () => {
    const id = "errand-order-77-completed-runner-99-2026-05-22T08:30:00Z";
    const item = normalizeNotificationItem(completedWire({ id }));
    expect(item.id).toBe(id);
    expect(item.kind).toBe("order");
  });

  it("id eventId-equivalent mismatch with data.orderId is allowed (renderer doesn't reconcile)", () => {
    const item = normalizeNotificationItem(
      completedWire({
        id: "errand-order-MISMATCH-completed-runner-99-2026-05-22T08:30:00Z",
        data: {
          status: "completed",
          orderId: "order-77",
          targetType: "errand-order",
          orderTitle: "奶茶代购",
        },
      }),
    );
    expect(item.id).toBe("errand-order-MISMATCH-completed-runner-99-2026-05-22T08:30:00Z");
    expect(item.excerpt).toContain("奶茶代购");
    expect(item.target).toEqual({ kind: "errand-order", orderId: "order-77" });
  });
});

describe("errand-notifications-normalizer / case 5 — payload-driven body", () => {
  it("data.orderTitle drives the {title} substitution in the fallback body", () => {
    const item = normalizeNotificationItem({
      type: "errand-order-completed",
      data: {
        status: "completed",
        orderId: "order-7",
        orderTitle: "校园文具配送",
        targetType: "errand-order",
      },
    });
    expect(item.excerpt).toBe("「校园文具配送」订单已完成，报酬已入账。");
    expect(item.target).toEqual({ kind: "errand-order", orderId: "order-7" });
  });

  it("falls back to data.title when data.orderTitle is absent", () => {
    const item = normalizeNotificationItem({
      type: "errand-order-completed",
      data: {
        status: "completed",
        orderId: "order-7",
        title: "二楼咖啡代取",
        targetType: "errand-order",
      },
    });
    expect(item.excerpt).toContain("二楼咖啡代取");
    expect(item.target).toEqual({ kind: "errand-order", orderId: "order-7" });
  });

  it("status-enum-only fallback when raw.type is missing but data.status is well-formed", () => {
    // Defensive path — if the backend ever drops the type slug but keeps the
    // structured status enum, F3 still synthesises locked copy. Kind dispatch
    // remains gated on the slug (this case lands as kind="generic"), but the
    // copy projection must not crash.
    const item = normalizeNotificationItem({
      data: {
        status: "completed",
        orderId: "order-99",
        orderTitle: "奶茶代购",
        targetType: "errand-order",
      },
    });
    // Without the slug, kind dispatch falls through; the orderTitle fallback
    // must still not corrupt downstream rendering.
    expect(item).toBeDefined();
    expect(item.excerpt).not.toContain("undefined");
  });
});

describe("errand-notifications-normalizer / case 6 — mixed inbox preserves source order", () => {
  it("normalizeNotificationResponse keeps errand items in arrival order alongside event/reply types", () => {
    const response = normalizeNotificationResponse({
      items: [
        acceptedWire(),
        completedWire(),
        { id: "r-1", type: "reply", tid: 88, title: "有人回复了你的帖子" },
        {
          id: "evt-1",
          type: "event-completed",
          tid: 156,
          data: {
            eventId: "evt-1",
            eventTitle: "周末桌游夜",
            hostPostTid: 156,
            transition: "completed",
            targetType: "event",
          },
        },
      ],
    });

    const kinds = (response.items || []).map((it) => it.kind);
    expect(kinds).toEqual(["order", "order", "reply", "event-completed"]);
  });

  it("seven status types in one response all retain kind='order' and unique titles", () => {
    const slugs = [
      "errand-order-accepted",
      "errand-order-picked-up",
      "errand-order-delivering",
      "errand-order-delivered",
      "errand-order-completed",
      "errand-order-cancelled",
      "errand-order-refunded",
    ];
    const response = normalizeNotificationResponse({
      items: slugs.map((type) => ({
        id: `${type}-x`,
        type,
        data: {
          status: type.replace("errand-order-", "").replace(/-/g, "_"),
          orderId: "order-x",
          orderTitle: "奶茶代购",
          targetType: "errand-order",
        },
        actor: ERRAND_ACTOR,
        timestampISO: "2026-05-22T08:00:00Z",
        read: false,
      })),
    });

    const items = response.items || [];
    expect(items.length).toBe(7);
    for (const item of items) {
      expect(item.kind).toBe("order");
      expect(item.target).toEqual({ kind: "errand-order", orderId: "order-x" });
    }
    const titles = new Set(items.map((it) => it.title));
    expect(titles.size).toBe(7);
  });

  it("stays on the fallback path when an errand-order payload lacks orderId", () => {
    const item = normalizeNotificationItem({
      type: "errand-order-delivered",
      data: {
        status: "delivered",
        targetType: "errand-order",
        orderTitle: "奶茶代购",
      },
      actor: ERRAND_ACTOR,
      timestampISO: "2026-05-22T08:00:00Z",
      read: false,
    });

    expect(item.target).toEqual({
      kind: "none",
      reason: "订单类通知会在后续版本接入目标页。",
    });
    expect(item.actionLabel).toBe("订单类通知会在后续版本接入目标页。");
  });
});
