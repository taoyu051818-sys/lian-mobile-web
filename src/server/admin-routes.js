import fs from "node:fs/promises";

import { memory } from "./cache.js";
import { loadAuthStore, saveAuthStore, writeJsonFile } from "./data-store.js";
import { sendJson } from "./http-response.js";
import { metadataPath, rulesPath } from "./paths.js";
import { readJsonBody, requireAdmin } from "./request-utils.js";
import { applyInviteViolation, publicAuthUser } from "./auth-service.js";
import { handleAdminMapV2 } from "./map-v2-service.js";

async function handleAdminUserStatus(req, reqUrl, res) {
  requireAdmin(req);
  const match = reqUrl.pathname.match(/^\/api\/admin\/auth\/users\/([^/]+)\/status$/);
  if (!match) return false;
  const payload = await readJsonBody(req);
  const status = String(payload.status || "");
  if (!["active", "limited", "banned"].includes(status)) return sendJson(res, 400, { error: "invalid status" });
  const store = await loadAuthStore();
  const user = store.users.find((item) => item.id === match[1] || item.email === match[1]);
  if (!user) return sendJson(res, 404, { error: "user not found" });
  user.status = status;
  user.statusReason = String(payload.reason || "");
  user.statusChangedAt = new Date().toISOString();
  if (status === "banned") applyInviteViolation(store, user.id);
  await saveAuthStore(store);
  sendJson(res, 200, { user: publicAuthUser(user) });
  return true;
}

async function handleAdmin(req, reqUrl, res) {
  requireAdmin(req);

  if (req.method === "PATCH" && /^\/api\/admin\/auth\/users\/[^/]+\/status$/.test(reqUrl.pathname)) {
    return await handleAdminUserStatus(req, reqUrl, res);
  }

  if (req.method === "GET" && reqUrl.pathname === "/api/admin/feed-rules") {
    const raw = await fs.readFile(rulesPath, "utf8");
    return sendJson(res, 200, JSON.parse(raw));
  }

  if ((req.method === "GET" || req.method === "PUT") && reqUrl.pathname === "/api/admin/map-v2") {
    return await handleAdminMapV2(req, res);
  }

  if (req.method === "PUT" && reqUrl.pathname === "/api/admin/feed-rules") {
    const payload = await readJsonBody(req);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return sendJson(res, 400, { error: "feed rules must be a JSON object" });
    }
    if (payload.tabs && !Array.isArray(payload.tabs)) {
      return sendJson(res, 400, { error: "tabs must be an array" });
    }
    if (payload.pinnedTids && !Array.isArray(payload.pinnedTids)) {
      return sendJson(res, 400, { error: "pinnedTids must be an array" });
    }
    await writeJsonFile(rulesPath, payload);
    memory.rules = payload;
    memory.rulesLoadedAt = Date.now();
    memory.feedPages.clear();
    return sendJson(res, 200, { ok: true, rules: payload });
  }

  if (req.method === "PUT" && reqUrl.pathname === "/api/admin/feed-edition") {
    const payload = await readJsonBody(req);
    const pages = payload?.pages;
    if (!Array.isArray(pages)) {
      return sendJson(res, 400, { error: "pages must be an array" });
    }
    const normalizedPages = pages.map((page) => {
      const tids = Array.isArray(page) ? page : page?.tids;
      return (Array.isArray(tids) ? tids : []).map(Number).filter(Number.isFinite);
    }).filter((page) => page.length);
    if (!normalizedPages.length) {
      return sendJson(res, 400, { error: "pages must contain at least one tid" });
    }

    const raw = await fs.readFile(rulesPath, "utf8");
    const rules = JSON.parse(raw);
    rules.feedEditions = {
      pageSize: Number(payload.pageSize || rules.feedEditions?.pageSize || 10),
      generatedAt: payload.generatedAt || new Date().toISOString(),
      strategy: payload.strategy || "daily-curated-batches",
      notes: Array.isArray(payload.notes) ? payload.notes : [],
      pages: normalizedPages
    };
    await writeJsonFile(rulesPath, rules);
    memory.rules = rules;
    memory.rulesLoadedAt = Date.now();
    memory.feedPages.clear();
    return sendJson(res, 200, { ok: true, feedEditions: rules.feedEditions });
  }

  if (req.method === "GET" && reqUrl.pathname === "/api/admin/post-metadata") {
    const raw = await fs.readFile(metadataPath, "utf8");
    return sendJson(res, 200, JSON.parse(raw));
  }

  if (req.method === "PUT" && reqUrl.pathname === "/api/admin/post-metadata") {
    const payload = await readJsonBody(req);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return sendJson(res, 400, { error: "post metadata must be a JSON object" });
    }
    const data = payload.items ? payload : { items: payload };
    if (!data.items || typeof data.items !== "object" || Array.isArray(data.items)) {
      return sendJson(res, 400, { error: "items must be an object" });
    }
    await writeJsonFile(metadataPath, data);
    memory.metadata = data.items;
    memory.metadataLoadedAt = Date.now();
    memory.feedPages.clear();
    return sendJson(res, 200, { ok: true, metadata: data });
  }

  const metadataMatch = reqUrl.pathname.match(/^\/api\/admin\/post-metadata\/(\d+)$/);
  if ((req.method === "PATCH" || req.method === "DELETE") && metadataMatch) {
    const tid = metadataMatch[1];
    const raw = await fs.readFile(metadataPath, "utf8").catch(() => "{\"items\":{}}");
    const data = JSON.parse(raw);
    data.items ||= {};
    if (req.method === "DELETE") {
      delete data.items[tid];
    } else {
      const payload = await readJsonBody(req);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return sendJson(res, 400, { error: "metadata patch must be a JSON object" });
      }
      data.items[tid] = { ...(data.items[tid] || {}), ...payload };
    }
    await writeJsonFile(metadataPath, data);
    memory.metadata = data.items;
    memory.metadataLoadedAt = Date.now();
    memory.feedPages.clear();
    return sendJson(res, 200, { ok: true, tid: Number(tid), item: data.items[tid] || null });
  }

  if (req.method === "POST" && reqUrl.pathname === "/api/admin/reload") {
    memory.feedPages.clear();
    memory.topicDetails.clear();
    memory.rules = null;
    memory.metadata = null;
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: "admin route not found" });
}

export { handleAdmin };
