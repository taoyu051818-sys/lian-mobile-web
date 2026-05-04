import { isProductionMode, securityModeName } from "./security-mode.js";

function contentTypeIsHtml(contentType = "") {
  return String(contentType || "").toLowerCase().includes("text/html");
}

function productionContentSecurityPolicy(contentType = "") {
  if (!contentTypeIsHtml(contentType)) return "";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "img-src 'self' https://res.cloudinary.com data:",
    "script-src 'self' https://unpkg.com 'unsafe-inline'",
    "style-src 'self' https://unpkg.com 'unsafe-inline'",
    "font-src 'self' data:",
    "connect-src 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join("; ");
}

function securityHeaders(contentType = "") {
  const headers = { "x-lian-security-mode": securityModeName() };
  if (!isProductionMode()) return headers;

  headers["x-content-type-options"] = "nosniff";
  headers["referrer-policy"] = "no-referrer";
  headers["x-frame-options"] = "SAMEORIGIN";
  headers["permissions-policy"] = "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)";

  const csp = productionContentSecurityPolicy(contentType);
  if (csp) headers["content-security-policy"] = csp;
  return headers;
}

function responseHeaders(contentType = "", extra = {}) {
  return {
    ...securityHeaders(contentType),
    ...extra
  };
}

export {
  productionContentSecurityPolicy,
  responseHeaders,
  securityHeaders
};
