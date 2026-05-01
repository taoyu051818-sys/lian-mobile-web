import fs from "node:fs/promises";
import path from "node:path";

import { memory } from "./cache.js";
import { authUsersPath, channelReadsPath, metadataPath, rulesPath } from "./paths.js";

async function writeJsonFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, filePath);
}

async function loadRules() {
  const now = Date.now();
  if (memory.rules && now - memory.rulesLoadedAt < 15_000) return memory.rules;
  try {
    const raw = await fs.readFile(rulesPath, "utf8");
    memory.rules = JSON.parse(raw);
  } catch {
    memory.rules = { tabs: ["推荐"], pinnedTids: [], tagWeights: {}, recencyHalfLifeHours: 96, coverBonus: 0 };
  }
  memory.rulesLoadedAt = now;
  return memory.rules;
}

async function loadMetadata() {
  const now = Date.now();
  if (memory.metadata && now - memory.metadataLoadedAt < 15_000) return memory.metadata;
  try {
    const raw = await fs.readFile(metadataPath, "utf8");
    const data = JSON.parse(raw);
    memory.metadata = data.items || {};
  } catch {
    memory.metadata = {};
  }
  memory.metadataLoadedAt = now;
  return memory.metadata;
}

async function patchPostMetadata(tid, patch = {}) {
  const key = String(Number(tid) || tid || "");
  if (!key) return;
  const raw = await fs.readFile(metadataPath, "utf8").catch(() => "{\"items\":{}}");
  const data = JSON.parse(raw || "{\"items\":{}}");
  data.items ||= {};
  data.items[key] = { ...(data.items[key] || {}), ...patch };
  await writeJsonFile(metadataPath, data);
  memory.metadata = data.items;
  memory.metadataLoadedAt = Date.now();
  memory.feedPages.clear();
}

async function loadChannelReads() {
  const now = Date.now();
  if (memory.channelReads && now - memory.channelReadsLoadedAt < 5_000) return memory.channelReads;
  try {
    const raw = await fs.readFile(channelReadsPath, "utf8");
    const data = JSON.parse(raw);
    memory.channelReads = data && typeof data === "object" ? data : { version: 1, items: {} };
  } catch {
    memory.channelReads = { version: 1, items: {} };
  }
  if (!memory.channelReads.items || typeof memory.channelReads.items !== "object") memory.channelReads.items = {};
  memory.channelReadsLoadedAt = now;
  return memory.channelReads;
}

async function saveChannelReads(data) {
  await fs.mkdir(path.dirname(channelReadsPath), { recursive: true });
  await fs.writeFile(channelReadsPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  memory.channelReads = data;
  memory.channelReadsLoadedAt = Date.now();
}

async function loadAuthStore() {
  try {
    const raw = await fs.readFile(authUsersPath, "utf8");
    const data = JSON.parse(raw);
    return {
      version: 1,
      users: Array.isArray(data.users) ? data.users : [],
      sessions: data.sessions && typeof data.sessions === "object" ? data.sessions : {},
      invites: data.invites && typeof data.invites === "object" ? data.invites : {},
      verifications: data.verifications && typeof data.verifications === "object" ? data.verifications : {}
    };
  } catch {
    return { version: 1, users: [], sessions: {}, invites: {}, verifications: {} };
  }
}

async function saveAuthStore(data) {
  await fs.mkdir(path.dirname(authUsersPath), { recursive: true });
  await fs.writeFile(authUsersPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export {
  loadAuthStore,
  loadChannelReads,
  loadMetadata,
  loadRules,
  patchPostMetadata,
  saveAuthStore,
  saveChannelReads,
  writeJsonFile
};