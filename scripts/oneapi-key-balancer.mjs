#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const WINDOW_MS = 3 * 60 * 60 * 1000;
const DEFAULT_WARN_RATIO = 0.85;
const DEFAULT_HARD_RATIO = 0.95;
const DEFAULT_STATE_PATH = path.join(os.tmpdir(), "oneapi-key-balancer-state.json");

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function maskKey(value) {
  if (!value) return "";
  const normalized = String(value);
  if (normalized.length <= 12) return `${normalized.slice(0, 2)}***${normalized.slice(-2)}`;
  return `${normalized.slice(0, 6)}***${normalized.slice(-6)}`;
}

function normalizeKeyId(value) {
  return String(value || "")
    .trim()
    .replace(/^sk-/, "");
}

function usageKey(value) {
  return normalizeKeyId(value);
}

function nowMs() {
  return Date.now();
}

function buildKeys() {
  const keys = [
    {
      label: "keyA",
      key: process.env.ONEAPI_KEY_A || process.env.API_KEY_A || "",
      limit: readNumber(process.env.ONEAPI_KEY_A_LIMIT, 300),
    },
    {
      label: "keyB",
      key: process.env.ONEAPI_KEY_B || process.env.API_KEY_B || "",
      limit: readNumber(process.env.ONEAPI_KEY_B_LIMIT, 600),
    },
  ].filter((entry) => entry.key);

  if (!keys.length) {
    throw new Error(
      "Missing API keys. Set ONEAPI_KEY_A / ONEAPI_KEY_B (or API_KEY_A / API_KEY_B).",
    );
  }

  return keys.map((entry) => ({
    ...entry,
    keyId: normalizeKeyId(entry.key),
    maskedKey: maskKey(entry.key),
  }));
}

async function loadState(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data?.events) ? data : { events: [] };
  } catch {
    return { events: [] };
  }
}

async function saveState(filePath, state) {
  await fs.writeFile(filePath, JSON.stringify(state, null, 2));
}

function pruneEvents(events, currentTime = nowMs()) {
  return events.filter((event) => currentTime - Number(event.at || 0) <= WINDOW_MS);
}

function usageInWindow(events, keyId) {
  return events
    .filter((event) => event.keyId === keyId)
    .reduce((sum, event) => sum + readNumber(event.count, 0), 0);
}

function pickRecommendation(snapshots) {
  const sorted = [...snapshots].sort((a, b) => {
    if (a.hardLimit !== b.hardLimit) return Number(a.hardLimit) - Number(b.hardLimit);
    if (a.pressure !== b.pressure) return a.pressure - b.pressure;
    if (a.remainingCalls !== b.remainingCalls) return b.remainingCalls - a.remainingCalls;
    return a.label.localeCompare(b.label);
  });
  return sorted[0] || null;
}

function recommendParallelism(snapshots) {
  const maxPressure = Math.max(...snapshots.map((item) => item.pressure), 0);
  const minRemaining = Math.min(...snapshots.map((item) => item.remainingCalls), Infinity);
  if (maxPressure >= DEFAULT_HARD_RATIO || minRemaining <= 10) return 1;
  if (maxPressure >= DEFAULT_WARN_RATIO || minRemaining <= 30) return 2;
  if (maxPressure >= 0.7 || minRemaining <= 60) return 3;
  return 4;
}

function extractInterestingFields(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const directKeys = [
    "balance",
    "quota",
    "usedQuota",
    "remainQuota",
    "usedAmount",
    "requestCount",
    "count",
    "data",
    "message",
    "success",
  ];
  const out = {};
  for (const key of directKeys) {
    if (key in payload) out[key] = payload[key];
  }
  return Object.keys(out).length ? out : payload;
}

async function fetchBalance(baseUrl, cookie, newApiUser, keyConfig) {
  const endpoint = new URL(`/api/balance/${keyConfig.keyId}`, baseUrl);
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Cookie: cookie,
      "New-API-User": newApiUser,
      "Cache-Control": "no-store",
      "User-Agent": "Claude-Code-OneAPI-Balancer/1.0",
    },
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!response.ok) {
    throw new Error(`Balance query failed for ${keyConfig.label}: ${response.status} ${text}`);
  }
  return {
    status: response.status,
    payload: json ?? text,
    summary: extractInterestingFields(json ?? text),
  };
}

function buildSnapshots(keys, events) {
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
      nearLimit: pressure >= DEFAULT_WARN_RATIO,
      hardLimit: pressure >= DEFAULT_HARD_RATIO || remainingCalls <= 0,
    };
  });
}

function parseBalancePayload(payload, fallbackLimit) {
  const data =
    payload && typeof payload === "object" && payload.data && typeof payload.data === "object"
      ? payload.data
      : {};
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
  };
}

function mergeSnapshots(keys, localSnapshots, liveBalanceByKeyId) {
  return localSnapshots.map((local) => {
    const key = keys.find((entry) => entry.keyId === local.keyId);
    const live = liveBalanceByKeyId.get(local.keyId);
    if (!live) {
      return {
        ...local,
        source: "local-window",
        nearLimit: local.pressure >= DEFAULT_WARN_RATIO,
        hardLimit: local.pressure >= DEFAULT_HARD_RATIO || local.remainingCalls <= 0,
        selectedReason: "using local rolling-window usage",
      };
    }

    return {
      label: local.label,
      keyId: local.keyId,
      maskedKey: key?.maskedKey || local.maskedKey,
      limit: live.limit,
      usedCalls: live.usedCalls,
      remainingCalls: live.remainingCalls,
      pressure: live.pressure,
      source: "live-balance",
      nearLimit: live.pressure >= DEFAULT_WARN_RATIO,
      hardLimit: live.pressure >= DEFAULT_HARD_RATIO || live.remainingCalls <= 0,
      localWindowUsedCalls: local.usedCalls,
      selectedReason: "using live rate_limit_remaining",
    };
  });
}

function buildWarnings(snapshots, queriedBalance) {
  const warnings = [];
  if (!queriedBalance) {
    warnings.push(
      "Live balance disabled: set ONEAPI_SESSION_COOKIE and ONEAPI_NEW_API_USER to use rate_limit_remaining.",
    );
  }
  for (const item of snapshots) {
    if (item.hardLimit) {
      warnings.push(
        `${item.label} is at hard limit (${item.remainingCalls}/${item.limit} remaining).`,
      );
    } else if (item.nearLimit) {
      warnings.push(
        `${item.label} is near limit (${item.remainingCalls}/${item.limit} remaining).`,
      );
    }
  }
  return warnings;
}

function buildStatusPayload({ windowHours, statePath, baseUrl, queriedBalance, snapshots }) {
  const recommendation = pickRecommendation(snapshots);
  const recommendedParallelism = recommendParallelism(snapshots);
  const warnings = buildWarnings(snapshots, queriedBalance);
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

  return {
    ok: Boolean(chosenKey),
    windowHours,
    statePath,
    baseUrl,
    queriedBalance,
    chosenKey,
    recommendation,
    snapshots,
    recommendedParallelism,
    warnings,
  };
}

function parseArgs(argv) {
  const [command = "status", ...rest] = argv;
  const options = { command, record: false, count: 1, key: "", json: false };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === "--record") options.record = true;
    else if (token === "--json") options.json = true;
    else if (token === "--count") options.count = readNumber(rest[i + 1], 1);
    else if (token === "--key") options.key = String(rest[i + 1] || "");
    if (token === "--count" || token === "--key") i += 1;
  }
  return options;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const statePath = process.env.ONEAPI_USAGE_STATE_PATH || DEFAULT_STATE_PATH;
  const baseUrl = process.env.ONEAPI_BASE_URL || "https://vip.aipro.love";
  const cookie = process.env.ONEAPI_SESSION_COOKIE || process.env.ONEAPI_COOKIE || "";
  const newApiUser = process.env.ONEAPI_NEW_API_USER || process.env.NEW_API_USER || "";
  const queriedBalance = Boolean(cookie && newApiUser);
  const keys = buildKeys();
  const state = await loadState(statePath);
  const currentTime = nowMs();
  state.events = pruneEvents(state.events, currentTime);

  if (args.command === "record") {
    const keyId = usageKey(args.key || keys[0]?.keyId);
    state.events.push({ at: currentTime, keyId, count: Math.max(1, args.count) });
    await saveState(statePath, state);
    const snapshots = buildSnapshots(keys, state.events);
    const payload = buildStatusPayload({
      windowHours: 3,
      statePath,
      baseUrl,
      queriedBalance: false,
      snapshots: snapshots.map((item) => ({ ...item, source: "local-window" })),
    });
    console.log(
      JSON.stringify({ recorded: keyId, count: Math.max(1, args.count), ...payload }, null, 2),
    );
    return;
  }

  const liveBalanceByKeyId = new Map();
  const balanceResults = {};
  if (queriedBalance) {
    for (const key of keys) {
      const result = await fetchBalance(baseUrl, cookie, newApiUser, key);
      balanceResults[key.label] = result;
      liveBalanceByKeyId.set(key.keyId, parseBalancePayload(result.payload, key.limit));
    }
  }

  const localSnapshots = buildSnapshots(keys, state.events);
  const snapshots = mergeSnapshots(keys, localSnapshots, liveBalanceByKeyId);
  const status = buildStatusPayload({
    windowHours: 3,
    statePath,
    baseUrl,
    queriedBalance,
    snapshots,
  });

  if (args.command === "pick") {
    if (!status.recommendation) throw new Error("No usable key available.");
    if (args.record) {
      state.events.push({
        at: currentTime,
        keyId: status.recommendation.keyId,
        count: Math.max(1, args.count),
      });
      await saveState(statePath, state);
    }
    const selected = keys.find((key) => key.keyId === status.recommendation.keyId);
    const result = {
      selected: {
        label: status.recommendation.label,
        keyId: status.recommendation.keyId,
        maskedKey: status.recommendation.maskedKey,
        key: selected?.key || "",
        source: status.recommendation.source,
      },
      chosenKey: status.chosenKey,
      recommendation: status.recommendation,
      recommendedParallelism: status.recommendedParallelism,
      warnings: status.warnings,
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(JSON.stringify({ ...status, balanceResults }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
