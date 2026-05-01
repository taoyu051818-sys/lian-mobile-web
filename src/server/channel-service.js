import crypto from "node:crypto";

import { config } from "./config.js";
import { memory } from "./cache.js";
import { stripHtml } from "./content-utils.js";
import { loadChannelReads, saveChannelReads } from "./data-store.js";
import { getAllRecentTopics, getTopicDetail, normalizeChannelEvent } from "./feed-service.js";
import { sendJson } from "./http-response.js";
import { nodebbFetch, withNodebbUid } from "./nodebb-client.js";
import { readJsonBody } from "./request-utils.js";
import { ensureNodebbUid, requireUser, selectIdentityTag } from "./auth-service.js";
import { buildChannelMessageHtml, replyToNodebbTopic } from "./post-service.js";

async function markNodebbTopicRead(tid) {
  if (!tid) return;
  for (const method of ["POST", "PUT"]) {
    const options = { method, headers: { authorization: `Bearer ${config.nodebbToken}` } };
    for (const endpoint of [`/api/v3/topics/${tid}/read`, `/api/topic/${tid}/read`]) {
      try {
        await nodebbFetch(endpoint, options);
        return;
      } catch {
        // Read count in this app is still recorded locally if LIAN rejects this endpoint.
      }
    }
  }
}

function clientReaderId(req, payload = {}) {
  const raw = payload.readerId || req.headers["x-client-id"] || req.headers["user-agent"] || "anonymous";
  return crypto.createHash("sha1").update(String(raw)).digest("hex").slice(0, 24);
}

async function handleChannel(reqUrl, res) {
  const limit = Math.min(80, Math.max(10, Number(reqUrl.searchParams.get("limit") || 40)));
  const offset = Math.max(0, Number(reqUrl.searchParams.get("offset") || 0));
  const reads = await loadChannelReads();
  const topics = await getAllRecentTopics(3);
  const selectedTopics = topics.slice(offset, offset + limit);
  const events = [];
  for (const topic of selectedTopics) {
    try {
      const detail = await getTopicDetail(topic.tid);
      for (const post of detail?.posts || []) {
        if (!post || post.deleted) continue;
        events.push(normalizeChannelEvent({ ...topic, ...detail }, post, reads));
      }
    } catch {
      // Keep the channel readable even if one topic detail is temporarily unavailable.
    }
  }
  events.sort((a, b) => Date.parse(b.timestampISO || 0) - Date.parse(a.timestampISO || 0));
  const selected = events.slice(0, limit);
  sendJson(res, 200, {
    items: selected,
    offset,
    nextOffset: offset + selectedTopics.length < topics.length ? offset + selectedTopics.length : null,
    hasMore: offset + selectedTopics.length < topics.length,
    channelTid: config.nodebbChannelTopicTid || null
  });
}

async function handleChannelRead(req, res) {
  const payload = await readJsonBody(req);
  const eventIds = Array.isArray(payload.eventIds) ? payload.eventIds.map(String).filter(Boolean) : [];
  const readerId = clientReaderId(req, payload);
  const reads = await loadChannelReads();
  const counts = {};
  for (const id of eventIds) {
    if (!reads.items[id]) reads.items[id] = { readers: [] };
    const readers = new Set(Array.isArray(reads.items[id].readers) ? reads.items[id].readers : []);
    readers.add(readerId);
    reads.items[id].readers = Array.from(readers);
    counts[id] = reads.items[id].readers.length;
  }
  await saveChannelReads(reads);
  for (const tid of new Set((payload.tids || []).map(Number).filter(Number.isFinite))) {
    await markNodebbTopicRead(tid);
  }
  sendJson(res, 200, { ok: true, readCounts: counts });
}

async function handleChannelMessage(req, res) {
  const auth = await requireUser(req);
  if (!config.nodebbToken) return sendJson(res, 500, { error: "LIAN API token is missing" });
  if (auth.user.status === "limited") return sendJson(res, 403, { error: "account is limited" });
  const payload = await readJsonBody(req);
  const content = String(payload.content || "").trim();
  const identityTag = selectIdentityTag(auth.user, String(payload.identityTag || ""));
  if (!content) return sendJson(res, 400, { error: "content is required" });
  if (content.length > 800) return sendJson(res, 400, { error: "content is too long" });
  const nodebbUid = await ensureNodebbUid(auth);

  let data;
  if (config.nodebbChannelTopicTid) {
    data = await replyToNodebbTopic(config.nodebbChannelTopicTid, buildChannelMessageHtml(content, auth.user, identityTag), auth.user, nodebbUid);
  } else {
    data = await nodebbFetch(withNodebbUid("/api/v3/topics", nodebbUid), {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: `Bearer ${config.nodebbToken}`
      },
      body: JSON.stringify({
        cid: config.nodebbChannelCid,
        title: "校园频道",
        content: buildChannelMessageHtml(content, auth.user, identityTag),
        tags: ["频道消息"]
      })
    });
  }
  if (data?.response?.tid || data?.tid || data?.topicData?.tid) {
    config.nodebbChannelTopicTid = Number(data.response?.tid || data.tid || data.topicData?.tid || config.nodebbChannelTopicTid);
  }
  memory.feedPages.clear();
  memory.topicDetails.clear();
  sendJson(res, 200, data);
}

async function handleCreateReply(tid, req, res) {
  const auth = await requireUser(req);
  if (!config.nodebbToken) return sendJson(res, 500, { error: "LIAN API token is missing" });
  if (auth.user.status === "limited") return sendJson(res, 403, { error: "account is limited" });
  const payload = await readJsonBody(req);
  const content = String(payload.content || "").trim();
  if (!content) return sendJson(res, 400, { error: "content is required" });
  if (content.length > 2000) return sendJson(res, 400, { error: "content is too long" });
  const nodebbUid = await ensureNodebbUid(auth);
  const data = await replyToNodebbTopic(tid, content, auth.user, nodebbUid);
  memory.feedPages.clear();
  memory.topicDetails.delete(Number(tid));
  sendJson(res, 200, data);
}

async function handleMessages(res) {
  try {
    const data = await nodebbFetch("/api/notifications");
    const items = (data?.notifications || []).slice(0, 30).map((item) => ({
      id: item.nid || item.datetime || item.path,
      title: stripHtml(item.bodyShort || item.bodyLong || item.text || "新消息"),
      time: item.datetimeISO || item.datetime || "",
      url: item.path ? `${config.nodebbPublicBaseUrl}${item.path}` : config.nodebbPublicBaseUrl
    }));
    sendJson(res, 200, { items });
  } catch {
    sendJson(res, 200, { items: [] });
  }
}

export { handleChannel, handleChannelMessage, handleChannelRead, handleCreateReply, handleMessages };
