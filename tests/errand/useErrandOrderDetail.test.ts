/**
 * Cancel + canCancel coverage for `useErrandOrderDetail` (issue #609 PR1).
 *
 * The composable already had read-side coverage in
 * `tests/errand/errand-order.structure.test.mjs`; this file exercises the
 * runtime behaviour PR1 layered on top:
 *
 * - canCancel only fires while the order is non-terminal,
 * - cancel() flips the detail into the cancelled state and stops polling,
 * - cancel() surfaces backend errors through `cancelError` instead of the
 *   shared `errorMessage` channel (so a failed cancel does not blank out
 *   the timeline the user is staring at).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nextTick } from "vue";
import type { ErrandOrderDetail } from "../../src/types/errand";

vi.mock("../../src/api/errands", () => ({
  fetchErrandOrder: vi.fn(),
  cancelErrandOrder: vi.fn(),
}));

import * as errandsApi from "../../src/api/errands";
import { useErrandOrderDetail } from "../../src/features/errand/useErrandOrderDetail";

function makeDetail(overrides: Partial<ErrandOrderDetail["order"]> = {}): ErrandOrderDetail {
  return {
    order: {
      orderId: "ord-1",
      requesterUserId: "u-requester",
      pickupLocation: { placeId: "p", label: "海大食堂", lat: null, lng: null },
      dropoffLocation: { placeId: "d", label: "明德楼", lat: null, lng: null },
      mode: "dedicated",
      status: "created",
      feePoints: 3,
      rewardPoints: 5,
      totalLockedPoints: 0,
      ...overrides,
    },
    timeline: [{ status: "created", at: "2026-05-21T10:00:00Z", actor: "system" }],
    notes: "",
    createdAt: "2026-05-21T10:00:00Z",
  };
}

describe("useErrandOrderDetail — cancel surface (#609 PR1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(errandsApi.fetchErrandOrder).mockReset();
    vi.mocked(errandsApi.cancelErrandOrder).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("canCancel is false until a detail loads", async () => {
    const { canCancel } = useErrandOrderDetail();
    expect(canCancel.value).toBe(false);
  });

  it("canCancel is true on a non-terminal status, false on a terminal one", async () => {
    const detail = makeDetail({ status: "delivering" });
    vi.mocked(errandsApi.fetchErrandOrder).mockResolvedValue(detail);
    const ctx = useErrandOrderDetail();
    await ctx.refresh("ord-1");
    expect(ctx.canCancel.value).toBe(true);

    // Flip to a terminal status — refresh again, canCancel must drop.
    vi.mocked(errandsApi.fetchErrandOrder).mockResolvedValue(makeDetail({ status: "delivered" }));
    await ctx.refresh("ord-1");
    expect(ctx.canCancel.value).toBe(false);
    ctx.stop();
  });

  it("cancel() replaces detail with the cancelled record and stops polling", async () => {
    const live = makeDetail({ status: "created" });
    const cancelled = makeDetail({ status: "cancelled" });
    cancelled.timeline = [
      ...live.timeline,
      { status: "cancelled", at: "2026-05-21T10:05:00Z", actor: "requester" },
    ];
    vi.mocked(errandsApi.fetchErrandOrder).mockResolvedValue(live);
    vi.mocked(errandsApi.cancelErrandOrder).mockResolvedValue(cancelled);

    const ctx = useErrandOrderDetail();
    await ctx.refresh("ord-1");
    expect(ctx.canCancel.value).toBe(true);

    await ctx.cancel("ord-1");
    expect(ctx.detail.value?.order.status).toBe("cancelled");
    expect(ctx.canCancel.value).toBe(false);
    expect(ctx.cancelError.value).toBe("");

    // After cancel, advancing the clock should NOT re-fetch — polling was
    // stopped by the terminal transition.
    const fetchCallsBefore = vi.mocked(errandsApi.fetchErrandOrder).mock.calls.length;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(vi.mocked(errandsApi.fetchErrandOrder).mock.calls.length).toBe(fetchCallsBefore);
  });

  it("cancel() surfaces backend errors through cancelError, not errorMessage", async () => {
    const live = makeDetail({ status: "created" });
    vi.mocked(errandsApi.fetchErrandOrder).mockResolvedValue(live);
    vi.mocked(errandsApi.cancelErrandOrder).mockRejectedValue(new Error("backend boom"));

    const ctx = useErrandOrderDetail();
    await ctx.refresh("ord-1");
    expect(ctx.errorMessage.value).toBe("");

    await ctx.cancel("ord-1");
    expect(ctx.cancelError.value).toBe("backend boom");
    // Existing detail must NOT be replaced — we want the user to keep
    // looking at the order they tried to cancel.
    expect(ctx.detail.value?.order.status).toBe("created");
    expect(ctx.errorMessage.value).toBe("");
    ctx.stop();
  });

  it("cancel() is a no-op while already cancelling", async () => {
    const live = makeDetail({ status: "created" });
    vi.mocked(errandsApi.fetchErrandOrder).mockResolvedValue(live);

    let resolveCancel: (value: ErrandOrderDetail) => void = () => undefined;
    vi.mocked(errandsApi.cancelErrandOrder).mockImplementation(
      () =>
        new Promise<ErrandOrderDetail>((resolve) => {
          resolveCancel = resolve;
        }),
    );

    const ctx = useErrandOrderDetail();
    await ctx.refresh("ord-1");

    // First cancel locks the composable.
    const first = ctx.cancel("ord-1");
    await nextTick();
    expect(ctx.cancelling.value).toBe(true);

    // Second cancel must short-circuit, not double-call the API.
    await ctx.cancel("ord-1");
    expect(vi.mocked(errandsApi.cancelErrandOrder).mock.calls.length).toBe(1);

    resolveCancel(makeDetail({ status: "cancelled" }));
    await first;
    expect(ctx.cancelling.value).toBe(false);
    ctx.stop();
  });
});
