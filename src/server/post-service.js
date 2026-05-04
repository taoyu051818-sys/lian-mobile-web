import { canViewPost, normalizeAudience, deriveSchoolId } from "./audience-service.js";
import { getCurrentUser } from "./auth-service.js";
import { config } from "./config.js";
import { memory } from "./cache.js";
import {
  buildTextPostHtml,
  escapeHtml,
  extractCover,
  normalizePostImageUrl,
  proxiedPostImageUrl,
  warmupPostImages
} from "./content-utils.js";
import { loadMetadata, patchPostMetadata, recordUserLike, recordUserSave, getUserLikedTids, getUserSavedTids, loadUserCache, saveUserCache } from "./data-store.js";
import { sendJson } from "./http-response.js";
import { fetchNodebbTopicIndex, nodebbFetch, withNodebbUid } from "./nodebb-client.js";
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
    avatarUrl: alias ? (alias.avatarUrl || "") : (user.avatarUrl || user.nodebbPicture || ""),
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
    blocks.push(`<p>地点：${escapeHtml(place)}</p>`);
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

function firstPostVoteState(detail = {}) {
  const post = detail?.posts?.[0] || {};
  const pid = Number(post.pid || detail.mainPid || 0) || 0;
  const likeCount = Number(post.upvotes ?? post.votes ?? post.reputation ?? 0) || 0;
  const liked = post.upvoted === undefined && post.voted === undefined && post.vote === undefined
    ? null
    : Boolean(post.upvoted || post.voted === 1 || post.vote === 1);
  return { pid, likeCount: Math.max(0, likeCount), liked };
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

async function fetchTopicForUser(tid, nodebbUid) {
  return await nodebbFetch(withNodebbUid(`/api/topic/${tid}`, nodebbUid));
}

async function voteFirstPost(pid, nodebbUid, shouldLike) {
  const method = shouldLike ? "PUT" : "DELETE";
  const options = {
    method,
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${config.nodebbToken}`
    },
    body: method === "PUT" ? JSON.stringify({ delta: 1 }) : undefined
  };
  const endpoints = [
    withNodebbUid(`/api/v3/posts/${pid}/vote`, nodebbUid),
    withNodebbUid(`/api/v3/posts/${pid}/votes`, nodebbUid)
  ];
  let lastError;
  for (const endpoint of endpoints) {
    try {
      return await nodebbFetch(endpoint, options);
    } catch (error) {
      lastError = error;
      if (![404, 405].includes(Number(error.status))) break;
    }
  }
  throw lastError;
}

async function handleTogglePostLike(tid, req, res) {
  const auth = await requireUser(req);
  if (!config.nodebbToken) return sendJson(res, 500, { error: "LIAN API token is missing" });
  if (auth.user.status === "limited") return sendJson(res, 403, { error: "account is limited" });
  const metadata = await loadMetadata();
  const meta = metadata[String(tid)] || {};
  if (!canViewPost(auth.user, { visibility: meta.visibility, audience: meta.audience })) {
    return sendJson(res, 403, { error: "access denied" });
  }
  const payload = await readJsonBody(req).catch(() => ({}));
  const nodebbUid = await ensureNodebbUid(auth);
  let detail;
  try {
    detail = await fetchTopicForUser(tid, nodebbUid);
  } catch (err) {
    console.warn(`[like] fetchTopicForUser tid=${tid} uid=${nodebbUid} error:`, err.message);
    recordUserLike(auth.user.id, tid, false).catch(() => {});
    return sendJson(res, 404, { error: "post not found" });
  }
  const before = firstPostVoteState(detail);
  if (!before.pid) {
    console.warn(`[like] no pid for tid=${tid}, detail keys: ${Object.keys(detail || {}).join(",")}`);
    recordUserLike(auth.user.id, tid, false).catch(() => {});
    return sendJson(res, 404, { error: "post not found" });
  }
  const shouldLike = typeof payload.liked === "boolean" ? payload.liked : !before.liked;
  console.info(`[like] tid=${tid} uid=${nodebbUid} pid=${before.pid} payload.liked=${payload.liked} before.liked=${before.liked} before.likeCount=${before.likeCount} shouldLike=${shouldLike}`);

  await voteFirstPost(before.pid, nodebbUid, shouldLike);
  recordUserLike(auth.user.id, tid, shouldLike).catch(() => {});

  memory.topicDetails.delete(Number(tid));
  memory.feedPages.clear();
  let likeCount = Math.max(0, before.likeCount + (shouldLike ? 1 : -1));
  try {
    const after = firstPostVoteState(await fetchTopicForUser(tid, nodebbUid));
    if (after.likeCount) likeCount = after.likeCount;
  } catch { /* refetch failure doesn't affect the toggle result */ }
  sendJson(res, 200, {
    ok: true,
    tid: Number(tid),
    pid: before.pid,
    liked: shouldLike,
    likeCount
  });
}

async function bookmarkFirstPost(pid, nodebbUid, shouldSave) {
  const method = shouldSave ? "PUT" : "DELETE";
  const options = {
    method,
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${config.nodebbToken}`
    }
  };
  try {
    return await nodebbFetch(withNodebbUid(`/api/v3/posts/${pid}/bookmark`, nodebbUid), options);
  } catch (error) {
    const msg = String(error.message || "").toLowerCase();
    if (shouldSave && (msg.includes("already bookmarked") || msg.includes("already saved"))) return {};
    if (!shouldSave && (msg.includes("not bookmarked") || msg.includes("not saved"))) return {};
    throw error;
  }
}

function firstPostBookmarkState(detail = {}) {
  const post = detail?.posts?.[0] || {};
  const pid = Number(post.pid || detail.mainPid || 0) || 0;
  return { pid, saved: Boolean(post.bookmarked) };
}

async function handleTogglePostSave(tid, req, res) {
  const auth = await requireUser(req);
  if (!config.nodebbToken) return sendJson(res, 500, { error: "LIAN API token is missing" });
  if (auth.user.status === "limited") return sendJson(res, 403, { error: "account is limited" });
  const metadata = await loadMetadata();
  const meta = metadata[String(tid)] || {};
  if (!canViewPost(auth.user, { visibility: meta.visibility, audience: meta.audience })) {
    return sendJson(res, 403, { error: "access denied" });
  }
  const payload = await readJsonBody(req).catch(() => ({}));
  const nodebbUid = await ensureNodebbUid(auth);
  let detail;
  try {
    detail = await fetchTopicForUser(tid, nodebbUid);
  } catch (err) {
    console.warn(`[save] fetchTopicForUser tid=${tid} uid=${nodebbUid} error:`, err.message);
    recordUserSave(auth.user.id, tid, false).catch(() => {});
    return sendJson(res, 404, { error: "post not found" });
  }
  const before = firstPostBookmarkState(detail);
  if (!before.pid) {
    console.warn(`[save] no pid for tid=${tid}, detail keys: ${Object.keys(detail || {}).join(",")}`);
    recordUserSave(auth.user.id, tid, false).catch(() => {});
    return sendJson(res, 404, { error: "post not found" });
  }
  const shouldSave = typeof payload.saved === "boolean" ? payload.saved : !before.saved;

  await bookmarkFirstPost(before.pid, nodebbUid, shouldSave);
  recordUserSave(auth.user.id, tid, shouldSave).catch(() => {});

  memory.topicDetails.delete(Number(tid));
  memory.feedPages.clear();
  sendJson(res, 200, {
    ok: true,
    tid: Number(tid),
    pid: before.pid,
    saved: shouldSave
  });
}

async function flagNodebbPost(pid, nodebbUid, reason) {
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${config.nodebbToken}`
    },
    body: JSON.stringify({ reason: reason || "未指定原因" })
  };
  return await nodebbFetch(withNodebbUid(`/api/v3/posts/${pid}/flag`, nodebbUid), options);
}

async function handleReportPost(tid, req, res) {
  const auth = await requireUser(req);
  if (!config.nodebbToken) return sendJson(res, 500, { error: "LIAN API token is missing" });
  if (auth.user.status === "limited") return sendJson(res, 403, { error: "account is limited" });
  const metadata = await loadMetadata();
  const meta = metadata[String(tid)] || {};
  if (!canViewPost(auth.user, { visibility: meta.visibility, audience: meta.audience })) {
    return sendJson(res, 403, { error: "access denied" });
  }
  const payload = await readJsonBody(req).catch(() => ({}));
  const reason = String(payload.reason || payload.category || "").trim();
  const nodebbUid = await ensureNodebbUid(auth);
  const detail = await fetchTopicForUser(tid, nodebbUid);
  const pid = Number(detail?.posts?.[0]?.pid || detail?.mainPid || 0) || 0;
  if (!pid) return sendJson(res, 404, { error: "post not found" });

  await flagNodebbPost(pid, nodebbUid, reason);
  sendJson(res, 200, { ok: true, tid: Number(tid), pid });
}

function normalizeProfileTopic(topic, metadata = {}) {
  const tid = Number(topic.tid || topic.tid || 0);
  const meta = metadata[String(tid)] || {};
  const title = topic.titleRaw || topic.title || meta.title || "未命名";
  const timestampISO = topic.timestampISO || topic.lastposttimeISO || "";
  const contentHtml = topic.posts?.[0]?.content || topic.teaser?.content || "";
  const cover = meta.imageUrls?.[0]
    ? proxiedPostImageUrl(meta.imageUrls[0], { width: 400 })
    : extractCover(contentHtml);
  return {
    tid,
    title,
    cover,
    timestampISO,
    visibility: meta.visibility || "public",
    audience: meta.audience || null,
    author: topic.user?.username || topic.author?.username || "同学"
  };
}

async function filterByAudience(items, user) {
  const metadata = await loadMetadata();
  return items.filter((item) => {
    const meta = metadata[String(item.tid)] || {};
    return canViewPost(user, { visibility: meta.visibility, audience: meta.audience });
  }).map((item) => {
    const meta = metadata[String(item.tid)] || {};
    return { ...item, visibility: meta.visibility || "public" };
  });
}

async function getUserSlug(nodebbUid) {
  try {
    const data = await nodebbFetch(`/api/user/uid/${nodebbUid}`);
    const slug = data?.userslug || data?.slug || "";
    console.info(`[getUserSlug] uid=${nodebbUid} slug=${slug} keys=${Object.keys(data || {}).join(",")}`);
    return slug;
  } catch (error) {
    console.warn(`[getUserSlug] uid=${nodebbUid} error:`, error.message);
    return "";
  }
}

async function fetchUserPosts(nodebbUid, endpoint) {
  const slug = await getUserSlug(nodebbUid);
  if (!slug) {
    console.warn(`[fetchUserPosts] no slug for uid=${nodebbUid}`);
    return [];
  }
  // Try multiple endpoint patterns since NodeBB API shape varies by version
  const attempts = [
    withNodebbUid(`/api/user/${slug}/${endpoint}`, nodebbUid),
    `/api/user/${slug}/${endpoint}?_uid=${nodebbUid}`,
    withNodebbUid(`/api/v3/users/${nodebbUid}/${endpoint}`, nodebbUid)
  ];
  let lastError;
  for (const url of attempts) {
    try {
      console.info(`[fetchUserPosts] GET ${url}`);
      const data = await nodebbFetch(url, {
        headers: { authorization: `Bearer ${config.nodebbToken}` }
      });
      const topics = Array.isArray(data?.topics) ? data.topics
        : Array.isArray(data?.payload?.topics) ? data.payload.topics
        : Array.isArray(data?.response?.topics) ? data.response.topics
        : Array.isArray(data) ? data
        : [];
      console.info(`[fetchUserPosts] keys=${Object.keys(data || {}).join(",")} topics=${topics.length}`);
      if (topics.length) return topics;
      // If empty, try next endpoint (might be wrong endpoint)
      if (topics.length === 0 && attempts.indexOf(url) < attempts.length - 1) {
        console.info(`[fetchUserPosts] empty result, trying next endpoint`);
        continue;
      }
      return topics;
    } catch (error) {
      lastError = error;
      console.warn(`[fetchUserPosts] ${url} failed: ${error.message}`);
      if (![404, 405, 401, 403].includes(Number(error.status))) break;
    }
  }
  console.warn(`[fetchUserPosts] all attempts failed for uid=${nodebbUid} endpoint=${endpoint}`);
  return [];
}

function buildItemsFromCacheTids(tids, metadata) {
  return tids.map((tid) => {
    const meta = metadata[String(tid)] || {};
    return {
      tid: Number(tid),
      title: meta.title || "未命名",
      cover: meta.imageUrls?.[0] ? proxiedPostImageUrl(meta.imageUrls[0], { width: 400 }) : "",
      timestampISO: "",
      visibility: meta.visibility || "public",
      audience: meta.audience || null,
      author: "同学"
    };
  });
}

async function handleGetSavedPosts(req, res) {
  const auth = await requireUser(req);
  const nodebbUid = await ensureNodebbUid(auth);
  try {
    await loadUserCache();
    const topics = await fetchUserPosts(nodebbUid, "bookmarks");
    console.info(`[saved] uid=${nodebbUid} raw topics: ${topics.length}`);
    // Extract tids and sync to cache
    let tids = topics.map((t) => Number(t.tid)).filter(Boolean);
    if (tids.length) {
      const cache = await loadUserCache();
      cache.users[auth.user.id] = {
        ...(cache.users[auth.user.id] || {}),
        savedTids: tids,
        updatedAt: new Date().toISOString()
      };
      saveUserCache(cache).catch(() => {});
    }
    // Fallback to cached tids if endpoint returned empty
    if (!tids.length) tids = getUserSavedTids(auth.user.id);
    // Fetch full topic details for each tid (bookmarks endpoint lacks title/cover)
    const metadata = await loadMetadata();
    const items = [];
    for (const tid of tids.slice(0, 50)) {
      const meta = metadata[String(tid)] || {};
      if (!canViewPost(auth.user, { visibility: meta.visibility, audience: meta.audience })) continue;
      try {
        const detail = await nodebbFetch(withNodebbUid(`/api/topic/${tid}`, nodebbUid));
        items.push(normalizeProfileTopic(detail, metadata));
      } catch { /* skip inaccessible */ }
    }
    console.info(`[saved] items: ${items.length}`);
    sendJson(res, 200, { items });
  } catch (error) {
    console.warn(`[saved] error:`, error.message);
    sendJson(res, error.status || 500, { error: error.message });
  }
}

async function handleGetLikedPosts(req, res) {
  const auth = await requireUser(req);
  const nodebbUid = await ensureNodebbUid(auth);
  try {
    await loadUserCache();
    const topics = await fetchUserPosts(nodebbUid, "upvoted");
    console.info(`[liked] uid=${nodebbUid} raw topics: ${topics.length}`);
    // Extract tids and sync to cache
    let tids = topics.map((t) => Number(t.tid)).filter(Boolean);
    if (tids.length) {
      const cache = await loadUserCache();
      cache.users[auth.user.id] = {
        ...(cache.users[auth.user.id] || {}),
        likedTids: tids,
        updatedAt: new Date().toISOString()
      };
      saveUserCache(cache).catch(() => {});
    }
    // Fallback to cached tids if endpoint returned empty
    if (!tids.length) tids = getUserLikedTids(auth.user.id);
    // Fetch full topic details for each tid (upvoted endpoint lacks title/cover)
    const metadata = await loadMetadata();
    const items = [];
    for (const tid of tids.slice(0, 50)) {
      const meta = metadata[String(tid)] || {};
      if (!canViewPost(auth.user, { visibility: meta.visibility, audience: meta.audience })) continue;
      try {
        const detail = await nodebbFetch(withNodebbUid(`/api/topic/${tid}`, nodebbUid));
        items.push(normalizeProfileTopic(detail, metadata));
      } catch { /* skip inaccessible */ }
    }
    console.info(`[liked] items: ${items.length}`);
    sendJson(res, 200, { items });
  } catch (error) {
    console.warn(`[liked] error:`, error.message);
    sendJson(res, error.status || 500, { error: error.message });
  }
}

async function handleGetHistory(req, res) {
  const auth = await requireUser(req);
  const nodebbUid = await ensureNodebbUid(auth);
  try {
    const payload = await readJsonBody(req).catch(() => ({}));
    const tids = Array.isArray(payload.tids) ? payload.tids.map(Number).filter(Boolean) : [];
    if (!tids.length) return sendJson(res, 200, { items: [] });
    const metadata = await loadMetadata();
    const items = [];
    for (const tid of tids.slice(0, 50)) {
      const meta = metadata[String(tid)] || {};
      if (!canViewPost(auth.user, { visibility: meta.visibility, audience: meta.audience })) continue;
      try {
        const detail = await nodebbFetch(withNodebbUid(`/api/topic/${tid}`, nodebbUid));
        items.push(normalizeProfileTopic(detail, metadata));
      } catch {
        // skip inaccessible topics
      }
    }
    sendJson(res, 200, { items });
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message });
  }
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
  const visibility = payload.visibility || "public";
  const audience = normalizeAudience(payload.audience, visibility);
  if (audience.visibility === "school" && !audience.schoolIds.length && auth.user.institution) {
    audience.schoolIds = [deriveSchoolId(auth.user.institution) || auth.user.institution];
  }
  if (tid) {
    await patchPostMetadata(tid, {
      title,
      imageUrls,
      visibility,
      audience,
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
  handleGetHistory,
  handleGetLikedPosts,
  handleGetSavedPosts,
  handleReportPost,
  handleTogglePostLike,
  handleTogglePostSave,
  replyToNodebbTopic,
  userSignature
};
