import { describe, expect, it } from "vitest";

import { normalizeNotificationItem, normalizeNotificationResponse } from "../../src/api/messages";

describe("notification routing normalization", () => {
  it("routes reply notifications to post detail", () => {
    const item = normalizeNotificationItem({
      id: "reply-1",
      type: "new-reply",
      tid: "88",
      title: "有人回复了你的帖子",
      excerpt: "新的回复内容",
      read: false,
    });

    expect(item.kind).toBe("reply");
    expect(item.target).toEqual({ kind: "detail", tid: 88 });
    expect(item.actionLabel).toBe("查看回复详情");
  });

  it("routes verification notifications to the verification center", () => {
    const item = normalizeNotificationItem({
      id: "verification-1",
      type: "verification-approved",
      title: "校园认证已通过",
      excerpt: "现在可以进入认证中心查看状态。",
    });

    expect(item.kind).toBe("verification");
    expect(item.target).toEqual({ kind: "verification" });
    expect(item.actionLabel).toBe("前往认证中心");
  });

  it("keeps order-like notifications in a stable fallback state when no target exists", () => {
    const item = normalizeNotificationItem({
      id: "order-1",
      type: "errand-order-status",
      title: "跑腿订单状态更新",
      excerpt: "骑手已经接单。",
    });

    expect(item.kind).toBe("order");
    expect(item.target).toEqual({
      kind: "none",
      reason: "订单类通知会在后续版本接入目标页。",
    });
    expect(item.fallbackText).toBe("订单类通知会在后续版本接入目标页。");
  });

  it("accepts the notifications alias used by some message payloads", () => {
    const response = normalizeNotificationResponse({
      notifications: [{ id: "reply-2", type: "reply", tid: 7, title: "回复通知" }],
    });

    expect(response.items).toHaveLength(1);
    expect(response.items?.[0]?.target).toEqual({ kind: "detail", tid: 7 });
  });
});

describe("errand-order notification routing (ps#477 / ps#495 fan-out)", () => {
  // Lock the seven exact errand-order-* slugs onto kind="order" so a fuzzy
  // "order"/"errand" hit on an unrelated payload can't poach the bucket. The
  // status itself is projected via ERRAND_ORDER_TYPE_TO_STATUS for body copy.
  // Wire types use kebab-case (`errand-order-picked-up`); internal status
  // enums are snake_case (`picked_up`).

  const baseEnvelope = {
    actor: { id: "system", name: "LIAN", displayName: "LIAN" },
    timestampISO: "2026-05-22T08:00:00Z",
    read: false,
  } as const;

  it.each([
    ["errand-order-accepted", "跑腿订单已被接单", "「奶茶代购」已被跑腿员接单，请保持联系。"],
    ["errand-order-picked-up", "跑腿订单已取件", "「奶茶代购」已取件，正在前往送达。"],
    ["errand-order-delivering", "跑腿订单配送中", "「奶茶代购」正在配送途中。"],
    ["errand-order-delivered", "跑腿订单已送达", "「奶茶代购」已送达，请尽快确认完成。"],
    ["errand-order-completed", "跑腿订单已完成结算", "「奶茶代购」订单已完成，报酬已入账。"],
    ["errand-order-cancelled", "跑腿订单已取消", "「奶茶代购」订单已取消。"],
    ["errand-order-refunded", "跑腿订单已退款", "「奶茶代购」订单退款已到账。"],
  ])("routes %s onto kind='order' with locked fallback copy", (type, fallbackTitle, fallbackBody) => {
    // Backend strips title/excerpt to exercise our fallback copy path.
    const item = normalizeNotificationItem({
      id: `errand-order-1-${type}-uid-7-2026-05-22T08:00:00Z`,
      type,
      data: {
        status: type.replace("errand-order-", "").replace(/-/g, "_"),
        previousStatus: "",
        orderId: "order-1",
        merchantPostId: "42",
        triggeredBy: "uid-9",
        targetType: "errand-order",
        orderTitle: "奶茶代购",
      },
      idempotencyKey: `errand-order-1-${type.replace("errand-order-", "").replace(/-/g, "_")}-uid-7-2026-05-22T08:00:00Z`,
      ...baseEnvelope,
    });

    expect(item.kind).toBe("order");
    expect(item.title).toBe(fallbackTitle);
    expect(item.excerpt).toBe(fallbackBody);
    expect(item.target).toEqual({
      kind: "none",
      reason: "订单类通知会在后续版本接入目标页。",
    });
    expect(item.actionLabel).toBe("订单类通知会在后续版本接入目标页。");
  });

  it("pins ps#495 errand-order-completed payload (recipient = runner) end-to-end", () => {
    // Specific pin for ps#495 — the recipient is the runner whose wallet was
    // just credited, and `data.triggeredBy` carries the requester uid that
    // confirmed the order.
    const item = normalizeNotificationItem({
      id: "errand-order-77-completed-runner-99-2026-05-22T08:00:00Z",
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
      idempotencyKey: "errand-order-77-completed-runner-99-2026-05-22T08:00:00Z",
      actor: { id: "system", name: "LIAN", displayName: "LIAN" },
      timestampISO: "2026-05-22T08:00:00Z",
      read: false,
    });

    expect(item.kind).toBe("order");
    expect(item.title).toBe("跑腿订单已完成结算");
    expect(item.excerpt).toBe("「奶茶代购」订单已完成，报酬已入账。");
    expect(item.type).toBe("errand-order-completed");
    expect(item.target.kind).toBe("none");
  });
});

describe("event notification rendering (B2 #438 fan-out)", () => {
  // Wire shape mirrors lian-platform-server#445 (merge fc65accf):
  //   id "evt-<eventId>-<uid>-<arm>", type, tid:<hostPostTid>, data{eventId,
  //   hostPostTid, transition, targetType:"event", ...}, actor.displayName,
  //   timestampISO, read=false.

  it("uses a structured event title when one exists", () => {
    const item = normalizeNotificationItem({
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
      actor: { displayName: "活动小助手" },
      timestampISO: "2026-05-21T08:00:00Z",
      read: false,
    });

    expect(item.kind).toBe("event-completed");
    expect(item.title).toBe("活动已结束");
    expect(item.excerpt).toBe("「周末桌游夜」的活动已结束。");
    expect(item.target).toEqual({ kind: "detail", tid: 156 });
    expect(item.actionLabel).toBe("查看详情");
    expect(item.read).toBe(false);
    expect(item.actor?.displayName).toBe("活动小助手");
  });

  it("does not treat backend raw.title as a bare event name", () => {
    const item = normalizeNotificationItem({
      id: "evt-evt-1-uid-7-completed",
      type: "event-completed",
      tid: 156,
      title: "周末桌游夜 活动已结束",
      data: {
        eventId: "evt-1",
        hostPostTid: 156,
        transition: "completed",
        targetType: "event",
      },
    });

    expect(item.title).toBe("活动已结束");
    expect(item.excerpt).toBe("「活动」的活动已结束。");
    expect(item.excerpt).not.toContain("周末桌游夜 活动已结束");
  });

  it("renders event-reward-settled with perJoiner / totalPaid / currency in the body", () => {
    const item = normalizeNotificationItem({
      id: "evt-evt-1-uid-7-settlement-s-1",
      type: "event-reward-settled",
      tid: 156,
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
      actor: { displayName: "活动小助手" },
      timestampISO: "2026-05-21T08:05:00Z",
      read: false,
    });

    expect(item.kind).toBe("event-reward-settled");
    expect(item.title).toBe("活动奖励已发放");
    expect(item.excerpt).toContain("周末桌游夜");
    expect(item.excerpt).toContain("50");
    expect(item.excerpt).toContain("150");
    expect(item.excerpt).toContain("积分");
    expect(item.target).toEqual({ kind: "detail", tid: 156 });
  });

  it("falls back to legacy `points` payload when perJoiner is absent", () => {
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

  it("renders event-expired with branded title and deep-link", () => {
    const item = normalizeNotificationItem({
      id: "evt-evt-2-uid-7-expired",
      type: "event-expired",
      tid: 200,
      data: {
        eventId: "evt-2",
        eventTitle: "过期活动",
        hostPostTid: 200,
        transition: "expired",
        targetType: "event",
      },
      actor: { displayName: "活动小助手" },
      timestampISO: "2026-05-21T09:00:00Z",
      read: false,
    });

    expect(item.kind).toBe("event-expired");
    expect(item.title).toBe("活动已过期");
    expect(item.excerpt).toContain("过期活动");
    expect(item.excerpt).toContain("自动过期");
    expect(item.target).toEqual({ kind: "detail", tid: 200 });
    expect(item.actionLabel).toBe("查看详情");
  });

  it("falls back to a generic body and no link when tid is missing", () => {
    const item = normalizeNotificationItem({
      type: "event-completed",
      data: {
        eventId: "evt-1",
        transition: "completed",
        targetType: "event",
      },
    });

    expect(item.kind).toBe("event-completed");
    expect(item.title).toBe("活动已结束");
    expect(item.excerpt).toBe("「活动」的活动已结束。");
    expect(item.target.kind).toBe("none");
    expect(item.fallbackText).toBeTruthy();
  });

  it("survives malformed `data` without crashing", () => {
    const item = normalizeNotificationItem({
      type: "event-reward-settled",
      tid: 156,
      data: "oops" as unknown as Record<string, unknown>,
    });

    expect(item.kind).toBe("event-reward-settled");
    expect(item.title).toBe("活动奖励已发放");
    expect(item.excerpt).toContain("0");
    expect(item.target).toEqual({ kind: "detail", tid: 156 });
  });

  it("does not route an unknown type containing 'event' into an event kind", () => {
    const item = normalizeNotificationItem({
      type: "event-cancelled",
      tid: 42,
      title: "未来类型",
    });

    expect(item.kind).not.toBe("event-completed");
    expect(item.kind).not.toBe("event-reward-settled");
    expect(item.kind).not.toBe("event-expired");
  });

  it("preserves the deep-link route precedent: detail target with numeric tid", () => {
    const reply = normalizeNotificationItem({ type: "reply", tid: 88, title: "x" });
    const completed = normalizeNotificationItem({
      type: "event-completed",
      tid: 156,
      data: { eventId: "e", hostPostTid: 156, transition: "completed", targetType: "event" },
    });

    expect(reply.target.kind).toBe("detail");
    expect(completed.target.kind).toBe("detail");
    if (reply.target.kind === "detail" && completed.target.kind === "detail") {
      expect(typeof reply.target.tid).toBe("number");
      expect(typeof completed.target.tid).toBe("number");
    }
  });

  it("renders mixed inbox without regression — legacy + 3 new types", () => {
    const response = normalizeNotificationResponse({
      items: [
        { id: "r-1", type: "reply", tid: 10, title: "回复" },
        {
          id: "e-1",
          type: "event-completed",
          tid: 11,
          data: {
            eventId: "evt-a",
            hostPostTid: 11,
            transition: "completed",
            targetType: "event",
          },
        },
        {
          id: "e-2",
          type: "event-reward-settled",
          tid: 11,
          data: {
            eventId: "evt-a",
            hostPostTid: 11,
            transition: "reward_settled",
            targetType: "event",
            settlementId: "s-1",
            perJoiner: 5,
            totalPaid: 5,
            currency: "积分",
          },
        },
        {
          id: "e-3",
          type: "event-expired",
          tid: 12,
          data: {
            eventId: "evt-b",
            hostPostTid: 12,
            transition: "expired",
            targetType: "event",
          },
        },
        { id: "v-1", type: "verification-approved", title: "认证通过" },
      ],
    });

    const kinds = (response.items || []).map((it) => it.kind);
    expect(kinds).toEqual([
      "reply",
      "event-completed",
      "event-reward-settled",
      "event-expired",
      "verification",
    ]);
  });
});
