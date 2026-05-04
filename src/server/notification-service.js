import { canViewPost } from "./audience-service.js";
import { config } from "./config.js";
import { stripHtml } from "./content-utils.js";
import { loadMetadata, getActorMeta, recordActorMeta, loadUserCache } from "./data-store.js";
import { sendJson } from "./http-response.js";
import { nodebbFetch } from "./nodebb-client.js";
import { ensureNodebbUid, getCurrentUser } from "./auth-service.js";

function extractTidFromPath(path) {
  const s = String(path || "");
  const topicMatch = s.match(/topic\/(\d+)/);
  if (topicMatch) return { tid: Number(topicMatch[1]), pid: 0 };
  const postMatch = s.match(/post\/(\d+)/);
  if (postMatch) return { tid: 0, pid: Number(postMatch[1]) };
  return { tid: 0, pid: 0 };
}

async function resolvePidsToTids(pidSet) {
  const map = new Map();
  for (const pid of pidSet) {
    try {
      const data = await nodebbFetch(`/api/v3/posts/${pid}`);
      const tid = Number(data?.tid || data?.post?.tid || 0);
      if (tid) map.set(pid, tid);
    } catch {
      // skip unresolvable posts
    }
  }
  return map;
}

function parseLianUserMeta(html = "") {
  const match = html.match(/<!--\s*lian-user-meta\s+([\s\S]*?)\s*-->/);
  if (!match) return {};
  try { return JSON.parse(match[1]); } catch { return {}; }
}

async function fetchPostAuthors(pids) {
  const map = new Map();
  for (const pid of pids) {
    try {
      const data = await nodebbFetch(`/api/v3/posts/${pid}`);
      const content = data?.content || data?.post?.content || "";
      const meta = parseLianUserMeta(content);
      if (meta.username) {
        map.set(pid, meta);
        if (meta.nodebbUid) recordActorMeta(meta.nodebbUid, meta).catch(() => {});
      }
    } catch {
      // skip
    }
  }
  return map;
}

function normalizeNotification(item, tid, authorMeta = null) {
  const actor = Array.isArray(item.fromUsers) && item.fromUsers.length > 0
    ? item.fromUsers[0]
    : null;
  const displayName = authorMeta?.username || actor?.username || "";
  return {
    id: item.nid || item.datetimeISO || item.path || String(Date.now()),
    type: item.type || "notification",
    title: stripHtml(item.bodyShort || item.bodyLong || item.text || ""),
    excerpt: stripHtml(item.bodyShort || ""),
    tid,
    pid: Number(item.pid || 0),
    actor: (displayName || actor) ? {
      uid: Number(authorMeta?.userId || actor?.uid || 0),
      displayName,
      picture: authorMeta?.avatarUrl || actor?.picture || "",
      identityTag: authorMeta?.identityTag || ""
    } : null,
    time: item.datetimeISO || item.datetime || "",
    read: Boolean(item.read),
    url: tid ? `/?post=${tid}` : "/"
  };
}

async function handleMessages(req, res) {
  let viewer = null;
  let nodebbUid = 0;
  try {
    const auth = await getCurrentUser(req);
    if (auth.user) {
      viewer = auth.user;
      nodebbUid = await ensureNodebbUid(auth);
    }
  } catch {
    // guest — will get empty list
  }

  if (!nodebbUid) {
    return sendJson(res, 200, { items: [] });
  }

  let data;
  try {
    data = await nodebbFetch(`/api/notifications?_uid=${nodebbUid}`, {
      headers: { authorization: `Bearer ${config.nodebbToken}` }
    });
  } catch (error) {
    return sendJson(res, 200, { items: [], error: "notification_fetch_failed" });
  }

  const raw = Array.isArray(data?.notifications) ? data.notifications : [];

  // First pass: extract tids directly, collect pids that need resolution
  const itemsWithTid = [];
  const pidResolveSet = new Set();
  for (const item of raw) {
    if (!item) continue;
    const directTid = Number(item.tid || 0);
    if (directTid) {
      itemsWithTid.push({ item, tid: directTid });
      continue;
    }
    const { tid: pathTid, pid } = extractTidFromPath(item.path);
    if (pathTid) {
      itemsWithTid.push({ item, tid: pathTid });
    } else if (pid) {
      pidResolveSet.add(pid);
      itemsWithTid.push({ item, tid: 0, pendingPid: pid });
    }
    // drop notifications with no tid and no pid — cannot map to a post
  }

  // Batch resolve pid→tid for /post/:pid paths
  let pidToTid = new Map();
  if (pidResolveSet.size > 0) {
    pidToTid = await resolvePidsToTids(pidResolveSet);
  }

  // Second pass: filter and normalize
  await loadUserCache();
  const metadata = await loadMetadata();
  const items = [];
  const pidsToFetch = new Set();
  for (const entry of itemsWithTid) {
    let tid = entry.tid;
    if (!tid && entry.pendingPid) {
      tid = pidToTid.get(entry.pendingPid) || 0;
    }
    if (!tid) continue; // unmappable — drop

    const postMeta = metadata[String(tid)];
    if (!canViewPost(viewer, { visibility: postMeta?.visibility || "public", audience: postMeta?.audience }, "detail")) {
      continue;
    }

    const normalized = normalizeNotification(entry.item, tid);
    // Check cached actor metadata before fetching
    const actorUid = normalized.actor?.uid || 0;
    const actorName = normalized.actor?.displayName || "";
    if (actorUid && (!actorName || /^(admin|system|nodebb|同学)$/i.test(actorName))) {
      const cached = getActorMeta(actorUid);
      if (cached?.username) {
        normalized.actor = {
          uid: actorUid,
          displayName: cached.username,
          picture: cached.avatarUrl || "",
          identityTag: cached.identityTag || ""
        };
      } else if (normalized.pid) {
        pidsToFetch.add(normalized.pid);
      }
    }
    items.push(normalized);
    if (items.length >= 30) break;
  }

  // Batch-fetch post content for uncached actor identities
  let authorMetaMap = new Map();
  if (pidsToFetch.size > 0) {
    authorMetaMap = await fetchPostAuthors(pidsToFetch);
  }
  // Apply LIAN identity where available
  if (authorMetaMap.size > 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.pid && authorMetaMap.has(item.pid)) {
        const meta = authorMetaMap.get(item.pid);
        items[i] = {
          ...item,
          actor: {
            uid: meta.userId || item.actor?.uid || 0,
            displayName: meta.username || item.actor?.displayName || "",
            picture: meta.avatarUrl || item.actor?.picture || "",
            identityTag: meta.identityTag || ""
          }
        };
      }
    }
  }

  sendJson(res, 200, { items });
}

export { handleMessages };
