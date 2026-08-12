import { afterEach, describe, expect, it, vi } from "vitest";
import { ref, type Ref } from "vue";

interface MerchantQuery {
  limit: number;
  offset: number;
  q?: string;
  status?: "active" | "inactive";
}

interface Merchant {
  id: string;
  code: string;
  displayName: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

interface MerchantEnvelope {
  data: Merchant[];
  page: { limit: number; offset: number; total: number };
  meta: { requestId: string; schemaVersion: "v1" };
}

interface SafeMerchantError extends Error {
  status: number;
  code: string;
  retryAfterSeconds: number | null;
}

interface UseAdminMerchantsOptions {
  authEpoch: Ref<number>;
  isSessionLane(): boolean;
  fetchMerchants(query: MerchantQuery, signal: AbortSignal): Promise<MerchantEnvelope>;
  onAuthorizationLost(status: 401 | 403): void;
}

interface AdminMerchantsController {
  rows: Ref<Merchant[]>;
  page: Ref<{ limit: number; offset: number; total: number }>;
  requestId: Ref<string>;
  loading: Ref<boolean>;
  error: Ref<SafeMerchantError | null>;
  empty: Ref<boolean>;
  draftQ: Ref<string>;
  status: Ref<"all" | "active" | "inactive">;
  canPrevious: Ref<boolean>;
  canNext: Ref<boolean>;
  canRetry: Ref<boolean>;
  retryBlocked: Ref<boolean>;
  adoptInitial(value: MerchantEnvelope): void;
  submitSearch(): Promise<void>;
  selectStatus(value: "all" | "active" | "inactive"): Promise<void>;
  previousPage(): Promise<void>;
  nextPage(): Promise<void>;
  refresh(): Promise<void>;
  retry(): Promise<void>;
  clear(): void;
  dispose(): void;
}

type UseAdminMerchants = (options: UseAdminMerchantsOptions) => AdminMerchantsController;

async function requireMerchants(): Promise<UseAdminMerchants> {
  const specifier = new URL("../../src/features/admin/" + "useAdminMerchants.ts", import.meta.url)
    .href;
  let loaded: { useAdminMerchants?: UseAdminMerchants } | undefined;
  let loadError: unknown;
  try {
    loaded = (await import(/* @vite-ignore */ specifier)) as {
      useAdminMerchants?: UseAdminMerchants;
    };
  } catch (error) {
    loadError = error;
  }
  expect(loadError, "useAdminMerchants runtime module must exist").toBeUndefined();
  expect(loaded?.useAdminMerchants).toBeTypeOf("function");
  return loaded!.useAdminMerchants!;
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

function merchant(id: string): Merchant {
  return {
    id,
    code: `${id}.code`,
    displayName: `<b>${id}</b>`,
    status: "active",
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T01:02:03.004Z",
  };
}

function envelope(
  id = "merchant_demo",
  page: MerchantEnvelope["page"] = { limit: 20, offset: 0, total: 1 },
): MerchantEnvelope {
  return {
    data: id ? [merchant(id)] : [],
    page,
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
  authEpoch: Ref<number>;
  lane: Ref<string>;
  controller: AdminMerchantsController;
  fetchMerchants: ReturnType<typeof vi.fn>;
  onAuthorizationLost: ReturnType<typeof vi.fn>;
}

async function makeHarness(
  implementation: (query: MerchantQuery, signal: AbortSignal) => Promise<MerchantEnvelope> = (
    query,
  ) => Promise.resolve(envelope("merchant_demo", { ...query, total: 1 })),
): Promise<Harness> {
  const useAdminMerchants = await requireMerchants();
  const authEpoch = ref(7);
  const lane = ref("session-merchants");
  const fetchMerchants = vi.fn(implementation);
  const onAuthorizationLost = vi.fn();
  const controller = useAdminMerchants({
    authEpoch,
    isSessionLane: () => lane.value === "session-merchants",
    fetchMerchants,
    onAuthorizationLost,
  });
  return { authEpoch, lane, controller, fetchMerchants, onAuthorizationLost };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("administrator merchants queue state", () => {
  it("adopts the already-proven initial envelope without issuing a duplicate request", async () => {
    const harness = await makeHarness();
    const initial = envelope("first-row");

    harness.controller.adoptInitial(initial);

    expect(harness.fetchMerchants).not.toHaveBeenCalled();
    expect(harness.controller.rows.value).toEqual([merchant("first-row")]);
    expect(harness.controller.rows.value).not.toBe(initial.data);
    expect(harness.controller.page.value).toEqual(initial.page);
    expect(harness.controller.requestId.value).toBe(initial.meta.requestId);
    expect(harness.controller.loading.value).toBe(false);
    expect(harness.controller.empty.value).toBe(false);
  });

  it("renders empty only for an adopted strict zero-row success", async () => {
    const harness = await makeHarness();
    expect(harness.controller.empty.value).toBe(false);
    harness.controller.adoptInitial(envelope("", { limit: 20, offset: 0, total: 0 }));
    expect(harness.controller.empty.value).toBe(true);

    const pending = deferred<MerchantEnvelope>();
    const loading = await makeHarness(() => pending.promise);
    loading.controller.adoptInitial(envelope("old"));
    const run = loading.controller.refresh();
    expect(loading.controller.rows.value).toEqual([]);
    expect(loading.controller.empty.value).toBe(false);
    pending.reject(safeError(503, "INTEGRATION_UNAVAILABLE"));
    await run;
    expect(loading.controller.empty.value).toBe(false);
  });

  it("trims and encodes explicit q submit, resets offset, and fires exactly once", async () => {
    const harness = await makeHarness((query) =>
      Promise.resolve(envelope("search", { ...query, total: 1 })),
    );
    harness.controller.adoptInitial(envelope("page-three", { limit: 20, offset: 40, total: 100 }));
    harness.controller.draftQ.value = "  north & east  ";

    await harness.controller.submitSearch();

    expect(harness.fetchMerchants).toHaveBeenCalledTimes(1);
    expect(harness.fetchMerchants.mock.calls[0]?.[0]).toEqual({
      limit: 20,
      offset: 0,
      q: "north & east",
    });
  });

  it("rejects overlong q locally and omits an empty q without transport drift", async () => {
    const harness = await makeHarness((query) =>
      Promise.resolve(envelope("search", { ...query, total: 1 })),
    );
    harness.controller.draftQ.value = "x".repeat(161);
    await harness.controller.submitSearch();
    expect(harness.fetchMerchants).not.toHaveBeenCalled();
    expect(harness.controller.error.value).toMatchObject({ code: "REQUEST_CONTRACT" });

    harness.controller.draftQ.value = "   ";
    await harness.controller.submitSearch();
    expect(harness.fetchMerchants).toHaveBeenCalledWith(
      { limit: 20, offset: 0 },
      expect.any(AbortSignal),
    );
  });

  it("supports only all/active/inactive, resets offset, and makes current-status selection a no-op", async () => {
    const harness = await makeHarness((query) =>
      Promise.resolve(envelope("status", { ...query, total: 1 })),
    );
    harness.controller.adoptInitial(envelope("page-three", { limit: 20, offset: 40, total: 100 }));

    await harness.controller.selectStatus("all");
    expect(harness.fetchMerchants).not.toHaveBeenCalled();
    await harness.controller.selectStatus("active");
    expect(harness.fetchMerchants.mock.calls[0]?.[0]).toEqual({
      limit: 20,
      offset: 0,
      status: "active",
    });
    await harness.controller.selectStatus("active");
    expect(harness.fetchMerchants).toHaveBeenCalledTimes(1);
    await harness.controller.selectStatus("inactive");
    expect(harness.fetchMerchants.mock.calls[1]?.[0]).toEqual({
      limit: 20,
      offset: 0,
      status: "inactive",
    });
  });

  it("computes previous/next offsets and never serializes a page key", async () => {
    const harness = await makeHarness((query) =>
      Promise.resolve(envelope(`offset-${query.offset}`, { ...query, total: 100 })),
    );
    harness.controller.adoptInitial(envelope("page-two", { limit: 20, offset: 20, total: 100 }));

    expect(harness.controller.canPrevious.value).toBe(true);
    expect(harness.controller.canNext.value).toBe(true);
    await harness.controller.previousPage();
    await harness.controller.nextPage();

    expect(harness.fetchMerchants.mock.calls.map((call) => call[0])).toEqual([
      { limit: 20, offset: 0 },
      { limit: 20, offset: 20 },
    ]);
    expect(JSON.stringify(harness.fetchMerchants.mock.calls)).not.toMatch(/"page"/);
  });

  it("allows offset 999,980 to advance to the inclusive 1,000,000 bound exactly once", async () => {
    const harness = await makeHarness((query) =>
      Promise.resolve(envelope("hard-bound", { ...query, total: 1_000_001 })),
    );
    harness.controller.page.value = { limit: 20, offset: 999_980, total: 1_000_001 };
    harness.controller.rows.value = Array.from({ length: 20 }, (_, index) =>
      merchant(`edge-${index}`),
    );

    expect(harness.controller.canNext.value).toBe(true);
    await harness.controller.nextPage();

    expect(harness.fetchMerchants).toHaveBeenCalledTimes(1);
    expect(harness.fetchMerchants).toHaveBeenCalledWith(
      { limit: 20, offset: 1_000_000 },
      expect.any(AbortSignal),
    );
  });

  it("guards both Next state and handler at total, non-safe, and 1,000,000 hard boundaries", async () => {
    const harness = await makeHarness();
    const cases = [
      { page: { limit: 20, offset: 0, total: 1 }, rows: [merchant("only")] },
      { page: { limit: 20, offset: 1_000_000, total: 2_000_000 }, rows: [] },
      {
        page: { limit: 20, offset: Number.MAX_SAFE_INTEGER, total: Number.MAX_SAFE_INTEGER },
        rows: [],
      },
    ];

    for (const value of cases) {
      harness.controller.page.value = value.page;
      harness.controller.rows.value = value.rows;
      expect(harness.controller.canNext.value).toBe(false);
      await harness.controller.nextPage();
    }
    expect(harness.fetchMerchants).not.toHaveBeenCalled();
  });

  it("retries exactly the frozen failed canonical query", async () => {
    const attempts: MerchantQuery[] = [];
    const harness = await makeHarness((query) => {
      attempts.push({ ...query });
      return attempts.length === 1
        ? Promise.reject(safeError(503, "INTEGRATION_UNAVAILABLE"))
        : Promise.resolve(envelope("retried", { ...query, total: 1 }));
    });
    harness.controller.draftQ.value = "first";
    await harness.controller.submitSearch();
    harness.controller.draftQ.value = "changed after failure";

    await harness.controller.retry();

    expect(attempts).toEqual([
      { limit: 20, offset: 0, q: "first" },
      { limit: 20, offset: 0, q: "first" },
    ]);
    expect(harness.controller.rows.value[0]?.id).toBe("retried");
  });

  it("physically aborts the predecessor and gives latest success/error/finally sole ownership", async () => {
    const first = deferred<MerchantEnvelope>();
    const second = deferred<MerchantEnvelope>();
    const harness = await makeHarness(
      vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),
    );
    harness.controller.draftQ.value = "first";
    const firstRun = harness.controller.submitSearch();
    const firstSignal = harness.fetchMerchants.mock.calls[0]?.[1] as AbortSignal;
    harness.controller.draftQ.value = "second";
    const secondRun = harness.controller.submitSearch();
    const secondSignal = harness.fetchMerchants.mock.calls[1]?.[1] as AbortSignal;

    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);
    first.resolve(envelope("stale-first"));
    await firstRun;
    expect(harness.controller.loading.value).toBe(true);
    expect(harness.controller.rows.value).toEqual([]);

    second.resolve(envelope("current-second"));
    await secondRun;
    expect(harness.controller.loading.value).toBe(false);
    expect(harness.controller.rows.value[0]?.id).toBe("current-second");
    expect(harness.controller.error.value).toBeNull();
  });

  it("registers merchants sequence and AbortController before transport can synchronously reenter", async () => {
    const outer = deferred<MerchantEnvelope>();
    const inner = deferred<MerchantEnvelope>();
    let innerRun!: Promise<void>;
    let transportCalls = 0;
    const harness = await makeHarness(() => {
      transportCalls += 1;
      if (transportCalls === 1) {
        innerRun = harness.controller.refresh();
        return outer.promise;
      }
      return inner.promise;
    });
    harness.controller.adoptInitial(envelope("initial"));

    const outerRun = harness.controller.refresh();
    expect(harness.fetchMerchants).toHaveBeenCalledTimes(2);
    const outerSignal = harness.fetchMerchants.mock.calls[0]?.[1] as AbortSignal;
    const innerSignal = harness.fetchMerchants.mock.calls[1]?.[1] as AbortSignal;
    expect(outerSignal.aborted).toBe(true);
    expect(innerSignal.aborted).toBe(false);

    outer.resolve(envelope("stale-outer"));
    await outerRun;
    expect(harness.controller.rows.value).toEqual([]);
    expect(harness.controller.loading.value).toBe(true);

    inner.resolve(envelope("sync-inner"));
    await innerRun;
    expect(harness.controller.rows.value[0]?.id).toBe("sync-inner");
    expect(harness.controller.loading.value).toBe(false);
  });

  it("rejects stale failure and auth loss after a newer request owns the queue", async () => {
    const first = deferred<MerchantEnvelope>();
    const second = deferred<MerchantEnvelope>();
    const harness = await makeHarness(
      vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),
    );
    const firstRun = harness.controller.refresh();
    const secondRun = harness.controller.refresh();
    first.reject(safeError(401, "AUTH_REQUIRED"));
    await firstRun;
    expect(harness.onAuthorizationLost).not.toHaveBeenCalled();
    expect(harness.controller.loading.value).toBe(true);

    second.resolve(envelope("current"));
    await secondRun;
    expect(harness.controller.rows.value[0]?.id).toBe("current");
  });

  it("silently rejects an ordinary predecessor failure after a newer merchants owner is admitted", async () => {
    const first = deferred<MerchantEnvelope>();
    const second = deferred<MerchantEnvelope>();
    const harness = await makeHarness(
      vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),
    );
    const firstRun = harness.controller.refresh();
    const secondRun = harness.controller.refresh();

    first.reject(new Error("RAW superseded merchants failure must stay private"));
    await firstRun;
    expect(harness.controller.error.value).toBeNull();
    expect(harness.controller.rows.value).toEqual([]);
    expect(harness.controller.loading.value).toBe(true);
    expect(harness.onAuthorizationLost).not.toHaveBeenCalled();

    second.resolve(envelope("current-after-ordinary-failure"));
    await secondRun;
    expect(harness.controller.rows.value[0]?.id).toBe("current-after-ordinary-failure");
    expect(harness.controller.error.value).toBeNull();
    expect(harness.controller.loading.value).toBe(false);
  });

  it("rejects account-A settlement after auth epoch/lane changes and never flashes old rows", async () => {
    const pending = deferred<MerchantEnvelope>();
    const harness = await makeHarness(() => pending.promise);
    harness.controller.adoptInitial(envelope("old-row"));
    const run = harness.controller.refresh();
    expect(harness.controller.rows.value).toEqual([]);

    harness.authEpoch.value += 1;
    harness.lane.value = "gate";
    pending.resolve(envelope("account-a-late"));
    await run;
    expect(harness.controller.rows.value).toEqual([]);
    expect(harness.controller.empty.value).toBe(false);
  });

  it.each([
    [400, "REQUEST_CONTRACT", false],
    [404, "BFF_NOT_DEPLOYED", false],
    [428, "PREREQUISITE_UNAVAILABLE", false],
    [429, "RATE_LIMITED", true],
    [499, "TEMPORARILY_UNAVAILABLE", true],
    [500, "TEMPORARILY_UNAVAILABLE", true],
    [502, "TEMPORARILY_UNAVAILABLE", true],
    [503, "INTEGRATION_UNAVAILABLE", true],
    [504, "TEMPORARILY_UNAVAILABLE", true],
    [418, "HTTP_FAILURE", true],
    [0, "NETWORK_FAILURE", true],
    [0, "MALFORMED_RESPONSE", true],
  ])("keeps later %i/%s in merchants with fixed retry policy", async (status, code, canRetry) => {
    const harness = await makeHarness(() => Promise.reject(safeError(status, code)));
    harness.controller.adoptInitial(envelope("stale-row"));

    await harness.controller.refresh();

    expect(harness.lane.value).toBe("session-merchants");
    expect(harness.controller.rows.value).toEqual([]);
    expect(harness.controller.error.value).toMatchObject({ status, code });
    expect(harness.controller.canRetry.value).toBe(canRetry);
    expect(harness.onAuthorizationLost).not.toHaveBeenCalled();
  });

  it.each([401, 403] as const)(
    "retires later %i before authorization loss and never falls back to ops",
    async (status) => {
      const harness = await makeHarness(() =>
        Promise.reject(safeError(status, status === 401 ? "AUTH_REQUIRED" : "CAPABILITY_REQUIRED")),
      );
      harness.controller.adoptInitial(envelope("sensitive-row"));
      harness.controller.draftQ.value = "retained-filter";
      harness.controller.status.value = "inactive";
      let authorizationSnapshot:
        | {
            rows: Merchant[];
            loading: boolean;
            signalAborted: boolean;
            draftQ: string;
            status: "all" | "active" | "inactive";
          }
        | undefined;
      harness.onAuthorizationLost.mockImplementation(() => {
        const signal = harness.fetchMerchants.mock.calls[0]?.[1] as AbortSignal;
        authorizationSnapshot = {
          rows: [...harness.controller.rows.value],
          loading: harness.controller.loading.value,
          signalAborted: signal.aborted,
          draftQ: harness.controller.draftQ.value,
          status: harness.controller.status.value,
        };
        harness.controller.clear();
      });

      const run = harness.controller.refresh();
      expect(harness.controller.rows.value).toEqual([]);
      // Admission intentionally clears visible rows. Reinsert an in-memory
      // sentinel after admission so this oracle isolates authorization-loss
      // ordering from the independent load-start behavior.
      harness.controller.rows.value = [merchant("authorization-order-sentinel")];
      await run;

      expect(harness.onAuthorizationLost).toHaveBeenCalledTimes(1);
      expect(harness.onAuthorizationLost).toHaveBeenCalledWith(status);
      expect(authorizationSnapshot).toEqual({
        rows: [merchant("authorization-order-sentinel")],
        loading: false,
        signalAborted: true,
        draftQ: "retained-filter",
        status: "inactive",
      });
      expect(harness.controller.rows.value).toEqual([]);
      expect(harness.controller.loading.value).toBe(false);
      expect(harness.controller.draftQ.value).toBe("");
      expect(harness.controller.status.value).toBe("all");
      expect(harness.controller.error.value).toBeNull();
    },
  );

  it("owns bounded 429 timers by request sequence and never auto-retries", async () => {
    vi.useFakeTimers();
    for (const seconds of [1, 60]) {
      const attempts = [
        () => Promise.reject(safeError(429, "RATE_LIMITED", seconds)),
        () => Promise.resolve(envelope("manual-retry")),
      ];
      const harness = await makeHarness(() => attempts.shift()!());
      await harness.controller.refresh();
      expect(harness.controller.retryBlocked.value).toBe(true);
      expect(harness.controller.canRetry.value).toBe(false);

      await vi.advanceTimersByTimeAsync(seconds * 1_000);
      expect(harness.fetchMerchants).toHaveBeenCalledTimes(1);
      expect(harness.controller.retryBlocked.value).toBe(false);
      await harness.controller.retry();
      expect(harness.fetchMerchants).toHaveBeenCalledTimes(2);
      harness.controller.dispose();
    }
  });

  it.each([undefined, null, 0, -1, 1.5, 61, Number.NaN, "10", true, {}])(
    "creates no merchants timer for invalid retryAfterSeconds %s",
    async (seconds) => {
      vi.useFakeTimers();
      const harness = await makeHarness(() =>
        Promise.reject(safeError(429, "RATE_LIMITED", seconds)),
      );
      await harness.controller.refresh();
      expect(harness.controller.retryBlocked.value).toBe(false);
      expect(harness.controller.canRetry.value).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("clears cooldown ownership on new intent and makes stale timer callbacks no-ops", async () => {
    vi.useFakeTimers();
    const attempts = [
      () => Promise.reject(safeError(429, "RATE_LIMITED", 60)),
      () => Promise.resolve(envelope("new-intent")),
    ];
    const harness = await makeHarness(() => attempts.shift()!());
    await harness.controller.refresh();
    expect(vi.getTimerCount()).toBe(1);

    harness.controller.draftQ.value = "new";
    await harness.controller.submitSearch();
    expect(vi.getTimerCount()).toBe(0);
    await vi.runAllTimersAsync();
    expect(harness.controller.rows.value[0]?.id).toBe("new-intent");
    expect(harness.fetchMerchants).toHaveBeenCalledTimes(2);
  });

  it("a lane/epoch retirement clear removes cooldown ownership without an automatic retry", async () => {
    vi.useFakeTimers();
    const harness = await makeHarness(() => Promise.reject(safeError(429, "RATE_LIMITED", 60)));
    await harness.controller.refresh();
    expect(vi.getTimerCount()).toBe(1);

    harness.lane.value = "gate";
    harness.authEpoch.value += 1;
    harness.controller.clear();
    expect(vi.getTimerCount()).toBe(0);
    expect(harness.controller.retryBlocked.value).toBe(false);
    await vi.runAllTimersAsync();
    expect(harness.fetchMerchants).toHaveBeenCalledTimes(1);
  });

  it("disposal clears an active merchants 429 cooldown and leaves its callback inert", async () => {
    vi.useFakeTimers();
    const harness = await makeHarness(() => Promise.reject(safeError(429, "RATE_LIMITED", 60)));
    await harness.controller.refresh();
    expect(harness.controller.retryBlocked.value).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    harness.controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
    expect(harness.controller.retryBlocked.value).toBe(false);
    await vi.runAllTimersAsync();
    expect(harness.fetchMerchants).toHaveBeenCalledTimes(1);
  });

  it("a merchants request that rejects 429 after disposal cannot create a timer or error", async () => {
    vi.useFakeTimers();
    const pending = deferred<MerchantEnvelope>();
    const harness = await makeHarness(() => pending.promise);
    const run = harness.controller.refresh();

    harness.controller.dispose();
    pending.reject(safeError(429, "RATE_LIMITED", 60));
    await run;

    expect(vi.getTimerCount()).toBe(0);
    expect(harness.controller.retryBlocked.value).toBe(false);
    expect(harness.controller.error.value).toBeNull();
  });

  it("a merchants request that rejects ordinarily after disposal cannot render late state", async () => {
    const pending = deferred<MerchantEnvelope>();
    const harness = await makeHarness(() => pending.promise);
    harness.controller.adoptInitial(envelope("sensitive-row"));
    const run = harness.controller.refresh();

    harness.controller.dispose();
    pending.reject(new Error("RAW ordinary late merchants failure must stay private"));
    await run;

    expect(harness.controller.rows.value).toEqual([]);
    expect(harness.controller.requestId.value).toBe("");
    expect(harness.controller.loading.value).toBe(false);
    expect(harness.controller.error.value).toBeNull();
    expect(harness.controller.retryBlocked.value).toBe(false);
    expect(harness.onAuthorizationLost).not.toHaveBeenCalled();
  });

  it.each(["clear", "dispose"] as const)(
    "%s aborts transport, clears timer/data, and rejects every late commit",
    async (method) => {
      vi.useFakeTimers();
      const pending = deferred<MerchantEnvelope>();
      const harness = await makeHarness(() => pending.promise);
      harness.controller.adoptInitial(envelope("account-a"));
      const run = harness.controller.refresh();
      const signal = harness.fetchMerchants.mock.calls[0]?.[1] as AbortSignal;

      harness.controller[method]();
      expect(signal.aborted).toBe(true);
      expect(harness.controller.rows.value).toEqual([]);
      expect(harness.controller.requestId.value).toBe("");
      expect(harness.controller.loading.value).toBe(false);
      expect(vi.getTimerCount()).toBe(0);

      pending.resolve(envelope("late"));
      await run;
      await flush();
      expect(harness.controller.rows.value).toEqual([]);
    },
  );
});
