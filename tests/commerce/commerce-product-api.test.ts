import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CommerceApiError,
  decodeCommerceActorInitialize,
  decodeCommerceCartResult,
  decodeCommerceProduct,
  decodeCommerceProductDetail,
  decodeCommerceProductList,
  decodeCommerceProductSummary,
  deleteCommerceCartItem,
  fetchCommerceActorInitialize,
  fetchCommerceCart,
  fetchCommerceProductDetail,
  fetchCommerceStoreProducts,
  setCommerceCartItem,
} from "../../src/api/commerce";
import { formatCommercePrice } from "../../src/features/commerce/product/formatCommercePrice";
import { commerceRoutes } from "../../src/platform/ui-fixtures/data/commerce";
import type { FixtureRequestContext } from "../../src/platform/ui-fixtures/types";

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

function cartItem(overrides: Record<string, unknown> = {}) {
  return {
    skuId: "1",
    productId: "10",
    storeId: "1",
    productName: "校园帆布包",
    skuName: "蓝色",
    quantity: 1,
    referenceUnitPrice: { currency: "CNY", amountMinor: 1200 },
    availability: "available",
    ...overrides,
  };
}

function cartEnvelope(items: unknown[] = [cartItem()], overrides: Record<string, unknown> = {}) {
  return {
    data: { cart: { items } },
    meta: { requestId: REQUEST_ID, schemaVersion: "1.0.0" },
    ...overrides,
  };
}

function actorEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    data: { actor: { initialized: true } },
    meta: { requestId: REQUEST_ID, schemaVersion: "1.0.0" },
    ...overrides,
  };
}

function strictErrorResponse(status: number, error: string, code: string) {
  return new Response(JSON.stringify({ error, code, requestId: REQUEST_ID }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Request-Id": REQUEST_ID,
      ...(status === 429 ? { "Retry-After": "30" } : {}),
    },
  });
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

async function runCommerceFixture(pattern: string, params: Record<string, string>) {
  const route = commerceRoutes.find((candidate) => candidate.pattern === pattern);
  if (!route) throw new Error(`missing commerce fixture ${pattern}`);
  const context: FixtureRequestContext = {
    method: "GET",
    path: pattern,
    route: pattern,
    params,
    query: new URLSearchParams(),
    body: null,
    state: {
      scenario: "normal",
      identity: "registered",
      volume: "default",
      latencyMs: 0,
      errorOverride: null,
    },
    scenario: "normal",
    identity: "registered",
    volume: "default",
  };
  const result = await route.handler(context);
  if (!(result instanceof Response)) throw new Error("commerce fixture did not return Response");
  return result;
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

describe("commerce actor and cart strict contract", () => {
  it("decodes only exact actor and ordered cart envelopes", () => {
    expect(decodeCommerceActorInitialize(actorEnvelope(), REQUEST_ID).initialized).toBe(true);
    expect(
      decodeCommerceCartResult(
        cartEnvelope([cartItem({ skuId: "1" }), cartItem({ skuId: "10", quantity: 99 })]),
        REQUEST_ID,
      ).cart.items,
    ).toHaveLength(2);

    for (const candidate of [
      actorEnvelope({ data: { actor: { initialized: false } } }),
      actorEnvelope({ data: { actor: { initialized: true, extra: true } } }),
      cartEnvelope([cartItem({ extra: true })]),
      cartEnvelope([cartItem({ skuId: "01" })]),
      cartEnvelope([cartItem({ productName: "<img>" })]),
      cartEnvelope([cartItem({ quantity: 0 })]),
      cartEnvelope([cartItem({ quantity: 100, availability: "available" })]),
      cartEnvelope([cartItem({ skuId: "10" }), cartItem({ skuId: "2" })]),
      cartEnvelope([cartItem({ referenceUnitPrice: null, availability: "available" })]),
    ]) {
      expect(() =>
        "actor" in ((candidate as { data: object }).data as object)
          ? decodeCommerceActorInitialize(candidate, REQUEST_ID)
          : decodeCommerceCartResult(candidate, REQUEST_ID),
      ).toThrowError(CommerceApiError);
    }
  });

  it("keeps cart reads header-light and emits exact dedicated write requests", async () => {
    const keys = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ];
    vi.stubGlobal("crypto", { randomUUID: vi.fn().mockImplementation(() => keys.shift()) });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(successResponse(cartEnvelope([])))
      .mockResolvedValueOnce(successResponse(actorEnvelope()))
      .mockResolvedValueOnce(successResponse(cartEnvelope()))
      .mockResolvedValueOnce(successResponse(cartEnvelope([])));
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;

    await fetchCommerceCart(signal);
    await fetchCommerceActorInitialize(signal);
    await setCommerceCartItem("1", 1, signal);
    await deleteCommerceCartItem("1", signal);

    expect(fetchMock.mock.calls[0]).toEqual([
      "/api/commerce/cart",
      {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        headers: { Accept: "application/json" },
        signal,
      },
    ]);
    expect(
      fetchMock.mock.calls.slice(1).map(([url, init]) => [url, init.method, init.body]),
    ).toEqual([
      ["/api/commerce/actors/me", "PUT", "{}"],
      ["/api/commerce/cart/items/1", "PUT", '{"quantity":1}'],
      ["/api/commerce/cart/items/1", "DELETE", "{}"],
    ]);
    expect(fetchMock.mock.calls.slice(1).map(([, init]) => init.headers)).toEqual([
      {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": "11111111-1111-4111-8111-111111111111",
        "X-LIAN-CSRF": "1",
      },
      {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": "22222222-2222-4222-8222-222222222222",
        "X-LIAN-CSRF": "1",
      },
      {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": "33333333-3333-4333-8333-333333333333",
        "X-LIAN-CSRF": "1",
      },
    ]);
    for (const [, init] of fetchMock.mock.calls.slice(1)) {
      expect(init.credentials).toBe("same-origin");
      expect(init.cache).toBe("no-store");
      expect(init.redirect).toBe("error");
      expect(init.signal).toBe(signal);
      expect(init.headers).not.toHaveProperty("Origin");
      expect(init.headers).not.toHaveProperty("Sec-Fetch-Site");
    }
  });

  it("maps only exact correlated error envelopes to actor/login/item semantics", async () => {
    const cases = [
      [401, "Commerce login is required", "COMMERCE_LOGIN_REQUIRED", "login-required"],
      [
        409,
        "Commerce actor initialization is required",
        "COMMERCE_ACTOR_INITIALIZATION_REQUIRED",
        "actor-initialization-required",
      ],
      [
        409,
        "Commerce cart item is unavailable",
        "COMMERCE_CART_ITEM_UNAVAILABLE",
        "item-unavailable",
      ],
      [
        409,
        "Commerce cart item limit was reached",
        "COMMERCE_CART_LIMIT_EXCEEDED",
        "cart-limit-exceeded",
      ],
      [429, "Commerce cart request rate is limited", "COMMERCE_CART_RATE_LIMITED", "rate-limited"],
    ] as const;
    for (const [status, error, code, kind] of cases) {
      vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
      installFetch(strictErrorResponse(status, error, code));
      await expectApiKind(setCommerceCartItem("1", 1, new AbortController().signal), kind);
      vi.unstubAllGlobals();
    }

    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    installFetch(
      new Response(
        JSON.stringify({
          error: "Commerce actor initialization is required",
          code: "COMMERCE_ACTOR_INITIALIZATION_REQUIRED",
          requestId: REQUEST_ID.replace(/.$/, "0"),
        }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "X-Request-Id": REQUEST_ID,
          },
        },
      ),
    );
    await expectApiKind(setCommerceCartItem("1", 1, new AbortController().signal), "malformed");
  });

  it("validates cart input before generating an idempotency key or fetching", async () => {
    const randomUUID = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal("crypto", { randomUUID });
    vi.stubGlobal("fetch", fetchMock);
    await expectApiKind(setCommerceCartItem("01", 1, new AbortController().signal), "malformed");
    await expectApiKind(setCommerceCartItem("1", 0, new AbortController().signal), "malformed");
    await expectApiKind(
      deleteCommerceCartItem("2147483648", new AbortController().signal),
      "malformed",
    );
    expect(randomUUID).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("correlates mutation success snapshots to the exact SKU and absolute quantity", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    installFetch(successResponse(cartEnvelope([])));
    await expectApiKind(setCommerceCartItem("1", 2, new AbortController().signal), "malformed");

    installFetch(successResponse(cartEnvelope([cartItem({ skuId: "1", quantity: 1 })])));
    await expectApiKind(setCommerceCartItem("1", 2, new AbortController().signal), "malformed");

    installFetch(
      successResponse(
        cartEnvelope([
          cartItem({
            skuId: "1",
            quantity: 2,
            availability: "unavailable",
            productName: null,
            skuName: null,
            referenceUnitPrice: null,
          }),
        ]),
      ),
    );
    await expectApiKind(setCommerceCartItem("1", 2, new AbortController().signal), "malformed");

    installFetch(successResponse(cartEnvelope([cartItem({ skuId: "1", quantity: 1 })])));
    await expectApiKind(deleteCommerceCartItem("1", new AbortController().signal), "malformed");
  });

  it("rejects a path-impossible cart error even when its envelope is otherwise exact", async () => {
    installFetch(
      strictErrorResponse(
        409,
        "Commerce actor initialization is required",
        "COMMERCE_ACTOR_INITIALIZATION_REQUIRED",
      ),
    );
    await expectApiKind(fetchCommerceCart(new AbortController().signal), "malformed");
  });
});

describe("commerce fixture global product and SKU identity", () => {
  it("keeps store product ranges disjoint and detail ownership reversible", async () => {
    const firstStoreResponse = await runCommerceFixture("/api/commerce/stores/:storeId/products", {
      storeId: "1",
    });
    const secondStoreResponse = await runCommerceFixture("/api/commerce/stores/:storeId/products", {
      storeId: "2",
    });
    const firstStore = decodeCommerceProductList(
      await firstStoreResponse.json(),
      firstStoreResponse.headers.get("x-request-id") ?? "",
      "1",
    );
    const secondStore = decodeCommerceProductList(
      await secondStoreResponse.json(),
      secondStoreResponse.headers.get("x-request-id") ?? "",
      "2",
    );
    expect(firstStore.items.map((item) => item.id)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(secondStore.items.map((item) => item.id)).toEqual(["19", "20", "21", "22", "23", "24"]);

    const firstDetailResponse = await runCommerceFixture("/api/commerce/products/:productId", {
      productId: "1",
    });
    const secondDetailResponse = await runCommerceFixture("/api/commerce/products/:productId", {
      productId: "19",
    });
    const firstDetail = decodeCommerceProductDetail(
      await firstDetailResponse.json(),
      firstDetailResponse.headers.get("x-request-id") ?? "",
      "1",
    );
    const secondDetail = decodeCommerceProductDetail(
      await secondDetailResponse.json(),
      secondDetailResponse.headers.get("x-request-id") ?? "",
      "19",
    );
    expect(firstDetail.product.storeId).toBe("1");
    expect(secondDetail.product.storeId).toBe("2");
    expect(firstDetail.product.skus.map((item) => item.id)).toEqual(["1", "2"]);
    expect(secondDetail.product.skus.map((item) => item.id)).toEqual(["73", "74"]);
  });
});
