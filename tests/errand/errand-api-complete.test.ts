import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";

const { apiSendMock } = vi.hoisted(() => ({ apiSendMock: vi.fn() }));

vi.mock("../../src/api/http", () => ({
  apiGet: vi.fn(),
  apiSend: apiSendMock,
  LianApiError: class LianApiError extends Error {},
}));

import * as errandsApi from "../../src/api/errands";
import ErrandOrderMeta from "../../src/features/errand/ErrandOrderMeta.vue";
import {
  TERMINAL_RUNNER_SAFE_DETAIL_WIRE,
  TERMINAL_RUNNER_SAFE_ORDER_KEYS,
} from "./fixtures/errand-wire-fixtures";

describe("errand requester completion API", () => {
  beforeEach(() => {
    apiSendMock.mockReset();
  });

  it("posts to the accepted complete route and normalizes returned detail", async () => {
    const contract = errandsApi as typeof errandsApi & {
      completeErrandOrder?: (orderId: string) => Promise<unknown>;
    };
    expect(typeof contract.completeErrandOrder).toBe("function");

    apiSendMock.mockResolvedValue({
      ok: true,
      order: {
        orderId: "ord-complete",
        requesterUserId: "creator-A",
        pickupLocation: { placeId: "pickup", label: "商家", lat: 18.39, lng: 110.01 },
        dropoffLocation: {
          placeId: "place-safe-building",
          label: "明德楼大厅",
          lat: 18.401,
          lng: 110.022,
        },
        mode: "dedicated",
        status: "completed",
        feePoints: 2,
        rewardPoints: 5,
        totalLockedPoints: 0,
        timeline: [{ status: "completed", at: "2026-08-24T01:00:00.000Z", actor: "requester" }],
      },
    });

    await expect(contract.completeErrandOrder?.("ord-complete")).resolves.toMatchObject({
      order: { orderId: "ord-complete", status: "completed" },
    });
    expect(apiSendMock).toHaveBeenCalledWith("/api/errands/orders/ord-complete/complete", {
      method: "POST",
    });
  });

  it("accepts the backend exact-safe terminal runner detail without inventing private fields", async () => {
    const normalized = errandsApi.normalizeErrandOrderDetail(TERMINAL_RUNNER_SAFE_DETAIL_WIRE);

    expect(normalized).not.toBeNull();
    if (!normalized) throw new Error("terminal safe detail must normalize");
    expect(Object.keys(normalized.order).sort()).toEqual([...TERMINAL_RUNNER_SAFE_ORDER_KEYS]);
    expect(normalized.order.status).toBe("completed");
    expect(normalized.timeline).toEqual([]);
    expect(normalized.notes).toBe("");
    expect(normalized.order).not.toHaveProperty("requesterUserId");
    expect(normalized.order).not.toHaveProperty("pickupLocation");
    expect(normalized.order).not.toHaveProperty("dropoffLocation");

    const html = await renderToString(
      createSSRApp({
        render: () => h(ErrandOrderMeta, { order: normalized.order, notes: normalized.notes }),
      }),
    );
    expect(html).toContain('data-testid="errand-order-meta"');
    expect(html).not.toContain('data-testid="errand-order-meta-pickup"');
    expect(html).not.toContain('data-testid="errand-order-meta-dropoff"');
    expect(html).not.toContain("undefined");
  });
});
