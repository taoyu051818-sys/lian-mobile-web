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

function userSignature(user) {
  if (!user) return "";
  const tags = Array.isArray(user.tags) && user.tags.length ? `｜${user.tags.join(" ")}` : "";
  return `\n\n<p style="color:#69706b;font-size:13px">来自 ${escapeHtml(user.username || "同学")}${escapeHtml(tags)}</p>`;
}

function buildLianUserMeta(user = {}, identityTag = "") {
  if (!user?.id) return "";
  const meta = {
    userId: user.id,
    nodebbUid: user.nodebbUid || null,
    username: user.username || "",
    identityTag: identityTag || selectIdentityTag(user),
    avatarText: String(user.username || "同").slice(0, 1),
    avatarUrl: user.avatarUrl || "",
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
  if (payload.currentUser) blocks.push(buildLianUserMeta(payload.currentUser));
  if (payload.imageUrl) {
    const imageUrl = normalizePostImageUrl(payload.imageUrl, { width: 1200 });
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
  return `${blocks.join("\n\n").trim()}${userSignature(payload.currentUser)}`.trim();
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
  const nodebbUid = await ensureNodebbUid(auth);
  const imageUrl = payload.imageUrl ? normalizePostImageUrl(payload.imageUrl, { width: 1200 }) : "";
  const content = buildTopicHtml({ ...payload, imageUrl, currentUser: auth.user });
  const body = {
    cid: Number(payload.cid || config.nodebbCid),
    title,
    content,
    tags: payload.tag ? [payload.tag] : undefined
  };
  const data = await nodebbFetch(withNodebbUid("/api/v3/topics", nodebbUid), {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${config.nodebbToken}`
    },
    body: JSON.stringify(body)
  });
  const tid = extractCreatedTid(data);
  if (tid && imageUrl) {
    await patchPostMetadata(tid, {
      imageUrls: [imageUrl]
    });
  }
  if (imageUrl) await warmupPostImages([imageUrl]);
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
  extractCreatedTid,
  handleCreatePost,
  replyToNodebbTopic,
  userSignature
};
