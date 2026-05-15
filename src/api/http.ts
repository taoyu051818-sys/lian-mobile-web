import { buildApiUrl, getApiBase } from "../config/runtime-config";

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

type JsonRecord = Record<string, unknown>;

export function withApiBase(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith("/") ? `${getApiBase()}${path}` : path;
}


function normalizeJsonOptions(options: RequestInit = {}) {
  if (!options.body) return options;
  const headers = new Headers(options.headers || {});
  if (!headers.has("content-type") && typeof options.body === "string") {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return { ...options, headers };
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
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
    return { message: "发送太频繁，请稍后再试。", code };
  }

  return { message: `请求失败（状态码 ${status}）`, code };
}

function buildApiError(data: unknown, status: number, fallbackMessage = "", retryAfterSeconds: number | null = null) {
  const error = extractApiError(data, status);
  if (fallbackMessage && error.message === `请求失败（状态码 ${status}）`) {
    return new LianApiError(fallbackMessage, status, error.code, retryAfterSeconds);
  }
  return new LianApiError(error.message, status, error.code, retryAfterSeconds);
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({} as T));
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  fallbackMessage = "",
): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...normalizeJsonOptions(options),
  });
  const data = await readJsonResponse<T>(response);
  if (!response.ok) {
    throw buildApiError(data, response.status, fallbackMessage, parseRetryAfterSeconds(response.headers.get("retry-after")));
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
