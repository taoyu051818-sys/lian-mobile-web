const buckets = new Map();

function nowMs() {
  return Date.now();
}

function normalizeRateLimitKey(value = "") {
  return String(value || "").trim().toLowerCase().slice(0, 200) || "unknown";
}

function getClientIp(req = {}) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";
}

function assertRateLimit(key, { max = 5, windowMs = 60_000, now = nowMs() } = {}) {
  const normalizedKey = normalizeRateLimitKey(key);
  const current = buckets.get(normalizedKey);
  if (!current || current.resetAt <= now) {
    buckets.set(normalizedKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, max - 1), resetAt: now + windowMs };
  }
  if (current.count >= max) {
    const error = new Error("too many requests");
    error.status = 429;
    error.retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    throw error;
  }
  current.count += 1;
  return { allowed: true, remaining: Math.max(0, max - current.count), resetAt: current.resetAt };
}

function checkRateLimit(req, bucket, subject = "", options = {}) {
  const ip = getClientIp(req);
  const key = `${bucket}:${normalizeRateLimitKey(ip)}:${normalizeRateLimitKey(subject)}`;
  return assertRateLimit(key, options);
}

function clearRateLimits() {
  buckets.clear();
}

export {
  assertRateLimit,
  checkRateLimit,
  clearRateLimits,
  getClientIp,
  normalizeRateLimitKey
};
