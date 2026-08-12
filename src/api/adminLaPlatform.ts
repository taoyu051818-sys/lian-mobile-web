import { apiGet, LianApiError } from "./http";

export interface AdminLaMerchantQuery {
  limit: number;
  offset: number;
  q?: string;
  status?: "active" | "inactive";
}

export interface AdminLaMerchant {
  id: string;
  code: string;
  displayName: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface AdminLaMerchantEnvelope {
  data: AdminLaMerchant[];
  page: { limit: number; offset: number; total: number };
  meta: { requestId: string; schemaVersion: "v1" };
}

export class AdminLaPlatformError extends Error {
  status: number;
  code: string;
  retryAfterSeconds: number | null;

  constructor(message: string, status: number, code: string, retryAfterSeconds: number | null) {
    super(message);
    this.name = "AdminLaPlatformError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const BFF_PATH = "/api/admin/laplatform/merchants";
const ENVELOPE_KEYS = ["data", "page", "meta"] as const;
const MERCHANT_KEYS = ["id", "code", "displayName", "status", "createdAt", "updatedAt"] as const;
const PAGE_KEYS = ["limit", "offset", "total"] as const;
const META_KEYS = ["requestId", "schemaVersion"] as const;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;
const CODE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/u;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const UTC_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/u;

const LOCAL_MESSAGES: Record<string, string> = {
  REQUEST_CONTRACT: "The merchants request does not match the local contract.",
  AUTH_REQUIRED: "Sign in before opening the merchants directory.",
  CAPABILITY_REQUIRED: "This account cannot read the merchants directory.",
  BFF_NOT_DEPLOYED: "The merchants service is not deployed on this LIAN server.",
  PREREQUISITE_UNAVAILABLE: "A required merchants service is unavailable.",
  RATE_LIMITED: "The merchants service is busy. Try again later.",
  TEMPORARILY_UNAVAILABLE: "The merchants directory is temporarily unavailable.",
  INTEGRATION_UNAVAILABLE: "The merchants integration is not available.",
  HTTP_FAILURE: "The merchants request failed safely.",
  NETWORK_FAILURE: "The merchants service could not be reached.",
  MALFORMED_RESPONSE: "The merchants service returned an invalid response.",
};

function safeError(code: string, status = 0, retryAfterSeconds: number | null = null) {
  return new AdminLaPlatformError(
    LOCAL_MESSAGES[code] ?? LOCAL_MESSAGES.HTTP_FAILURE,
    status,
    code,
    retryAfterSeconds,
  );
}

function abortError() {
  const error = new Error("The local merchants request was cancelled.");
  error.name = "AbortError";
  return error;
}

type UnknownDataProperties<Keys extends readonly string[]> = {
  [Key in Keys[number]]: unknown;
};

function readExactDataProperties<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): UnknownDataProperties<Keys> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Object.prototype) return null;
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== keys.length ||
    ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
  ) {
    return null;
  }

  const properties: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) return null;
    properties[key] = descriptor.value;
  }
  return properties as UnknownDataProperties<Keys>;
}

function readAllowedDataProperties(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[],
): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Object.prototype) return null;

  const allowedKeys = [...requiredKeys, ...optionalKeys];
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.some((key) => typeof key !== "string" || !allowedKeys.includes(key)) ||
    requiredKeys.some((key) => !ownKeys.includes(key))
  ) {
    return null;
  }

  const properties: Record<string, unknown> = {};
  for (const key of ownKeys) {
    if (typeof key !== "string") return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) return null;
    properties[key] = descriptor.value;
  }
  return properties;
}

function readDenseDataItems(value: unknown): unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (!lengthDescriptor || !("value" in lengthDescriptor) || lengthDescriptor.enumerable) {
    return null;
  }
  const length = lengthDescriptor.value;
  if (!Number.isSafeInteger(length) || length < 0) return null;

  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== length + 1 || !ownKeys.includes("length")) return null;

  const items: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !("value" in descriptor)) return null;
    items.push(descriptor.value);
  }
  return items;
}

function isRealUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = UTC_TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;
  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

function normalizeQuery(query: AdminLaMerchantQuery): AdminLaMerchantQuery {
  try {
    const values = readAllowedDataProperties(query, ["limit", "offset"], ["q", "status"]);
    if (!values) throw new Error();

    const { limit, offset, q: rawQ, status } = values;
    if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 100) {
      throw new Error();
    }
    if (!Number.isSafeInteger(offset) || (offset as number) < 0 || (offset as number) > 1_000_000) {
      throw new Error();
    }
    if (rawQ !== undefined && typeof rawQ !== "string") throw new Error();
    const q = rawQ?.trim() ?? "";
    if (q.length > 160) throw new Error();
    if (status !== undefined && status !== "active" && status !== "inactive") {
      throw new Error();
    }

    return {
      limit: limit as number,
      offset: offset as number,
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
    };
  } catch {
    throw safeError("REQUEST_CONTRACT");
  }
}

function decodeMerchant(value: unknown): AdminLaMerchant | null {
  const properties = readExactDataProperties(value, MERCHANT_KEYS);
  if (!properties) return null;
  const { id, code, displayName, status, createdAt, updatedAt } = properties;
  if (typeof id !== "string" || !ID_PATTERN.test(id)) return null;
  if (typeof code !== "string" || !CODE_PATTERN.test(code)) return null;
  if (typeof displayName !== "string" || displayName.length < 1 || displayName.length > 160) {
    return null;
  }
  if (status !== "active" && status !== "inactive") return null;
  if (!isRealUtcTimestamp(createdAt) || !isRealUtcTimestamp(updatedAt)) return null;
  return { id, code, displayName, status, createdAt, updatedAt };
}

function decodeEnvelopeUnsafe(
  value: unknown,
  query: AdminLaMerchantQuery,
): AdminLaMerchantEnvelope | null {
  const envelope = readExactDataProperties(value, ENVELOPE_KEYS);
  if (!envelope) return null;
  const rawRows = readDenseDataItems(envelope.data);
  const page = readExactDataProperties(envelope.page, PAGE_KEYS);
  const meta = readExactDataProperties(envelope.meta, META_KEYS);
  if (!rawRows || !page || !meta) return null;

  const rows: AdminLaMerchant[] = [];
  for (const rawRow of rawRows) {
    const row = decodeMerchant(rawRow);
    if (!row) return null;
    rows.push(row);
  }

  const { limit, offset, total } = page;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return null;
  }
  if (
    typeof offset !== "number" ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 1_000_000
  ) {
    return null;
  }
  if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0) return null;
  if (limit !== query.limit || offset !== query.offset) return null;

  const { requestId, schemaVersion } = meta;
  if (typeof requestId !== "string" || !UUID_V4_PATTERN.test(requestId)) return null;
  if (schemaVersion !== "v1") return null;

  return {
    data: rows,
    page: { limit, offset, total },
    meta: { requestId, schemaVersion },
  };
}

function decodeEnvelope(value: unknown, query: AdminLaMerchantQuery): AdminLaMerchantEnvelope {
  try {
    const decoded = decodeEnvelopeUnsafe(value, query);
    if (!decoded) throw new Error();
    return decoded;
  } catch {
    throw safeError("MALFORMED_RESPONSE");
  }
}

function mapHttpCode(status: number): string {
  switch (status) {
    case 400:
      return "REQUEST_CONTRACT";
    case 401:
      return "AUTH_REQUIRED";
    case 403:
      return "CAPABILITY_REQUIRED";
    case 404:
      return "BFF_NOT_DEPLOYED";
    case 428:
      return "PREREQUISITE_UNAVAILABLE";
    case 429:
      return "RATE_LIMITED";
    case 499:
    case 500:
    case 502:
    case 504:
      return "TEMPORARILY_UNAVAILABLE";
    case 503:
      return "INTEGRATION_UNAVAILABLE";
    default:
      return "HTTP_FAILURE";
  }
}

function mapTransportError(error: unknown) {
  try {
    if (error instanceof LianApiError) {
      const status = error.status;
      if (Number.isInteger(status) && status >= 400 && status <= 599) {
        const code = mapHttpCode(status);
        const rawRetryAfterSeconds: unknown = error.retryAfterSeconds;
        const retryAfterSeconds =
          status === 429 &&
          typeof rawRetryAfterSeconds === "number" &&
          Number.isInteger(rawRetryAfterSeconds) &&
          rawRetryAfterSeconds >= 1 &&
          rawRetryAfterSeconds <= 60
            ? rawRetryAfterSeconds
            : null;
        return safeError(code, status, retryAfterSeconds);
      }
      return safeError("HTTP_FAILURE");
    }
  } catch {
    return safeError("NETWORK_FAILURE");
  }
  return safeError("NETWORK_FAILURE");
}

export async function fetchAdminLaMerchants(
  requestedQuery: AdminLaMerchantQuery,
  signal?: AbortSignal,
): Promise<AdminLaMerchantEnvelope> {
  const query = normalizeQuery(requestedQuery);
  const search = new URLSearchParams();
  search.set("limit", String(query.limit));
  search.set("offset", String(query.offset));
  if (query.q) search.set("q", query.q);
  if (query.status) search.set("status", query.status);

  const options: RequestInit = { cache: "no-store", redirect: "error" };
  if (signal) options.signal = signal;

  let raw: unknown;
  try {
    raw = await apiGet<unknown>(`${BFF_PATH}?${search.toString()}`, options);
  } catch (error) {
    if (signal?.aborted) throw abortError();
    throw mapTransportError(error);
  }
  if (signal?.aborted) throw abortError();
  return decodeEnvelope(raw, query);
}
