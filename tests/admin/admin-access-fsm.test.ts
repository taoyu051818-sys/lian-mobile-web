import { afterEach, describe, expect, it, vi } from "vitest";
import { ref, watch, type Ref } from "vue";

type AdminLane = "probing" | "session-merchants" | "ops" | "gate" | "probe-error" | "disposed";

interface SafeProbeError extends Error {
  status: number;
  code: string;
  retryAfterSeconds: number | null;
}

interface MerchantEnvelope {
  data: Array<{ id: string }>;
  page: { limit: number; offset: number; total: number };
  meta: { requestId: string; schemaVersion: "v1" };
}

interface UseAdminAccessOptions {
  token: Ref<string>;
  authEpoch: Ref<number>;
  setToken(value: string): void;
  clearToken(): void;
  advanceAuthEpoch(): number;
  probeMerchants(signal: AbortSignal): Promise<MerchantEnvelope>;
  adoptMerchants(value: MerchantEnvelope): void;
  retireMerchants(): void;
  clearMerchants(): void;
  loadReports(): Promise<void>;
}

interface AdminAccessController {
  lane: Ref<AdminLane>;
  reason: Ref<string>;
  probeError: Ref<SafeProbeError | null>;
  retryBlocked: Ref<boolean>;
  initialize(): Promise<void>;
  retryProbe(): Promise<void>;
  submitOpsToken(value: string): Promise<void>;
  loseSessionAuthorization(status: 401 | 403): void;
  exit(): void;
  accountChanged(): void;
  logout(): void;
  dispose(): void;
}

type UseAdminAccess = (options: UseAdminAccessOptions) => AdminAccessController;

async function requireAccess(): Promise<UseAdminAccess> {
  const specifier = new URL("../../src/features/admin/" + "useAdminAccess.ts", import.meta.url)
    .href;
  let loaded: { useAdminAccess?: UseAdminAccess } | undefined;
  let loadError: unknown;
  try {
    loaded = (await import(/* @vite-ignore */ specifier)) as {
      useAdminAccess?: UseAdminAccess;
    };
  } catch (error) {
    loadError = error;
  }
  expect(loadError, "useAdminAccess runtime module must exist").toBeUndefined();
  expect(loaded?.useAdminAccess).toBeTypeOf("function");
  return loaded!.useAdminAccess!;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function validEnvelope(id = "merchant_demo"): MerchantEnvelope {
  return {
    data: [{ id }],
    page: { limit: 20, offset: 0, total: 1 },
    meta: {
      requestId: "3f5a9c26-6571-4d6c-9c70-3517b2a7f4d8",
      schemaVersion: "v1",
    },
  };
}

function safeError(status: number, code: string, retryAfterSeconds: unknown = null) {
  return Object.assign(new Error("fixed safe copy"), { status, code, retryAfterSeconds });
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

interface Harness {
  token: Ref<string>;
  authEpoch: Ref<number>;
  controller: AdminAccessController;
  setToken: ReturnType<typeof vi.fn>;
  clearToken: ReturnType<typeof vi.fn>;
  advanceAuthEpoch: ReturnType<typeof vi.fn>;
  probeMerchants: ReturnType<typeof vi.fn>;
  adoptMerchants: ReturnType<typeof vi.fn>;
  retireMerchants: ReturnType<typeof vi.fn>;
  clearMerchants: ReturnType<typeof vi.fn>;
  loadReports: ReturnType<typeof vi.fn>;
}

async function makeHarness(
  options: { token?: string; probe?: (signal: AbortSignal) => Promise<MerchantEnvelope> } = {},
) {
  const useAdminAccess = await requireAccess();
  const token = ref(options.token ?? "");
  const authEpoch = ref(1);
  const setToken = vi.fn((value: string) => {
    token.value = value.trim();
    authEpoch.value += 1;
  });
  const clearToken = vi.fn(() => {
    token.value = "";
    authEpoch.value += 1;
  });
  const advanceAuthEpoch = vi.fn(() => {
    authEpoch.value += 1;
    return authEpoch.value;
  });
  const probeMerchants = vi.fn((signal: AbortSignal) =>
    options.probe ? options.probe(signal) : Promise.resolve(validEnvelope()),
  );
  const adoptMerchants = vi.fn();
  const retireMerchants = vi.fn();
  const clearMerchants = vi.fn();
  const loadReports = vi.fn(async () => undefined);
  const controller = useAdminAccess({
    token,
    authEpoch,
    setToken,
    clearToken,
    advanceAuthEpoch,
    probeMerchants,
    adoptMerchants,
    retireMerchants,
    clearMerchants,
    loadReports,
  });
  return {
    token,
    authEpoch,
    controller,
    setToken,
    clearToken,
    advanceAuthEpoch,
    probeMerchants,
    adoptMerchants,
    retireMerchants,
    clearMerchants,
    loadReports,
  } satisfies Harness;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("administrator access FSM", () => {
  it("starts synchronously in probing even when an ops token is already stored", async () => {
    const pending = deferred<MerchantEnvelope>();
    const harness = await makeHarness({
      token: "sentinel-ops-token",
      probe: () => pending.promise,
    });

    expect(harness.controller.lane.value).toBe("probing");
    const run = harness.controller.initialize();
    expect(harness.controller.lane.value).toBe("probing");
    expect(harness.loadReports).not.toHaveBeenCalled();
    expect(harness.adoptMerchants).not.toHaveBeenCalled();

    pending.resolve(validEnvelope());
    await run;
  });

  it("registers probe sequence and abort ownership before transport can synchronously reenter", async () => {
    const pending = deferred<MerchantEnvelope>();
    const harness = await makeHarness({
      probe: (signal) => {
        harness.controller.dispose();
        expect(signal.aborted).toBe(true);
        return pending.promise;
      },
    });

    const run = harness.controller.initialize();
    expect(harness.controller.lane.value).toBe("disposed");
    expect(harness.retireMerchants).toHaveBeenCalled();

    pending.resolve(validEnvelope("late-sync-reentry"));
    await run;
    expect(harness.adoptMerchants).not.toHaveBeenCalled();
  });

  it("atomically adopts the first strict queue before establishing session-merchants and retains the sentinel", async () => {
    const harness = await makeHarness({ token: "sentinel-ops-token" });
    harness.adoptMerchants.mockImplementation(() => {
      expect(harness.controller.lane.value).toBe("probing");
      expect(harness.token.value).toBe("sentinel-ops-token");
    });

    await harness.controller.initialize();

    expect(harness.probeMerchants).toHaveBeenCalledTimes(1);
    expect(harness.adoptMerchants).toHaveBeenCalledWith(validEnvelope());
    expect(harness.controller.lane.value).toBe("session-merchants");
    expect(harness.token.value).toBe("sentinel-ops-token");
    expect(harness.clearToken).not.toHaveBeenCalled();
    expect(harness.loadReports).not.toHaveBeenCalled();
  });

  it.each([
    [400, "REQUEST_CONTRACT", "probe-error", false],
    [401, "AUTH_REQUIRED", "gate", false],
    [403, "CAPABILITY_REQUIRED", "gate", false],
    [404, "BFF_NOT_DEPLOYED", "probe-error", false],
    [428, "PREREQUISITE_UNAVAILABLE", "probe-error", false],
    [429, "RATE_LIMITED", "probe-error", true],
    [499, "TEMPORARILY_UNAVAILABLE", "probe-error", false],
    [500, "TEMPORARILY_UNAVAILABLE", "probe-error", false],
    [502, "TEMPORARILY_UNAVAILABLE", "probe-error", false],
    [503, "INTEGRATION_UNAVAILABLE", "probe-error", false],
    [504, "TEMPORARILY_UNAVAILABLE", "probe-error", false],
    [418, "HTTP_FAILURE", "probe-error", false],
    [0, "NETWORK_FAILURE", "probe-error", false],
    [0, "MALFORMED_RESPONSE", "probe-error", false],
  ])(
    "maps initial %i/%s without a token to the exact safe lane",
    async (status, code, expectedLane, boundedCooldown) => {
      const retry = boundedCooldown ? 10 : null;
      const harness = await makeHarness({
        probe: () => Promise.reject(safeError(status, code, retry)),
      });

      await harness.controller.initialize();

      expect(harness.controller.lane.value).toBe(expectedLane);
      expect(harness.controller.reason.value).toBe(code);
      expect(harness.controller.probeError.value).toMatchObject({ status, code });
      expect(harness.controller.retryBlocked.value).toBe(boundedCooldown);
      expect(harness.loadReports).not.toHaveBeenCalled();
    },
  );

  it.each([
    [400, "REQUEST_CONTRACT"],
    [401, "AUTH_REQUIRED"],
    [403, "CAPABILITY_REQUIRED"],
    [404, "BFF_NOT_DEPLOYED"],
    [428, "PREREQUISITE_UNAVAILABLE"],
    [429, "RATE_LIMITED"],
    [499, "TEMPORARILY_UNAVAILABLE"],
    [500, "TEMPORARILY_UNAVAILABLE"],
    [502, "TEMPORARILY_UNAVAILABLE"],
    [503, "INTEGRATION_UNAVAILABLE"],
    [504, "TEMPORARILY_UNAVAILABLE"],
    [418, "HTTP_FAILURE"],
    [0, "NETWORK_FAILURE"],
    [0, "MALFORMED_RESPONSE"],
  ])(
    "falls back to stored-token ops exactly once only after initial %i/%s settles",
    async (status, code) => {
      const pending = deferred<MerchantEnvelope>();
      const harness = await makeHarness({ token: "ops-token", probe: () => pending.promise });
      const run = harness.controller.initialize();

      expect(harness.controller.lane.value).toBe("probing");
      expect(harness.loadReports).not.toHaveBeenCalled();
      pending.reject(safeError(status, code, status === 429 ? 10 : null));
      await run;

      expect(harness.controller.lane.value).toBe("ops");
      expect(harness.loadReports).toHaveBeenCalledTimes(1);
      expect(harness.retireMerchants).toHaveBeenCalled();
      expect(harness.controller.retryBlocked.value).toBe(false);
    },
  );

  it("never treats a locally aborted initial probe as a live 499 or activates stored-token ops", async () => {
    const pending = deferred<MerchantEnvelope>();
    const harness = await makeHarness({ token: "ops-token", probe: () => pending.promise });
    const run = harness.controller.initialize();
    const signal = harness.probeMerchants.mock.calls[0]?.[0] as AbortSignal;

    harness.controller.dispose();
    expect(signal.aborted).toBe(true);
    pending.reject(safeError(499, "TEMPORARILY_UNAVAILABLE"));
    await run;

    expect(harness.controller.lane.value).toBe("disposed");
    expect(harness.loadReports).not.toHaveBeenCalled();
    expect(harness.controller.probeError.value).toBeNull();
  });

  it.each([
    [401, "AUTH_REQUIRED", "gate"],
    [503, "INTEGRATION_UNAVAILABLE", "probe-error"],
  ])(
    "submits one non-empty token intent from %s/%s %s, advances epoch and loads reports once",
    async (status, code, lane) => {
      const harness = await makeHarness({
        probe: () => Promise.reject(safeError(status, code)),
      });
      await harness.controller.initialize();
      expect(harness.controller.lane.value).toBe(lane);
      const beforeEpoch = harness.authEpoch.value;

      await harness.controller.submitOpsToken("   ");
      expect(harness.setToken).not.toHaveBeenCalled();
      expect(harness.loadReports).not.toHaveBeenCalled();
      const first = harness.controller.submitOpsToken("  ops-token  ");
      const duplicate = harness.controller.submitOpsToken("ops-token");
      expect(harness.setToken).toHaveBeenCalledTimes(1);
      expect(harness.setToken).toHaveBeenCalledWith("ops-token");
      expect(harness.authEpoch.value).toBeGreaterThan(beforeEpoch);
      expect(harness.controller.lane.value).toBe("ops");
      expect(harness.loadReports).toHaveBeenCalledTimes(1);

      await Promise.all([first, duplicate]);
      expect(harness.loadReports).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects a stale token handler after retry has moved probe-error back to probing", async () => {
    const retry = deferred<MerchantEnvelope>();
    const responses = [
      () => Promise.reject(safeError(503, "INTEGRATION_UNAVAILABLE")),
      () => retry.promise,
    ];
    const harness = await makeHarness({ probe: () => responses.shift()!() });
    await harness.controller.initialize();
    expect(harness.controller.lane.value).toBe("probe-error");

    const retryRun = harness.controller.retryProbe();
    const signal = harness.probeMerchants.mock.calls[1]?.[0] as AbortSignal;
    expect(harness.controller.lane.value).toBe("probing");
    await harness.controller.submitOpsToken("stale-ops-token");
    expect(harness.setToken).not.toHaveBeenCalled();
    expect(harness.loadReports).not.toHaveBeenCalled();
    expect(signal.aborted).toBe(false);

    retry.resolve(validEnvelope("retry-owner"));
    await retryRun;
    expect(harness.controller.lane.value).toBe("session-merchants");
    expect(harness.loadReports).not.toHaveBeenCalled();
  });

  it("turns a later session 401/403 into one ordered revocation without ops fallback", async () => {
    for (const status of [401, 403] as const) {
      const events: string[] = [];
      const visibleRows = ref(["sensitive-row"]);
      const harness = await makeHarness({ token: "retained-ops-token" });
      await harness.controller.initialize();
      const beforeEpoch = harness.authEpoch.value;
      harness.retireMerchants.mockImplementation(() => {
        events.push("retire");
        expect(harness.controller.lane.value).toBe("session-merchants");
        expect(harness.token.value).toBe("retained-ops-token");
        expect(harness.authEpoch.value).toBe(beforeEpoch);
      });
      harness.clearToken.mockImplementation(() => {
        events.push("clear-token");
        expect(harness.controller.lane.value).toBe("session-merchants");
        harness.token.value = "";
        harness.authEpoch.value += 1;
      });
      harness.clearMerchants.mockImplementation(() => {
        events.push("clear-merchants");
        expect(harness.controller.lane.value).toBe("session-merchants");
        expect(harness.token.value).toBe("");
        expect(harness.authEpoch.value).toBeGreaterThan(beforeEpoch);
        visibleRows.value = [];
      });
      const visibleWrites: string[] = [];
      const stopVisibleWriteAudit = watch(
        [harness.controller.lane, harness.controller.reason],
        ([lane, reason]) => {
          visibleWrites.push(`${lane}:${reason}`);
          expect(harness.authEpoch.value).toBeGreaterThan(beforeEpoch);
          expect(harness.token.value).toBe("");
          expect(visibleRows.value).toEqual([]);
          expect(events).toEqual(["retire", "clear-token", "clear-merchants"]);
        },
        { flush: "sync" },
      );

      harness.controller.loseSessionAuthorization(status);
      stopVisibleWriteAudit();

      expect(events).toEqual(["retire", "clear-token", "clear-merchants"]);
      expect(visibleRows.value).toEqual([]);
      expect(visibleWrites.length).toBeGreaterThan(0);
      expect(harness.authEpoch.value).toBeGreaterThan(beforeEpoch);
      expect(harness.token.value).toBe("");
      expect(harness.controller.lane.value).toBe("gate");
      expect(harness.controller.reason.value).toBe(
        status === 401 ? "AUTH_REQUIRED" : "CAPABILITY_REQUIRED",
      );
      expect(harness.loadReports).not.toHaveBeenCalled();
    }
  });

  it("bounds 429 cooldown to 1-60 seconds, never auto-retries, and clears stale timer ownership", async () => {
    vi.useFakeTimers();
    for (const retryAfterSeconds of [1, 60]) {
      const responses = [
        () => Promise.reject(safeError(429, "RATE_LIMITED", retryAfterSeconds)),
        () => Promise.resolve(validEnvelope("retried")),
      ];
      const harness = await makeHarness({ probe: () => responses.shift()!() });
      await harness.controller.initialize();
      expect(harness.controller.retryBlocked.value).toBe(true);

      await vi.advanceTimersByTimeAsync(retryAfterSeconds * 1_000 - 1);
      await harness.controller.retryProbe();
      expect(harness.probeMerchants).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(harness.probeMerchants).toHaveBeenCalledTimes(1);

      await harness.controller.retryProbe();
      expect(harness.probeMerchants).toHaveBeenCalledTimes(2);
      expect(harness.controller.lane.value).toBe("session-merchants");
      harness.controller.dispose();
    }
  });

  it("disposal clears an active 429 cooldown and makes its pending callback inert", async () => {
    vi.useFakeTimers();
    const harness = await makeHarness({
      probe: () => Promise.reject(safeError(429, "RATE_LIMITED", 60)),
    });
    await harness.controller.initialize();
    expect(harness.controller.retryBlocked.value).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    harness.controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
    expect(harness.controller.retryBlocked.value).toBe(false);
    await vi.runAllTimersAsync();
    expect(harness.probeMerchants).toHaveBeenCalledTimes(1);
    expect(harness.controller.lane.value).toBe("disposed");
  });

  it("a pending probe that rejects 429 after disposal cannot create a cooldown", async () => {
    vi.useFakeTimers();
    const pending = deferred<MerchantEnvelope>();
    const harness = await makeHarness({ probe: () => pending.promise });
    const run = harness.controller.initialize();

    harness.controller.dispose();
    pending.reject(safeError(429, "RATE_LIMITED", 60));
    await run;

    expect(vi.getTimerCount()).toBe(0);
    expect(harness.controller.retryBlocked.value).toBe(false);
    expect(harness.controller.probeError.value).toBeNull();
    expect(harness.controller.lane.value).toBe("disposed");
  });

  it("a pending probe that rejects ordinarily after disposal cannot render an error", async () => {
    const pending = deferred<MerchantEnvelope>();
    const harness = await makeHarness({ probe: () => pending.promise });
    const run = harness.controller.initialize();

    harness.controller.dispose();
    pending.reject(new Error("RAW ordinary late failure must stay private"));
    await run;

    expect(harness.controller.probeError.value).toBeNull();
    expect(harness.controller.retryBlocked.value).toBe(false);
    expect(harness.controller.lane.value).toBe("disposed");
    expect(harness.adoptMerchants).not.toHaveBeenCalled();
    expect(harness.loadReports).not.toHaveBeenCalled();
  });

  it.each(["exit", "accountChanged", "logout"] as const)(
    "%s immediately clears an active probe cooldown and leaves its callback inert",
    async (method) => {
      vi.useFakeTimers();
      const harness = await makeHarness({
        probe: () => Promise.reject(safeError(429, "RATE_LIMITED", 60)),
      });
      await harness.controller.initialize();
      expect(harness.controller.retryBlocked.value).toBe(true);
      expect(vi.getTimerCount()).toBe(1);

      harness.controller[method]();

      expect(vi.getTimerCount()).toBe(0);
      expect(harness.controller.retryBlocked.value).toBe(false);
      await vi.runAllTimersAsync();
      expect(harness.probeMerchants).toHaveBeenCalledTimes(1);
    },
  );

  it("stored-token initial 429 enters ops with no surviving merchants cooldown", async () => {
    vi.useFakeTimers();
    const harness = await makeHarness({
      token: "stored-ops-token",
      probe: () => Promise.reject(safeError(429, "RATE_LIMITED", 60)),
    });

    await harness.controller.initialize();

    expect(harness.controller.lane.value).toBe("ops");
    expect(harness.loadReports).toHaveBeenCalledTimes(1);
    expect(harness.controller.retryBlocked.value).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([undefined, null, 0, -1, 1.5, 61, Number.NaN, "10", true, {}])(
    "creates no cooldown for invalid retryAfterSeconds %s",
    async (retryAfterSeconds) => {
      vi.useFakeTimers();
      const responses = [
        () => Promise.reject(safeError(429, "RATE_LIMITED", retryAfterSeconds)),
        () => Promise.resolve(validEnvelope("retried")),
      ];
      const harness = await makeHarness({ probe: () => responses.shift()!() });
      await harness.controller.initialize();
      expect(harness.controller.retryBlocked.value).toBe(false);
      await harness.controller.retryProbe();
      expect(harness.probeMerchants).toHaveBeenCalledTimes(2);
    },
  );

  it("rejects a probe settlement after an external auth-epoch change", async () => {
    const pending = deferred<MerchantEnvelope>();
    const harness = await makeHarness({ probe: () => pending.promise });
    const run = harness.controller.initialize();
    harness.authEpoch.value += 1;
    pending.resolve(validEnvelope("account-a"));
    await run;

    expect(harness.adoptMerchants).not.toHaveBeenCalled();
    expect(harness.controller.lane.value).toBe("probing");
  });

  it.each(["exit", "accountChanged", "logout", "dispose"] as const)(
    "%s aborts probe work, retires data, clears token and invalidates late settlement",
    async (method) => {
      const pending = deferred<MerchantEnvelope>();
      const harness = await makeHarness({ token: "ops-token", probe: () => pending.promise });
      const run = harness.controller.initialize();
      const signal = harness.probeMerchants.mock.calls[0]?.[0] as AbortSignal;
      const beforeEpoch = harness.authEpoch.value;

      harness.controller[method]();
      expect(signal.aborted).toBe(true);
      expect(harness.retireMerchants).toHaveBeenCalled();
      expect(harness.clearMerchants).toHaveBeenCalled();
      expect(harness.clearToken).toHaveBeenCalled();
      expect(harness.authEpoch.value).toBeGreaterThan(beforeEpoch);

      pending.resolve(validEnvelope("late-account-a"));
      await run;
      await flush();
      expect(harness.adoptMerchants).not.toHaveBeenCalled();
      expect(harness.loadReports).not.toHaveBeenCalled();
      expect(["gate", "probing", "disposed"]).toContain(harness.controller.lane.value);
      if (method === "dispose") expect(harness.controller.lane.value).toBe("disposed");
    },
  );
});
