/**
 * Response builders for the offline fixture runtime.
 *
 * Error bodies deliberately match the exact shape `extractApiError()` in
 * src/api/http.ts reads (`error` / `message` / `status.message`, plus `code`),
 * and 429 carries a real `retry-after` header so `parseRetryAfterSeconds()`
 * exercises its normal path. Anything else would make fixtures pass while the
 * production error mapping silently rots.
 */

import type { FixtureScenario } from "./types";

export const UNMAPPED_FIXTURE_CODE = "UNMAPPED_FIXTURE_REQUEST";
export const BLOCKED_FIXTURE_CODE = "BLOCKED_EXTERNAL_REQUEST";

function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

/** 200 with a JSON body. */
export function fixtureJson(body: unknown, status = 200): Response {
  return jsonResponse(body, status);
}

export function fixtureError(
  status: number,
  message: string,
  code: string,
  headers: Record<string, string> = {},
): Response {
  return jsonResponse({ error: message, code }, status, headers);
}

/** 204, for endpoints whose real contract returns no content. */
export function fixtureNoContent(): Response {
  return new Response(null, { status: 204 });
}

/**
 * Deterministic lowercase UUIDv4 derived from a seed string.
 *
 * The commerce decoder rejects any `x-request-id` that is not UUIDv4 and then
 * cross-checks it against `meta.requestId`, so fixtures need a real-looking id
 * that stays stable across reloads (a random one would make request-id
 * assertions and repeat screenshots non-reproducible).
 */
export function fixtureRequestId(seed: string): string {
  let h1 = 0x9e3779b9;
  let h2 = 0x85ebca6b;
  for (let index = 0; index < seed.length; index += 1) {
    h1 = Math.imul(h1 ^ seed.charCodeAt(index), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + seed.charCodeAt(index) + index, 0x85ebca6b) >>> 0;
  }
  const hex = (value: number, length: number) =>
    (value >>> 0).toString(16).padStart(8, "0").slice(0, length);
  const a = hex(h1, 8);
  const b = hex(Math.imul(h1 ^ h2, 0x27d4eb2d), 4);
  const c = `4${hex(Math.imul(h2, 0x165667b1), 3)}`;
  // Variant nibble must be one of 8/9/a/b for UUIDv4.
  const variant = "89ab"[(h1 ^ h2) & 3] ?? "8";
  const d = `${variant}${hex(Math.imul(h2 ^ 0x5bf03635, 0x2545f491), 3)}`;
  const e = `${hex(Math.imul(h1 + h2, 0x9e3779b1), 8)}${hex(Math.imul(h2 ^ h1, 0xc2b2ae35), 4)}`;
  return `${a}-${b}-${c}-${d}-${e}`;
}

/**
 * 200 with the exact header triple the commerce decoder asserts on
 * (`application/json`, `cache-control: no-store`, UUIDv4 `x-request-id`).
 *
 * The body builder receives the generated id so it can echo it into
 * `meta.requestId`; the real decoder treats a mismatch as malformed.
 */
export function fixtureStrictJson(
  buildBody: (requestId: string) => unknown,
  seed: string,
): Response {
  const requestId = fixtureRequestId(seed);
  return new Response(JSON.stringify(buildBody(requestId)), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-request-id": requestId,
    },
  });
}

/**
 * 404 for a resource-shaped miss (unknown store/product id).
 *
 * Distinct from the `not-found` scenario switch: this fires when the requested
 * id genuinely is not in the fixture set, so a page can be driven into its
 * not-found branch by URL alone without changing the active scenario.
 */
export function fixtureNotFound(message: string): Response {
  return fixtureError(404, message, "FIXTURE_RESOURCE_NOT_FOUND");
}

export interface TransportFailure {
  status: number;
  message: string;
  code: string;
  headers?: Record<string, string>;
}

/**
 * Maps a transport-level scenario to its response. Returning `null` means the
 * scenario is data-shaping and must be delegated to the endpoint handler.
 */
export function resolveTransportFailure(scenario: FixtureScenario): TransportFailure | null {
  switch (scenario) {
    case "error":
      return { status: 500, message: "服务暂时不可用，请稍后再试", code: "FIXTURE_SERVER_ERROR" };
    case "not-found":
      return { status: 404, message: "内容不存在或已被删除", code: "FIXTURE_NOT_FOUND" };
    case "unauthorized":
      return { status: 401, message: "登录状态已失效，请重新登录", code: "FIXTURE_UNAUTHORIZED" };
    case "forbidden":
      return { status: 403, message: "没有访问该内容的权限", code: "FIXTURE_FORBIDDEN" };
    case "rate-limited":
      return {
        status: 429,
        message: "操作过于频繁，请稍后再试",
        code: "FIXTURE_RATE_LIMITED",
        headers: { "retry-after": "30" },
      };
    default:
      return null;
  }
}

export function unmappedFixtureResponse(method: string, path: string, route: string): Response {
  return fixtureError(501, `离线 Fixture 未映射该请求：${method} ${path}`, UNMAPPED_FIXTURE_CODE, {
    "x-fixture-route": route || "unmatched",
  });
}

export function blockedExternalResponse(url: string): Response {
  return fixtureError(502, `离线模式已阻止外部请求：${url}`, BLOCKED_FIXTURE_CODE);
}
