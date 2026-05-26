#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const WINDOW_MS = 3 * 60 * 60 * 1000;
const LIVE_BALANCE_TTL_MS = 30_000;
const LIVE_BALANCE_TTL_EARLY_MS = 15_000;
const LIVE_BALANCE_TTL_BALANCE_MS = 10_000;
const LIVE_BALANCE_TTL_CONSTRAINED_MS = 5_000;
const LIVE_BALANCE_TTL_HIGH_PRESSURE_MS = 2_000;
const LOCAL_SHADOW_THRESHOLD = 10;
const DEFAULT_STATE_PATH = path.join(os.tmpdir(), "claude-code-balancer-state.json");
const DEFAULT_PORT = Number(process.env.CLAUDE_BALANCER_PORT || 8787);
const DEFAULT_WARN_RATIO = 0.85;
const DEFAULT_HARD_RATIO = 0.95;
const PRESSURE_EARLY_BALANCE_RATIO = 0.70;
const PRESSURE_BALANCE_RATIO = 0.80;
const PRESSURE_CONSTRAINED_RATIO = 0.90;
const PRESSURE_HARD_RATIO = DEFAULT_HARD_RATIO;
const HIGH_PRESSURE_TOTAL_REMAINING_THRESHOLD = 10;
const DEFAULT_UPSTREAM_BASE_URL = "https://vip.aipro.love";

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeKeyId(value) {
  return String(value || "").trim().replace(/^sk-/, "");
}

function maskKey(value) {
  if (!value) return "";
  const normalized = String(value);
  if (normalized.length <= 12) return `${normalized.slice(0, 2)}***${normalized.slice(-2)}`;
  return `${normalized.slice(0, 6)}***${normalized.slice(-6)}`;
}

function nowMs() {
  return Date.now();
}

function discoverKeySpecs() {
  const specs = [];
  for (const [name, value] of Object.entries(process.env)) {
    const match = /^CLAUDE_PROXY_KEY_([A-Z0-9_]+)$/.exec(name);
    if (!match) continue;
    const suffix = match[1];
    if (suffix.endsWith("_BALANCE_ID") || suffix.endsWith("_LIMIT") || suffix.endsWith("_FALLBACK")) continue;
    if (!value) continue;
    specs.push({
      suffix,
      label: `key-${suffix.toLowerCase()}`,
      key: value,
      limit: readNumber(process.env[`CLAUDE_PROXY_KEY_${suffix}_LIMIT`], 300),
      balanceId: process.env[`CLAUDE_PROXY_KEY_${suffix}_BALANCE_ID`] || value,
      fallbackOnly: String(process.env[`CLAUDE_PROXY_KEY_${suffix}_FALLBACK`] || "").trim() === "1",
    });
  }
  return specs.sort((a, b) => a.label.localeCompare(b.label));
}

function buildKeys() {
  const discovered = discoverKeySpecs();
  if (!discovered.length) {
    throw new Error("Missing upstream API keys. Set CLAUDE_PROXY_KEY_<NAME> env vars.");
  }

  return discovered.map((entry) => ({
    label: entry.label,
    key: entry.key,
    keyId: normalizeKeyId(entry.key),
    balanceId: normalizeKeyId(entry.balanceId),
    maskedKey: maskKey(entry.key),
    limit: entry.limit,
    fallbackOnly: entry.fallbackOnly,
  }));
}

function ensureStateShape(state) {
  return {
    events: Array.isArray(state?.events) ? state.events : [],
    forwards: Array.isArray(state?.forwards) ? state.forwards : [],
    shadowQuota: state?.shadowQuota && typeof state.shadowQuota === "object" ? state.shadowQuota : {},
  };
}

async function loadState(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return ensureStateShape(JSON.parse(raw));
  } catch {
    return ensureStateShape({});
  }
}

async function saveState(filePath, state) {
  await fs.writeFile(filePath, JSON.stringify(state, null, 2));
}

function pruneEvents(events, currentTime = nowMs()) {
  return events.filter((event) => currentTime - Number(event.at || 0) <= WINDOW_MS);
}

function pruneForwards(forwards, currentTime = nowMs()) {
  return forwards.filter((forward) => currentTime - Number(forward.at || 0) <= WINDOW_MS);
}

function usageInWindow(events, keyId) {
  return events
    .filter((event) => event.keyId === keyId)
    .reduce((sum, event) => sum + readNumber(event.count, 0), 0);
}

function buildLocalSnapshots(keys, events) {
  return keys.map((key) => {
    const usedCalls = usageInWindow(events, key.keyId);
    const remainingCalls = Math.max(0, key.limit - usedCalls);
    const pressure = key.limit > 0 ? usedCalls / key.limit : 1;
    return {
      label: key.label,
      keyId: key.keyId,
      maskedKey: key.maskedKey,
      limit: key.limit,
      usedCalls,
      remainingCalls,
      pressure,
      source: "local-window",
      fallbackOnly: key.fallbackOnly,
      nearLimit: pressure >= DEFAULT_WARN_RATIO,
      hardLimit: pressure >= DEFAULT_HARD_RATIO || remainingCalls <= 0,
      selectedReason: "using local rolling-window usage",
    };
  });
}

function parseBalancePayload(payload, fallbackLimit) {
  const data = payload?.data || {};
  const limit = readNumber(data.rate_limit_requests, fallbackLimit);
  const used = readNumber(data.rate_limit_used, 0);
  const remaining = Math.max(0, readNumber(data.rate_limit_remaining, Math.max(0, limit - used)));
  const pressure = limit > 0 ? used / limit : 1;
  return {
    limit,
    usedCalls: used,
    remainingCalls: remaining,
    pressure,
    queriedAt: nowMs(),
    payload,
  };
}

function _updateShadowQuota(state, snapshots) {
  const next = {};
  for (const snapshot of snapshots) {
    const current = state.shadowQuota?.[snapshot.keyId];
    if (snapshot.remainingCalls <= LOCAL_SHADOW_THRESHOLD) {
      next[snapshot.keyId] = {
        remainingCalls:
          current && Number.isFinite(current.remainingCalls)
            ? Math.min(snapshot.remainingCalls, current.remainingCalls)
            : snapshot.remainingCalls,
        observedAt: nowMs(),
      };
    }
  }
  state.shadowQuota = next;
}

function applyShadowQuota(snapshot, shadowQuota) {
  const shadow = shadowQuota?.[snapshot.keyId];
  if (!shadow || !Number.isFinite(shadow.remainingCalls)) return snapshot;
  const remainingCalls = Math.max(0, Math.min(snapshot.remainingCalls, shadow.remainingCalls));
  const usedCalls = Math.max(snapshot.usedCalls, snapshot.limit - remainingCalls);
  const pressure = snapshot.limit > 0 ? usedCalls / snapshot.limit : 1;
  return {
    ...snapshot,
    usedCalls,
    remainingCalls,
    pressure,
    nearLimit: pressure >= DEFAULT_WARN_RATIO,
    hardLimit: pressure >= DEFAULT_HARD_RATIO || remainingCalls <= 0,
    selectedReason: `${snapshot.selectedReason} + local shadow quota`,
    shadowRemainingCalls: remainingCalls,
  };
}

function mergeSnapshots(localSnapshots, liveCache, shadowQuota) {
  return localSnapshots.map((local) => {
    const live = liveCache.get(local.keyId);
    if (!live) return applyShadowQuota(local, shadowQuota);
    return applyShadowQuota({
      label: local.label,
      keyId: local.keyId,
      maskedKey: local.maskedKey,
      limit: live.limit,
      usedCalls: live.usedCalls,
      remainingCalls: live.remainingCalls,
      pressure: live.pressure,
      source: "live-balance",
      fallbackOnly: local.fallbackOnly,
      nearLimit: live.pressure >= DEFAULT_WARN_RATIO,
      hardLimit: live.pressure >= DEFAULT_HARD_RATIO || live.remainingCalls <= 0,
      recentCalls: live.payload?.data?.recent_calls || [],
      localWindowUsedCalls: local.usedCalls,
      selectedReason: "using live rate_limit_remaining",
    }, shadowQuota);
  });
}

function resolveQuotaAuth() {
  const cookie =
    process.env.ONEAPI_SESSION_COOKIE ||
    process.env.ONEAPI_COOKIE ||
    process.env.NEW_API_COOKIE ||
    "";
  const newApiUser =
    process.env.ONEAPI_NEW_API_USER ||
    process.env.NEW_API_USER ||
    process.env.ONEAPI_USERNAME ||
    process.env.NEW_API_USERNAME ||
    "";
  return { cookie, newApiUser, enabled: Boolean(cookie && newApiUser) };
}

async function fetchBalance(baseUrl, cookie, newApiUser, key) {
  const endpoint = new URL(`/api/balance/${key.balanceId}`, baseUrl);
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Cookie: cookie,
      "New-API-User": newApiUser,
      "Cache-Control": "no-store",
      "User-Agent": "Claude-Code-Balancer-Proxy/1.0",
    },
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  if (!response.ok || payload?.success === false) {
    throw new Error(`Balance query failed for ${key.label}: ${response.status} ${text}`);
  }
  return parseBalancePayload(payload, key.limit);
}

async function queryLiveBalances(upstreamBaseUrl, quotaAuth, keys, balanceCache, currentSnapshots = []) {
  const ttlMs = computeLiveBalanceTtlMs(currentSnapshots);
  const freshEntries = [];
  for (const key of keys) {
    let live = balanceCache.get(key.keyId);
    if (!live || nowMs() - live.queriedAt > ttlMs) {
      live = await fetchBalance(upstreamBaseUrl, quotaAuth.cookie, quotaAuth.newApiUser, key);
      balanceCache.set(key.keyId, live);
    }
    freshEntries.push([key.keyId, live]);
  }
  return new Map(freshEntries);
}

function _compositePressure(snapshots) {
  if (!snapshots.length) return 0;
  return snapshots.reduce((sum, item) => sum + item.pressure, 0) / snapshots.length;
}

function maxPressure(snapshots) {
  return snapshots.length
    ? snapshots.reduce((max, item) => Math.max(max, item.pressure), 0)
    : 0;
}

function minPressure(snapshots) {
  return snapshots.length
    ? snapshots.reduce((min, item) => Math.min(min, item.pressure), Number.POSITIVE_INFINITY)
    : 0;
}

function pressureSpread(snapshots) {
  if (!snapshots.length) return 0;
  return maxPressure(snapshots) - minPressure(snapshots);
}

function totalRemainingCalls(snapshots) {
  return snapshots.reduce((sum, item) => sum + Math.max(0, readNumber(item.remainingCalls, 0)), 0);
}

function shortWindowForwardCount(forwards, keyId, currentTime = nowMs(), windowMs = 60_000) {
  return (forwards || []).filter((forward) => forward.keyId === keyId && currentTime - Number(forward.at || 0) <= windowMs).length;
}

function classifyBalancingMode(snapshots) {
  const totalRemaining = totalRemainingCalls(snapshots);
  if (totalRemaining <= HIGH_PRESSURE_TOTAL_REMAINING_THRESHOLD) return "high-pressure";
  const hottest = maxPressure(snapshots);
  if (hottest >= PRESSURE_HARD_RATIO) return "hard-limit";
  if (hottest >= PRESSURE_CONSTRAINED_RATIO) return "constrained";
  if (hottest >= PRESSURE_BALANCE_RATIO) return "balanced";
  if (hottest >= PRESSURE_EARLY_BALANCE_RATIO) return "early-balance";
  return "normal";
}

function computeLiveBalanceTtlMs(snapshots) {
  const totalRemaining = totalRemainingCalls(snapshots);
  if (totalRemaining <= HIGH_PRESSURE_TOTAL_REMAINING_THRESHOLD) return LIVE_BALANCE_TTL_HIGH_PRESSURE_MS;
  const hottest = maxPressure(snapshots);
  if (hottest >= PRESSURE_CONSTRAINED_RATIO) return LIVE_BALANCE_TTL_CONSTRAINED_MS;
  if (hottest >= PRESSURE_BALANCE_RATIO) return LIVE_BALANCE_TTL_BALANCE_MS;
  if (hottest >= PRESSURE_EARLY_BALANCE_RATIO) return LIVE_BALANCE_TTL_EARLY_MS;
  return LIVE_BALANCE_TTL_MS;
}

function remainingRatio(snapshot) {
  return snapshot.limit > 0 ? Math.max(0, snapshot.remainingCalls) / snapshot.limit : 0;
}

function snapshotEligibility(snapshot) {
  if (snapshot.hardLimit || snapshot.remainingCalls <= 0 || snapshot.pressure >= PRESSURE_HARD_RATIO) {
    return "hard-blocked";
  }
  if (snapshot.pressure >= PRESSURE_CONSTRAINED_RATIO || snapshot.nearLimit) {
    return "deprioritized";
  }
  return "preferred";
}

function shouldUseFallbacks(snapshots) {
  const primarySnapshots = snapshots.filter((item) => !item.fallbackOnly);
  if (!primarySnapshots.length) return true;
  return primarySnapshots.every((item) => item.pressure >= PRESSURE_CONSTRAINED_RATIO || item.remainingCalls <= 0 || item.hardLimit);
}

function pickRecommendation(snapshots, forcedKeyLabel = "", forwards = []) {
  const forced = String(forcedKeyLabel || "").trim();
  if (forced) {
    const matched = snapshots.find((item) => item.label === forced);
    if (matched) return matched;
  }

  const allowFallbacks = shouldUseFallbacks(snapshots);
  const eligibleSnapshots = snapshots.filter((item) => allowFallbacks || !item.fallbackOnly);
  const currentMode = classifyBalancingMode(eligibleSnapshots);
  const now = nowMs();
  const scoredSnapshots = eligibleSnapshots
    .filter((item) => !item.hardLimit && item.remainingCalls > 0)
    .map((item) => {
      const ratio = remainingRatio(item);
      const recentForwardCount = shortWindowForwardCount(forwards, item.keyId, now);
      let score = ratio;
      if (item.pressure >= PRESSURE_EARLY_BALANCE_RATIO) score -= (item.pressure - PRESSURE_EARLY_BALANCE_RATIO) * 0.8;
      if (item.pressure >= PRESSURE_BALANCE_RATIO) score -= (item.pressure - PRESSURE_BALANCE_RATIO) * 1.4;
      if (item.pressure >= PRESSURE_CONSTRAINED_RATIO) score -= (item.pressure - PRESSURE_CONSTRAINED_RATIO) * 2.4;
      if (item.nearLimit) score -= 0.08;
      score -= recentForwardCount * 0.035;
      if (item.fallbackOnly) score -= 0.12;
      return {
        ...item,
        recentForwardCount,
        remainingRatio: ratio,
        score,
        eligibility: snapshotEligibility(item),
        selectedReason: `${currentMode} scoring (score=${score.toFixed(3)}, recentForwards=${recentForwardCount})`,
      };
    })
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.remainingCalls !== b.remainingCalls) return b.remainingCalls - a.remainingCalls;
      if (a.pressure !== b.pressure) return a.pressure - b.pressure;
      return a.label.localeCompare(b.label);
    });

  return scoredSnapshots[0] || eligibleSnapshots[0] || null;
}

function recommendParallelism(snapshots) {
  const totalRemaining = totalRemainingCalls(snapshots);
  if (totalRemaining <= HIGH_PRESSURE_TOTAL_REMAINING_THRESHOLD) return 1;

  const hottest = maxPressure(snapshots);
  const healthyPrimaryKeys = snapshots.filter(
    (item) => !item.fallbackOnly && !item.hardLimit && item.remainingCalls > 0 && item.pressure < PRESSURE_CONSTRAINED_RATIO,
  ).length;

  if (hottest >= PRESSURE_HARD_RATIO) return healthyPrimaryKeys >= 2 ? 2 : 1;
  if (hottest >= PRESSURE_CONSTRAINED_RATIO) return 2;
  if (hottest >= PRESSURE_BALANCE_RATIO) return healthyPrimaryKeys >= 2 ? 3 : 2;
  return 4;
}

function buildWarnings(snapshots, queriedBalance) {
  const warnings = [];
  if (!queriedBalance) {
    warnings.push("Live balance disabled: set ONEAPI_SESSION_COOKIE and ONEAPI_NEW_API_USER to use rate_limit_remaining.");
  }
  for (const item of snapshots) {
    if (item.hardLimit) warnings.push(`${item.label} is at hard limit (${item.remainingCalls}/${item.limit} remaining).`);
    else if (item.nearLimit) warnings.push(`${item.label} is near limit (${item.remainingCalls}/${item.limit} remaining).`);
  }
  return warnings;
}

function buildStatusPayload({ upstreamBaseUrl, queriedBalance, snapshots, forwards, forcedKeyLabel }) {
  const allLive = queriedBalance && snapshots.length > 0 && snapshots.every((item) => item.source === "live-balance");
  const balancingMode = classifyBalancingMode(snapshots);
  const ttlMs = computeLiveBalanceTtlMs(snapshots);
  const recommendation = allLive ? pickRecommendation(snapshots, forcedKeyLabel, forwards) : null;
  const lastForward = [...(forwards || [])].sort((a, b) => Number(b.at || 0) - Number(a.at || 0))[0] || null;
  const chosenKey = recommendation
    ? {
        label: recommendation.label,
        keyId: recommendation.keyId,
        maskedKey: recommendation.maskedKey,
        source: recommendation.source,
        remainingCalls: recommendation.remainingCalls,
        limit: recommendation.limit,
      }
    : null;
  const warnings = buildWarnings(snapshots, queriedBalance);
  const totalRemaining = totalRemainingCalls(snapshots);
  const highPressureMode = totalRemaining <= HIGH_PRESSURE_TOTAL_REMAINING_THRESHOLD;
  const now = nowMs();
  const enrichedSnapshots = snapshots.map((snapshot) => ({
    ...snapshot,
    remainingRatio: remainingRatio(snapshot),
    eligibility: snapshotEligibility(snapshot),
    recentForwardCount: shortWindowForwardCount(forwards, snapshot.keyId, now),
    snapshotAgeMs: snapshot.source === "live-balance" && Number.isFinite(snapshot.queriedAt)
      ? Math.max(0, now - snapshot.queriedAt)
      : null,
  }));
  if (!allLive) {
    warnings.unshift("Live balance is unavailable or incomplete; current load numbers are not trustworthy.");
  }
  if (highPressureMode) {
    warnings.unshift(
      `High-pressure mode active: total remaining calls ${totalRemaining} <= ${HIGH_PRESSURE_TOTAL_REMAINING_THRESHOLD}.`,
    );
  }
  return {
    ok: Boolean(chosenKey),
    trustedLoad: allLive,
    upstreamBaseUrl,
    queriedBalance,
    chosenKey,
    lastForward,
    recommendation,
    snapshots: enrichedSnapshots,
    totalRemainingCalls: totalRemaining,
    highPressureMode,
    recommendedParallelism: allLive ? recommendParallelism(snapshots) : null,
    balancer: {
      mode: balancingMode,
      pollTtlMs: ttlMs,
      maxPressure: maxPressure(snapshots),
      minPressure: minPressure(snapshots),
      pressureSpread: pressureSpread(snapshots),
      healthyPrimaryKeys: snapshots.filter((item) => !item.fallbackOnly && snapshotEligibility(item) === "preferred").length,
    },
    warnings,
  };
}

function normalizeUpstreamBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return DEFAULT_UPSTREAM_BASE_URL;
  const url = new URL(raw);
  const isLoopbackHost = ["127.0.0.1", "localhost", "0.0.0.0"].includes(url.hostname);
  if (isLoopbackHost && String(url.port || "") === String(DEFAULT_PORT)) {
    throw new Error(`Refusing to use local balancer URL as upstream (${url.origin}). Set ANTHROPIC_UPSTREAM_BASE_URL to the real upstream endpoint.`);
  }
  return url.toString().replace(/\/$/, "");
}

function buildForwardHeaders(reqHeaders, upstreamKey) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(reqHeaders)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (["host", "content-length", "connection"].includes(lower)) continue;
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else headers.set(key, value);
  }
  headers.set("x-api-key", upstreamKey);
  headers.set("authorization", `Bearer ${upstreamKey}`);
  return headers;
}

function buildForwardTarget(url, upstreamBaseUrl) {
  return new URL(url.pathname + url.search, `${upstreamBaseUrl}/`);
}

function buildForwardInit(req, upstreamKey) {
  const method = req.method || "GET";
  const init = {
    method,
    headers: buildForwardHeaders(req.headers, upstreamKey),
    duplex: "half",
  };
  if (method !== "GET" && method !== "HEAD") init.body = req;
  return init;
}

function resolveSelectedKey(keys, recommendation) {
  if (!recommendation) return null;
  return keys.find((key) => key.keyId === recommendation.keyId) || null;
}

function recordForward(state, recommendation, req) {
  const at = nowMs();
  state.events.push({ at, keyId: recommendation.keyId, count: 1, path: req.url || "/" });
  state.forwards.push({
    at,
    keyId: recommendation.keyId,
    label: recommendation.label,
    path: req.url || "/",
    method: req.method || "GET",
    source: recommendation.source,
  });
  if (state.shadowQuota?.[recommendation.keyId] && Number.isFinite(state.shadowQuota[recommendation.keyId].remainingCalls)) {
    state.shadowQuota[recommendation.keyId].remainingCalls = Math.max(0, state.shadowQuota[recommendation.keyId].remainingCalls - 1);
    state.shadowQuota[recommendation.keyId].observedAt = at;
  }
  state.events = pruneEvents(state.events);
  state.forwards = pruneForwards(state.forwards);
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(payload, null, 2));
}

async function main() {
  const keys = buildKeys();
  const statePath = process.env.CLAUDE_BALANCER_STATE_PATH || DEFAULT_STATE_PATH;
  const port = readNumber(process.env.CLAUDE_BALANCER_PORT, DEFAULT_PORT);
  const host = process.env.CLAUDE_BALANCER_HOST || "127.0.0.1";
  const upstreamBaseUrl = normalizeUpstreamBaseUrl(process.env.ANTHROPIC_UPSTREAM_BASE_URL);
  const quotaAuth = resolveQuotaAuth();
  const queriedBalance = quotaAuth.enabled;
  const forcedKeyLabel = process.env.CLAUDE_BALANCER_FORCE_KEY || "";
  const state = await loadState(statePath);
  state.events = pruneEvents(state.events);
  state.forwards = pruneForwards(state.forwards);
  const balanceCache = new Map();

  async function getSnapshots() {
    const localSnapshots = buildLocalSnapshots(keys, state.events);
    if (!queriedBalance) return localSnapshots;
    const liveBalances = await queryLiveBalances(upstreamBaseUrl, quotaAuth, keys, balanceCache, localSnapshots);
    return mergeSnapshots(localSnapshots, liveBalances).map((snapshot) => {
      const live = liveBalances.get(snapshot.keyId);
      return live ? { ...snapshot, queriedAt: live.queriedAt } : snapshot;
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "content-type",
          "cache-control": "no-store",
        });
        res.end();
        return;
      }
      const snapshots = await getSnapshots();
      const status = buildStatusPayload({ upstreamBaseUrl, queriedBalance, snapshots, forwards: state.forwards, forcedKeyLabel });

      if (url.pathname === "/_status") {
        writeJson(res, 200, status);
        return;
      }
      if (url.pathname === "/_pick") {
        writeJson(res, 200, {
          ok: status.ok,
          trustedLoad: status.trustedLoad,
          chosenKey: status.chosenKey,
          lastForward: status.lastForward,
          recommendation: status.recommendation,
          recommendedParallelism: status.recommendedParallelism,
          warnings: status.warnings,
        });
        return;
      }
      if (!status.trustedLoad) {
        writeJson(res, 503, {
          error: "Live balance unavailable or incomplete; refusing to route on untrusted load data.",
          warnings: status.warnings,
          snapshots: status.snapshots,
        });
        return;
      }
      if (!status.recommendation) {
        writeJson(res, 503, { error: "No upstream key available", warnings: status.warnings });
        return;
      }

      const selectedKey = resolveSelectedKey(keys, status.recommendation);
      if (!selectedKey) {
        writeJson(res, 500, { error: `Selected key ${status.recommendation.label} missing secret` });
        return;
      }

      const target = buildForwardTarget(url, upstreamBaseUrl);
      const init = buildForwardInit(req, selectedKey.key);
      recordForward(state, status.recommendation, req);
      await saveState(statePath, state);
      const upstreamResponse = await fetch(target, init);

      const responseHeaders = {};
      upstreamResponse.headers.forEach((value, key) => {
        if (["content-length", "connection", "transfer-encoding"].includes(key.toLowerCase())) return;
        responseHeaders[key] = value;
      });
      responseHeaders["x-claude-balancer-key"] = status.recommendation.label;
      responseHeaders["x-claude-balancer-parallelism"] = String(status.recommendedParallelism);
      res.writeHead(upstreamResponse.status, responseHeaders);

      if (!upstreamResponse.body) {
        res.end();
        return;
      }
      await pipeline(Readable.fromWeb(upstreamResponse.body), res);
    } catch (error) {
      if (res.headersSent) {
        res.destroy(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      writeJson(res, 502, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  server.on("error", (error) => {
    console.error(JSON.stringify({ ok: false, port, host, error: error.message || String(error) }));
    process.exit(1);
  });

  server.listen(port, host, () => {
    console.log(
      JSON.stringify(
        {
          ok: true,
          pid: process.pid,
          host,
          port,
          listen: `http://${host}:${port}`,
          upstreamBaseUrl,
          queriedBalance,
          statePath,
          statusEndpoint: `http://${host}:${port}/_status`,
          pickEndpoint: `http://${host}:${port}/_pick`,
          keys: keys.map((key) => ({ label: key.label, maskedKey: key.maskedKey })),
          usage: {
            setEnv: {
              ANTHROPIC_BASE_URL: `http://${host}:${port}`,
              ANTHROPIC_API_KEY: "local-balanced",
            },
          },
        },
        null,
        2,
      ),
    );
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
