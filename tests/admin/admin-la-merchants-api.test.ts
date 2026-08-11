import { afterEach, describe, expect, it, vi } from "vitest";

import { LianApiError } from "../../src/api/http";

const apiGet = vi.hoisted(() => vi.fn());

vi.mock("../../src/api/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/api/http")>();
  return { ...actual, apiGet };
});

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

type FetchAdminLaMerchants = (
  query: MerchantQuery,
  signal?: AbortSignal,
) => Promise<MerchantEnvelope>;

async function requireApi(): Promise<FetchAdminLaMerchants> {
  const specifier = new URL("../../src/api/" + "adminLaPlatform.ts", import.meta.url).href;
  let loaded: { fetchAdminLaMerchants?: FetchAdminLaMerchants } | undefined;
  let loadError: unknown;
  try {
    loaded = (await import(/* @vite-ignore */ specifier)) as {
      fetchAdminLaMerchants?: FetchAdminLaMerchants;
    };
  } catch (error) {
    loadError = error;
  }
  expect(loadError, "adminLaPlatform runtime module must exist").toBeUndefined();
  expect(loaded?.fetchAdminLaMerchants).toBeTypeOf("function");
  return loaded!.fetchAdminLaMerchants!;
}

function envelope(overrides: Partial<MerchantEnvelope> = {}): MerchantEnvelope {
  return {
    data: [
      {
        id: "merchant_demo",
        code: "demo.code-1",
        displayName: " Example Merchant ",
        status: "active",
        createdAt: "2026-08-11T00:00:00.000Z",
        updatedAt: "2026-08-11T01:02:03.004Z",
      },
    ],
    page: { limit: 20, offset: 0, total: 1 },
    meta: {
      requestId: "3f5a9c26-6571-4d6c-9c70-3517b2a7f4d8",
      schemaVersion: "v1",
    },
    ...overrides,
  };
}

function rawError(status: unknown, retryAfterSeconds: unknown = null) {
  const error = new LianApiError(
    "RAW https://la.internal/?q=secret Authorization=sentinel",
    status as number,
    "INTEGRATION_UNAVAILABLE",
    retryAfterSeconds as number | null,
  );
  Object.assign(error, {
    stack: "RAW STACK Authorization=sentinel https://la.internal/secret",
    cause: new Error("raw cause"),
    response: { body: "raw body", headers: { authorization: "sentinel" } },
    query: "secret",
    requestId: "diagnostic-" + "x".repeat(1_024),
  });
  return error;
}

function withNonEnumerableRequired(source: object, key: string): Record<string, unknown> {
  const copy = { ...(source as Record<string, unknown>) };
  const value = copy[key];
  delete copy[key];
  Object.defineProperty(copy, key, {
    value,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return copy;
}

function withSymbolExtra(source: object): Record<string, unknown> {
  const copy = { ...(source as Record<string, unknown>) };
  Object.defineProperty(copy, Symbol("raw diagnostic"), {
    value: "secret",
    enumerable: true,
    configurable: true,
  });
  return copy;
}

function withInheritedRequired(source: object, key: string): Record<string, unknown> {
  const copy = { ...(source as Record<string, unknown>) };
  const value = copy[key];
  delete copy[key];
  const prototype = Object.create(Object.prototype) as Record<string, unknown>;
  Object.defineProperty(prototype, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return Object.assign(Object.create(prototype) as Record<string, unknown>, copy);
}

function withAccessorRequired(source: object, key: string): Record<string, unknown> {
  const copy = { ...(source as Record<string, unknown>) };
  const value = copy[key];
  delete copy[key];
  Object.defineProperty(copy, key, {
    get: () => value,
    enumerable: true,
    configurable: true,
  });
  return copy;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("admin LAPlatform merchants browser boundary", () => {
  it("uses the one fixed cookie BFF GET with canonical query order and no credential input", async () => {
    const fetchAdminLaMerchants = await requireApi();
    const controller = new AbortController();
    apiGet.mockResolvedValueOnce(envelope({ page: { limit: 20, offset: 40, total: 41 } }));

    await fetchAdminLaMerchants(
      { limit: 20, offset: 40, q: "  north & east  ", status: "inactive" },
      controller.signal,
    );

    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(apiGet).toHaveBeenCalledWith(
      "/api/admin/laplatform/merchants?limit=20&offset=40&q=north+%26+east&status=inactive",
      {
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      },
    );
    const serialized = JSON.stringify(apiGet.mock.calls[0]);
    expect(serialized).not.toMatch(/authorization|x-admin-token|bearer|laplatform_service_token/i);
  });

  it("emits the exact initial URL and accepts a strict value without pretending apiGet exposed 200", async () => {
    const fetchAdminLaMerchants = await requireApi();
    const valid = envelope();
    apiGet.mockResolvedValueOnce(valid);

    const result = await fetchAdminLaMerchants({ limit: 20, offset: 0 });

    expect(apiGet).toHaveBeenCalledWith(
      "/api/admin/laplatform/merchants?limit=20&offset=0",
      expect.objectContaining({ cache: "no-store", redirect: "error" }),
    );
    expect(result).toEqual(valid);
    expect(result).not.toBe(valid);
    expect(result.data).not.toBe(valid.data);
    expect(result.data[0]).not.toBe(valid.data[0]);
    expect(result.page).not.toBe(valid.page);
    expect(result.meta).not.toBe(valid.meta);
  });

  it("omits empty q and all-status while preserving the exact canonical key order", async () => {
    const fetchAdminLaMerchants = await requireApi();
    apiGet.mockResolvedValueOnce(
      envelope({ page: { limit: 100, offset: 1_000_000, total: 1_000_001 } }),
    );

    await fetchAdminLaMerchants({ limit: 100, offset: 1_000_000, q: "   " });

    expect(apiGet.mock.calls[0]?.[0]).toBe(
      "/api/admin/laplatform/merchants?limit=100&offset=1000000",
    );
  });

  it("rejects non-canonical caller queries and unknown credential/path/init escape hatches before IO", async () => {
    const fetchAdminLaMerchants = await requireApi();
    const invalid = [
      { limit: 0, offset: 0 },
      { limit: 101, offset: 0 },
      { limit: 20.5, offset: 0 },
      { limit: Number.NaN, offset: 0 },
      { limit: "20", offset: 0 },
      { limit: 20, offset: -1 },
      { limit: 20, offset: 1_000_001 },
      { limit: 20, offset: Number.MAX_SAFE_INTEGER + 1 },
      { limit: 20, offset: Number.POSITIVE_INFINITY },
      { limit: 20, offset: "0" },
      { limit: 20, offset: 0, q: "x".repeat(161) },
      { limit: 20, offset: 0, q: 7 },
      { limit: 20, offset: 0, status: "all" },
      { limit: 20, offset: 0, status: "disabled" },
      { limit: 20, offset: 0, status: null },
      { limit: 20, offset: 0, token: "sentinel-ops-token" },
      { limit: 20, offset: 0, headers: { authorization: "Bearer sentinel" } },
      { limit: 20, offset: 0, path: "https://la.internal/merchants" },
      { limit: 20, offset: 0, method: "POST" },
      { limit: 20, offset: 0, page: 1 },
    ];

    for (const query of invalid) {
      await expect(
        fetchAdminLaMerchants(query as unknown as MerchantQuery),
        JSON.stringify(query),
      ).rejects.toMatchObject({ code: "REQUEST_CONTRACT", status: 0 });
    }
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("preserves displayName exactly under the backend UTF-16 length rule", async () => {
    const fetchAdminLaMerchants = await requireApi();
    const accepted = [" ", "x".repeat(160), "😀".repeat(80)];

    for (const displayName of accepted) {
      const value = envelope({ data: [{ ...envelope().data[0], displayName }] });
      apiGet.mockResolvedValueOnce(value);
      const result = await fetchAdminLaMerchants({ limit: 20, offset: 0 });
      expect(result.data[0].displayName).toBe(displayName);
    }

    for (const displayName of ["", "x".repeat(161), "😀".repeat(81)]) {
      apiGet.mockResolvedValueOnce(envelope({ data: [{ ...envelope().data[0], displayName }] }));
      await expect(fetchAdminLaMerchants({ limit: 20, offset: 0 })).rejects.toMatchObject({
        code: "MALFORMED_RESPONSE",
        status: 0,
      });
    }
  });

  it("accepts and preserves real UTC timestamps with or without optional milliseconds", async () => {
    const fetchAdminLaMerchants = await requireApi();
    const value = envelope({
      data: [
        {
          ...envelope().data[0],
          createdAt: "2024-02-29T00:00:00Z",
          updatedAt: "2026-08-11T01:02:03.004Z",
        },
      ],
    });
    apiGet.mockResolvedValueOnce(value);

    const result = await fetchAdminLaMerchants({ limit: 20, offset: 0 });

    expect(result.data[0].createdAt).toBe("2024-02-29T00:00:00Z");
    expect(result.data[0].updatedAt).toBe("2026-08-11T01:02:03.004Z");
  });

  it("fails closed for every exact-key, type, identifier, timestamp, page and meta drift", async () => {
    const fetchAdminLaMerchants = await requireApi();
    const base = envelope();
    const merchant = base.data[0];
    const merchantMissingOwnCode = { ...merchant } as Partial<Merchant>;
    delete merchantMissingOwnCode.code;
    const sparseData = new Array<Merchant>(1);
    const exactKeyLevels: Array<{
      name: string;
      source: object;
      requiredKey: string;
      wrap(value: unknown): unknown;
    }> = [
      {
        name: "envelope",
        source: base,
        requiredKey: "meta",
        wrap: (value) => value,
      },
      {
        name: "row",
        source: merchant,
        requiredKey: "code",
        wrap: (value) => ({ ...base, data: [value] }),
      },
      {
        name: "page",
        source: base.page,
        requiredKey: "total",
        wrap: (value) => ({ ...base, page: value }),
      },
      {
        name: "meta",
        source: base.meta,
        requiredKey: "requestId",
        wrap: (value) => ({ ...base, meta: value }),
      },
    ];
    const exactKeyMutations = [
      {
        name: "non-enumerable required descriptor",
        build: withNonEnumerableRequired,
      },
      {
        name: "symbol extra",
        build: (source: object, _key: string) => withSymbolExtra(source),
      },
      {
        name: "inherited required prototype",
        build: withInheritedRequired,
      },
      {
        name: "accessor required descriptor",
        build: withAccessorRequired,
      },
    ];
    const exactKeyMatrix: Array<[string, unknown]> = [];
    for (const level of exactKeyLevels) {
      for (const mutation of exactKeyMutations) {
        exactKeyMatrix.push([
          `${level.name} ${mutation.name}`,
          level.wrap(mutation.build(level.source, level.requiredKey)),
        ]);
      }
    }
    const invalid: Array<[string, unknown]> = [
      ...exactKeyMatrix,
      ["null", null],
      ["array top level", []],
      ["missing meta", { data: base.data, page: base.page }],
      ["extra top key", { ...base, extra: true }],
      ["data not array", { ...base, data: {} }],
      ["sparse data", { ...base, data: sparseData }],
      ["merchant null", { ...base, data: [null] }],
      ["merchant missing own key", { ...base, data: [merchantMissingOwnCode] }],
      ["merchant undefined key", { ...base, data: [{ ...merchant, code: undefined }] }],
      ["merchant extra key", { ...base, data: [{ ...merchant, secret: "raw" }] }],
      ["invalid id", { ...base, data: [{ ...merchant, id: "bad id" }] }],
      ["oversized id", { ...base, data: [{ ...merchant, id: "x".repeat(65) }] }],
      ["invalid code", { ...base, data: [{ ...merchant, code: "bad/code" }] }],
      ["empty code", { ...base, data: [{ ...merchant, code: "" }] }],
      ["oversized code", { ...base, data: [{ ...merchant, code: "x".repeat(65) }] }],
      ["coerced name", { ...base, data: [{ ...merchant, displayName: 7 }] }],
      ["unknown status", { ...base, data: [{ ...merchant, status: "pending" }] }],
      [
        "impossible date",
        { ...base, data: [{ ...merchant, createdAt: "2026-02-30T00:00:00.000Z" }] },
      ],
      [
        "one fractional timestamp digit",
        { ...base, data: [{ ...merchant, createdAt: "2026-08-11T00:00:00.1Z" }] },
      ],
      [
        "two fractional timestamp digits",
        { ...base, data: [{ ...merchant, createdAt: "2026-08-11T00:00:00.12Z" }] },
      ],
      [
        "four fractional timestamp digits",
        { ...base, data: [{ ...merchant, createdAt: "2026-08-11T00:00:00.1234Z" }] },
      ],
      [
        "lowercase UTC suffix",
        { ...base, data: [{ ...merchant, createdAt: "2026-08-11T00:00:00.000z" }] },
      ],
      ["coerced date", { ...base, data: [{ ...merchant, createdAt: 1_786_406_400_000 }] }],
      ["offset date", { ...base, data: [{ ...merchant, updatedAt: "2026-08-11T09:00:00+08:00" }] }],
      ["page extra", { ...base, page: { ...base.page, page: 1 } }],
      ["page limit coerced", { ...base, page: { ...base.page, limit: "20" } }],
      ["page limit fractional", { ...base, page: { ...base.page, limit: 20.5 } }],
      [
        "page offset infinite",
        { ...base, page: { ...base.page, offset: Number.POSITIVE_INFINITY } },
      ],
      [
        "page offset unsafe",
        { ...base, page: { ...base.page, offset: Number.MAX_SAFE_INTEGER + 1 } },
      ],
      ["page total negative", { ...base, page: { ...base.page, total: -1 } }],
      ["page total fractional", { ...base, page: { ...base.page, total: 1.5 } }],
      ["page total NaN", { ...base, page: { ...base.page, total: Number.NaN } }],
      [
        "page total unsafe",
        { ...base, page: { ...base.page, total: Number.MAX_SAFE_INTEGER + 1 } },
      ],
      ["meta extra", { ...base, meta: { ...base.meta, trace: "raw" } }],
      [
        "uuid not v4",
        { ...base, meta: { ...base.meta, requestId: "3f5a9c26-6571-1d6c-9c70-3517b2a7f4d8" } },
      ],
      [
        "uuid uppercase",
        { ...base, meta: { ...base.meta, requestId: base.meta.requestId.toUpperCase() } },
      ],
      ["uuid coerced", { ...base, meta: { ...base.meta, requestId: 7 } }],
      ["uuid oversized", { ...base, meta: { ...base.meta, requestId: "x".repeat(1_024) } }],
      ["schema drift", { ...base, meta: { ...base.meta, schemaVersion: "v2" } }],
    ];

    for (const [label, value] of invalid) {
      apiGet.mockResolvedValueOnce(value);
      await expect(fetchAdminLaMerchants({ limit: 20, offset: 0 }), label).rejects.toMatchObject({
        code: "MALFORMED_RESPONSE",
        status: 0,
      });
    }
  });

  it("rejects a response whose limit or offset does not match the canonical request", async () => {
    const fetchAdminLaMerchants = await requireApi();
    apiGet.mockResolvedValueOnce(envelope({ page: { limit: 10, offset: 40, total: 1 } }));
    await expect(fetchAdminLaMerchants({ limit: 20, offset: 40 })).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
      status: 0,
    });

    apiGet.mockResolvedValueOnce(envelope({ page: { limit: 20, offset: 20, total: 1 } }));
    await expect(fetchAdminLaMerchants({ limit: 20, offset: 40 })).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
      status: 0,
    });
  });

  it("maps bodyless, HTML-like, and malformed successful values to one local malformed error", async () => {
    const fetchAdminLaMerchants = await requireApi();
    for (const value of [undefined, {}, "<html>secret</html>", { error: "raw backend secret" }]) {
      apiGet.mockResolvedValueOnce(value);
      let caught: unknown;
      try {
        await fetchAdminLaMerchants({ limit: 20, offset: 0 });
      } catch (error) {
        caught = error;
      }
      expect(caught).toMatchObject({ code: "MALFORMED_RESPONSE", status: 0 });
      expect(String((caught as Error).message)).not.toMatch(/html|secret|backend/i);
    }
  });

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
    [599, "HTTP_FAILURE"],
  ])(
    "regenerates safe local mapping for HTTP %i and discards raw diagnostics",
    async (status, code) => {
      const fetchAdminLaMerchants = await requireApi();
      apiGet.mockRejectedValueOnce(rawError(status));

      let caught: unknown;
      try {
        await fetchAdminLaMerchants({ limit: 20, offset: 0 });
      } catch (error) {
        caught = error;
      }

      expect(caught).toMatchObject({ status, code, retryAfterSeconds: null });
      expect(String((caught as Error).message)).not.toMatch(
        /raw|secret|authorization|sentinel|la\.internal/i,
      );
      expect(String((caught as Error).stack)).not.toMatch(
        /raw stack|authorization|sentinel|la\.internal/i,
      );
      expect(caught).not.toHaveProperty("cause");
      expect(caught).not.toHaveProperty("response");
      expect(caught).not.toHaveProperty("query");
      expect(caught).not.toHaveProperty("requestId");
    },
  );

  it("normalizes invalid raw statuses and all non-Lian failures without retaining attacker data", async () => {
    const fetchAdminLaMerchants = await requireApi();
    const cases: Array<[unknown, string]> = [
      [rawError(0), "HTTP_FAILURE"],
      [rawError(399), "HTTP_FAILURE"],
      [rawError(401.5), "HTTP_FAILURE"],
      [rawError(Number.NaN), "HTTP_FAILURE"],
      [rawError(Number.POSITIVE_INFINITY), "HTTP_FAILURE"],
      [rawError("401"), "HTTP_FAILURE"],
      [rawError(null), "HTTP_FAILURE"],
      [rawError(600), "HTTP_FAILURE"],
      [new Error("redirected to https://evil.invalid/?token=sentinel"), "NETWORK_FAILURE"],
      [Object.assign(new Error("spoof"), { name: "AbortError" }), "NETWORK_FAILURE"],
    ];

    for (const [raw, code] of cases) {
      apiGet.mockRejectedValueOnce(raw);
      let caught: unknown;
      try {
        await fetchAdminLaMerchants({ limit: 20, offset: 0 });
      } catch (error) {
        caught = error;
      }
      expect(caught).toMatchObject({ status: 0, code, retryAfterSeconds: null });
      expect(String((caught as Error).message)).not.toMatch(/evil|token|sentinel|spoof/i);
    }
  });

  it("retains bounded retry seconds only for a 429", async () => {
    const fetchAdminLaMerchants = await requireApi();
    for (const [status, rawRetry, expected] of [
      [429, 1, 1],
      [429, 60, 60],
      [429, 0, null],
      [429, -1, null],
      [429, 1.5, null],
      [429, 61, null],
      [429, "10", null],
      [429, true, null],
      [429, {}, null],
      [503, 10, null],
    ] as const) {
      apiGet.mockRejectedValueOnce(rawError(status, rawRetry));
      await expect(fetchAdminLaMerchants({ limit: 20, offset: 0 })).rejects.toMatchObject({
        status,
        code: status === 429 ? "RATE_LIMITED" : "INTEGRATION_UNAVAILABLE",
        retryAfterSeconds: expected,
      });
    }
  });

  it("treats abort as local ownership only when the caller-owned signal is actually aborted", async () => {
    const fetchAdminLaMerchants = await requireApi();
    const live = new AbortController();
    apiGet.mockRejectedValueOnce(Object.assign(new Error("spoof"), { name: "AbortError" }));
    await expect(
      fetchAdminLaMerchants({ limit: 20, offset: 0 }, live.signal),
    ).rejects.toMatchObject({
      code: "NETWORK_FAILURE",
    });

    const aborted = new AbortController();
    aborted.abort();
    apiGet.mockRejectedValueOnce(rawError(499));
    await expect(
      fetchAdminLaMerchants({ limit: 20, offset: 0 }, aborted.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
