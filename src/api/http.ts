export class LianApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "LianApiError";
    this.status = status;
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

export async function apiGet<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(withApiBase(path), {
    credentials: "include",
    ...normalizeJsonOptions(options),
  });
  const data = await response.json().catch(() => ({} as JsonRecord));
  if (!response.ok) {
    const message = typeof data.error === "string" ? data.error : `请求失败（状态码 ${response.status}）`;
    throw new LianApiError(message, response.status);
  }
  return data as T;
}

export async function apiSend<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiGet<T>(path, options);
}
