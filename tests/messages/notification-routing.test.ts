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