import { isProductionMode } from "./security-mode.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function firstHeaderValue(value = "") {
  return String(value || "").split(",")[0].trim();
}

function getRequestOrigin(req = {}) {
  const host = firstHeaderValue(req.headers?.["x-forwarded-host"] || req.headers?.host || "");
  if (!host) return "";
  const proto = firstHeaderValue(req.headers?.["x-forwarded-proto"] || "http").toLowerCase() || "http";
  return `${proto}://${host}`;
}

function normalizeOrigin(value = "") {
  try {
    const parsed = new URL(String(value || ""));
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return "";
  }
}

function getRequestSourceOrigin(req = {}) {
  const origin = normalizeOrigin(req.headers?.origin || "");
  if (origin) return origin;
  const referer = normalizeOrigin(req.headers?.referer || "");
  return referer;
}

function isSameOriginRequest(req = {}) {
  const expected = normalizeOrigin(getRequestOrigin(req));
  const source = getRequestSourceOrigin(req);
  if (!source) return true;
  return Boolean(expected && source === expected);
}

function requireSameOrigin(req = {}) {
  if (!isProductionMode()) return;
  if (SAFE_METHODS.has(String(req.method || "GET").toUpperCase())) return;
  if (isSameOriginRequest(req)) return;
  const error = new Error("cross-origin state-changing request blocked");
  error.status = 403;
  throw error;
}

export {
  getRequestOrigin,
  getRequestSourceOrigin,
  isSameOriginRequest,
  normalizeOrigin,
  requireSameOrigin
};
