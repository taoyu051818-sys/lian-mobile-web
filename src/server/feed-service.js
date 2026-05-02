import { canViewPost } from "./audience-service.js";
import { ensureNodebbUid, getCurrentUser } from "./auth-service.js";
import { memory } from "./cache.js";
import { config } from "./config.js";
import {
  absoluteNodebbUrl,
  extractCover,
  extractSourceUrl,
  extractSummary,
  normalizePostImageUrl,
  parseLianChannelMeta,
  parseLianUserMeta,
  proxiedPostImageUrl,
  renderPostContent,
  stripHtml
} from "./content-utils.js";
import { loadMetadata, loadRules } from "./data-store.js";
import { sendJson } from "./http-response.js";
import { nodebbFetch, withNodebbUid } from "./nodebb-client.js";
import { requireAdmin } from "./request-utils.js";

const defaultPostMetadata = {
  contentType: "general",
  vibeTags: [],
  sceneTags: [],
  imageUrls: [],
  locationId: "",
  locationArea: "",
  qualityScore: 0,
  imageImpactScore: 0,
  riskScore: 0,
  officialScore: 0,
  visibility: "public",
  distribution: ["home", "search", "detail"],
  keepAfterExpired: false
};

function metadataArray(value, fallback = []) {
  if (!Array.isArray(value)) return [...fallback];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function metadataString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function metadataNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function metadataBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizePostMetadata(meta = {}) {
  return {
    ...defaultPostMetadata,
    ...meta,
    contentType: metadataString(meta.contentType, defaultPostMetadata.contentType),
    vibeTags: metadataArray(meta.vibeTags, defaultPostMetadata.vibeTags),
    sceneTags: metadataArray(meta.sceneTags, defaultPostMetadata.sceneTags),
    imageUrls: metadataArray(meta.imageUrls, defaultPostMetadata.imageUrls).map((url) => normalizePostImageUrl(url, { width: 900 })),
    locationId: metadataString(meta.locationId, defaultPostMetadata.locationId),
    locationArea: metadataString(meta.locationArea, defaultPostMetadata.locationArea),
    qualityScore: metadataNumber(meta.qualityScore, defaultPostMetadata.qualityScore),
    imageImpactScore: metadataNumber(meta.imageImpactScore, defaultPostMetadata.imageImpactScore),
    riskScore: metadataNumber(meta.riskScore, defaultPostMetadata.riskScore),
    officialScore: metadataNumber(meta.officialScore, defaultPostMetadata.officialScore),
    visibility: metadataString(meta.visibility, defaultPostMetadata.visibility),
    distribution: metadataArray(meta.distribution, defaultPostMetadata.distribution),
    keepAfterExpired: metadataBoolean(meta.keepAfterExpired, defaultPostMetadata.keepAfterExpired)
  };
}

function normalizeTopic(topic, detail = null, metadata = {}) {
  const firstPost = detail?.posts?.[0] || {};
  const contentHtml = firstPost.content || topic?.teaser?.content || "";
  const userMeta = parseLianUserMeta(contentHtml);
  const tags = Array.isArray(detail?.tags) && detail.tags.length ? detail.tags : topic?.tags || [];
  const tag = tags[0]?.value || tags[0]?.name || "";
  const timestampISO = detail?.timestampISO || topic?.timestampISO || firstPost.timestampISO || "";
  const title = detail?.titleRaw || detail?.title || topic?.titleRaw || topic?.title || "未命名";
  const tid = detail?.tid || topic?.tid;
  const firstPostPid = Number(firstPost.pid || topic?.mainPid || topic?.teaserPid || topic?.teaser?.pid || 0) || null;
  const likeCount = Number(firstPost.upvotes ?? firstPost.votes ?? firstPost.reputation ?? topic?.upvotes ?? topic?.votes ?? topic?.reputation ?? 0) || 0;
  const meta = normalizePostMetadata(metadata[String(tid)] || {});
  const cover = meta.imageUrls[0] ? proxiedPostImageUrl(meta.imageUrls[0], { width: 600 }) : extractCover(contentHtml);

  return {
    id: String(tid),
    tid,
    title,
    tag,
    tags: tags.map((item) => item.value || item.name || item).filter(Boolean),
    summary: extractSummary(contentHtml, title),
    cover,
    timestampISO,
    timeLabel: meta.timeLabel || "",
    startsAt: meta.startsAt || null,
    endsAt: meta.endsAt || null,
    expiresAt: meta.expiresAt || null,
    priority: Number(meta.priority || 0),
    isExpired: Boolean(meta.expiresAt && Date.now() > Date.parse(meta.expiresAt)),
    contentType: meta.contentType,
    vibeTags: meta.vibeTags,
    sceneTags: meta.sceneTags,
    locationId: meta.locationId,
    locationArea: meta.locationArea,
    qualityScore: meta.qualityScore,
    imageImpactScore: meta.imageImpactScore,
    riskScore: meta.riskScore,
    officialScore: meta.officialScore,
    visibility: meta.visibility,
    audience: meta.audience || null,
    distribution: meta.distribution,
    keepAfterExpired: meta.keepAfterExpired,
    author: userMeta.username || firstPost?.user?.username || topic?.user?.username || "同学",
    authorUserId: userMeta.userId || "",
    authorIdentityTag: userMeta.identityTag || "",
    authorAvatarText: userMeta.avatarText || String(userMeta.username || "").slice(0, 1),
    authorAvatarUrl: userMeta.avatarUrl || "",
    replyCount: detail?.postcount ? Math.max(0, detail.postcount - 1) : topic?.postcount || 0,
    firstPostPid,
    likeCount: Math.max(0, likeCount),
    nodebbUrl: `${config.nodebbPublicBaseUrl}/topic/${tid}`,
    sourceUrl: meta.sourceUrl || extractSourceUrl(contentHtml)
  };
}

function isChannelTopic(topic = {}) {
  const tid = Number(topic.tid);
  const cid = Number(topic.cid);
  const title = String(topic.titleRaw || topic.title || "").trim();
  const tags = [
    ...(Array.isArray(topic.tags) ? topic.tags : []),
    ...(Array.isArray(topic.tagWhitelist) ? topic.tagWhitelist : [])
  ].map((tag) => String(tag?.value || tag).trim());
  const firstPostContent = topic.posts?.[0]?.content || topic.mainPost?.content || topic.content || "";
  if (config.nodebbChannelTopicTid && tid === config.nodebbChannelTopicTid) return true;
  if (config.nodebbChannelCidConfigured && config.nodebbChannelCid !== config.nodebbCid && cid === config.nodebbChannelCid) return true;
  if (title === "校园频道") return true;
  if (tags.includes("频道消息")) return true;
  if (String(firstPostContent).includes("lian-channel-meta")) return true;
  return false;
}

function isChannelItem(item = {}) {
  if (!item) return false;
  if (String(item.title || "").trim() === "校园频道") return true;
  if (Array.isArray(item.tags) && item.tags.includes("频道消息")) return true;
  if (item.tag === "频道消息") return true;
  return false;
}

function normalizeChannelEvent(topic = {}, post = {}, reads = {}) {
  const tid = Number(topic.tid || post.tid);
  const pid = Number(post.pid || post.index || tid);
  const id = `post:${pid || tid}`;
  const content = post.content || post.raw || "";
  const meta = parseLianChannelMeta(content);
  const text = stripHtml(content)
    .replace(/\s+/g, " ")
    .replace(/\s*来自\s+[^｜\s]+(?:｜[^<]+)?$/u, "")
    .trim();
  const title = post.index > 0 ? `回复了：${topic.titleRaw || topic.title || ""}` : topic.titleRaw || topic.title || "校园动态";
  const readerSet = Array.isArray(reads.items?.[id]?.readers) ? reads.items[id].readers : [];
  const postUser = post.user || topic.user || {};
  const fallbackUsername = postUser.username && postUser.username !== "猴岛情报站" ? postUser.username : "";
  return {
    id,
    type: isChannelTopic(topic) ? "channel_message" : (post.index > 0 ? "post_reply" : "topic"),
    tid,
    pid,
    title,
    text,
    excerpt: text.length > 120 ? `${text.slice(0, 120)}...` : text,
    cover: extractCover(content),
    userId: meta.userId || "",
    nodebbUid: Number(meta.nodebbUid || postUser.uid || topic.user?.uid || 0) || null,
    username: meta.username || fallbackUsername,
    identityTag: meta.identityTag || "",
    avatarText: meta.avatarText || String(meta.username || fallbackUsername || "同").slice(0, 1),
    avatarUrl: meta.avatarUrl || absoluteNodebbUrl(postUser.picture || postUser.userslugpicture || ""),
    timestampISO: post.timestampISO || topic.timestampISO || "",
    timeLabel: post.timestampISO || topic.timestampISO || "",
    readCount: readerSet.length,
    nodebbUrl: `${config.nodebbPublicBaseUrl}/topic/${tid}`
  };
}

async function getTopicDetail(tid) {
  const cached = memory.topicDetails.get(tid);
  if (cached && Date.now() - cached.at < 180_000) return cached.data;
  const data = await nodebbFetch(`/api/topic/${tid}`);
  memory.topicDetails.set(tid, { at: Date.now(), data });
  return data;
}

async function getRecentTopics(page = 1) {
  const key = String(page);
  const cached = memory.feedPages.get(key);
  if (cached && Date.now() - cached.at < 60_000) return cached.data;
  const data = await nodebbFetch(`/api/recent?page=${page}`);
  memory.feedPages.set(key, { at: Date.now(), data });
  return data;
}

async function getAllRecentTopics(maxPages = 6) {
  const pages = await Promise.all(
    Array.from({ length: maxPages }, (_, index) => getRecentTopics(index + 1))
  );
  const seen = new Set();
  const topics = [];
  for (const page of pages) {
    for (const topic of page?.topics || []) {
      if (!topic?.tid || seen.has(topic.tid)) continue;
      seen.add(topic.tid);
      topics.push(topic);
    }
  }
  return topics;
}

function feedFeatureEnabled(rules, featureName) {
  return Boolean(rules?.feedFeatures?.[featureName]);
}

function scoringRules(rules = {}) {
  return {
    readPenalty: -60,
    qualityWeight: 40,
    imageImpactWeight: 24,
    riskPenalty: -220,
    officialHomePenalty: -35,
    riskHideThreshold: 0.7,
    missingLocationAreaPenalty: 0,
    contentTypeWeights: {},
    momentContentTypeWeights: {},
    momentMissingLocationAreaPenalty: 0,
    vibeWeights: {},
    sceneWeights: {},
    ...(rules.scoring || {})
  };
}

function itemScoreTags(item = {}) {
  return [
    item.tag,
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...(Array.isArray(item.vibeTags) ? item.vibeTags : []),
    ...(Array.isArray(item.sceneTags) ? item.sceneTags : [])
  ].map((tag) => String(tag || "").trim()).filter(Boolean);
}

function legacyScoreItem(item, rules) {
  if (item.isExpired) return -10_000;
  const pinnedIndex = (rules.pinnedTids || []).indexOf(Number(item.tid));
  const pinned = pinnedIndex >= 0 ? 1000 - pinnedIndex * 5 : 0;
  const tagWeight = rules.tagWeights?.[item.tag] || 0;
  const activeTime = item.startsAt || item.endsAt || item.expiresAt || item.timestampISO || new Date().toISOString();
  const ageMs = Math.abs(Date.now() - Date.parse(activeTime));
  const halfLife = Math.max(1, Number(rules.recencyHalfLifeHours || 96));
  const recency = 60 * Math.pow(0.5, ageMs / (halfLife * 3600_000));
  const cover = item.cover ? Number(rules.coverBonus || 0) : 0;
  return pinned + tagWeight + recency + cover + item.priority;
}

function isFeedEligible(item, rules, { surface = "home", currentUser = null } = {}) {
  if (!item) return false;
  if (isChannelItem(item)) return false;
  if (!feedFeatureEnabled(rules, "eligibility")) return true;

  const scoring = scoringRules(rules);
  if (item.isExpired && !item.keepAfterExpired) return false;
  if (Number(item.riskScore || 0) >= Number(scoring.riskHideThreshold ?? 0.7)) return false;

  const distribution = Array.isArray(item.distribution) ? item.distribution : defaultPostMetadata.distribution;
  if (distribution.includes("detailOnly")) return false;
  if (distribution.length && !distribution.includes("all")) {
    const allowed = surface === "moment" ? ["moment", "home"] : [surface];
    if (!allowed.some((candidate) => distribution.includes(candidate))) return false;
  }
  if (!canViewPost(currentUser, item, "feed")) return false;
  return true;
}

function feedFilterReason(item, rules, { surface = "home", currentUser = null } = {}) {
  if (!item) return "missing-item";
  if (isChannelItem(item)) return "channel-message";
  if (!feedFeatureEnabled(rules, "eligibility")) return "";

  const scoring = scoringRules(rules);
  if (item.isExpired && !item.keepAfterExpired) return "expired";
  if (Number(item.riskScore || 0) >= Number(scoring.riskHideThreshold ?? 0.7)) return "high-risk";

  const distribution = Array.isArray(item.distribution) ? item.distribution : defaultPostMetadata.distribution;
  if (distribution.includes("detailOnly")) return "detail-only";
  if (distribution.length && !distribution.includes("all")) {
    const allowed = surface === "moment" ? ["moment", "home"] : [surface];
    if (!allowed.some((candidate) => distribution.includes(candidate))) return `not-distributed-to-${surface}`;
  }
  if (!canViewPost(currentUser, item, "feed")) return "audience-denied";
  return "";
}

function scoreItem(item, rules, { readTids = new Set(), surface = "home", useOfficialPenalty = true } = {}) {
  if (!feedFeatureEnabled(rules, "enhancedScoring")) return legacyScoreItem(item, rules);

  const base = legacyScoreItem(item, rules);
  const scoring = scoringRules(rules);
  const tags = itemScoreTags(item);
  const seen = new Set();
  const tagScore = tags.reduce((sum, tag) => {
    if (seen.has(tag)) return sum;
    seen.add(tag);
    const baseTagWeight = tag === item.tag ? 0 : Number(rules.tagWeights?.[tag] || 0);
    return sum
      + baseTagWeight
      + Number(scoring.vibeWeights?.[tag] || 0)
      + Number(scoring.sceneWeights?.[tag] || 0);
  }, 0);
  const quality = Number(item.qualityScore || 0) * Number(scoring.qualityWeight || 0);
  const imageImpact = Number(item.imageImpactScore || 0) * Number(scoring.imageImpactWeight || 0);
  const risk = Number(item.riskScore || 0) * Number(scoring.riskPenalty || 0);
  const official = surface === "home" && useOfficialPenalty
    ? Number(item.officialScore || 0) * Number(scoring.officialHomePenalty || 0)
    : 0;
  const contentType = Number(scoring.contentTypeWeights?.[item.contentType] || 0);
  const locationArea = item.locationArea ? 0 : Number(scoring.missingLocationAreaPenalty || 0);
  const read = readTids.has(Number(item.tid)) ? Number(scoring.readPenalty || 0) : 0;
  return base + tagScore + quality + imageImpact + risk + official + contentType + locationArea + read;
}

function scoreBreakdown(item, rules, { readTids = new Set(), surface = "home", useOfficialPenalty = true } = {}) {
  const legacy = legacyScoreItem(item, rules);
  if (!feedFeatureEnabled(rules, "enhancedScoring")) {
    return {
      legacy,
      tag: 0,
      vibe: 0,
      scene: 0,
      quality: 0,
      imageImpact: 0,
      risk: 0,
      official: 0,
      contentType: 0,
      locationArea: 0,
      read: 0,
      final: legacy
    };
  }

  const scoring = scoringRules(rules);
  const tags = itemScoreTags(item);
  const seen = new Set();
  let tag = 0;
  let vibe = 0;
  let scene = 0;
  for (const scoreTag of tags) {
    if (seen.has(scoreTag)) continue;
    seen.add(scoreTag);
    tag += scoreTag === item.tag ? 0 : Number(rules.tagWeights?.[scoreTag] || 0);
    vibe += Number(scoring.vibeWeights?.[scoreTag] || 0);
    scene += Number(scoring.sceneWeights?.[scoreTag] || 0);
  }
  const quality = Number(item.qualityScore || 0) * Number(scoring.qualityWeight || 0);
  const imageImpact = Number(item.imageImpactScore || 0) * Number(scoring.imageImpactWeight || 0);
  const risk = Number(item.riskScore || 0) * Number(scoring.riskPenalty || 0);
  const official = surface === "home" && useOfficialPenalty
    ? Number(item.officialScore || 0) * Number(scoring.officialHomePenalty || 0)
    : 0;
  const contentType = Number(scoring.contentTypeWeights?.[item.contentType] || 0);
  const locationArea = item.locationArea ? 0 : Number(scoring.missingLocationAreaPenalty || 0);
  const read = readTids.has(Number(item.tid)) ? Number(scoring.readPenalty || 0) : 0;
  const final = legacy + tag + vibe + scene + quality + imageImpact + risk + official + contentType + locationArea + read;
  return { legacy, tag, vibe, scene, quality, imageImpact, risk, official, contentType, locationArea, read, final };
}

function diversityKey(value) {
  const key = String(value || "").trim();
  return key || "";
}

function exceedsDiversityLimits(item, counters, diversity) {
  const contentType = diversityKey(item.contentType);
  const locationArea = diversityKey(item.locationArea);
  const primaryTag = diversityKey(item.tag || item.tags?.[0]);
  return Boolean(
    (contentType && counters.contentType[contentType] >= Number(diversity.maxSameContentType || Infinity)) ||
    (locationArea && counters.locationArea[locationArea] >= Number(diversity.maxSameLocationArea || Infinity)) ||
    (primaryTag && counters.primaryTag[primaryTag] >= Number(diversity.maxSamePrimaryTag || Infinity))
  );
}

function addDiversityCounters(item, counters) {
  const contentType = diversityKey(item.contentType);
  const locationArea = diversityKey(item.locationArea);
  const primaryTag = diversityKey(item.tag || item.tags?.[0]);
  if (contentType) counters.contentType[contentType] = (counters.contentType[contentType] || 0) + 1;
  if (locationArea) counters.locationArea[locationArea] = (counters.locationArea[locationArea] || 0) + 1;
  if (primaryTag) counters.primaryTag[primaryTag] = (counters.primaryTag[primaryTag] || 0) + 1;
}

function diversifyItems(items, rules) {
  const diversity = rules.diversity || {};
  if (!feedFeatureEnabled(rules, "diversity") || diversity.enabled === false) return items;
  const selected = [];
  const delayed = [];
  const counters = { contentType: {}, locationArea: {}, primaryTag: {} };

  for (const item of items) {
    if (exceedsDiversityLimits(item, counters, diversity)) {
      delayed.push(item);
      continue;
    }
    selected.push(item);
    addDiversityCounters(item, counters);
  }
  return [...selected, ...delayed];
}

function momentScoreItem(item, rules) {
  const scoring = scoringRules(rules);
  const activeTime = item.startsAt || item.endsAt || item.expiresAt || item.timestampISO || new Date().toISOString();
  const ageMs = Math.max(0, Date.now() - Date.parse(activeTime));
  const halfLife = Math.max(1, Number(rules.recencyHalfLifeHours || 48));
  const recency = 90 * Math.pow(0.5, ageMs / (halfLife * 3600_000));
  const quality = Number(item.qualityScore || 0) * 35;
  const imageImpact = Number(item.imageImpactScore || 0) * 30;
  const replies = Number(item.replyCount || 0) * 4;
  const priority = Number(item.priority || 0);
  const tags = new Set(itemScoreTags(item));
  const momentVibe = ["真实", "在地", "有网感", "生活感", "现场感", "实用", "路况", "饭点", "夜宵", "傍晚", "夜间"];
  const vibe = momentVibe.reduce((sum, tag) => sum + (tags.has(tag) ? 12 : 0), 0);
  const contentTypeWeights = scoring.momentContentTypeWeights || {};
  const contentType = Number(contentTypeWeights[item.contentType] || 0);
  const locationArea = item.locationArea ? 0 : Number(scoring.momentMissingLocationAreaPenalty || 0);
  return recency + quality + imageImpact + replies + priority + vibe + contentType + locationArea;
}

function selectMomentFeed(items, rules, { page, limit, readTids, currentUser = null }) {
  const momentItems = items
    .filter((item) => isFeedEligible(item, rules, { surface: "moment", currentUser }))
    .sort((a, b) => momentScoreItem(b, rules) - momentScoreItem(a, rules));
  const diversified = diversifyItems(momentItems, rules);
  const start = (page - 1) * limit;
  return {
    selected: personalizeBatch(diversified.slice(start, start + limit), readTids),
    hasMore: start + limit < diversified.length
  };
}

function getCuratedPages(rules) {
  const pages = rules?.feedEditions?.pages;
  if (!Array.isArray(pages)) return [];
  return pages
    .map((page) => (Array.isArray(page) ? page : page?.tids))
    .filter(Array.isArray)
    .map((page) => page.map(Number).filter(Number.isFinite))
    .filter((page) => page.length);
}

function curatedSlotsPerPage(rules, limit) {
  const configured = Number(rules?.feedEditions?.curatedSlotsPerPage);
  if (!Number.isFinite(configured)) return limit;
  return Math.min(limit, Math.max(0, configured));
}

function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function personalizeBatch(items, readTids) {
  return [...items].sort((a, b) => {
    const aRead = readTids.has(Number(a.tid)) ? 1 : 0;
    const bRead = readTids.has(Number(b.tid)) ? 1 : 0;
    if (aRead !== bRead) return aRead - bRead;
    return 0;
  });
}

function parseReadTids(value = "") {
  return new Set(
    String(value)
      .split(",")
      .map((item) => Number(item.trim()))
      .filter(Number.isFinite)
  );
}

async function handleFeed(req, reqUrl, res) {
  const rules = await loadRules();
  const metadata = await loadMetadata();
  const auth = await getCurrentUser(req);
  const currentUser = auth.user;
  const tab = reqUrl.searchParams.get("tab") || "此刻";
  const page = Math.max(1, Number(reqUrl.searchParams.get("page") || 1));
  const editionPageSize = Number(rules?.feedEditions?.pageSize || 10);
  const limit = Math.min(24, Math.max(4, Number(reqUrl.searchParams.get("limit") || editionPageSize || 10)));
  const readTids = parseReadTids(reqUrl.searchParams.get("read") || "");
  const isRecommendTab = tab === "精选";
  const isMomentTab = tab === "此刻" && feedFeatureEnabled(rules, "momentTab");
  const surface = isMomentTab ? "moment" : "home";
  const topics = await getAllRecentTopics();
  const basicItems = topics
    .map((topic) => normalizeTopic(topic, null, metadata))
    .filter((item) => isFeedEligible(item, rules, { surface, currentUser }));
  const itemByTid = new Map(basicItems.map((item) => [Number(item.tid), item]));

  let items = basicItems;
  let selected;
  let hasMore;
  let feedMode = "scored";
  const curatedPages = isRecommendTab ? getCuratedPages(rules) : [];

  if (isMomentTab) {
    const momentFeed = selectMomentFeed(basicItems, rules, { page, limit, readTids, currentUser });
    selected = momentFeed.selected;
    hasMore = momentFeed.hasMore;
    feedMode = "moment";
  } else if (!isRecommendTab) {
    items = items.filter((item) => item.tags.includes(tab) || item.tag === tab);
    const start = (page - 1) * limit;
    selected = items.slice(start, start + limit);
    hasMore = start + selected.length < items.length;
  } else if (curatedPages.length) {
    feedMode = "curated";
    const used = new Set();
    const curatedSlots = curatedSlotsPerPage(rules, limit);
    const pages = curatedPages.map((tids) => (
      tids
        .map((tid) => itemByTid.get(Number(tid)))
        .filter((item) => isFeedEligible(item, rules, { surface: "home", currentUser }))
        .slice(0, curatedSlots)
    ));
    pages.flat().forEach((item) => used.add(Number(item.tid)));
    const rankedRest = basicItems
      .filter((item) => !used.has(Number(item.tid)))
      .filter((item) => isFeedEligible(item, rules, { surface: "home", currentUser }))
      .sort((a, b) => (
        scoreItem(b, rules, { readTids, surface: "home", useOfficialPenalty: true })
        - scoreItem(a, rules, { readTids, surface: "home", useOfficialPenalty: true })
      ));
    const diversifiedRest = diversifyItems(rankedRest, rules);
    const rankedRestOnCuratedPages = rules?.feedEditions?.rankedRestOnCuratedPages === true;
    const allPages = rankedRestOnCuratedPages
      ? pages.map((pageItems, index) => {
        const restStart = index * Math.max(0, limit - pageItems.length);
        const restFill = diversifiedRest.slice(restStart, restStart + Math.max(0, limit - pageItems.length));
        return [...pageItems, ...restFill];
      })
      : pages;
    const usedRestCount = rankedRestOnCuratedPages
      ? allPages.reduce((sum, batch, index) => sum + Math.max(0, batch.length - (pages[index]?.length || 0)), 0)
      : 0;
    const restPages = chunkItems(diversifiedRest.slice(usedRestCount), Math.max(4, limit));
    allPages.push(...restPages);
    const nonEmptyPages = allPages.filter((batch) => batch.length);
    const currentBatch = nonEmptyPages[page - 1] || [];
    selected = personalizeBatch(currentBatch, readTids);
    hasMore = page < nonEmptyPages.length;
  } else {
    items = items.sort((a, b) => (
      scoreItem(b, rules, { readTids, surface: "home", useOfficialPenalty: true })
      - scoreItem(a, rules, { readTids, surface: "home", useOfficialPenalty: true })
    ));
    items = diversifyItems(items, rules);
    const start = (page - 1) * limit;
    selected = items.slice(start, start + limit);
    hasMore = start + selected.length < items.length;
  }

  const sliced = await Promise.all(
    selected.map(async (item) => {
      const topic = topics.find((candidate) => candidate.tid === item.tid) || item;
      try {
        const detail = await getTopicDetail(item.tid);
        return normalizeTopic(topic, detail, metadata);
      } catch {
        return item;
      }
    })
  );
  const filtered = sliced
    .filter((item) => isFeedEligible(item, rules, { surface, currentUser }))
    .filter((item) => isRecommendTab || isMomentTab || item.tags.includes(tab) || item.tag === tab);
  const configuredTabs = Array.isArray(rules.tabs) && rules.tabs.length ? rules.tabs : ["精选"];
  const tabs = feedFeatureEnabled(rules, "momentTab") && !configuredTabs.includes("此刻")
    ? ["此刻", "精选", ...configuredTabs.filter((item) => item !== "此刻" && item !== "精选")]
    : configuredTabs;
  sendJson(res, 200, {
    items: filtered,
    page,
    nextPage: hasMore ? page + 1 : null,
    hasMore,
    tabs,
    feedEdition: feedMode === "curated" ? {
      mode: "curated",
      pageSize: editionPageSize,
      generatedAt: rules.feedEditions?.generatedAt || null,
      pageNote: rules.feedEditions?.notes?.[page - 1] || ""
    } : { mode: feedMode },
    dataSource: "api"
  });
}

function feedDebugSource(item, { isRecommendTab, isMomentTab, tab, curatedTidSet }) {
  if (isMomentTab) return "moment";
  if (!isRecommendTab) return (item.tags.includes(tab) || item.tag === tab) ? "category" : "category";
  return curatedTidSet.has(Number(item.tid)) ? "curated" : "rankedRest";
}

function feedDebugRow(item, rules, context) {
  const reason = feedFilterReason(item, rules, { surface: context.surface, currentUser: context.currentUser || null });
  const tabReason = context.tabFilterReason?.(item) || "";
  const filteredReason = reason || tabReason;
  const eligible = !filteredReason;
  const breakdown = scoreBreakdown(item, rules, {
    readTids: context.readTids,
    surface: context.scoreSurface || context.surface,
    useOfficialPenalty: context.useOfficialPenalty
  });
  return {
    tid: Number(item.tid),
    title: item.title,
    tag: item.tag,
    tags: item.tags,
    contentType: item.contentType,
    locationArea: item.locationArea,
    distribution: item.distribution,
    riskScore: item.riskScore,
    officialScore: item.officialScore,
    isExpired: item.isExpired,
    hasCover: Boolean(item.cover),
    eligible,
    filteredReason,
    source: feedDebugSource(item, context),
    score: breakdown
  };
}

async function handleFeedDebug(req, reqUrl, res) {
  requireAdmin(req);
  const rules = await loadRules();
  const metadata = await loadMetadata();
  const tab = reqUrl.searchParams.get("tab") || "此刻";
  const page = Math.max(1, Number(reqUrl.searchParams.get("page") || 1));
  const editionPageSize = Number(rules?.feedEditions?.pageSize || 10);
  const limit = Math.min(60, Math.max(4, Number(reqUrl.searchParams.get("limit") || editionPageSize || 10)));
  const readTids = parseReadTids(reqUrl.searchParams.get("read") || "");
  const isRecommendTab = tab === "精选";
  const isMomentTab = tab === "此刻" && feedFeatureEnabled(rules, "momentTab");
  const surface = isMomentTab ? "moment" : "home";
  const topics = await getAllRecentTopics();
  const allItems = topics.map((topic) => normalizeTopic(topic, null, metadata));
  const curatedPages = getCuratedPages(rules);
  const curatedTidSet = new Set(curatedPages.flat().map(Number));
  const usedCurated = new Set();
  const tabFilterReason = (item) => {
    if (isRecommendTab || isMomentTab) return "";
    return item.tags.includes(tab) || item.tag === tab ? "" : "not-in-tab";
  };
  const debugAuth = await getCurrentUser(req);
  const context = {
    tab,
    isRecommendTab,
    isMomentTab,
    curatedTidSet,
    readTids,
    surface,
    scoreSurface: "home",
    useOfficialPenalty: isRecommendTab || isMomentTab,
    tabFilterReason,
    currentUser: debugAuth.user
  };
  const rows = allItems.map((item) => feedDebugRow(item, rules, context));

  let orderedRows;
  let mode = "scored";
  if (isMomentTab) {
    mode = "moment";
    orderedRows = [...rows].sort((a, b) => {
      const itemA = allItems.find((item) => Number(item.tid) === a.tid);
      const itemB = allItems.find((item) => Number(item.tid) === b.tid);
      return momentScoreItem(itemB, rules) - momentScoreItem(itemA, rules);
    });
  } else if (!isRecommendTab) {
    mode = "category";
    orderedRows = rows.filter((row) => row.filteredReason !== "not-in-tab")
      .sort((a, b) => Date.parse(allItems.find((item) => Number(item.tid) === b.tid)?.timestampISO || 0)
        - Date.parse(allItems.find((item) => Number(item.tid) === a.tid)?.timestampISO || 0));
  } else if (curatedPages.length) {
    mode = "curated";
    const itemByTid = new Map(allItems.map((item) => [Number(item.tid), item]));
    const curatedSlots = curatedSlotsPerPage(rules, limit);
    const curatedPageRows = curatedPages.map((tids) => {
      const pageRows = [];
      for (const tid of tids) {
        if (pageRows.length >= curatedSlots) break;
        const item = itemByTid.get(Number(tid));
        if (!item) continue;
        usedCurated.add(Number(tid));
        pageRows.push(feedDebugRow(item, rules, context));
      }
      return pageRows;
    });
    const restRows = allItems
      .filter((item) => !usedCurated.has(Number(item.tid)))
      .map((item) => feedDebugRow(item, rules, context))
      .sort((a, b) => b.score.final - a.score.final);
    if (rules?.feedEditions?.rankedRestOnCuratedPages === true) {
      const pages = curatedPageRows.map((pageRows, index) => {
        const restStart = index * Math.max(0, limit - pageRows.length);
        const restFill = restRows.slice(restStart, restStart + Math.max(0, limit - pageRows.length));
        return [...pageRows, ...restFill];
      });
      const usedRestCount = pages.reduce((sum, batch, index) => sum + Math.max(0, batch.length - (curatedPageRows[index]?.length || 0)), 0);
      orderedRows = [...pages.flat(), ...restRows.slice(usedRestCount)];
    } else {
      orderedRows = [...curatedPageRows.flat(), ...restRows];
    }
  } else {
    orderedRows = [...rows].sort((a, b) => b.score.final - a.score.final);
  }

  const start = (page - 1) * limit;
  const pageRows = orderedRows.slice(start, start + limit);
  sendJson(res, 200, {
    tab,
    page,
    limit,
    mode,
    surface,
    items: pageRows,
    totals: {
      candidates: rows.length,
      eligible: rows.filter((row) => row.eligible).length,
      filtered: rows.filter((row) => !row.eligible).length,
      pageItems: pageRows.length
    },
    filteredReasons: rows.reduce((acc, row) => {
      if (row.filteredReason) acc[row.filteredReason] = (acc[row.filteredReason] || 0) + 1;
      return acc;
    }, {}),
    dataSource: "api"
  });
}

async function handlePostDetail(req, tid, res) {
  const metadata = await loadMetadata();
  const detail = await getTopicDetail(tid);
  if (!detail) {
    sendJson(res, 404, { error: "topic not found" });
    return;
  }
  const firstPost = detail?.posts?.[0] || {};
  const meta = metadata[String(tid)] || {};
  const auth = await getCurrentUser(req);
  const postForAccess = { visibility: meta.visibility, audience: meta.audience, authorUserId: "" };
  const userMetaForAccess = parseLianUserMeta(firstPost.content || "");
  if (userMetaForAccess.userId) postForAccess.authorUserId = userMetaForAccess.userId;
  if (!canViewPost(auth.user, postForAccess)) {
    sendJson(res, 403, { error: "access denied" });
    return;
  }
  const sourceUrl = meta.sourceUrl || extractSourceUrl(firstPost.content || "");
  let bookmarked = false;
  if (auth.user) {
    try {
      const nodebbUid = await ensureNodebbUid(auth);
      const userDetail = await nodebbFetch(withNodebbUid(`/api/topic/${tid}`, nodebbUid));
      bookmarked = Boolean(userDetail?.posts?.[0]?.bookmarked);
    } catch {
      bookmarked = false;
    }
  }
  const replies = (detail?.posts || []).slice(1).map((post) => {
    const userMeta = parseLianUserMeta(post.content || "");
    return {
      pid: post.pid,
      username: userMeta.username || post.user?.username || "",
      identityTag: userMeta.identityTag || "",
      avatarText: userMeta.avatarText || String(userMeta.username || post.user?.username || "同").slice(0, 1),
      avatarUrl: userMeta.avatarUrl || absoluteNodebbUrl(post.user?.picture || ""),
      timestampISO: post.timestampISO || "",
      contentHtml: renderPostContent(post.content || "")
    };
  });
  sendJson(res, 200, {
    ...normalizeTopic({ tid }, detail, metadata),
    sourceUrl,
    contentHtml: renderPostContent(firstPost.content || ""),
    bookmarked,
    replies,
    dataSource: "api",
    raw: {
      tid: detail.tid,
      slug: detail.slug,
      timestampISO: detail.timestampISO,
      tags: detail.tags || []
    }
  });
}

// AI post preview helpers: draft-only generation, no publishing and no metadata writes.

export {
  getAllRecentTopics,
  getTopicDetail,
  handleFeed,
  handleFeedDebug,
  handlePostDetail,
  normalizeChannelEvent
};
