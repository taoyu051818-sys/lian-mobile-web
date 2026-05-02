import fs from "node:fs/promises";
import crypto from "node:crypto";

import { memory } from "./cache.js";
import { aliasPoolPath } from "./paths.js";
import { sendJson } from "./http-response.js";
import { readJsonBody } from "./request-utils.js";
import { requireUser, publicAuthUser } from "./auth-service.js";
import { loadAuthStore, saveAuthStore } from "./data-store.js";

const MAX_ALIASES_PER_USER = 1;

async function loadAliasPool() {
  const now = Date.now();
  if (memory.aliasPool && now - memory.aliasPoolLoadedAt < 30_000) return memory.aliasPool;
  try {
    const raw = await fs.readFile(aliasPoolPath, "utf8");
    const data = JSON.parse(raw);
    memory.aliasPool = Array.isArray(data.aliases) ? data.aliases : [];
  } catch {
    memory.aliasPool = [];
  }
  memory.aliasPoolLoadedAt = now;
  return memory.aliasPool;
}

function findPoolEntry(pool, poolId) {
  return pool.find((item) => item.id === poolId) || null;
}

function userAliases(user = {}) {
  return Array.isArray(user.aliases) ? user.aliases : [];
}

function findUserAlias(user, aliasId) {
  return userAliases(user).find((a) => a.id === aliasId) || null;
}

function activeAlias(user = {}) {
  if (!user.activeAliasId) return null;
  return findUserAlias(user, user.activeAliasId) || null;
}

function normalizeAlias(alias = {}) {
  return {
    id: alias.id || "",
    poolId: alias.poolId || "",
    name: alias.name || "",
    avatarUrl: alias.avatarUrl || "",
    avatarSeed: alias.avatarSeed || "",
    createdAt: alias.createdAt || "",
    status: alias.status || "active"
  };
}

// --- Route handlers ---

async function handleGetAliasPool(_req, res) {
  const pool = await loadAliasPool();
  sendJson(res, 200, {
    aliases: pool.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || "",
      avatarSeed: item.avatarSeed || "",
      order: item.order || 0
    }))
  });
}

async function handleGetAliases(req, res) {
  const auth = await requireUser(req);
  const aliases = userAliases(auth.user).map(normalizeAlias);
  sendJson(res, 200, {
    aliases,
    activeAliasId: auth.user.activeAliasId || null
  });
}

async function handleCreateAlias(req, res) {
  const auth = await requireUser(req);
  const payload = await readJsonBody(req);
  const poolId = String(payload.poolId || "").trim();
  if (!poolId) return sendJson(res, 400, { error: "poolId is required" });

  const pool = await loadAliasPool();
  const entry = findPoolEntry(pool, poolId);
  if (!entry) return sendJson(res, 404, { error: "alias not found in pool" });

  const existing = userAliases(auth.user);
  if (existing.length >= MAX_ALIASES_PER_USER) {
    return sendJson(res, 409, { error: `最多创建 ${MAX_ALIASES_PER_USER} 个马甲` });
  }
  if (existing.some((a) => a.poolId === poolId && a.status === "active")) {
    return sendJson(res, 409, { error: "该马甲已存在" });
  }

  const alias = {
    id: crypto.randomUUID(),
    poolId: entry.id,
    name: entry.name,
    avatarUrl: "",
    avatarSeed: entry.avatarSeed || "",
    createdAt: new Date().toISOString(),
    status: "active"
  };

  auth.user.aliases = [...existing, alias];
  auth.user.activeAliasId = alias.id;
  await saveAuthStore(auth.store);

  sendJson(res, 200, {
    alias: normalizeAlias(alias),
    activeAliasId: alias.id
  });
}

async function handleDeactivateAlias(req, res) {
  const auth = await requireUser(req);
  if (!auth.user.activeAliasId) {
    return sendJson(res, 400, { error: "当前没有活跃马甲" });
  }
  auth.user.activeAliasId = null;
  await saveAuthStore(auth.store);
  sendJson(res, 200, {
    ok: true,
    activeAliasId: null
  });
}

async function handleActivateAlias(req, res) {
  const auth = await requireUser(req);
  const payload = await readJsonBody(req);
  const aliasId = String(payload.aliasId || "").trim();
  if (!aliasId) return sendJson(res, 400, { error: "aliasId is required" });
  const alias = findUserAlias(auth.user, aliasId);
  if (!alias) return sendJson(res, 404, { error: "alias not found" });
  auth.user.activeAliasId = alias.id;
  await saveAuthStore(auth.store);
  sendJson(res, 200, { ok: true, activeAliasId: alias.id });
}

export {
  activeAlias,
  findPoolEntry,
  findUserAlias,
  handleActivateAlias,
  handleCreateAlias,
  handleDeactivateAlias,
  handleGetAliasPool,
  handleGetAliases,
  loadAliasPool,
  normalizeAlias,
  userAliases
};
