/**
 * Runtime config accessor for LIAN frontend.
 *
 * PUBLIC config  – injected by the serve/rehearsal script into <head> BEFORE
 *   any app module script runs.  The accessor reads from window on every call
 *   so a late-injected value is never missed.
 *
 * PRIVATE config – the accessor validates each read:
 *   - Outside dev, localhost / 127.0.0.1 / ::1 origins are rejected.
 *   - Outside dev, LIAN_IMAGE_PROXY_BASE_URL must be non-empty and absolute.
 *   - Malformed or insecure URLs throw at read time rather than silently
 *     falling back to localhost.
 */

declare global {
  interface Window {
    __VITE_DEV__?: boolean;
    LIAN_API_BASE_URL?: string;
    LIAN_IMAGE_PROXY_BASE_URL?: string;
    LIAN_RELEASE_ID?: string;
    LIAN_BUILD_SHA?: string;
    LIAN_BUILD_TIME?: string;
    LIAN_RUNTIME_LANE?: string;
  }
}

type RuntimeWindowKey =
  | "LIAN_API_BASE_URL"
  | "LIAN_IMAGE_PROXY_BASE_URL"
  | "LIAN_RELEASE_ID"
  | "LIAN_BUILD_SHA"
  | "LIAN_BUILD_TIME"
  | "LIAN_RUNTIME_LANE";

export interface RuntimeConfig {
  /** May be empty when the API is same-origin. */
  apiBaseUrl: string;
  /** Always an absolute URL outside dev contexts. */
  imageProxyBaseUrl: string;
}

export interface ReleaseDiagnostics {
  releaseId: string;
  buildSha: string;
  buildTime: string;
  runtimeLane: string;
  mode: string;
  dev: boolean;
  apiBaseUrl: string;
  imageProxyBaseUrl: string;
  runtimeConfigStatus: "ok" | "invalid";
}

/** Read on every call so the accessor is never stale after injection. */
function readRaw(key: RuntimeWindowKey): string {
  return typeof window !== "undefined" ? (window[key] ?? "") : "";
}

function isLocalhostOrigin(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\/./i.test(value);
}

function readOptionalMetadata(
  key: "LIAN_RELEASE_ID" | "LIAN_BUILD_SHA" | "LIAN_BUILD_TIME" | "LIAN_RUNTIME_LANE",
  envValue: string | boolean | undefined,
): string {
  const runtimeValue = readRaw(key).trim();
  if (runtimeValue) return runtimeValue;
  return typeof envValue === "string" ? envValue.trim() : "";
}

/**
 * Dev-mode detection.  Vite sets import.meta.url with @fs or /@id prefixes
 * during dev; a built bundle uses a file:// or https?:// origin instead.
 */
export function isDevContext(): boolean {
  try {
    if (typeof window !== "undefined" && window.__VITE_DEV__) {
      return true;
    }
    const url = import.meta.url;
    return url.includes("/@fs/") || url.includes("/@id/") || url.includes("__vite_");
  } catch {
    return false;
  }
}

/**
 * Validate an env value read from process.env at build/serve time.
 *
 * - Allows empty (caller falls back to a default).
 * - Rejects values that look like paths rather than URLs.
 * - Outside dev, rejects localhost origins.
 *
 * Returns the trimmed, slash-stripped value or throws.
 */
export function parseEnvUrl(
  raw: string | undefined,
  label: string,
  { dev }: { dev: boolean },
): string {
  const value = (raw ?? "").trim().replace(/\/+$/, "");
  if (!value) return value;
  if (!isAbsoluteUrl(value)) {
    throw new Error(
      `[runtime-config] ${label} must be an absolute URL (got: ${JSON.stringify(value)})`,
    );
  }
  if (!dev && isLocalhostOrigin(value)) {
    throw new Error(
      `[runtime-config] ${label} must not use a localhost origin outside dev (got: ${JSON.stringify(value)})`,
    );
  }
  return value;
}

function validateAbsoluteOrEmpty(value: string, label: string, dev: boolean): string {
  if (!value) return value;
  if (!isAbsoluteUrl(value)) {
    throw new Error(`[runtime-config] ${label} is not an absolute URL: ${JSON.stringify(value)}`);
  }
  if (!dev && isLocalhostOrigin(value)) {
    throw new Error(
      `[runtime-config] ${label} must not use a localhost origin outside dev (got: ${JSON.stringify(value)})`,
    );
  }
  return value;
}

function validateAbsoluteRequired(value: string, label: string, dev: boolean): string {
  if (!value) {
    if (dev) return value;
    throw new Error(
      `[runtime-config] ${label} is missing; set it via the runtime config injection script`,
    );
  }
  return validateAbsoluteOrEmpty(value, label, dev);
}

export function getRuntimeConfig(): RuntimeConfig {
  const dev = isDevContext();
  return {
    apiBaseUrl: validateAbsoluteOrEmpty(readRaw("LIAN_API_BASE_URL"), "LIAN_API_BASE_URL", dev),
    imageProxyBaseUrl: validateAbsoluteRequired(
      readRaw("LIAN_IMAGE_PROXY_BASE_URL"),
      "LIAN_IMAGE_PROXY_BASE_URL",
      dev,
    ),
  };
}

export function getReleaseDiagnostics(): ReleaseDiagnostics {
  const dev = isDevContext();
  const env = import.meta.env;
  const mode =
    typeof env.MODE === "string" && env.MODE.trim()
      ? env.MODE.trim()
      : dev
        ? "development"
        : "production";
  let apiBaseUrl = "";
  let imageProxyBaseUrl = "";
  let runtimeConfigStatus: ReleaseDiagnostics["runtimeConfigStatus"] = "ok";

  try {
    ({ apiBaseUrl, imageProxyBaseUrl } = getRuntimeConfig());
  } catch {
    runtimeConfigStatus = "invalid";
  }

  return {
    releaseId: readOptionalMetadata("LIAN_RELEASE_ID", env.VITE_LIAN_RELEASE_ID),
    buildSha: readOptionalMetadata("LIAN_BUILD_SHA", env.VITE_LIAN_BUILD_SHA),
    buildTime: readOptionalMetadata("LIAN_BUILD_TIME", env.VITE_LIAN_BUILD_TIME),
    runtimeLane:
      readOptionalMetadata("LIAN_RUNTIME_LANE", env.VITE_LIAN_RUNTIME_LANE) || mode,
    mode,
    dev,
    apiBaseUrl,
    imageProxyBaseUrl,
    runtimeConfigStatus,
  };
}

/** Convenience accessor – prefer getRuntimeConfig() when both values are needed. */
export function getApiBase(): string {
  return validateAbsoluteOrEmpty(
    readRaw("LIAN_API_BASE_URL"),
    "LIAN_API_BASE_URL",
    isDevContext(),
  );
}

/** Shared builder so API modules do not each duplicate base-url joining. */
export function buildApiUrl(path: string): string {
  if (isAbsoluteUrl(path)) return path;
  return path.startsWith("/") ? `${getApiBase()}${path}` : path;
}

/** Convenience accessor – prefer getRuntimeConfig() when both values are needed. */
export function getImageProxyBase(): string {
  return validateAbsoluteRequired(
    readRaw("LIAN_IMAGE_PROXY_BASE_URL"),
    "LIAN_IMAGE_PROXY_BASE_URL",
    isDevContext(),
  );
}
