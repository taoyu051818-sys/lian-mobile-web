import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  apiGet,
  clearRecentDiagnosticsEvents,
  getRecentDiagnosticsEvents,
  normalizeDiagnosticsRoute,
  recordDiagnosticsEvent,
  LianApiError,
} from "../../src/api/http.ts";

describe("safe diagnostics telemetry", () => {
  const g = globalThis as unknown as {
    fetch?: typeof fetch;
    window?: Record<string, unknown>;
  };

  beforeEach(() => {
    clearRecentDiagnosticsEvents();
    g.window = {};
  });

  afterEach(() => {
    clearRecentDiagnosticsEvents();
    delete g.window;
    vi.restoreAllMocks();
  });

  it("normalizes route diagnostics to strip ids, query strings, and filenames", () => {
    expect(
      normalizeDiagnosticsRoute(
        "https://api.example.com/api/messages/1234567890abcdef/avatar.png?token=secret#frag",
      ),
    ).toBe("/api/messages/:id/:redacted");
  });

  it("records only allowlisted api error fields", () => {
    const event = recordDiagnosticsEvent("api.http.error", {
      method: "post",
      route: "https://api.example.com/api/messages/1234567890abcdef?token=secret",
      status: 429,
      code: "RATE_LIMIT",
      retryAfterSeconds: "2",
      fileName: "evidence.png",
      cookie: "session=secret",
      body: "private",
      coordinates: [31.23, 121.47],
    } as unknown);

    expect(event.payload).toEqual({
      method: "POST",
      route: "/api/messages/:id",
      status: 429,
      code: "RATE_LIMIT",
      retryAfterSeconds: 2,
    });
    expect((event.payload as Record<string, unknown>).fileName).toBeUndefined();
    expect((event.payload as Record<string, unknown>).cookie).toBeUndefined();
    expect(getRecentDiagnosticsEvents()).toHaveLength(1);
  });

  it("apiGet emits a typed diagnostics event before throwing", async () => {
    g.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ status: { code: "UPSTREAM_DOWN", message: "service unavailable" } }),
        {
          status: 503,
          headers: { "retry-after": "5", "content-type": "application/json" },
        },
      ),
    );

    await expect(apiGet("/api/messages/abc123def456ghi7?cursor=private")).rejects.toBeInstanceOf(
      LianApiError,
    );

    const [event] = getRecentDiagnosticsEvents();
    expect(event).toMatchObject({
      name: "api.http.error",
      payload: {
        method: "GET",
        route: "/api/messages/:id",
        status: 503,
        code: "UPSTREAM_DOWN",
        retryAfterSeconds: 5,
      },
    });
  });

  it.each([
    {
      envelope: {
        error: "top-level error",
        message: "top-level message",
        code: "TOP_LEVEL_CODE",
        status: { code: "NESTED_CODE", message: "nested message" },
      },
      expectedMessage: "top-level error",
    },
    {
      envelope: {
        message: "top-level message",
        code: "TOP_LEVEL_CODE",
        status: { code: "NESTED_CODE", message: "nested message" },
      },
      expectedMessage: "top-level message",
    },
  ])(
    "preserves top-level message and code before nested status fields",
    async ({ envelope, expectedMessage }) => {
      g.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(envelope), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      );

      await expect(apiGet("/api/test/error-envelope")).rejects.toMatchObject({
        code: "TOP_LEVEL_CODE",
        message: expectedMessage,
        name: "LianApiError",
        status: 400,
      });
    },
  );

  it("falls back to nested status code when a top-level code is absent", async () => {
    g.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "top-level error",
          status: { code: "NESTED_CODE", message: "nested message" },
        }),
        { status: 422, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(apiGet("/api/test/error-envelope")).rejects.toMatchObject({
      code: "NESTED_CODE",
      message: "top-level error",
      status: 422,
    });
  });

  it("keeps an empty code when the JSON envelope does not provide one", async () => {
    g.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "request rejected" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(apiGet("/api/test/error-envelope")).rejects.toMatchObject({
      code: "",
      message: "request rejected",
      status: 400,
    });
  });

  it("uses the generic fallback for a non-JSON response", async () => {
    g.fetch = vi.fn().mockResolvedValue(
      new Response("bad gateway", {
        status: 502,
        headers: { "content-type": "text/plain" },
      }),
    );

    await expect(apiGet("/api/test/error-envelope")).rejects.toMatchObject({
      code: "",
      message: "请求失败（状态码 502）",
      status: 502,
    });
  });
});
