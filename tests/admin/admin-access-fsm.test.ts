import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import { useAdminAccess } from "../../src/features/admin/useAdminAccess";

function makeAccess(initialToken = "") {
  const token = ref(initialToken);
  let epoch = 0;
  const retireConsole = vi.fn();
  const loadReports = vi.fn().mockResolvedValue(undefined);
  const setToken = vi.fn((value: string) => {
    epoch += 1;
    token.value = value.trim();
  });
  const clearToken = vi.fn(() => {
    epoch += 1;
    token.value = "";
  });
  const advanceAuthEpoch = vi.fn(() => ++epoch);
  const access = useAdminAccess({
    token,
    setToken,
    clearToken,
    advanceAuthEpoch,
    retireConsole,
    loadReports,
  });

  return {
    access,
    token,
    setToken,
    clearToken,
    advanceAuthEpoch,
    retireConsole,
    loadReports,
  };
}

describe("useAdminAccess retired LA boundary", () => {
  it("opens directly on the ops-token gate without probing any session provider", async () => {
    const harness = makeAccess();

    expect(harness.access.lane.value).toBe("gate");
    await harness.access.initialize();

    expect(harness.access.lane.value).toBe("gate");
    expect(harness.loadReports).not.toHaveBeenCalled();
    expect(harness.retireConsole).not.toHaveBeenCalled();
  });

  it("restores a stored explicit ops token and loads reports exactly once", async () => {
    const harness = makeAccess("stored-ops-token");

    expect(harness.access.lane.value).toBe("ops");
    await harness.access.initialize();
    await harness.access.initialize();

    expect(harness.loadReports).toHaveBeenCalledTimes(1);
    expect(harness.setToken).not.toHaveBeenCalled();
    expect(harness.access.lane.value).toBe("ops");
  });

  it("accepts one trimmed legacy token and cannot enter a retired session lane", async () => {
    const harness = makeAccess();

    await harness.access.submitOpsToken("  explicit-ops-token  ");
    await harness.access.submitOpsToken("second-token");

    expect(harness.retireConsole).toHaveBeenCalledTimes(1);
    expect(harness.setToken).toHaveBeenCalledOnce();
    expect(harness.setToken).toHaveBeenCalledWith("explicit-ops-token");
    expect(harness.loadReports).toHaveBeenCalledTimes(1);
    expect(harness.access.lane.value).toBe("ops");
    expect(harness.access.lane.value).not.toBe("session-merchants");
  });

  it("ignores empty token submissions", async () => {
    const harness = makeAccess();

    await harness.access.submitOpsToken("   ");

    expect(harness.setToken).not.toHaveBeenCalled();
    expect(harness.retireConsole).not.toHaveBeenCalled();
    expect(harness.loadReports).not.toHaveBeenCalled();
    expect(harness.access.lane.value).toBe("gate");
  });

  it.each(["exit", "accountChanged", "logout"] as const)(
    "%s retires console ownership before clearing the account token",
    (operation) => {
      const harness = makeAccess("account-a-token");
      const order: string[] = [];
      harness.retireConsole.mockImplementation(() => order.push("retire"));
      harness.advanceAuthEpoch.mockImplementation(() => {
        order.push("epoch");
        return 1;
      });
      harness.clearToken.mockImplementation(() => {
        order.push("clear");
        harness.token.value = "";
      });

      harness.access[operation]();

      expect(order).toEqual(["retire", "epoch", "clear"]);
      expect(harness.access.lane.value).toBe("gate");
      expect(harness.token.value).toBe("");
    },
  );

  it("unmount disposal retires console ownership and makes later actions inert", async () => {
    const harness = makeAccess("account-a-token");

    harness.access.dispose();
    await harness.access.initialize();
    await harness.access.submitOpsToken("account-b-token");
    harness.access.exit();

    expect(harness.access.lane.value).toBe("disposed");
    expect(harness.retireConsole).toHaveBeenCalledTimes(1);
    expect(harness.clearToken).toHaveBeenCalledTimes(1);
    expect(harness.loadReports).not.toHaveBeenCalled();
    expect(harness.setToken).not.toHaveBeenCalled();
  });
});
