import crypto from "node:crypto";

import { normalizeAudience, deriveSchoolId } from "./audience-service.js";
import { memory } from "./cache.js";
import { warmupPostImages, normalizePostImageUrl } from "./content-utils.js";
import { appendJsonLine, patchPostMetadata } from "./data-store.js";
import { sendJson } from "./http-response.js";
import { aiPostDraftsPath, aiPostRecordsPath } from "./paths.js";
import { createNodebbTopicFromPayload } from "./post-service.js";
import { readJsonBody } from "./request-utils.js";
import { requireUser } from "./auth-service.js";
import {
  AI_ALLOWED_CONTENT_TYPES,
  AI_ALLOWED_DISTRIBUTION,
  AI_ALLOWED_VISIBILITY,
  AI_DEFAULT_METADATA,
  clampNumber,
  compactStringArray,
  normalizeLocationDraft,
  normalizeRiskFlags,
  truncateText
} from "./ai-post-preview.js";
import { config } from "./config.js";

const AI_POST_PREVIEW_MAX_BODY_BYTES = 1_750_000;

function metadataArray(value, fallback = []) {
  if (!Array.isArray(value)) return [...fallback];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeAiPublishMetadata(value = {}, locationDraft = {}, request = {}) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const contentType = AI_ALLOWED_CONTENT_TYPES.has(input.contentType)
    ? input.contentType
    : (AI_ALLOWED_CONTENT_TYPES.has(request.template) ? request.template : AI_DEFAULT_METADATA.contentType);
  const visibility = AI_ALLOWED_VISIBILITY.has(input.visibility) ? input.visibility
    : (AI_ALLOWED_VISIBILITY.has(request.visibilityHint) ? request.visibilityHint : "public");
  const locationArea = locationDraft?.skipped
    ? truncateText(input.locationArea || request.locationHint || "", 40)
    : truncateText(locationDraft.locationArea || input.locationArea || request.locationHint || "", 40);
  const distribution = compactStringArray(input.distribution, 4, 20)
    .filter((item) => AI_ALLOWED_DISTRIBUTION.has(item));
  const hasLatLng = !locationDraft?.skipped && Number.isFinite(Number(locationDraft?.lat)) && Number.isFinite(Number(locationDraft?.lng));
  return {
    ...AI_DEFAULT_METADATA,
    contentType,
    vibeTags: compactStringArray(input.vibeTags, 5, 16),
    sceneTags: compactStringArray(input.sceneTags, 5, 16),
    locationId: "",
    locationArea,
    qualityScore: clampNumber(input.qualityScore),
    imageImpactScore: clampNumber(input.imageImpactScore),
    riskScore: clampNumber(input.riskScore),
    officialScore: clampNumber(input.officialScore),
    visibility,
    audience: normalizeAudience(input.audience, visibility),
    distribution: distribution.length
      ? distribution
      : (locationArea ? ["home", "map", "search", "detail"] : ["home", "search", "detail"]),
    keepAfterExpired: Boolean(input.keepAfterExpired),
    imageUrls: metadataArray(input.imageUrls, []),
    lat: hasLatLng ? Number(locationDraft.lat) : undefined,
    lng: hasLatLng ? Number(locationDraft.lng) : undefined,
    mapVersion: locationDraft?.mapVersion || (hasLatLng ? "gaode_v2" : "legacy"),
    locationDraft
  };
}

function normalizeAiPostPayload(payload = {}, { requireImage = false } = {}) {
  const imageUrls = Array.isArray(payload.imageUrls)
    ? payload.imageUrls.map((url) => normalizePostImageUrl(url, { width: 1200 })).filter(Boolean)
    : (payload.imageUrl ? [normalizePostImageUrl(payload.imageUrl, { width: 1200 })].filter(Boolean) : []);
  const imageUrl = imageUrls[0] || "";
  if (requireImage && !imageUrl) {
    const error = new Error("imageUrl is required");
    error.status = 400;
    throw error;
  }
  const title = truncateText(payload.title || "", 40);
  const body = truncateText(payload.body || payload.content || "", 300);
  if (!title) {
    const error = new Error("title is required");
    error.status = 400;
    throw error;
  }
  if (!body) {
    const error = new Error("body is required");
    error.status = 400;
    throw error;
  }
  const metadataInput = payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
    ? payload.metadata
    : {};
  const locationDraft = normalizeLocationDraft(payload.locationDraft, {
    aiLocationArea: metadataInput.locationArea || "",
    locationHint: payload.locationHint || ""
  });
  const metadata = normalizeAiPublishMetadata(metadataInput, locationDraft, {
    template: metadataInput.contentType,
    locationHint: payload.locationHint || ""
  });
  metadata.title = title;
  metadata.imageUrls = imageUrls;
  return {
    imageUrl,
    imageUrls,
    title,
    body,
    tags: compactStringArray(payload.tags, 5, 16),
    metadata,
    locationDraft,
    riskFlags: normalizeRiskFlags(payload.riskFlags),
    confidence: clampNumber(payload.confidence, 0, 1, 0),
    needsHumanReview: Boolean(payload.needsHumanReview),
    aiMode: truncateText(payload.aiMode || payload.mode || "", 20) || "unknown"
  };
}

function lianUserRecord(user = {}) {
  return {
    id: user.id || "",
    email: user.email || "",
    username: user.username || "",
    displayName: user.displayName || user.username || ""
  };
}

async function handleAiPostDraft(req, res) {
  const auth = await requireUser(req);
  const payload = await readJsonBody(req, AI_POST_PREVIEW_MAX_BODY_BYTES);
  const normalized = normalizeAiPostPayload(payload);
  const id = crypto.randomUUID();
  const record = {
    id,
    source: "ai_light_publish",
    status: "draft",
    createdAt: new Date().toISOString(),
    imageUrl: normalized.imageUrl,
    imageUrls: normalized.imageUrls,
    title: normalized.title,
    body: normalized.body,
    tags: normalized.tags,
    metadata: normalized.metadata,
    locationDraft: normalized.locationDraft,
    riskFlags: normalized.riskFlags,
    confidence: normalized.confidence,
    needsHumanReview: normalized.needsHumanReview,
    aiMode: normalized.aiMode,
    lianUser: lianUserRecord(auth.user)
  };
  await appendJsonLine(aiPostDraftsPath, record);
  sendJson(res, 200, { ok: true, draftId: id, status: "draft" });
}

async function handleAiPostPublish(req, res) {
  const auth = await requireUser(req);
  if (!config.nodebbToken) return sendJson(res, 500, { error: "LIAN API token is missing" });
  if (auth.user.status === "limited") return sendJson(res, 403, { error: "account is limited" });

  const payload = await readJsonBody(req, AI_POST_PREVIEW_MAX_BODY_BYTES);
  const normalized = normalizeAiPostPayload(payload, { requireImage: true });
  if (normalized.metadata.audience.visibility === "school" && !normalized.metadata.audience.schoolIds.length && auth.user.institution) {
    normalized.metadata.audience.schoolIds = [deriveSchoolId(auth.user.institution) || auth.user.institution];
  }
  const aliasId = String(payload.aliasId || "").trim();
  const recordId = crypto.randomUUID();
  const recordBase = {
    id: recordId,
    source: "ai_light_publish",
    status: "pending_publish",
    createdAt: new Date().toISOString(),
    imageUrl: normalized.imageUrl,
    imageUrls: normalized.imageUrls,
    title: normalized.title,
    body: normalized.body,
    tags: normalized.tags,
    metadata: normalized.metadata,
    locationDraft: normalized.locationDraft,
    riskFlags: normalized.riskFlags,
    confidence: normalized.confidence,
    needsHumanReview: normalized.needsHumanReview,
    aiMode: normalized.aiMode,
    aliasId,
    lianUser: lianUserRecord(auth.user)
  };

  let tid = 0;
  try {
    const nodebbResult = await createNodebbTopicFromPayload(auth, {
      title: normalized.title,
      content: normalized.body,
      imageUrl: normalized.imageUrl,
      imageUrls: normalized.imageUrls,
      tag: normalized.tags[0] || "",
      tags: normalized.tags,
      aliasId,
      placeName: normalized.locationDraft.displayName || normalized.locationDraft.locationArea || normalized.metadata.locationArea,
      mapLocation: normalized.locationDraft.skipped ? null : {
        x: normalized.locationDraft.legacyPoint.x ?? normalized.locationDraft.imagePoint.x ?? undefined,
        y: normalized.locationDraft.legacyPoint.y ?? normalized.locationDraft.imagePoint.y ?? undefined,
        lat: normalized.locationDraft.lat ?? undefined,
        lng: normalized.locationDraft.lng ?? undefined,
        placeName: normalized.locationDraft.displayName || normalized.locationDraft.locationArea || ""
      }
    });
    tid = nodebbResult.tid;
    if (!tid) throw new Error("NodeBB did not return tid");

    try {
      await patchPostMetadata(tid, normalized.metadata);
    } catch (metadataError) {
      await appendJsonLine(aiPostRecordsPath, {
        ...recordBase,
        status: "metadata_error",
        nodebbUid: nodebbResult.nodebbUid || null,
        tid,
        url: `${config.nodebbPublicBaseUrl}/topic/${tid}`,
        error: metadataError.message || "metadata write failed",
        failedAt: new Date().toISOString()
      });
      return sendJson(res, 500, {
        ok: false,
        error: "metadata write failed after NodeBB publish",
        tid,
        url: `${config.nodebbPublicBaseUrl}/topic/${tid}`,
        recordId
      });
    }

    await appendJsonLine(aiPostRecordsPath, {
      ...recordBase,
      status: "published",
      nodebbUid: nodebbResult.nodebbUid || null,
      tid,
      url: `${config.nodebbPublicBaseUrl}/topic/${tid}`,
      publishedAt: new Date().toISOString()
    });
    if (normalized.imageUrls.length) await warmupPostImages(normalized.imageUrls);
    memory.feedPages.clear();
    return sendJson(res, 200, {
      ok: true,
      tid,
      url: `${config.nodebbPublicBaseUrl}/topic/${tid}`,
      recordId
    });
  } catch (error) {
    await appendJsonLine(aiPostRecordsPath, {
      ...recordBase,
      status: "error",
      nodebbUid: auth.user.nodebbUid || null,
      tid,
      error: error.message || "publish failed",
      failedAt: new Date().toISOString()
    }).catch(() => {});
    throw error;
  }
}

export { handleAiPostDraft, handleAiPostPublish };
