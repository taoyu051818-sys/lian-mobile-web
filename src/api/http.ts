export class LianApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 0, code = "") {
    super(message);
    this.name = "LianApiError";
    this.status = status;
    this.code = code;
  }
}

type JsonRecord = Record<string, unknown>;

declare global {
  interface Window {
    LIAN_API_BASE_URL?: string;
  }
}

const API_BASE = typeof window !== "undefined" ? window.LIAN_API_BASE_URL || "" : "";

function withApiBase(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith("/") ? `${API_BASE}${path}` : path;
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
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
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

  return { message: `请求失败（状态码 ${status}）`, code };
}

export async function apiGet<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(withApiBase(path), {
    credentials: "include",
    ...normalizeJsonOptions(options),
  });
  const data = await response.json().catch(() => ({} as JsonRecord));
  if (!response.ok) {
    const error = extractApiError(data, response.status);
    throw new LianApiError(error.message, response.status, error.code);
  }
  return data as T;
}

export async function apiSend<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiGet<T>(path, options);
}
