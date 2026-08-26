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
import { nextTick, ref, type Ref } from "vue";
import type { ErrandOrderDetail } from "../../src/types/errand";

vi.mock("../../src/api/errands", () => ({
  fetchErrandOrder: vi.fn(),
  cancelErrandOrder: vi.fn(),
  completeErrandOrder: vi.fn(),
}));

vi.mock("../../src/api/profile", () => ({
  fetchAuthMe: vi.fn(),
}));

import * as errandsApi from "../../src/api/errands";
import * as profileApi from "../../src/api/profile";
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

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

type CompletionContext = ReturnType<typeof useErrandOrderDetail> & {
  canComplete?: { value: boolean };
  completing?: { value: boolean };
  completeError?: { value: string };
  complete?: (orderId: string) => Promise<void>;
};

function useCompletionContext(viewerUserId: string): CompletionContext {
  const factory = useErrandOrderDetail as unknown as (
    viewerUserId: Ref<string>,
  ) => ReturnType<typeof useErrandOrderDetail>;
  return factory(ref(viewerUserId)) as CompletionContext;
}

function useCompletionContextRef(viewerUserId: Ref<string>): CompletionContext {
  const factory = useErrandOrderDetail as unknown as (
    viewerUserId: Ref<string>,
  ) => ReturnType<typeof useErrandOrderDetail>;
  return factory(viewerUserId) as CompletionContext;
}

describe("useErrandOrderDetail — cancel surface (#609 PR1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(errandsApi.fetchErrandOrder).mockReset();
    vi.mocked(errandsApi.cancelErrandOrder).mockReset();
    vi.mocked(errandsApi.completeErrandOrder).mockReset();
    vi.mocked(profileApi.fetchAuthMe).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("canCancel is false until a detail loads", async () => {
    const { canCancel } = useErrandOrderDetail();
    expect(canCancel.value).toBe(false);
  });

  it("adopts the first timeline detail when auth identity settles before detail", async () => {
    const auth = deferred<{ id: string }>();
    const detail = deferred<ErrandOrderDetail>();
    vi.mocked(profileApi.fetchAuthMe).mockReturnValue(auth.promise);
    vi.mocked(errandsApi.fetchErrandOrder).mockReturnValue(detail.promise);

    const ctx = useErrandOrderDetail();
    const loadIdentity = ctx.loadCurrentUserId();
    ctx.start("ord-1");
    await nextTick();
    expect(ctx.loading.value).toBe(true);

    auth.resolve({ id: "u-requester" });
    await loadIdentity;
    await nextTick();

    detail.resolve(makeDetail({ status: "delivered" }));
    await nextTick();
    await Promise.resolve();

    expect(ctx.detail.value?.order.orderId).toBe("ord-1");
    expect(ctx.loading.value).toBe(false);
    expect(ctx.canComplete.value).toBe(true);
    expect(vi.mocked(errandsApi.fetchErrandOrder)).toHaveBeenCalledTimes(1);
    ctx.stop();
  });

  it("keeps the first timeline detail when detail settles before auth identity", async () => {
    const auth = deferred<{ id: string }>();
    const detail = deferred<ErrandOrderDetail>();
    vi.mocked(profileApi.fetchAuthMe).mockReturnValue(auth.promise);
    vi.mocked(errandsApi.fetchErrandOrder).mockReturnValue(detail.promise);

    const ctx = useErrandOrderDetail();
    const loadIdentity = ctx.loadCurrentUserId();
    ctx.start("ord-1");
    await nextTick();

    detail.resolve(makeDetail({ status: "delivered" }));
    await nextTick();
    await Promise.resolve();
    expect(ctx.detail.value?.order.orderId).toBe("ord-1");
    expect(ctx.loading.value).toBe(false);

    auth.resolve({ id: "u-requester" });
    await loadIdentity;
    await nextTick();

    expect(ctx.detail.value?.order.orderId).toBe("ord-1");
    expect(ctx.loading.value).toBe(false);
    expect(ctx.canComplete.value).toBe(true);
    expect(vi.mocked(errandsApi.fetchErrandOrder)).toHaveBeenCalledTimes(1);
    ctx.stop();
  });

  it("retires an empty managed viewer request when identity resets before first auth admission", async () => {
    const auth = deferred<{ id: string }>();
    const detail = deferred<ErrandOrderDetail>();
    vi.mocked(profileApi.fetchAuthMe).mockReturnValue(auth.promise);
    vi.mocked(errandsApi.fetchErrandOrder).mockReturnValue(detail.promise);

    const ctx = useErrandOrderDetail();
    ctx.start("ord-1");
    await nextTick();
    expect(ctx.loading.value).toBe(true);

    ctx.resetCurrentUserId();
    const loadNextIdentity = ctx.loadCurrentUserId();
    auth.resolve({ id: "runner-B" });
    await loadNextIdentity;
    await nextTick();

    detail.resolve(makeDetail({ status: "delivered" }));
    await nextTick();
    await Promise.resolve();

    expect(ctx.detail.value).toBeNull();
    expect(ctx.loading.value).toBe(false);
    expect(ctx.canComplete.value).toBe(false);
    ctx.stop();
  });

  it("ignores an in-flight poll response after an injected viewer changes", async () => {
    const viewerUserId = ref("u-requester");
    const initial = makeDetail({ status: "created" });
    const oldViewerPoll = deferred<ErrandOrderDetail>();
    const currentViewerRefresh = deferred<ErrandOrderDetail>();
    vi.mocked(errandsApi.fetchErrandOrder)
      .mockResolvedValueOnce(initial)
      .mockReturnValueOnce(oldViewerPoll.promise)
      .mockReturnValueOnce(currentViewerRefresh.promise);

    const ctx = useCompletionContextRef(viewerUserId);
    ctx.start("ord-1");
    await nextTick();
    await Promise.resolve();
    expect(ctx.detail.value?.order.status).toBe("created");

    await vi.advanceTimersByTimeAsync(12_000);
    expect(vi.mocked(errandsApi.fetchErrandOrder)).toHaveBeenCalledTimes(2);

    viewerUserId.value = "runner-B";
    await nextTick();
    const refreshForCurrentViewer = ctx.refresh("ord-1");
    await nextTick();

    oldViewerPoll.resolve(makeDetail({ status: "delivering" }));
    await nextTick();
    await Promise.resolve();
    expect(ctx.detail.value).toBeNull();

    currentViewerRefresh.resolve(makeDetail({ status: "assigned" }));
    await refreshForCurrentViewer;
    expect(ctx.detail.value?.order.status).toBe("assigned");
    ctx.stop();
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

  it("exposes complete only when delivered requesterUserId matches the current creator", async () => {
    const delivered = makeDetail({ status: "delivered" });
    vi.mocked(errandsApi.fetchErrandOrder).mockResolvedValue(delivered);

    const creator = useCompletionContext("u-requester");
    await creator.refresh("ord-1");
    expect(creator.canComplete?.value).toBe(true);

    const assignedRunner = useCompletionContext("runner-B");
    await assignedRunner.refresh("ord-1");
    expect(assignedRunner.canComplete?.value).toBe(false);
    expect(typeof assignedRunner.complete).toBe("function");
    await assignedRunner.complete?.("ord-1");
    expect(vi.mocked(errandsApi.completeErrandOrder)).not.toHaveBeenCalled();
    creator.stop();
    assignedRunner.stop();
  });

  for (const status of ["created", "assigned", "completed"] as const) {
    it(`does not expose or call complete for creator A while the order is ${status}`, async () => {
      vi.mocked(errandsApi.fetchErrandOrder).mockResolvedValue(makeDetail({ status }));

      const creator = useCompletionContext("u-requester");
      await creator.refresh("ord-1");
      expect(creator.canComplete?.value).toBe(false);
      expect(typeof creator.complete).toBe("function");
      await creator.complete?.("ord-1");
      expect(vi.mocked(errandsApi.completeErrandOrder)).not.toHaveBeenCalled();
      creator.stop();
    });
  }

  it("locks a pending creator complete to one request and adopts its completed response", async () => {
    const delivered = makeDetail({ status: "delivered" });
    const completed = makeDetail({ status: "completed" });
    vi.mocked(errandsApi.fetchErrandOrder).mockResolvedValue(delivered);

    let settleComplete: (value: ErrandOrderDetail) => void = () => undefined;
    vi.mocked(errandsApi.completeErrandOrder).mockImplementation(
      () =>
        new Promise<ErrandOrderDetail>((resolve) => {
          settleComplete = resolve;
        }),
    );

    const ctx = useCompletionContext("u-requester");
    await ctx.refresh("ord-1");

    expect(ctx.canComplete?.value).toBe(true);
    expect(typeof ctx.complete).toBe("function");
    if (!ctx.complete) throw new Error("complete contract is missing");

    const first = ctx.complete("ord-1");
    await nextTick();
    expect(ctx.completing?.value).toBe(true);
    expect(ctx.canComplete?.value).toBe(false);

    await ctx.complete("ord-1");
    expect(vi.mocked(errandsApi.completeErrandOrder)).toHaveBeenCalledTimes(1);

    settleComplete(completed);
    await first;
    expect(ctx.detail.value?.order.status).toBe("completed");
    expect(ctx.canComplete?.value).toBe(false);
    expect(ctx.completeError?.value).toBe("");
    expect(vi.mocked(errandsApi.completeErrandOrder)).toHaveBeenCalledTimes(1);
    ctx.stop();
  });

  it("ignores a late complete success after viewer ownership changes", async () => {
    const viewerUserId = ref("u-requester");
    const delivered = makeDetail({ status: "delivered" });
    const completed = makeDetail({ status: "completed" });
    vi.mocked(errandsApi.fetchErrandOrder).mockResolvedValue(delivered);

    let settleComplete: (value: ErrandOrderDetail) => void = () => undefined;
    vi.mocked(errandsApi.completeErrandOrder).mockImplementation(
      () =>
        new Promise<ErrandOrderDetail>((resolve) => {
          settleComplete = resolve;
        }),
    );

    const ctx = useCompletionContextRef(viewerUserId);
    await ctx.refresh("ord-1");

    const first = ctx.complete?.("ord-1");
    await nextTick();
    expect(ctx.completing?.value).toBe(true);

    viewerUserId.value = "runner-B";
    await nextTick();
    expect(ctx.completing?.value).toBe(false);

    settleComplete(completed);
    await first;
    expect(ctx.detail.value).toBeNull();
    expect(ctx.completeError?.value).toBe("");
    ctx.stop();
  });

  it("ignores a late complete error after the active order changes", async () => {
    const delivered = makeDetail({ status: "delivered" });
    const nextOrder = makeDetail({ orderId: "ord-2", status: "created" });
    vi.mocked(errandsApi.fetchErrandOrder)
      .mockResolvedValueOnce(delivered)
      .mockResolvedValueOnce(nextOrder);

    let rejectComplete: (error: Error) => void = () => undefined;
    vi.mocked(errandsApi.completeErrandOrder).mockImplementation(
      () =>
        new Promise<ErrandOrderDetail>((_resolve, reject) => {
          rejectComplete = reject;
        }),
    );

    const ctx = useCompletionContext("u-requester");
    await ctx.refresh("ord-1");

    const first = ctx.complete?.("ord-1");
    await nextTick();
    expect(ctx.completing?.value).toBe(true);

    await ctx.refresh("ord-2");
    expect(ctx.detail.value?.order.orderId).toBe("ord-2");
    expect(ctx.completing?.value).toBe(false);

    rejectComplete(new Error("late complete failed"));
    await first;
    expect(ctx.detail.value?.order.orderId).toBe("ord-2");
    expect(ctx.completeError?.value).toBe("");
    ctx.stop();
  });

  it("clears all public detail state immediately when the managed viewer resets", async () => {
    vi.mocked(profileApi.fetchAuthMe).mockResolvedValue({ id: "u-requester" });
    vi.mocked(errandsApi.fetchErrandOrder)
      .mockResolvedValueOnce(makeDetail({ status: "delivered" }))
      .mockRejectedValueOnce(new Error("stale detail error"));
    vi.mocked(errandsApi.completeErrandOrder).mockRejectedValue(new Error("stale complete error"));

    const ctx = useErrandOrderDetail();
    await ctx.loadCurrentUserId();
    await ctx.refresh("ord-1");
    await ctx.complete("ord-1");
    await ctx.refresh("ord-1");
    expect(ctx.detail.value?.order.orderId).toBe("ord-1");
    expect(ctx.loaded.value).toBe(true);
    expect(ctx.errorMessage.value).toBe("stale detail error");
    expect(ctx.completeError.value).toBe("stale complete error");

    ctx.resetCurrentUserId();

    expect(ctx.detail.value).toBeNull();
    expect(ctx.loaded.value).toBe(false);
    expect(ctx.loading.value).toBe(false);
    expect(ctx.errorMessage.value).toBe("");
    expect(ctx.cancelError.value).toBe("");
    expect(ctx.completeError.value).toBe("");
    expect(ctx.canCancel.value).toBe(false);
    expect(ctx.canComplete.value).toBe(false);
  });

  it("clears all public detail state immediately when an injected viewer changes", async () => {
    const viewerUserId = ref("u-requester");
    vi.mocked(errandsApi.fetchErrandOrder).mockResolvedValue(makeDetail({ status: "delivered" }));

    const ctx = useCompletionContextRef(viewerUserId);
    await ctx.refresh("ord-1");
    expect(ctx.canComplete.value).toBe(true);

    viewerUserId.value = "runner-B";
    await nextTick();

    expect(ctx.detail.value).toBeNull();
    expect(ctx.loaded.value).toBe(false);
    expect(ctx.errorMessage.value).toBe("");
    expect(ctx.canCancel.value).toBe(false);
    expect(ctx.canComplete.value).toBe(false);
  });

  it("public stop clears detail, loaded/error state, and both CTAs immediately", async () => {
    vi.mocked(errandsApi.fetchErrandOrder)
      .mockResolvedValueOnce(makeDetail({ status: "delivered" }))
      .mockRejectedValueOnce(new Error("stale load error"));
    const ctx = useCompletionContext("u-requester");
    await ctx.refresh("ord-1");
    await ctx.refresh("ord-1");
    expect(ctx.detail.value?.order.orderId).toBe("ord-1");
    expect(ctx.loaded.value).toBe(true);
    expect(ctx.errorMessage.value).toBe("stale load error");

    ctx.stop();

    expect(ctx.detail.value).toBeNull();
    expect(ctx.loaded.value).toBe(false);
    expect(ctx.loading.value).toBe(false);
    expect(ctx.errorMessage.value).toBe("");
    expect(ctx.canCancel.value).toBe(false);
    expect(ctx.canComplete.value).toBe(false);
  });

  it("order switch clears the prior detail before the new response and permits zero stale POSTs", async () => {
    const nextOrder = deferred<ErrandOrderDetail>();
    vi.mocked(errandsApi.fetchErrandOrder)
      .mockResolvedValueOnce(makeDetail({ status: "delivered" }))
      .mockReturnValueOnce(nextOrder.promise);
    vi.mocked(errandsApi.cancelErrandOrder).mockResolvedValue(makeDetail({ status: "cancelled" }));
    vi.mocked(errandsApi.completeErrandOrder).mockResolvedValue(
      makeDetail({ status: "completed" }),
    );

    const ctx = useCompletionContext("u-requester");
    await ctx.refresh("ord-1");
    expect(ctx.canComplete.value).toBe(true);

    const switchFlight = ctx.refresh("ord-2");
    await nextTick();
    expect(ctx.detail.value).toBeNull();
    expect(ctx.loaded.value).toBe(false);
    expect(ctx.loading.value).toBe(true);
    expect(ctx.canCancel.value).toBe(false);
    expect(ctx.canComplete.value).toBe(false);

    await ctx.cancel("ord-1");
    await ctx.cancel("ord-2");
    await ctx.complete("ord-1");
    await ctx.complete("ord-2");
    expect(vi.mocked(errandsApi.cancelErrandOrder)).not.toHaveBeenCalled();
    expect(vi.mocked(errandsApi.completeErrandOrder)).not.toHaveBeenCalled();

    nextOrder.resolve(makeDetail({ orderId: "ord-2", status: "created" }));
    await switchFlight;
    ctx.stop();
  });

  it("cancel requires both canCancel and an exact active/detail order id", async () => {
    vi.mocked(errandsApi.fetchErrandOrder).mockResolvedValue(makeDetail({ status: "delivered" }));
    vi.mocked(errandsApi.cancelErrandOrder).mockResolvedValue(makeDetail({ status: "cancelled" }));
    const ctx = useCompletionContext("u-requester");
    await ctx.refresh("ord-1");

    await ctx.cancel("ord-1");
    await ctx.cancel("ord-2");

    expect(ctx.canCancel.value).toBe(false);
    expect(vi.mocked(errandsApi.cancelErrandOrder)).not.toHaveBeenCalled();
    ctx.stop();
  });

  it("complete requires an exact active/detail order id even when the loaded order is eligible", async () => {
    vi.mocked(errandsApi.fetchErrandOrder).mockResolvedValue(makeDetail({ status: "delivered" }));
    vi.mocked(errandsApi.completeErrandOrder).mockResolvedValue(
      makeDetail({ orderId: "ord-2", status: "completed" }),
    );
    const ctx = useCompletionContext("u-requester");
    await ctx.refresh("ord-1");
    expect(ctx.canComplete.value).toBe(true);

    await ctx.complete("ord-2");

    expect(vi.mocked(errandsApi.completeErrandOrder)).not.toHaveBeenCalled();
    expect(ctx.detail.value?.order.orderId).toBe("ord-1");
    ctx.stop();
  });

  it("a retired cancel finally cannot clear the new owner's pending flag", async () => {
    const oldCancel = deferred<ErrandOrderDetail>();
    const newCancel = deferred<ErrandOrderDetail>();
    vi.mocked(errandsApi.fetchErrandOrder)
      .mockResolvedValueOnce(makeDetail({ status: "created" }))
      .mockResolvedValueOnce(makeDetail({ orderId: "ord-2", status: "created" }));
    vi.mocked(errandsApi.cancelErrandOrder)
      .mockReturnValueOnce(oldCancel.promise)
      .mockReturnValueOnce(newCancel.promise);

    const ctx = useCompletionContext("u-requester");
    await ctx.refresh("ord-1");
    const oldFlight = ctx.cancel("ord-1");
    await nextTick();
    await ctx.refresh("ord-2");
    const newFlight = ctx.cancel("ord-2");
    await nextTick();
    expect(ctx.cancelling.value).toBe(true);

    oldCancel.resolve(makeDetail({ status: "cancelled" }));
    await oldFlight;
    expect(ctx.cancelling.value).toBe(true);
    expect(ctx.detail.value?.order.orderId).toBe("ord-2");

    newCancel.resolve(makeDetail({ orderId: "ord-2", status: "cancelled" }));
    await newFlight;
    expect(ctx.cancelling.value).toBe(false);
    expect(ctx.detail.value?.order.orderId).toBe("ord-2");
  });

  it("a successful complete retires every earlier same-order manual refresh owner", async () => {
    const lateActiveDetail = deferred<ErrandOrderDetail>();
    const lateReadError = deferred<ErrandOrderDetail>();
    vi.mocked(errandsApi.fetchErrandOrder)
      .mockResolvedValueOnce(makeDetail({ status: "delivered" }))
      .mockReturnValueOnce(lateActiveDetail.promise)
      .mockReturnValueOnce(lateReadError.promise);
    vi.mocked(errandsApi.completeErrandOrder).mockResolvedValue(
      makeDetail({ status: "completed" }),
    );

    const ctx = useCompletionContext("u-requester");
    await ctx.refresh("ord-1");
    const oldSuccess = ctx.refresh("ord-1");
    const oldFailure = ctx.refresh("ord-1");
    await nextTick();
    expect(ctx.loading.value).toBe(true);

    await ctx.complete?.("ord-1");
    const immediatelyAfterWrite = {
      status: ctx.detail.value?.order.status,
      loading: ctx.loading.value,
      error: ctx.errorMessage.value,
      completeError: ctx.completeError?.value,
    };

    lateActiveDetail.resolve(makeDetail({ status: "delivered" }));
    await oldSuccess;
    lateReadError.reject(new Error("late same-order read failed"));
    await oldFailure;

    const beforeSecondAttempt = {
      status: ctx.detail.value?.order.status,
      loading: ctx.loading.value,
      error: ctx.errorMessage.value,
      completeError: ctx.completeError?.value,
      canComplete: ctx.canComplete?.value,
    };
    await ctx.complete?.("ord-1");

    expect({
      immediatelyAfterWrite,
      beforeSecondAttempt,
      postCount: vi.mocked(errandsApi.completeErrandOrder).mock.calls.length,
    }).toEqual({
      immediatelyAfterWrite: {
        status: "completed",
        loading: false,
        error: "",
        completeError: "",
      },
      beforeSecondAttempt: {
        status: "completed",
        loading: false,
        error: "",
        completeError: "",
        canComplete: false,
      },
      postCount: 1,
    });
  });

  it("a successful cancel retires every earlier same-order manual refresh owner", async () => {
    const lateActiveDetail = deferred<ErrandOrderDetail>();
    const lateReadError = deferred<ErrandOrderDetail>();
    vi.mocked(errandsApi.fetchErrandOrder)
      .mockResolvedValueOnce(makeDetail({ status: "created" }))
      .mockReturnValueOnce(lateActiveDetail.promise)
      .mockReturnValueOnce(lateReadError.promise);
    vi.mocked(errandsApi.cancelErrandOrder).mockResolvedValue(makeDetail({ status: "cancelled" }));

    const ctx = useCompletionContext("u-requester");
    await ctx.refresh("ord-1");
    const oldSuccess = ctx.refresh("ord-1");
    const oldFailure = ctx.refresh("ord-1");
    await nextTick();
    expect(ctx.loading.value).toBe(true);

    await ctx.cancel("ord-1");
    const immediatelyAfterWrite = {
      status: ctx.detail.value?.order.status,
      loading: ctx.loading.value,
      error: ctx.errorMessage.value,
      cancelError: ctx.cancelError.value,
    };

    lateActiveDetail.resolve(makeDetail({ status: "created" }));
    await oldSuccess;
    lateReadError.reject(new Error("late same-order read failed"));
    await oldFailure;

    const beforeSecondAttempt = {
      status: ctx.detail.value?.order.status,
      loading: ctx.loading.value,
      error: ctx.errorMessage.value,
      cancelError: ctx.cancelError.value,
      canCancel: ctx.canCancel.value,
    };
    await ctx.cancel("ord-1");

    expect({
      immediatelyAfterWrite,
      beforeSecondAttempt,
      postCount: vi.mocked(errandsApi.cancelErrandOrder).mock.calls.length,
    }).toEqual({
      immediatelyAfterWrite: {
        status: "cancelled",
        loading: false,
        error: "",
        cancelError: "",
      },
      beforeSecondAttempt: {
        status: "cancelled",
        loading: false,
        error: "",
        cancelError: "",
        canCancel: false,
      },
      postCount: 1,
    });
  });
});
