import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CommerceApiError,
  decodeCommerceProduct,
  decodeCommerceProductDetail,
  decodeCommerceProductList,
  decodeCommerceProductSummary,
  fetchCommerceProductDetail,
  fetchCommerceStoreProducts,
} from "../../src/api/commerce";
import { formatCommercePrice } from "../../src/features/commerce/product/formatCommercePrice";

const REQUEST_ID = "0f47a18d-3b6c-4c8a-9cf1-1a2b3c4d5e6f";

function summary(overrides: Record<string, unknown> = {}) {
  return {
    id: "10",
    storeId: "1",
    name: "校园帆布包",
    subtitle: "轻便耐用",
    coverAssetRef: null,
    priceRange: { currency: "CNY", minAmountMinor: 1, maxAmountMinor: 9_999_999_999 },
    availability: "available",
    rating: "4.80",
    salesCount: 12,
    recommended: true,
    ...overrides,
  };
}

function sku(id: string, amountMinor: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `规格 ${id}`,
    price: { currency: "CNY", amountMinor },
    availability: "available",
    default: id === "1",
    ...overrides,
  };
}

function product(overrides: Record<string, unknown> = {}) {
  return {
    ...summary({ priceRange: { currency: "CNY", minAmountMinor: 100, maxAmountMinor: 300 } }),
    skus: [sku("1", 100), sku("2", 200, { availability: "unavailable" }), sku("10", 300)],
    ...overrides,
  };
}

function listEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      items: [summary()],
      page: { page: 1, pageSize: 20, total: 1, hasMore: false },
    },
    meta: { requestId: REQUEST_ID, schemaVersion: "1.0.0" },
    ...overrides,
  };
}

function detailEnvelope(productId = "10", overrides: Record<string, unknown> = {}) {
  return {
    data: { product: product({ id: productId }) },
    meta: { requestId: REQUEST_ID, schemaVersion: "1.0.0" },
    ...overrides,
  };
}

function successResponse(
  body: unknown,
  options: { status?: number; headers?: Record<string, string> } = {},
) {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Request-Id": REQUEST_ID,
      ...options.headers,
    },
  });
}

function installFetch(response: Response | Promise<Response>) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function expectApiKind(promise: Promise<unknown>, kind: CommerceApiError["kind"]) {
  await expect(promise).rejects.toMatchObject({ name: "CommerceApiError", kind });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("commerce product same-origin transport", () => {
  it("fetches the literal store-product route with no query and the accepted browser policy", async () => {
    vi.stubGlobal("window", { LIAN_API_BASE_URL: "https://hostile.invalid" });
    const fetchMock = installFetch(successResponse(listEnvelope()));
    const controller = new AbortController();

    const result = await fetchCommerceStoreProducts("1", controller.signal);

    expect(result.items[0]?.storeId).toBe("1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/commerce/stores/1/products", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain("?");
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain("hostile.invalid");
  });

  it("fetches only the canonical literal detail route and validates IDs before fetch", async () => {
    const fetchMock = installFetch(successResponse(detailEnvelope("2147483647")));
    const result = await fetchCommerceProductDetail("2147483647", new AbortController().signal);

    expect(result.product.id).toBe("2147483647");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/commerce/products/2147483647");
    await expectApiKind(
      fetchCommerceProductDetail("01", new AbortController().signal),
      "malformed",
    );
    await expectApiKind(
      fetchCommerceStoreProducts("2147483648", new AbortController().signal),
      "malformed",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepts status 200 only and strictly validates every success header", async () => {
    for (const response of [
      successResponse(listEnvelope(), { status: 201 }),
      successResponse(listEnvelope(), { headers: { "Content-Type": "text/json" } }),
      successResponse(listEnvelope(), { headers: { "Cache-Control": "no-store, max-age=0" } }),
      successResponse(listEnvelope(), { headers: { "X-Request-Id": "UPPERCASE" } }),
    ]) {
      installFetch(response);
      await expectApiKind(
        fetchCommerceStoreProducts("1", new AbortController().signal),
        response.status === 201 ? "unavailable" : "malformed",
      );
      vi.unstubAllGlobals();
    }
  });

  it("rejects malformed JSON without exposing response text", async () => {
    installFetch(
      new Response("{raw secret", {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Request-Id": REQUEST_ID,
        },
      }),
    );
    await expectApiKind(fetchCommerceStoreProducts("1", new AbortController().signal), "malformed");
  });

  it.each([
    [404, "not-found"],
    [429, "rate-limited"],
    [504, "timeout"],
    [400, "unavailable"],
    [428, "unavailable"],
    [499, "unavailable"],
    [502, "unavailable"],
    [503, "unavailable"],
    [500, "unavailable"],
  ] as const)("maps product HTTP %i to %s without adopting server prose", async (status, kind) => {
    for (const request of [
      () => fetchCommerceStoreProducts("1", new AbortController().signal),
      () => fetchCommerceProductDetail("10", new AbortController().signal),
    ]) {
      installFetch(new Response("raw upstream prose", { status }));
      await expectApiKind(request(), kind);
      vi.unstubAllGlobals();
    }
  });

  it("distinguishes caller aborts from ordinary network failure", async () => {
    const aborted = new AbortController();
    aborted.abort();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("raw network detail")));
    await expectApiKind(fetchCommerceStoreProducts("1", aborted.signal), "aborted");

    await expectApiKind(fetchCommerceProductDetail("10", new AbortController().signal), "network");
  });
});

describe("commerce product strict response decoder", () => {
  it("accepts exact summary bounds and measures text by Unicode code point", () => {
    expect(
      decodeCommerceProductSummary(
        summary({
          id: "2147483647",
          storeId: "2147483647",
          name: "😀".repeat(128),
          subtitle: "😀".repeat(150),
          rating: "0",
          salesCount: Number.MAX_SAFE_INTEGER,
          recommended: false,
        }),
      ),
    ).toMatchObject({
      id: "2147483647",
      coverAssetRef: null,
      priceRange: { minAmountMinor: 1, maxAmountMinor: 9_999_999_999 },
      salesCount: Number.MAX_SAFE_INTEGER,
    });
  });

  it.each([
    ["unknown product key", () => summary({ extra: true })],
    ["missing product key", () => ({ ...summary(), name: undefined })],
    ["numeric product id", () => summary({ id: 10 })],
    ["non-canonical product id", () => summary({ id: "010" })],
    ["invalid store id", () => summary({ storeId: "0" })],
    ["empty name", () => summary({ name: "" })],
    ["long name", () => summary({ name: "商".repeat(129) })],
    ["long subtitle", () => summary({ subtitle: "介".repeat(151) })],
    ["controlled name", () => summary({ name: "safe\u007funsafe" })],
    ["HTML-shaped name", () => summary({ name: "<b>unsafe</b>" })],
    ["HTML-shaped subtitle", () => summary({ subtitle: "safe<img>" })],
    ["asset reference", () => summary({ coverAssetRef: "asset:1" })],
    ["product unavailable", () => summary({ availability: "unavailable" })],
    ["rating precision", () => summary({ rating: "4.8" })],
    ["zero rating precision", () => summary({ rating: "0.00" })],
    ["rating range", () => summary({ rating: "5.01" })],
    ["negative sales", () => summary({ salesCount: -1 })],
    ["unsafe sales", () => summary({ salesCount: Number.MAX_SAFE_INTEGER + 1 })],
    ["fractional sales", () => summary({ salesCount: 1.5 })],
    ["boolean mismatch", () => summary({ recommended: "true" })],
    ["price keys", () => summary({ priceRange: { ...summary().priceRange, extra: true } })],
    [
      "price currency",
      () => summary({ priceRange: { currency: "USD", minAmountMinor: 1, maxAmountMinor: 2 } }),
    ],
    [
      "zero price",
      () => summary({ priceRange: { currency: "CNY", minAmountMinor: 0, maxAmountMinor: 2 } }),
    ],
    [
      "fractional price",
      () => summary({ priceRange: { currency: "CNY", minAmountMinor: 1.5, maxAmountMinor: 2 } }),
    ],
    [
      "large price",
      () =>
        summary({
          priceRange: { currency: "CNY", minAmountMinor: 1, maxAmountMinor: 10_000_000_000 },
        }),
    ],
    [
      "reversed range",
      () => summary({ priceRange: { currency: "CNY", minAmountMinor: 2, maxAmountMinor: 1 } }),
    ],
  ])("rejects %s", (_label, candidate) => {
    expect(() => decodeCommerceProductSummary(candidate())).toThrowError(CommerceApiError);
  });

  it("rejects truly missing product and nested price keys", () => {
    const missingName = summary();
    delete missingName.name;
    expect(() => decodeCommerceProductSummary(missingName)).toThrowError(CommerceApiError);

    const missingAmount = summary();
    delete missingAmount.priceRange.maxAmountMinor;
    expect(() => decodeCommerceProductSummary(missingAmount)).toThrowError(CommerceApiError);
  });

  it("accepts sorted SKUs, an unavailable default, and derives range from available SKUs only", () => {
    const decoded = decodeCommerceProduct(
      product({
        priceRange: { currency: "CNY", minAmountMinor: 100, maxAmountMinor: 300 },
        skus: [
          sku("1", 999, { availability: "unavailable", default: true, name: "" }),
          sku("2", 100, { default: false }),
          sku("10", 300, { default: false }),
        ],
      }),
    );
    expect(decoded.skus.map((item) => item.id)).toEqual(["1", "2", "10"]);
    expect(decoded.skus[0]).toMatchObject({ name: "", availability: "unavailable", default: true });
  });

  it.each([
    ["missing skus", () => summary()],
    ["extra detail key", () => product({ extra: true })],
    ["empty skus", () => product({ skus: [] })],
    [
      "too many skus",
      () =>
        product({
          skus: Array.from({ length: 101 }, (_, index) =>
            sku(String(index + 1), 100, { default: index === 0 }),
          ),
        }),
    ],
    ["sparse skus", () => product({ skus: new Array(1) })],
    [
      "duplicate sku ids",
      () => product({ skus: [sku("1", 100), sku("1", 300, { default: false })] }),
    ],
    [
      "lexical rather than numeric order",
      () =>
        product({
          skus: [
            sku("1", 100),
            sku("10", 300, { default: false }),
            sku("2", 200, { default: false }),
          ],
        }),
    ],
    [
      "descending sku ids",
      () =>
        product({ skus: [sku("2", 100, { default: true }), sku("1", 300, { default: false })] }),
    ],
    [
      "no default",
      () =>
        product({ skus: [sku("1", 100, { default: false }), sku("2", 300, { default: false })] }),
    ],
    ["two defaults", () => product({ skus: [sku("1", 100), sku("2", 300, { default: true })] })],
    ["no available sku", () => product({ skus: [sku("1", 100, { availability: "unavailable" })] })],
    [
      "wrong available range",
      () => product({ priceRange: { currency: "CNY", minAmountMinor: 100, maxAmountMinor: 200 } }),
    ],
    ["sku unknown key", () => product({ skus: [sku("1", 100, { extra: true })] })],
    ["sku invalid id", () => product({ skus: [sku("01", 100)] })],
    ["sku long name", () => product({ skus: [sku("1", 100, { name: "规".repeat(21) })] })],
    ["sku HTML", () => product({ skus: [sku("1", 100, { name: "<b>" })] })],
    [
      "sku price keys",
      () =>
        product({
          skus: [sku("1", 100, { price: { currency: "CNY", amountMinor: 100, extra: true } })],
        }),
    ],
    [
      "sku currency",
      () => product({ skus: [sku("1", 100, { price: { currency: "USD", amountMinor: 100 } })] }),
    ],
    ["sku price bound", () => product({ skus: [sku("1", 0)] })],
    ["sku availability", () => product({ skus: [sku("1", 100, { availability: "reserved" })] })],
    ["sku default type", () => product({ skus: [sku("1", 100, { default: 1 })] })],
  ])("rejects detail invariant: %s", (_label, candidate) => {
    expect(() => decodeCommerceProduct(candidate())).toThrowError(CommerceApiError);
  });

  it("accepts full, short, and empty first pages with a truthful hasMore flag", () => {
    for (const length of [0, 1, 20]) {
      const items = Array.from({ length }, (_, index) => summary({ id: String(index + 1) }));
      const decoded = decodeCommerceProductList(
        listEnvelope({
          data: {
            items,
            page: { page: 1, pageSize: 20, total: 21, hasMore: true },
          },
        }),
        REQUEST_ID,
        "1",
      );
      expect(decoded.items).toHaveLength(length);
      expect(decoded.page.hasMore).toBe(true);
    }
  });

  it("validates list identity, exact defaults, count bounds, empty pages, and hasMore", () => {
    expect(decodeCommerceProductList(listEnvelope(), REQUEST_ID, "1").items).toHaveLength(1);
    expect(
      decodeCommerceProductList(
        listEnvelope({
          data: {
            items: [],
            page: { page: 1, pageSize: 20, total: 21, hasMore: true },
          },
        }),
        REQUEST_ID,
        "1",
      ).page,
    ).toMatchObject({ total: 21, hasMore: true });

    for (const value of [
      listEnvelope({
        data: {
          items: [summary({ storeId: "2" })],
          page: { page: 1, pageSize: 20, total: 1, hasMore: false },
        },
      }),
      listEnvelope({
        data: {
          items: Array.from({ length: 21 }, (_, index) => summary({ id: String(index + 1) })),
          page: { page: 1, pageSize: 20, total: 21, hasMore: true },
        },
      }),
      listEnvelope({
        data: { items: [summary()], page: { page: 2, pageSize: 20, total: 21, hasMore: false } },
      }),
      listEnvelope({
        data: { items: [summary()], page: { page: 1, pageSize: 19, total: 1, hasMore: false } },
      }),
      listEnvelope({
        data: { items: [summary()], page: { page: 1, pageSize: 20, total: 21, hasMore: false } },
      }),
      listEnvelope({
        data: { items: [summary()], page: { page: 1, pageSize: 20, total: 0, hasMore: false } },
      }),
      listEnvelope({
        data: { items: [summary()], page: { page: 1, pageSize: 20, total: 1.5, hasMore: false } },
      }),
      { ...listEnvelope(), unknown: true },
      { ...listEnvelope(), data: { ...listEnvelope().data, unknown: true } },
    ]) {
      expect(() => decodeCommerceProductList(value, REQUEST_ID, "1")).toThrowError(
        CommerceApiError,
      );
    }
  });

  it("rejects sparse items, meta drift, header mismatch, and detail identity drift", () => {
    expect(() =>
      decodeCommerceProductList(
        listEnvelope({
          data: {
            items: new Array(1),
            page: { page: 1, pageSize: 20, total: 1, hasMore: false },
          },
        }),
        REQUEST_ID,
        "1",
      ),
    ).toThrowError(CommerceApiError);
    expect(() =>
      decodeCommerceProductList(
        listEnvelope({
          meta: { requestId: REQUEST_ID, schemaVersion: "1.0.0", unknown: true },
        }),
        REQUEST_ID,
        "1",
      ),
    ).toThrowError(CommerceApiError);
    expect(() =>
      decodeCommerceProductList(
        listEnvelope({ meta: { requestId: REQUEST_ID.toUpperCase(), schemaVersion: "1.0.0" } }),
        REQUEST_ID,
        "1",
      ),
    ).toThrowError(CommerceApiError);
    expect(() =>
      decodeCommerceProductList(
        listEnvelope({ meta: { requestId: REQUEST_ID, schemaVersion: "1.0.1" } }),
        REQUEST_ID,
        "1",
      ),
    ).toThrowError(CommerceApiError);
    expect(() =>
      decodeCommerceProductList(listEnvelope(), REQUEST_ID.replace(/.$/, "0"), "1"),
    ).toThrowError(CommerceApiError);
    expect(() => decodeCommerceProductDetail(detailEnvelope("2"), REQUEST_ID, "1")).toThrowError(
      CommerceApiError,
    );
    expect(() =>
      decodeCommerceProductDetail(
        detailEnvelope("2", { data: { product: product({ id: "2" }), unknown: true } }),
        REQUEST_ID,
        "2",
      ),
    ).toThrowError(CommerceApiError);
    expect(decodeCommerceProductDetail(detailEnvelope("2"), REQUEST_ID, "2").product.id).toBe("2");
  });
});

describe("commerce integer-minor-unit price formatting", () => {
  it.each([
    [1, "¥0.01"],
    [10, "¥0.10"],
    [100, "¥1.00"],
    [12_345, "¥123.45"],
    [9_999_999_999, "¥99999999.99"],
  ] as const)("formats %i without a floating-point major-unit conversion", (minor, expected) => {
    expect(formatCommercePrice(minor)).toBe(expected);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 10_000_000_000])(
    "rejects invalid minor amount %s",
    (minor) => {
      expect(() => formatCommercePrice(minor)).toThrow(RangeError);
    },
  );
});
