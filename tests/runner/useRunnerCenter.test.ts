import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import { LianApiError } from "../../src/api/http";
import { useIsRunnerVerified, useRunnerCenter } from "../../src/features/runner/useRunnerCenter";
import type { RunnerOrder } from "../../src/types/runner";

vi.mock("../../src/api/runner", () => {
  return {
    fetchAvailableRunnerOrders: vi.fn(),
    fetchActiveRunnerOrders: vi.fn(),
    acceptRunnerOrder: vi.fn(),
    markRunnerOrderAtShop: vi.fn(),
    markRunnerOrderPickedUp: vi.fn(),
    markRunnerOrderDelivered: vi.fn(),
  };
});

import * as runnerApi from "../../src/api/runner";

const order = (id: string, status: RunnerOrder["status"]): RunnerOrder => ({
  id,
  status,
  title: `Order ${id}`,
});

describe("useIsRunnerVerified", () => {
  it("returns false for null user", () => {
    const user = ref(null);
    expect(useIsRunnerVerified(user).value).toBe(false);
  });

  it("trusts verificationState.runner.active when present", () => {
    const user = ref({ verificationState: { runner: { active: true } } });
    expect(useIsRunnerVerified(user).value).toBe(true);
    user.value = { verificationState: { runner: { active: false } } };
    expect(useIsRunnerVerified(user).value).toBe(false);
  });

  it("falls back to flat verificationTags / tags when state is absent", () => {
    const user = ref<{ verificationTags?: string[]; tags?: string[] }>({
      verificationTags: ["runner"],
    });
    expect(useIsRunnerVerified(user).value).toBe(true);
    user.value = { tags: ["runner"] };
    expect(useIsRunnerVerified(user).value).toBe(true);
    user.value = { verificationTags: ["campus_verified"] };
    expect(useIsRunnerVerified(user).value).toBe(false);
  });

  it("prefers state.active=false over a stale tag in the flat list", () => {
    const user = ref({
      verificationState: { runner: { active: false } },
      verificationTags: ["runner"],
    });
    expect(useIsRunnerVerified(user).value).toBe(false);
  });
});

describe("useRunnerCenter state machine", () => {
  beforeEach(() => {
    vi.mocked(runnerApi.fetchAvailableRunnerOrders).mockReset();
    vi.mocked(runnerApi.fetchActiveRunnerOrders).mockReset();
    vi.mocked(runnerApi.acceptRunnerOrder).mockReset();
    vi.mocked(runnerApi.markRunnerOrderAtShop).mockReset();
    vi.mocked(runnerApi.markRunnerOrderPickedUp).mockReset();
    vi.mocked(runnerApi.markRunnerOrderDelivered).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads available orders into the available bucket", async () => {
    vi.mocked(runnerApi.fetchAvailableRunnerOrders).mockResolvedValue({
      items: [order("a1", "available"), order("a2", "available")],
    });
    const ctrl = useRunnerCenter();
    await ctrl.loadAvailable();
    expect(ctrl.availableOrders.value).toHaveLength(2);
    expect(ctrl.availableLoading.value).toBe(false);
    expect(ctrl.availableError.value).toBe("");
    expect(ctrl.availableNeedsRunnerGate.value).toBe(false);
  });

  it("routes queue auth failures back to the runner gate", async () => {
    vi.mocked(runnerApi.fetchAvailableRunnerOrders).mockRejectedValue(
      new LianApiError("forbidden", 403),
    );
    const ctrl = useRunnerCenter();
    await ctrl.loadAvailable();
    expect(ctrl.availableNeedsRunnerGate.value).toBe(true);
    expect(ctrl.availableError.value).toBe("");
    expect(ctrl.availableOrders.value).toEqual([]);
  });

  it("surfaces an error message when load fails", async () => {
    vi.mocked(runnerApi.fetchAvailableRunnerOrders).mockRejectedValue(new Error("boom"));
    const ctrl = useRunnerCenter();
    await ctrl.loadAvailable();
    expect(ctrl.availableError.value).toBe("boom");
    expect(ctrl.availableNeedsRunnerGate.value).toBe(false);
    expect(ctrl.availableOrders.value).toEqual([]);
  });

  it("accept moves the order from available into active", async () => {
    vi.mocked(runnerApi.fetchAvailableRunnerOrders).mockResolvedValue({
      items: [order("a1", "available"), order("a2", "available")],
    });
    vi.mocked(runnerApi.acceptRunnerOrder).mockResolvedValue(order("a1", "accepted"));

    const ctrl = useRunnerCenter();
    await ctrl.loadAvailable();
    const ok = await ctrl.accept("a1");

    expect(ok).toBe(true);
    expect(ctrl.availableOrders.value.map((o) => o.id)).toEqual(["a2"]);
    expect(ctrl.activeOrders.value.map((o) => o.id)).toEqual(["a1"]);
    expect(ctrl.activeOrders.value[0].status).toBe("accepted");
  });

  it("at_shop -> picked_up -> delivered advances into read-only runner history", async () => {
    vi.mocked(runnerApi.fetchActiveRunnerOrders).mockResolvedValue({
      items: [order("a1", "accepted")],
    });
    vi.mocked(runnerApi.markRunnerOrderAtShop).mockResolvedValue(order("a1", "at_shop"));
    vi.mocked(runnerApi.markRunnerOrderPickedUp).mockResolvedValue(order("a1", "picked_up"));
    vi.mocked(runnerApi.markRunnerOrderDelivered).mockResolvedValue(order("a1", "delivered"));

    const ctrl = useRunnerCenter();
    await ctrl.loadActive();

    await ctrl.markAtShop("a1");
    expect(ctrl.activeOrders.value[0].status).toBe("at_shop");

    await ctrl.markPickedUp("a1");
    expect(ctrl.activeOrders.value[0].status).toBe("picked_up");

    await ctrl.markDelivered("a1");
    expect(ctrl.activeOrders.value).toEqual([order("a1", "delivered")]);
  });

  it("tracks per-order pending action while a transition is in flight", async () => {
    let resolveAccept: (value: RunnerOrder) => void = () => {};
    vi.mocked(runnerApi.acceptRunnerOrder).mockImplementation(
      () => new Promise<RunnerOrder>((resolve) => (resolveAccept = resolve)),
    );
    vi.mocked(runnerApi.fetchAvailableRunnerOrders).mockResolvedValue({
      items: [order("a1", "available")],
    });

    const ctrl = useRunnerCenter();
    await ctrl.loadAvailable();
    const flight = ctrl.accept("a1");
    expect(ctrl.pendingActionFor("a1")).toBe("accept");

    resolveAccept(order("a1", "accepted"));
    await flight;
    expect(ctrl.pendingActionFor("a1")).toBeUndefined();
  });

  it("publishes RUNNER_ACTION_FAIL on transition error and keeps order put", async () => {
    vi.mocked(runnerApi.fetchActiveRunnerOrders).mockResolvedValue({
      items: [order("a1", "accepted")],
    });
    vi.mocked(runnerApi.markRunnerOrderAtShop).mockRejectedValue(new Error("network down"));

    const ctrl = useRunnerCenter();
    await ctrl.loadActive();
    const ok = await ctrl.markAtShop("a1");
    expect(ok).toBe(false);
    expect(ctrl.actionError.value).toBe("network down");
    expect(ctrl.activeOrders.value[0].status).toBe("accepted");
  });
});
