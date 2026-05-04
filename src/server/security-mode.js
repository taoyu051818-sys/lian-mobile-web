const TRUE_VALUES = new Set(["1", "true", "yes", "on", "production"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off", "development", "dev", "local"]);
let warned = false;

function normalizeMode(value = "") {
  return String(value || "").trim().toLowerCase();
}

function isProductionMode() {
  const explicit = normalizeMode(process.env.LIAN_SECURITY_MODE || process.env.SECURITY_MODE || "");
  if (TRUE_VALUES.has(explicit)) return true;
  if (FALSE_VALUES.has(explicit)) return false;
  return normalizeMode(process.env.NODE_ENV) === "production";
}

function securityModeName() {
  return isProductionMode() ? "production" : "development";
}

function warnDevelopmentSecurityMode() {
  if (isProductionMode() || warned) return;
  warned = true;
  console.warn([
    "[LIAN security warning] Running in development security mode.",
    "Sensitive setup/status details are exposed and production-only restrictions such as Origin/CSRF checks and auth rate limits are disabled.",
    "Set NODE_ENV=production or LIAN_SECURITY_MODE=production before exposing this service to users."
  ].join(" "));
}

export {
  isProductionMode,
  securityModeName,
  warnDevelopmentSecurityMode
};
