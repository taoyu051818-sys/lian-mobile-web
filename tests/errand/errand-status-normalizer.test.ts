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
    feeAmount: 8,
    lockedBalanceAmount: 8,
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
