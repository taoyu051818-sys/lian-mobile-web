import { afterEach, describe, expect, it, vi } from "vitest";
import { CommerceApiError } from "../../src/api/commerce";
import {
  isCommerceProductVisible,
  useCommerceProductRead,
  type CommerceProductReadTransport,
} from "../../src/features/commerce/useCommerceProductRead";
import {
  useCommerceStoreRead,
  type CommerceReadTransport,
} from "../../src/features/commerce/useCommerceStoreRead";
import type {
  CommerceProduct,
  CommerceProductDetailResult,
  CommerceProductListResult,
  CommerceProductSummary,
} from "../../src/types/commerce";

const REQUEST_ID = "0f47a18d-3b6c-4c8a-9cf1-1a2b3c4d5e6f";

function summary(id = "1", storeId = "1"): CommerceProductSummary {
  return {
    id,
    storeId,
    name: `商品 ${id}`,
    subtitle: "",
    coverAssetRef: null,
    priceRange: { currency: "CNY", minAmountMinor: 100, maxAmountMinor: 100 },
    availability: "available",
    rating: "0",
    salesCount: 0,
    recommended: false,
  };
}

function product(id = "1", storeId = "1"): CommerceProduct {
  return {
    ...summary(id, storeId),
    skus: [
      {
        id: "1",
        name: "",
        price: { currency: "CNY", amountMinor: 100 },
        availability: "available",
        default: true,
      },
    ],
  };
}

function listResult(
  items: CommerceProductSummary[],
  page: CommerceProductListResult["page"] = {
    page: 1,
    pageSize: 20,
    total: items.length,
    hasMore: false,
  },
): CommerceProductListResult {
  return { items, page, meta: { requestId: REQUEST_ID, schemaVersion: "1.0.0" } };
}

function detailResult(id = "1", storeId = "1"): CommerceProductDetailResult {
  return {
    product: product(id, storeId),
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

function transport(
  overrides: Partial<CommerceProductReadTransport> = {},
): CommerceProductReadTransport {
  return {
    list: vi
      .fn()
      .mockImplementation(async (storeId: string) => listResult([summary("1", storeId)])),
    detail: vi.fn().mockImplementation(async (productId: string) => detailResult(productId)),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("commerce product visibility", () => {
  it.each([
    ["false", "false", false],
    ["true", "false", false],
    ["false", "true", false],
    ["true", "true", true],
    ["TRUE", "true", false],
  ] as const)("requires catalog=%s and product=%s", (catalog, productFlag, expected) => {
    vi.stubEnv("VITE_COMMERCE_CATALOG_VISIBLE", catalog);
    vi.stubEnv("VITE_COMMERCE_PRODUCT_VISIBLE", productFlag);
    expect(isCommerceProductVisible()).toBe(expected);
  });
});

describe("commerce product read-state ownership", () => {
  it("cannot be mistaken for a store-detail operation by the existing store owner", async () => {
    const storeTransport: CommerceReadTransport = {
      list: vi.fn(),
      detail: vi.fn(),
    };
    const storeReader = useCommerceStoreRead(storeTransport, { visible: () => true });

    await storeReader.loadRoute({ name: "product", productId: "1" });

    expect(storeReader.status.value).toBe("not-found");
    expect(storeTransport.list).not.toHaveBeenCalled();
    expect(storeTransport.detail).not.toHaveBeenCalled();
  });

  it("closes both targets locally when visibility is off and performs zero requests", async () => {
    const port = transport();
    const reader = useCommerceProductRead(port, { visible: () => false });

    await reader.loadTarget({ name: "store-products", storeId: "1" });
    expect(reader.status.value).toBe("closed");
    await reader.loadTarget({ name: "product", productId: "1" });
    expect(reader.status.value).toBe("closed");
    expect(port.list).not.toHaveBeenCalled();
    expect(port.detail).not.toHaveBeenCalled();
  });

  it("rejects missing or non-canonical targets before transport", async () => {
    const port = transport();
    const reader = useCommerceProductRead(port, { visible: () => true });

    await reader.loadTarget(null);
    expect(reader.status.value).toBe("not-found");
    await reader.loadTarget({ name: "store-products", storeId: "01" });
    await reader.loadTarget({ name: "product", productId: "2147483648" });
    expect(port.list).not.toHaveBeenCalled();
    expect(port.detail).not.toHaveBeenCalled();
  });

  it("publishes list page, empty hasMore page, and product detail from exact targets", async () => {
    const port = transport();
    const reader = useCommerceProductRead(port, { visible: () => true });

    await reader.loadTarget({ name: "store-products", storeId: "2" });
    expect(reader.status.value).toBe("ready");
    expect(reader.items.value[0]).toMatchObject({ id: "1", storeId: "2" });
    expect(reader.page.value).toMatchObject({ page: 1, pageSize: 20, hasMore: false });

    vi.mocked(port.list).mockResolvedValueOnce(
      listResult([], { page: 1, pageSize: 20, total: 21, hasMore: true }),
    );
    await reader.loadTarget({ name: "store-products", storeId: "2" });
    expect(reader.status.value).toBe("empty");
    expect(reader.items.value).toEqual([]);
    expect(reader.page.value).toMatchObject({ total: 21, hasMore: true });

    await reader.loadTarget({ name: "product", productId: "10" });
    expect(reader.status.value).toBe("ready");
    expect(reader.product.value?.id).toBe("10");
    expect(reader.items.value).toEqual([]);
    expect(reader.page.value).toBeNull();
  });

  it("aborts a prior store target and rejects its late settlement after an ID change", async () => {
    const first = deferred<CommerceProductListResult>();
    const signals: AbortSignal[] = [];
    const port = transport({
      list: vi
        .fn()
        .mockImplementationOnce((_storeId: string, signal: AbortSignal) => {
          signals.push(signal);
          return first.promise;
        })
        .mockResolvedValueOnce(listResult([summary("2", "2")])),
    });
    const reader = useCommerceProductRead(port, { visible: () => true });

    const firstLoad = reader.loadTarget({ name: "store-products", storeId: "1" });
    await reader.loadTarget({ name: "store-products", storeId: "2" });
    expect(signals[0]?.aborted).toBe(true);
    first.resolve(listResult([summary("99", "1")]));
    await firstLoad;

    expect(reader.activeTarget.value).toEqual({ name: "store-products", storeId: "2" });
    expect(reader.items.value.map((item) => item.id)).toEqual(["2"]);
  });

  it("switches list/detail ownership and lets back navigation permanently stale detail", async () => {
    const lateDetail = deferred<CommerceProductDetailResult>();
    const signals: AbortSignal[] = [];
    const port = transport({
      detail: vi.fn().mockImplementation((_productId: string, signal: AbortSignal) => {
        signals.push(signal);
        return lateDetail.promise;
      }),
    });
    const reader = useCommerceProductRead(port, { visible: () => true });

    const detailLoad = reader.loadTarget({ name: "product", productId: "1" });
    await reader.loadTarget({ name: "store-products", storeId: "2" });
    expect(signals[0]?.aborted).toBe(true);
    expect(reader.items.value[0]?.storeId).toBe("2");

    lateDetail.resolve(detailResult("1"));
    await detailLoad;
    expect(reader.activeTarget.value).toEqual({ name: "store-products", storeId: "2" });
    expect(reader.product.value).toBeNull();
  });

  it("makes explicit retry a new generation for the same exact target", async () => {
    const first = deferred<CommerceProductDetailResult>();
    const second = deferred<CommerceProductDetailResult>();
    const signals: AbortSignal[] = [];
    const port = transport({
      detail: vi
        .fn()
        .mockImplementationOnce((_id: string, signal: AbortSignal) => {
          signals.push(signal);
          return first.promise;
        })
        .mockImplementationOnce((_id: string, signal: AbortSignal) => {
          signals.push(signal);
          return second.promise;
        }),
    });
    const reader = useCommerceProductRead(port, { visible: () => true });

    const initialGeneration = reader.generation.value;
    const firstLoad = reader.loadTarget({ name: "product", productId: "1" });
    const retryLoad = reader.retry();
    expect(reader.generation.value).toBe(initialGeneration + 2);
    expect(signals[0]?.aborted).toBe(true);

    second.resolve(detailResult("1", "2"));
    await retryLoad;
    first.resolve(detailResult("1", "99"));
    await firstLoad;
    expect(reader.product.value?.storeId).toBe("2");
  });

  it.each([
    ["not-found", "not-found", "generic"],
    ["rate-limited", "error", "rate-limited"],
    ["timeout", "error", "timeout"],
    ["network", "error", "generic"],
    ["malformed", "error", "malformed"],
    ["unavailable", "error", "generic"],
  ] as const)("projects %s without rendering transport prose", async (kind, status, errorKind) => {
    const port = transport({
      list: vi.fn().mockRejectedValue(new CommerceApiError(kind, "raw upstream secret")),
    });
    const reader = useCommerceProductRead(port, { visible: () => true });

    await reader.loadTarget({ name: "store-products", storeId: "1" });

    expect(reader.status.value).toBe(status);
    expect(reader.errorKind.value).toBe(errorKind);
    expect(reader.items.value).toEqual([]);
    expect(reader.page.value).toBeNull();
  });

  it("turns its owned 12-second abort into timeout", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const port = transport({
      detail: vi.fn().mockImplementation((_id: string, signal: AbortSignal) => {
        signals.push(signal);
        return new Promise<CommerceProductDetailResult>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new CommerceApiError("aborted", "transport aborted")),
            { once: true },
          );
        });
      }),
    });
    const reader = useCommerceProductRead(port, { visible: () => true });

    const load = reader.loadTarget({ name: "product", productId: "1" });
    await vi.advanceTimersByTimeAsync(11_999);
    expect(reader.status.value).toBe("loading");
    await vi.advanceTimersByTimeAsync(1);
    await load;
    expect(signals[0]?.aborted).toBe(true);
    expect(reader.status.value).toBe("error");
    expect(reader.errorKind.value).toBe("timeout");
  });

  it("publishes timeout immediately and never adopts a transport that ignores abort", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const port = transport({
      detail: vi.fn().mockImplementation((_id: string, signal: AbortSignal) => {
        signals.push(signal);
        return new Promise<CommerceProductDetailResult>((resolve) => {
          setTimeout(() => resolve(detailResult("1", "99")), 20);
        });
      }),
    });
    const reader = useCommerceProductRead(port, { visible: () => true, timeoutMs: 1 });

    const load = reader.loadTarget({ name: "product", productId: "1" });
    await vi.advanceTimersByTimeAsync(1);
    expect(signals[0]?.aborted).toBe(true);
    expect(reader.status.value).toBe("error");
    expect(reader.errorKind.value).toBe("timeout");
    expect(reader.product.value).toBeNull();

    await vi.advanceTimersByTimeAsync(19);
    await load;
    expect(reader.status.value).toBe("error");
    expect(reader.errorKind.value).toBe("timeout");
    expect(reader.product.value).toBeNull();
  });

  it("disposal aborts pending work, clears every DTO, and permanently stales settlement", async () => {
    const pending = deferred<CommerceProductListResult>();
    const signals: AbortSignal[] = [];
    const port = transport({
      list: vi.fn().mockImplementation((_storeId: string, signal: AbortSignal) => {
        signals.push(signal);
        return pending.promise;
      }),
    });
    const reader = useCommerceProductRead(port, { visible: () => true });

    const load = reader.loadTarget({ name: "store-products", storeId: "1" });
    reader.dispose();
    expect(signals[0]?.aborted).toBe(true);
    expect(reader.status.value).toBe("idle");
    expect(reader.activeTarget.value).toBeNull();

    pending.resolve(listResult([summary("99")]));
    await load;
    expect(reader.status.value).toBe("idle");
    expect(reader.items.value).toEqual([]);
    expect(reader.page.value).toBeNull();
    expect(reader.product.value).toBeNull();
  });
});
