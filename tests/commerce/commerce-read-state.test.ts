import { afterEach, describe, expect, it, vi } from "vitest";
import { CommerceApiError } from "../../src/api/commerce";
import {
  useCommerceStoreRead,
  type CommerceReadTransport,
} from "../../src/features/commerce/useCommerceStoreRead";
import type { CommerceStore, CommerceStoreListResult } from "../../src/types/commerce";

const REQUEST_ID = "0f47a18d-3b6c-4c8a-9cf1-1a2b3c4d5e6f";

function store(id = "1"): CommerceStore {
  return {
    id,
    name: `店铺 ${id}`,
    summary: "",
    areaLabel: "",
    logoAssetRef: null,
    ratings: { description: "0", service: "0", logistics: "0" },
    salesCount: 0,
    favoriteCount: 0,
    recommended: false,
  };
}

function listResult(items: CommerceStore[]): CommerceStoreListResult {
  return {
    items,
    page: { page: 1, pageSize: 20, total: items.length, hasMore: false },
    meta: { requestId: REQUEST_ID, schemaVersion: "1.0.0" },
  };
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function transport(overrides: Partial<CommerceReadTransport> = {}): CommerceReadTransport {
  return {
    list: vi.fn().mockResolvedValue(listResult([store()])),
    detail: vi.fn().mockImplementation(async (id: string) => ({ store: store(id) })),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("commerce read-state ownership", () => {
  it("closes locally when the flag is off and never touches the transport", async () => {
    const port = transport();
    const reader = useCommerceStoreRead(port, { visible: () => false });

    await reader.loadRoute({ name: "catalog" });

    expect(reader.status.value).toBe("closed");
    expect(port.list).not.toHaveBeenCalled();
    expect(port.detail).not.toHaveBeenCalled();
  });

  it("presents an invalid raw route as not-found with zero commerce requests", async () => {
    const port = transport();
    const reader = useCommerceStoreRead(port, { visible: () => true });

    await reader.loadRoute(null);

    expect(reader.status.value).toBe("not-found");
    expect(port.list).not.toHaveBeenCalled();
    expect(port.detail).not.toHaveBeenCalled();
  });

  it("publishes ready, empty, and detail states from the route-specific operation", async () => {
    const port = transport();
    const reader = useCommerceStoreRead(port, { visible: () => true });

    await reader.loadRoute({ name: "catalog" });
    expect(reader.status.value).toBe("ready");
    expect(reader.items.value.map((item) => item.id)).toEqual(["1"]);

    vi.mocked(port.list).mockResolvedValueOnce(listResult([]));
    await reader.loadRoute({ name: "catalog" });
    expect(reader.status.value).toBe("empty");
    expect(reader.items.value).toEqual([]);

    await reader.loadRoute({ name: "store", storeId: "2" });
    expect(reader.status.value).toBe("ready");
    expect(reader.store.value?.id).toBe("2");
  });

  it("aborts and rejects late directory data after navigation to detail", async () => {
    const lateList = deferred<CommerceStoreListResult>();
    const listSignals: AbortSignal[] = [];
    const port = transport({
      list: vi.fn().mockImplementation((signal: AbortSignal) => {
        listSignals.push(signal);
        return lateList.promise;
      }),
    });
    const reader = useCommerceStoreRead(port, { visible: () => true });

    const first = reader.loadRoute({ name: "catalog" });
    expect(reader.status.value).toBe("loading");
    await reader.loadRoute({ name: "store", storeId: "2" });

    expect(listSignals[0]?.aborted).toBe(true);
    expect(reader.store.value?.id).toBe("2");
    lateList.resolve(listResult([store("99")]));
    await first;
    expect(reader.status.value).toBe("ready");
    expect(reader.store.value?.id).toBe("2");
    expect(reader.items.value).toEqual([]);
  });

  it("makes an explicit retry a new generation even when the route key is unchanged", async () => {
    const first = deferred<CommerceStoreListResult>();
    const second = deferred<CommerceStoreListResult>();
    const signals: AbortSignal[] = [];
    const port = transport({
      list: vi
        .fn()
        .mockImplementationOnce((signal: AbortSignal) => {
          signals.push(signal);
          return first.promise;
        })
        .mockImplementationOnce((signal: AbortSignal) => {
          signals.push(signal);
          return second.promise;
        }),
    });
    const reader = useCommerceStoreRead(port, { visible: () => true });

    const initialGeneration = reader.generation.value;
    const firstLoad = reader.loadRoute({ name: "catalog" });
    const retryLoad = reader.retry();

    expect(reader.generation.value).toBe(initialGeneration + 2);
    expect(signals[0]?.aborted).toBe(true);
    expect(port.list).toHaveBeenCalledTimes(2);

    second.resolve(listResult([store("2")]));
    await retryLoad;
    first.resolve(listResult([store("1")]));
    await firstLoad;
    expect(reader.items.value.map((item) => item.id)).toEqual(["2"]);
  });

  it("lets back navigation own the catalog and permanently stales late detail work", async () => {
    const lateDetail = deferred<{ store: CommerceStore }>();
    const detailSignals: AbortSignal[] = [];
    const port = transport({
      detail: vi.fn().mockImplementation((_id: string, signal: AbortSignal) => {
        detailSignals.push(signal);
        return lateDetail.promise;
      }),
    });
    const reader = useCommerceStoreRead(port, { visible: () => true });

    const detailLoad = reader.loadRoute({ name: "store", storeId: "1" });
    await reader.loadRoute({ name: "catalog" });
    expect(detailSignals[0]?.aborted).toBe(true);
    expect(reader.items.value.map((item) => item.id)).toEqual(["1"]);

    lateDetail.resolve({ store: store("1") });
    await detailLoad;
    expect(reader.activeRoute.value).toEqual({ name: "catalog" });
    expect(reader.store.value).toBeNull();
    expect(reader.items.value.map((item) => item.id)).toEqual(["1"]);
  });

  it.each([
    ["not-found", "not-found", "generic"],
    ["rate-limited", "error", "rate-limited"],
    ["network", "error", "generic"],
    ["malformed", "error", "malformed"],
    ["unavailable", "error", "generic"],
  ] as const)("projects %s without rendering upstream prose", async (kind, status, errorKind) => {
    const port = transport({
      detail: vi.fn().mockRejectedValue(new CommerceApiError(kind, "raw upstream secret")),
    });
    const reader = useCommerceStoreRead(port, { visible: () => true });

    await reader.loadRoute({ name: "store", storeId: "1" });

    expect(reader.status.value).toBe(status);
    expect(reader.errorKind.value).toBe(errorKind);
    expect(reader.store.value).toBeNull();
  });

  it("turns the owned 12-second abort into timeout and clears work on disposal", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const port = transport({
      list: vi.fn().mockImplementation((signal: AbortSignal) => {
        signals.push(signal);
        return new Promise<CommerceStoreListResult>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new CommerceApiError("aborted", "transport aborted")),
            { once: true },
          );
        });
      }),
    });
    const reader = useCommerceStoreRead(port, { visible: () => true });

    const load = reader.loadRoute({ name: "catalog" });
    await vi.advanceTimersByTimeAsync(11_999);
    expect(reader.status.value).toBe("loading");
    await vi.advanceTimersByTimeAsync(1);
    await load;
    expect(signals[0]?.aborted).toBe(true);
    expect(reader.status.value).toBe("error");
    expect(reader.errorKind.value).toBe("timeout");

    reader.dispose();
    expect(reader.status.value).toBe("idle");
    expect(reader.activeRoute.value).toBeNull();
    expect(reader.items.value).toEqual([]);
  });

  it("aborts pending work on unmount and late settlement cannot leave idle", async () => {
    const pending = deferred<CommerceStoreListResult>();
    const signals: AbortSignal[] = [];
    const port = transport({
      list: vi.fn().mockImplementation((signal: AbortSignal) => {
        signals.push(signal);
        return pending.promise;
      }),
    });
    const reader = useCommerceStoreRead(port, { visible: () => true });

    const load = reader.loadRoute({ name: "catalog" });
    expect(reader.status.value).toBe("loading");
    reader.dispose();
    expect(signals[0]?.aborted).toBe(true);
    expect(reader.status.value).toBe("idle");

    pending.resolve(listResult([store("99")]));
    await load;
    expect(reader.status.value).toBe("idle");
    expect(reader.activeRoute.value).toBeNull();
    expect(reader.items.value).toEqual([]);
    expect(reader.store.value).toBeNull();
  });
});
