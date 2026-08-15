import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CommerceApiError,
  decodeCommerceStore,
  decodeCommerceStoreDetail,
  decodeCommerceStoreList,
  fetchCommerceStoreDetail,
  fetchCommerceStoreList,
} from "../../src/api/commerce";

const REQUEST_ID = "0f47a18d-3b6c-4c8a-9cf1-1a2b3c4d5e6f";

function store(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    name: "校园便利店",
    summary: "日常用品和零食",
    areaLabel: "东区",
    logoAssetRef: null,
    ratings: { description: "4.80", service: "5.00", logistics: "0" },
    salesCount: 12,
    favoriteCount: 3,
    recommended: true,
    ...overrides,
  };
}

function listEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      items: [store()],
      page: { page: 1, pageSize: 20, total: 1, hasMore: false },
    },
    meta: { requestId: REQUEST_ID, schemaVersion: "1.0.0" },
    ...overrides,
  };
}

function detailEnvelope(storeId = "1", overrides: Record<string, unknown> = {}) {
  return {
    data: { store: store({ id: storeId }) },
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
  vi.restoreAllMocks();
});

describe("commerce same-origin transport", () => {
  it("fetches the literal root-relative list route with the accepted browser policy", async () => {
    const fetchMock = installFetch(successResponse(listEnvelope()));
    const controller = new AbortController();

    const result = await fetchCommerceStoreList(controller.signal);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/commerce/stores", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain("?");
  });

  it("fetches only the canonical literal detail route and preserves the string id", async () => {
    const fetchMock = installFetch(successResponse(detailEnvelope("2147483647")));
    const result = await fetchCommerceStoreDetail("2147483647", new AbortController().signal);

    expect(result.store.id).toBe("2147483647");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/commerce/stores/2147483647");
    await expectApiKind(fetchCommerceStoreDetail("01", new AbortController().signal), "malformed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepts status 200 only and validates every success header", async () => {
    for (const response of [
      successResponse(listEnvelope(), { status: 201 }),
      successResponse(listEnvelope(), { headers: { "Content-Type": "text/json" } }),
      successResponse(listEnvelope(), { headers: { "Cache-Control": "no-store, max-age=0" } }),
      successResponse(listEnvelope(), { headers: { "X-Request-Id": "UPPERCASE" } }),
    ]) {
      installFetch(response);
      await expectApiKind(
        fetchCommerceStoreList(new AbortController().signal),
        response.status === 201 ? "unavailable" : "malformed",
      );
      vi.unstubAllGlobals();
    }
  });

  it.each([
    [404, false, "unavailable"],
    [404, true, "not-found"],
    [429, false, "rate-limited"],
    [504, false, "timeout"],
    [400, false, "unavailable"],
    [428, false, "unavailable"],
    [502, false, "unavailable"],
    [503, false, "unavailable"],
  ] as const)("maps HTTP %i on detail=%s to %s", async (status, detail, kind) => {
    installFetch(new Response("raw upstream prose", { status }));
    const signal = new AbortController().signal;
    await expectApiKind(
      detail ? fetchCommerceStoreDetail("1", signal) : fetchCommerceStoreList(signal),
      kind,
    );
  });

  it("distinguishes caller aborts from ordinary network failure", async () => {
    const aborted = new AbortController();
    aborted.abort();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("raw network detail")));
    await expectApiKind(fetchCommerceStoreList(aborted.signal), "aborted");

    const active = new AbortController();
    await expectApiKind(fetchCommerceStoreList(active.signal), "network");
  });
});

describe("commerce strict response decoder", () => {
  it("accepts the exact store DTO, fixed ratings, null asset reference, and safe counts", () => {
    expect(
      decodeCommerceStore(
        store({ salesCount: Number.MAX_SAFE_INTEGER, favoriteCount: 0, recommended: false }),
      ),
    ).toMatchObject({
      id: "1",
      logoAssetRef: null,
      ratings: { description: "4.80", service: "5.00", logistics: "0" },
      salesCount: Number.MAX_SAFE_INTEGER,
    });
  });

  it("measures contract text by Unicode code point rather than UTF-16 code unit", () => {
    expect(decodeCommerceStore(store({ name: "😀".repeat(50) })).name).toBe("😀".repeat(50));
    expect(() => decodeCommerceStore(store({ name: "😀".repeat(51) }))).toThrowError(
      CommerceApiError,
    );
  });

  it.each([
    ["unknown key", () => store({ extra: true })],
    ["numeric id", () => store({ id: 1 })],
    ["non-canonical id", () => store({ id: "01" })],
    ["empty name", () => store({ name: "" })],
    ["long name", () => store({ name: "店".repeat(51) })],
    ["controlled summary", () => store({ summary: "safe\u007funsafe" })],
    ["long area", () => store({ areaLabel: "区".repeat(101) })],
    ["asset reference", () => store({ logoAssetRef: "asset:1" })],
    [
      "rating precision",
      () => store({ ratings: { description: "4.8", service: "5.00", logistics: "0" } }),
    ],
    [
      "rating range",
      () => store({ ratings: { description: "5.01", service: "5.00", logistics: "0" } }),
    ],
    ["negative count", () => store({ salesCount: -1 })],
    ["unsafe count", () => store({ favoriteCount: Number.MAX_SAFE_INTEGER + 1 })],
    ["fractional count", () => store({ salesCount: 1.5 })],
    ["boolean mismatch", () => store({ recommended: "true" })],
  ])("rejects %s", (_label, candidate) => {
    expect(() => decodeCommerceStore(candidate())).toThrowError(CommerceApiError);
  });

  it("rejects missing store and nested rating keys", () => {
    const missingName = store();
    delete missingName.name;
    expect(() => decodeCommerceStore(missingName)).toThrowError(CommerceApiError);

    const missingRating = store();
    delete missingRating.ratings.logistics;
    expect(() => decodeCommerceStore(missingRating)).toThrowError(CommerceApiError);
  });

  it("rejects sparse arrays, envelope drift, UUID/schema drift, and header/body mismatch", () => {
    const sparseItems = new Array(1);
    expect(() =>
      decodeCommerceStoreList(
        {
          data: {
            items: sparseItems,
            page: { page: 1, pageSize: 20, total: 1, hasMore: false },
          },
          meta: { requestId: REQUEST_ID, schemaVersion: "1.0.0" },
        },
        REQUEST_ID,
      ),
    ).toThrowError(CommerceApiError);

    expect(() =>
      decodeCommerceStoreList({ ...listEnvelope(), unknown: true }, REQUEST_ID),
    ).toThrowError(CommerceApiError);
    expect(() =>
      decodeCommerceStoreList(
        listEnvelope({ meta: { requestId: REQUEST_ID.toUpperCase(), schemaVersion: "1.0.0" } }),
        REQUEST_ID,
      ),
    ).toThrowError(CommerceApiError);
    expect(() =>
      decodeCommerceStoreList(
        listEnvelope({ meta: { requestId: REQUEST_ID, schemaVersion: "1.0.1" } }),
        REQUEST_ID,
      ),
    ).toThrowError(CommerceApiError);
    expect(() =>
      decodeCommerceStoreList(listEnvelope(), REQUEST_ID.replace(/.$/, "0")),
    ).toThrowError(CommerceApiError);
  });

  it.each([
    { page: 2, pageSize: 20, total: 1, hasMore: false },
    { page: 1, pageSize: 19, total: 1, hasMore: false },
    { page: 1, pageSize: 20, total: 21, hasMore: false },
    { page: 1, pageSize: 20, total: 0, hasMore: false },
    { page: 1, pageSize: 20, total: -1, hasMore: false },
    { page: 1, pageSize: 20, total: 1.5, hasMore: false },
  ])("rejects list page invariant drift %#", (page) => {
    expect(() =>
      decodeCommerceStoreList({ ...listEnvelope(), data: { items: [store()], page } }, REQUEST_ID),
    ).toThrowError(CommerceApiError);
  });

  it("requires detail identity to equal the requested route identity", () => {
    expect(decodeCommerceStoreDetail(detailEnvelope("2"), REQUEST_ID, "2").store.id).toBe("2");
    expect(() => decodeCommerceStoreDetail(detailEnvelope("2"), REQUEST_ID, "1")).toThrowError(
      CommerceApiError,
    );
  });
});
