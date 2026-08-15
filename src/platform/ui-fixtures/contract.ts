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

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}): Response {
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
  return fixtureError(
    501,
    `离线 Fixture 未映射该请求：${method} ${path}`,
    UNMAPPED_FIXTURE_CODE,
    { "x-fixture-route": route || "unmatched" },
  );
}

export function blockedExternalResponse(url: string): Response {
  return fixtureError(
    502,
    `离线模式已阻止外部请求：${url}`,
    BLOCKED_FIXTURE_CODE,
  );
}
