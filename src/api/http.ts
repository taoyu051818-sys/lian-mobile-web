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

async function readJsonResponse(response: Response): Promise<JsonRecord> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    const text = await response.text().catch(() => "");
    const preview = text.trim().slice(0, 80);
    throw new LianApiError(
      preview
        ? `接口返回的不是 JSON：${preview}`
        : `接口返回的不是 JSON（状态码 ${response.status}）`,
      response.status,
    );
  }

  try {
    return await response.json() as JsonRecord;
  } catch {
    throw new LianApiError(`接口返回 JSON 解析失败（状态码 ${response.status}）`, response.status);
  }
}

export async function apiGet<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(withApiBase(path), {
    credentials: "include",
    ...normalizeJsonOptions(options),
  });
  const data = await readJsonResponse(response);
  if (!response.ok) {
    const message = typeof data.error === "string" ? data.error : `请求失败（状态码 ${response.status}）`;
    throw new LianApiError(message, response.status);
  }
  return data as T;
}

export async function apiSend<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiGet<T>(path, options);
}
