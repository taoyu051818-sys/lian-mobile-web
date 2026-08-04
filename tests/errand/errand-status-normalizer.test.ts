import { describe, expect, it } from "vitest";

import {
  normalizeErrandOrderCreateResponse,
  normalizeErrandOrderDetail,
} from "../../src/api/errands";
import {
  ERRAND_STATUS_LABELS,
  isTerminalErrandStatus,
  statusLabel,
} from "../../src/features/errand/errand-format";

describe("errand status normalization", () => {
  const baseOrder = {
    orderId: "ord-1",
    requesterUserId: "u-requester",
    pickupLocation: { placeId: "pickup", label: "一食堂", lat: 20, lng: 110 },
    dropoffLocation: { placeId: "dropoff", label: "教学楼", lat: 20.1, lng: 110.1 },
    mode: "dedicated",
    feePoints: 3,
    rewardPoints: 5,
    totalLockedPoints: 8,
  };

  it("accepts backend status 'completed' on the order and timeline", () => {
    const detail = normalizeErrandOrderDetail({
      ...baseOrder,
      status: "completed",
      createdAt: "2026-05-27T10:00:00Z",
      timeline: [
        { status: "delivered", at: "2026-05-27T10:10:00Z", actor: "runner" },
        { status: "completed", at: "2026-05-27T10:20:00Z", actor: "requester" },
      ],
    });

    expect(detail?.order.status).toBe("completed");
    expect(detail?.timeline.map((event) => event.status)).toEqual(["delivered", "completed"]);
    expect(statusLabel("completed")).toBe(ERRAND_STATUS_LABELS.completed);
    expect(isTerminalErrandStatus("completed")).toBe(true);
  });

  it("accepts at_shop on the order and timeline", () => {
    const detail = normalizeErrandOrderDetail({
      ...baseOrder,
      status: "at_shop",
      createdAt: "2026-05-27T10:00:00Z",
      timeline: [{ status: "at_shop", at: "2026-05-27T10:10:00Z", actor: "runner" }],
    });

    expect(detail?.order.status).toBe("at_shop");
    expect(detail?.timeline.map((event) => event.status)).toEqual(["at_shop"]);
    expect(statusLabel("at_shop")).toBe(ERRAND_STATUS_LABELS.at_shop);
    expect(isTerminalErrandStatus("at_shop")).toBe(false);
  });

  it("prefers canonical point fields and only falls back to legacy aliases", () => {
    const canonical = normalizeErrandOrderDetail({
      ...baseOrder,
      status: "created",
      feeAmount: 99,
      rewardAmount: 99,
      lockedBalanceAmount: 198,
    });
    const legacy = normalizeErrandOrderDetail({
      ...baseOrder,
      status: "created",
      feePoints: undefined,
      rewardPoints: undefined,
      totalLockedPoints: undefined,
      feeAmount: 2,
      rewardAmount: 6,
      lockedBalanceAmount: 8,
    });

    expect(canonical?.order).toMatchObject({
      feePoints: 3,
      rewardPoints: 5,
      totalLockedPoints: 8,
    });
    expect(legacy?.order).toMatchObject({
      feePoints: 2,
      rewardPoints: 6,
      totalLockedPoints: 8,
    });
  });

  it("reads the real backend envelope timeline and an order.timeline fallback", () => {
    const outerTimeline = [
      { status: "created", at: "2026-05-27T10:00:00Z", actor: "requester" },
      { status: "paid_locked", at: "2026-05-27T10:00:01Z", actor: "platform" },
    ];
    const wrapped = normalizeErrandOrderDetail({
      order: { ...baseOrder, status: "paid_locked" },
      timeline: outerTimeline,
      notes: "外层备注",
      createdAt: "2026-05-27T10:00:00Z",
    });
    const nested = normalizeErrandOrderDetail({
      order: {
        ...baseOrder,
        status: "at_shop",
        timeline: [
          { status: "assigned", at: "2026-05-27T10:05:00Z", actor: "runner" },
          { status: "at_shop", at: "2026-05-27T10:10:00Z", actor: "runner" },
        ],
        notes: "订单内备注",
        createdAt: "2026-05-27T10:00:00Z",
      },
    });

    expect(wrapped?.timeline.map((event) => event.status)).toEqual(["created", "paid_locked"]);
    expect(wrapped?.notes).toBe("外层备注");
    expect(nested?.timeline.map((event) => event.status)).toEqual(["assigned", "at_shop"]);
    expect(nested?.notes).toBe("订单内备注");
    expect(nested?.createdAt).toBe("2026-05-27T10:00:00Z");
  });

  it("preserves unknown backend order statuses as 'unknown' instead of 'created'", () => {
    const detail = normalizeErrandOrderDetail({
      ...baseOrder,
      status: "settled_by_admin",
      createdAt: "2026-05-27T10:00:00Z",
    });

    expect(detail?.order.status).toBe("unknown");
    expect(detail?.timeline).toEqual([
      { status: "unknown", at: "2026-05-27T10:00:00Z", actor: "system" },
    ]);
    expect(statusLabel("unknown")).toBe(ERRAND_STATUS_LABELS.unknown);
    expect(isTerminalErrandStatus("unknown")).toBe(false);
  });

  it("drops unknown timeline statuses without corrupting the order status", () => {
    const detail = normalizeErrandOrderDetail({
      ...baseOrder,
      status: "completed",
      createdAt: "2026-05-27T10:00:00Z",
      timeline: [
        { status: "delivered", at: "2026-05-27T10:10:00Z", actor: "runner" },
        { status: "settled_by_admin", at: "2026-05-27T10:20:00Z", actor: "system" },
      ],
    });

    expect(detail?.order.status).toBe("completed");
    expect(detail?.timeline.map((event) => event.status)).toEqual(["delivered"]);
  });

  it("normalizes create responses with completed orders", () => {
    const response = normalizeErrandOrderCreateResponse({
      ok: true,
      order: {
        ...baseOrder,
        status: "completed",
        createdAt: "2026-05-27T10:00:00Z",
        timeline: [{ status: "completed", at: "2026-05-27T10:20:00Z", actor: "requester" }],
      },
    });

    expect(response.ok).toBe(true);
    expect(response.order?.order.status).toBe("completed");
  });

  it("documents current code evidence for refunded and disputed", () => {
    expect(isTerminalErrandStatus("refunded")).toBe(true);
    expect(isTerminalErrandStatus("disputed")).toBe(false);
    expect(statusLabel("refunded")).toBe(ERRAND_STATUS_LABELS.refunded);
    expect(statusLabel("disputed")).toBe(ERRAND_STATUS_LABELS.disputed);
  });
});
