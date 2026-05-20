import { buildApiUrl } from "../config/runtime-config";
import { ERROR_RATE_LIMIT } from "../config/brand";
import { ensureClientId } from "../platform/clientIdentity";
import { asNumber, asRecord, asString } from "../platform/api-normalizers";

export class LianApiError extends Error {
  status: number;
  code: string;
  retryAfterSeconds: number | null;

  constructor(message: string, status = 0, code = "", retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "LianApiError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type DiagnosticsEventName = "api.http.error";

export interface DiagnosticsEventMap {
  "api.http.error": {
    method: string;
    route: string;
    status: number;
    code: string;
    retryAfterSeconds: number | null;
  };
}

export interface SafeDiagnosticsEvent<Name extends DiagnosticsEventName = DiagnosticsEventName> {
  name: Name;
  recordedAt: string;
  payload: DiagnosticsEventMap[Name];
}

const RECENT_DIAGNOSTICS_EVENT_LIMIT = 20;
const recentDiagnosticsEvents: SafeDiagnosticsEvent[] = [];
const dynamicRouteSegmentPattern =
  /^(?:\d+|[0-9a-f]{8,}|[0-9a-f]{8}-[0-9a-f-]{27,}|(?=.*\d)[A-Za-z0-9_-]{12,})$/i;

function normalizeJsonOptions(options: RequestInit = {}) {
  if (!options.body) return options;
  const headers = new Headers(options.headers || {});
  if (!headers.has("content-type") && typeof options.body === "string") {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return { ...options, headers };
}

function parseRetryAfterSeconds(value: string | null): number | null {
  if (!value) return null;

  const numericSeconds = Number(value);
  if (Number.isFinite(numericSeconds) && numericSeconds > 0) {
    return Math.ceil(numericSeconds);
  }

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return null;

  const secondsUntilRetry = Math.ceil((retryAt - Date.now()) / 1000);
  return secondsUntilRetry > 0 ? secondsUntilRetry : null;
}

function extractApiError(data: unknown, status: number) {
  const record = asRecord(data);
  if (typeof record.error === "string" && record.error.trim()) {
    return { message: record.error.trim(), code: "" };
  }
  if (typeof record.message === "string" && record.message.trim()) {
    return { message: record.message.trim(), code: "" };
  }

  const statusRecord = asRecord(record.status);
  const code = typeof statusRecord.code === "string" ? statusRecord.code : "";
  if (typeof statusRecord.message === "string" && statusRecord.message.trim()) {
    return { message: statusRecord.message.trim(), code };
  }

  if (status === 429) {
    return { message: ERROR_RATE_LIMIT, code };
  }

  return { message: `请求失败（状态码 ${status}）`, code };
}

function buildApiError(
  data: unknown,
  status: number,
  fallbackMessage = "",
  retryAfterSeconds: number | null = null,
) {
  const error = extractApiError(data, status);
  if (fallbackMessage && error.message === `请求失败（状态码 ${status}）`) {
    return new LianApiError(fallbackMessage, status, error.code, retryAfterSeconds);
  }
  return new LianApiError(error.message, status, error.code, retryAfterSeconds);
}

function normalizeDiagnosticsMethod(method: unknown): string {
  const value = typeof method === "string" ? method.trim().toUpperCase() : "";
  return value || "GET";
}

function normalizeDiagnosticsCode(code: unknown): string {
  return typeof code === "string" ? code.trim().slice(0, 64) : "";
}

function normalizeDiagnosticsRouteSegment(segment: string): string {
  if (!segment) return "";
  if (segment.includes(".")) return ":redacted";
  return dynamicRouteSegmentPattern.test(segment) ? ":id" : segment;
}

export function normalizeDiagnosticsRoute(path: string): string {
  const raw = typeof path === "string" ? path.trim() : "";
  if (!raw) return "/";

  let pathname = raw;
  try {
    pathname = new URL(raw, "https://diagnostics.lian.invalid").pathname;
  } catch {
    pathname = raw;
  }

  pathname = pathname.split("?")[0]?.split("#")[0] || "/";
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;

  const normalized = pathname
    .split("/")
    .map((segment, index) => (index === 0 ? segment : normalizeDiagnosticsRouteSegment(segment)))
    .join("/")
    .replace(/\/{2,}/g, "/");

  return normalized || "/";
}

function sanitizeApiHttpErrorPayload(payload: unknown): DiagnosticsEventMap["api.http.error"] {
  const record = asRecord(payload);
  const status = Math.max(0, Math.trunc(asNumber(record.status, 0)));
  const retryAfterRaw = asNumber(record.retryAfterSeconds, Number.NaN);

  return {
    method: normalizeDiagnosticsMethod(record.method),
    route: normalizeDiagnosticsRoute(asString(record.route, "/")),
    status,
    code: normalizeDiagnosticsCode(record.code),
    retryAfterSeconds:
      Number.isFinite(retryAfterRaw) && retryAfterRaw > 0 ? Math.ceil(retryAfterRaw) : null,
  };
}

function pushDiagnosticsEvent<Name extends DiagnosticsEventName>(
  event: SafeDiagnosticsEvent<Name>,
): SafeDiagnosticsEvent<Name> {
  recentDiagnosticsEvents.push(event);
  if (recentDiagnosticsEvents.length > RECENT_DIAGNOSTICS_EVENT_LIMIT) {
    recentDiagnosticsEvents.splice(
      0,
      recentDiagnosticsEvents.length - RECENT_DIAGNOSTICS_EVENT_LIMIT,
    );
  }
  return event;
}

export function recordDiagnosticsEvent<Name extends DiagnosticsEventName>(
  name: Name,
  payload: unknown,
): SafeDiagnosticsEvent<Name> {
  switch (name) {
    case "api.http.error":
      return pushDiagnosticsEvent({
        name,
        recordedAt: new Date().toISOString(),
        payload: sanitizeApiHttpErrorPayload(payload),
      }) as SafeDiagnosticsEvent<Name>;
  }

  throw new Error(`unsupported diagnostics event: ${String(name)}`);
}

export function getRecentDiagnosticsEvents(): SafeDiagnosticsEvent[] {
  return recentDiagnosticsEvents.map((event) => ({
    ...event,
    payload: { ...event.payload },
  }));
}

export function clearRecentDiagnosticsEvents() {
  recentDiagnosticsEvents.length = 0;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({}) as T);
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  fallbackMessage = "",
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("x-client-id")) {
    headers.set("x-client-id", ensureClientId());
  }
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...normalizeJsonOptions({ ...options, headers }),
  });
  const data = await readJsonResponse<T>(response);
  if (!response.ok) {
    const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get("retry-after"));
    const error = buildApiError(data, response.status, fallbackMessage, retryAfterSeconds);
    recordDiagnosticsEvent("api.http.error", {
      method: options.method,
      route: path,
      status: response.status,
      code: error.code,
      retryAfterSeconds,
    });
    throw error;
  }
  return data;
}

export async function apiGet<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiRequest<T>(path, options);
}

export async function apiSend<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiRequest<T>(path, options);
}

export async function apiUpload<T>(
  path: string,
  body: FormData,
  fallbackMessage: string,
  options: RequestInit = {},
): Promise<T> {
  return apiRequest<T>(
    path,
    {
      method: "POST",
      body,
      ...options,
    },
    fallbackMessage,
  );
}
