import { config } from "./config.js";
import { memory } from "./cache.js";
import {
  buildTextPostHtml,
  escapeHtml,
  normalizePostImageUrl,
  warmupPostImages
} from "./content-utils.js";
import { patchPostMetadata } from "./data-store.js";
import { sendJson } from "./http-response.js";
import { nodebbFetch, withNodebbUid } from "./nodebb-client.js";
import { readJsonBody } from "./request-utils.js";
import { ensureNodebbUid, requireUser, selectIdentityTag } from "./auth-service.js";
import { findUserAlias } from "./alias-service.js";

function userSignature(user, alias = null) {
  if (!user) return "";
  const displayName = alias?.name || user.username || "同学";
  const tags = Array.isArray(user.tags) && user.tags.length ? `｜${user.tags.join(" ")}` : "";
  return `\n\n<p style="color:#69706b;font-size:13px">来自 ${escapeHtml(displayName)}${escapeHtml(tags)}</p>`;
}

function buildLianUserMeta(user = {}, identityTag = "", alias = null) {
  if (!user?.id) return "";
  const displayName = alias?.name || user.username || "";
  const meta = {
    userId: user.id,
    nodebbUid: user.nodebbUid || null,
    username: displayName,
    aliasId: alias?.id || "",
    aliasName: alias?.name || "",
    identityTag: identityTag || selectIdentityTag(user),
    avatarText: String(displayName || "同").slice(0, 1),
    avatarUrl: alias ? (alias.avatarUrl || "") : (user.avatarUrl || ""),
    sentAt: new Date().toISOString()
  };
  return `<!-- lian-user-meta ${escapeHtml(JSON.stringify(meta))} -->`;
}

function buildChannelMessageHtml(content, user, identityTag) {
  const meta = {
    userId: user.id,
    nodebbUid: user.nodebbUid || null,
    username: user.username,
    identityTag: selectIdentityTag(user, identityTag),
    avatarText: String(user.username || "同").slice(0, 1),
    avatarUrl: user.avatarUrl || "",
    sentAt: new Date().toISOString()
  };
  return `<!-- lian-channel-meta ${escapeHtml(JSON.stringify(meta))} -->\n${buildTextPostHtml(content)}`;
}

function buildTopicHtml(payload) {
  const blocks = [];
  if (payload.currentUser) blocks.push(buildLianUserMeta(payload.currentUser, "", payload.alias || null));
  const imageUrls = Array.isArray(payload.imageUrls) && payload.imageUrls.length
    ? payload.imageUrls
    : [payload.imageUrl].filter(Boolean);
  for (const rawImageUrl of imageUrls) {
    const imageUrl = normalizePostImageUrl(rawImageUrl, { width: 1200 });
    blocks.push(`<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(payload.title || "cover")}" style="max-width:100%;height:auto" />`);
  }
  if (payload.tag) blocks.push(`<p><strong>#${escapeHtml(payload.tag)}</strong></p>`);
  const content = String(payload.content || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br>")}</p>`);
  blocks.push(...content);
  if (payload.placeName || (payload.lat && payload.lng)) {
    const place = [payload.placeName, payload.lat && payload.lng ? `${payload.lat}, ${payload.lng}` : ""].filter(Boolean).join(" ");
    blocks.push(`<p>&#22320;&#28857;&#65306;${escapeHtml(place)}</p>`);
  }
  if (payload.mapLocation && typeof payload.mapLocation === "object") {
    blocks.push(`<!-- lian-map-location ${escapeHtml(JSON.stringify(payload.mapLocation))} -->`);
  }
  return `${blocks.join("\n\n").trim()}${userSignature(payload.currentUser, payload.alias || null)}`.trim();
}

function buildMapMetadataPatch(mapLocation = {}) {
  if (!mapLocation || typeof mapLocation !== "object") return {};
  const lat = Number(mapLocation.lat);
  const lng = Number(mapLocation.lng);
  const hasLatLng = Number.isFinite(lat) && Number.isFinite(lng);
  const x = Number(mapLocation.x);
  const y = Number(mapLocation.y);
  const hasLegacyPoint = Number.isFinite(x) && Number.isFinite(y);
  if (!hasLatLng && !hasLegacyPoint && !mapLocation.placeName) return {};
  return {
    locationArea: String(mapLocation.placeName || "").trim(),
    lat: hasLatLng ? lat : undefined,
    lng: hasLatLng ? lng : undefined,
    mapVersion: hasLatLng ? "gaode_v2" : "legacy",
    locationDraft: {
      source: hasLatLng ? "map_v2" : "legacy_map",
      locationId: "",
      locationArea: String(mapLocation.placeName || "").trim(),
      displayName: String(mapLocation.placeName || "").trim(),
      lat: hasLatLng ? lat : null,
      lng: hasLatLng ? lng : null,
      legacyPoint: { x: hasLegacyPoint ? x : null, y: hasLegacyPoint ? y : null },
      imagePoint: { x: hasLegacyPoint ? x : null, y: hasLegacyPoint ? y : null },
      mapVersion: hasLatLng ? "gaode_v2" : "legacy",
      confidence: hasLatLng ? 0.72 : (hasLegacyPoint ? 0.65 : 0.4),
      skipped: false,
      note: ""
    }
  };
}

function extractCreatedTid(data = {}) {
  return Number(
    data?.response?.tid ||
    data?.response?.topicData?.tid ||
    data?.response?.topic?.tid ||
    data?.tid ||
    data?.topicData?.tid ||
    data?.topic?.tid ||
    0
  ) || 0;
}

async function createNodebbTopicFromPayload(auth, payload = {}, options = {}) {
  const nodebbUid = Number(options.nodebbUid || 0) || await ensureNodebbUid(auth);
  const aliasId = String(payload.aliasId || "").trim();
  const alias = aliasId ? findUserAlias(auth.user, aliasId) : null;
  if (aliasId && !alias) {
    const error = new Error("aliasId is invalid or does not belong to current user");
    error.status = 400;
    throw error;
  }
  const imageUrls = Array.isArray(payload.imageUrls) && payload.imageUrls.length
    ? payload.imageUrls.map((url) => normalizePostImageUrl(url, { width: 1200 })).filter(Boolean)
    : (payload.imageUrl ? [normalizePostImageUrl(payload.imageUrl, { width: 1200 })] : []);
  const content = buildTopicHtml({
    ...payload,
    imageUrls,
    imageUrl: imageUrls[0] || "",
    currentUser: auth.user,
    alias
  });
  const tags = Array.isArray(payload.tags) && payload.tags.length
    ? payload.tags
    : (payload.tag ? [payload.tag] : undefined);
  const body = {
    cid: Number(payload.cid || config.nodebbCid),
    title: String(payload.title || "").trim(),
    content,
    tags
  };
  const data = await nodebbFetch(withNodebbUid("/api/v3/topics", nodebbUid), {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${config.nodebbToken}`
    },
    body: JSON.stringify(body)
  });
  if (data?.status?.code && data.status.code !== "ok") {
    const error = new Error(data.status.message || data.status.code || "NodeBB topic creation failed");
    error.status = 400;
    throw error;
  }
  return {
    data,
    tid: extractCreatedTid(data),
    imageUrl: imageUrls[0] || "",
    imageUrls,
    nodebbUid,
    aliasId: alias?.id || ""
  };
}

async function handleCreatePost(req, res) {
  const auth = await requireUser(req);
  if (!config.nodebbToken) {
    sendJson(res, 500, { error: "LIAN API token is missing" });
    return;
  }
  if (auth.user.status === "limited") return sendJson(res, 403, { error: "account is limited" });
  const payload = await readJsonBody(req);
  const title = String(payload.title || "").trim();
  if (!title) {
    sendJson(res, 400, { error: "title is required" });
    return;
  }
  const { data, tid, imageUrls } = await createNodebbTopicFromPayload(auth, {
    ...payload,
    title
  });
  if (tid && (imageUrls.length || payload.mapLocation)) {
    await patchPostMetadata(tid, {
      title,
      imageUrls,
      ...buildMapMetadataPatch(payload.mapLocation)
    });
  }
  if (imageUrls.length) await warmupPostImages(imageUrls);
  memory.feedPages.clear();
  sendJson(res, 200, data);
}



async function replyToNodebbTopic(tid, content, user = null, nodebbUid = null) {
  const html = String(content || "").trim().startsWith("<!-- lian-channel-meta")
    ? String(content || "").trim()
    : `${buildLianUserMeta(user)}\n${buildTextPostHtml(content)}${userSignature(user)}`.trim();
  const body = { content: html };
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${config.nodebbToken}`
    },
    body: JSON.stringify(body)
  };
  const attempts = [
    withNodebbUid(`/api/v3/topics/${tid}`, nodebbUid || config.nodebbUid),
    withNodebbUid(`/api/v3/topics/${tid}/posts`, nodebbUid || config.nodebbUid)
  ];
  let lastError;
  for (const endpoint of attempts) {
    try {
      return await nodebbFetch(endpoint, options);
    } catch (error) {
      lastError = error;
      if (![404, 405].includes(Number(error.status))) break;
    }
  }
  throw lastError;
}

export {
  buildChannelMessageHtml,
  buildLianUserMeta,
  createNodebbTopicFromPayload,
  extractCreatedTid,
  handleCreatePost,
  replyToNodebbTopic,
  userSignature
};
