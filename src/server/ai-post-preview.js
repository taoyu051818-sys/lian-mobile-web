import { config } from "./config.js";
import { sendJson } from "./http-response.js";
import { readJsonBody } from "./request-utils.js";
import { mapItems } from "./static-data.js";

const AI_POST_PREVIEW_MAX_BASE64_LENGTH = 1_500_000;
const AI_POST_PREVIEW_MAX_BODY_BYTES = 1_750_000;
const AI_POST_PREVIEW_TIMEOUT_MS = 20_000;
const AI_ALLOWED_CONTENT_TYPES = new Set([
  "campus_moment",
  "food",
  "place_memory",
  "campus_tip",
  "library_moment",
  "activity_scene",
  "learning_scene",
  "map_tip",
  "guide",
  "opportunity",
  "general"
]);
const AI_ALLOWED_TEMPLATES = new Set([
  "campus_moment",
  "food",
  "campus_tip",
  "place_memory",
  "library_moment",
  "activity_scene"
]);
const AI_ALLOWED_VISIBILITY = new Set(["public", "campus", "school", "linkOnly", "private"]);
const AI_ALLOWED_DISTRIBUTION = new Set(["home", "moment", "map", "search", "detail", "detailOnly"]);
const AI_DEFAULT_METADATA = {
  contentType: "general",
  vibeTags: [],
  sceneTags: [],
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

function clampNumber(value, min = 0, max = 1, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function truncateText(value = "", maxLength = 80) {
  return Array.from(String(value || "").trim()).slice(0, maxLength).join("");
}

function compactStringArray(value, maxItems = 5, maxLength = 16) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => truncateText(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function safeParseModelJson(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  const candidate = fenced || raw;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function knownLocationId(value = "") {
  const id = String(value || "").trim();
  if (!id) return "";
  return mapItems.some((item) => item.id === id) ? id : "";
}

function normalizeRiskFlags(value) {
  const items = Array.isArray(value) ? value : [];
  return items.slice(0, 5).map((item) => {
    const level = ["info", "warning", "block"].includes(item?.level) ? item.level : "warning";
    return {
      type: truncateText(item?.type || "privacy", 32),
      level,
      message: truncateText(item?.message || "发布前请确认图片中是否包含人脸、电话号码、车牌或宿舍门牌等隐私信息。", 120)
    };
  }).filter((item) => item.message);
}

function normalizeLocationSuggestions(value) {
  const items = Array.isArray(value) ? value : [];
  return items.slice(0, 5).map((item) => ({
    locationId: knownLocationId(item?.locationId),
    name: truncateText(item?.name || item?.locationArea || "", 40),
    confidence: clampNumber(item?.confidence, 0, 1, 0),
    reason: truncateText(item?.reason || "", 100)
  })).filter((item) => item.name || item.reason);
}

function normalizePostPreviewDraft(value = {}, request = {}) {
  const metadataInput = value?.metadata && typeof value.metadata === "object" && !Array.isArray(value.metadata)
    ? value.metadata
    : {};
  const distribution = compactStringArray(metadataInput.distribution, 4, 20)
    .filter((item) => AI_ALLOWED_DISTRIBUTION.has(item));
  const visibility = AI_ALLOWED_VISIBILITY.has(metadataInput.visibility)
    ? metadataInput.visibility
    : (AI_ALLOWED_VISIBILITY.has(request.visibilityHint) ? request.visibilityHint : AI_DEFAULT_METADATA.visibility);
  const contentType = AI_ALLOWED_CONTENT_TYPES.has(metadataInput.contentType)
    ? metadataInput.contentType
    : (AI_ALLOWED_CONTENT_TYPES.has(request.template) ? request.template : AI_DEFAULT_METADATA.contentType);

  return {
    title: truncateText(value?.title || "校园里的这一刻", 40),
    body: truncateText(value?.body || request.userText || "这是一条可编辑的校园轻投稿草稿，请发布前补充细节并确认图片隐私。", 300),
    tags: compactStringArray(value?.tags, 5, 16),
    metadata: {
      ...AI_DEFAULT_METADATA,
      contentType,
      vibeTags: compactStringArray(metadataInput.vibeTags, 5, 16),
      sceneTags: compactStringArray(metadataInput.sceneTags, 5, 16),
      locationId: knownLocationId(metadataInput.locationId),
      locationArea: truncateText(metadataInput.locationArea || request.locationHint || "", 40),
      qualityScore: clampNumber(metadataInput.qualityScore),
      imageImpactScore: clampNumber(metadataInput.imageImpactScore),
      riskScore: clampNumber(metadataInput.riskScore),
      officialScore: clampNumber(metadataInput.officialScore),
      visibility,
      distribution: distribution.length ? distribution : [...AI_DEFAULT_METADATA.distribution],
      keepAfterExpired: Boolean(metadataInput.keepAfterExpired)
    }
  };
}

function normalizePostPreviewResult(value = {}, request = {}, fallback = {}) {
  const draft = normalizePostPreviewDraft(value, request);
  const riskFlags = normalizeRiskFlags(value?.riskFlags);
  const confidence = clampNumber(value?.confidence, 0, 1, fallback.confidence ?? 0.55);
  const highRisk = draft.metadata.riskScore >= 0.7 || riskFlags.some((item) => item.level === "block");
  return {
    draft: {
      ...draft,
      tags: draft.tags.length ? draft.tags : ["校园随手拍"]
    },
    locationSuggestions: normalizeLocationSuggestions(value?.locationSuggestions),
    riskFlags,
    confidence,
    needsHumanReview: Boolean(value?.needsHumanReview) || highRisk || Boolean(fallback.needsHumanReview)
  };
}

function buildPostPreviewPrompt(payload = {}) {
  const template = AI_ALLOWED_TEMPLATES.has(payload.template) ? payload.template : "campus_moment";
  const visibilityHint = AI_ALLOWED_VISIBILITY.has(payload.visibilityHint) ? payload.visibilityHint : "public";
  return [
    "请根据图片和用户补充文字，生成 LIAN 校园轻投稿草稿。",
    "只输出严格 JSON，不要输出解释文字、Markdown 或代码块。",
    "JSON 字段必须包含 title, body, tags, metadata, locationSuggestions, riskFlags, confidence, needsHumanReview。",
    "AI 只能生成可编辑草稿，不能表示已经发布，不能替用户确认隐私或审核。",
    "locationId 只能在已有地点 ID 明确匹配时填写；不确定时必须输出空字符串。",
    "title 不超过 40 字，body 不超过 300 字，tags 最多 5 个。",
    "scores 必须是 0 到 1 的数字。",
    "风险提示只做提醒：如可能有人脸、电话号码、车牌、宿舍门牌、私人聊天截图、敏感地点或未授权人物特写，请加入 riskFlags。",
    `template: ${template}`,
    `visibilityHint: ${visibilityHint}`,
    `locationHint: ${truncateText(payload.locationHint || "", 80)}`,
    `userText: ${truncateText(payload.userText || "", 300)}`,
    `metadata 默认值: ${JSON.stringify(AI_DEFAULT_METADATA)}`,
    "允许 contentType: campus_moment, food, place_memory, campus_tip, library_moment, activity_scene, learning_scene, map_tip, guide, opportunity, general。",
    "允许 visibility: public, campus, school, linkOnly, private。",
    "允许 distribution: home, moment, map, search, detail, detailOnly。"
  ].join("\n");
}

function normalizePostPreviewRequest(payload = {}) {
  const imageUrl = String(payload.imageUrl || "").trim();
  const imageBase64 = String(payload.imageBase64 || "").trim();
  if (imageBase64 && imageBase64.length > AI_POST_PREVIEW_MAX_BASE64_LENGTH) {
    const error = new Error("imageBase64 is too large");
    error.status = 413;
    throw error;
  }
  return {
    imageUrl,
    imageBase64,
    template: AI_ALLOWED_TEMPLATES.has(payload.template) ? payload.template : "campus_moment",
    userText: truncateText(payload.userText || "", 300),
    locationHint: truncateText(payload.locationHint || "", 80),
    visibilityHint: AI_ALLOWED_VISIBILITY.has(payload.visibilityHint) ? payload.visibilityHint : "public"
  };
}

function mockPostPreview(request = {}) {
  const hasImage = Boolean(request.imageUrl || request.imageBase64);
  const contentType = request.template || "campus_moment";
  const locationArea = request.locationHint || "";
  const riskFlags = hasImage
    ? [{
        type: "privacy",
        level: "warning",
        message: "如果图片中有人脸、电话号码、车牌或宿舍门牌，请发布前确认是否需要打码。"
      }]
    : [];
  return normalizePostPreviewResult({
    title: locationArea ? `${locationArea}的一刻` : "校园里的这一刻",
    body: request.userText
      ? `${request.userText}。这是一条可编辑的校园轻投稿草稿，发布前可以继续补充时间、地点和细节。`
      : "这张内容适合整理成一条校园轻投稿。发布前请补充具体时间、地点和你想表达的重点。",
    tags: contentType === "food" ? ["校园美食", "饭点", "真实上桌"] : ["校园随手拍", "黎安记忆", "生活感"],
    metadata: {
      contentType,
      vibeTags: contentType === "food" ? ["真实", "饭点"] : ["真实", "在地", "生活感"],
      sceneTags: locationArea ? [locationArea] : [],
      locationId: "",
      locationArea,
      qualityScore: hasImage ? 0.66 : 0.42,
      imageImpactScore: hasImage ? 0.72 : 0,
      riskScore: hasImage ? 0.08 : 0.03,
      officialScore: 0,
      visibility: request.visibilityHint || "public",
      distribution: contentType === "place_memory" ? ["home", "map", "search", "detail"] : ["home", "search", "detail"],
      keepAfterExpired: false
    },
    locationSuggestions: locationArea ? [{
      locationId: "",
      name: locationArea,
      confidence: 0.45,
      reason: "来自用户提供的地点提示，需发布前确认。"
    }] : [],
    riskFlags,
    confidence: hasImage ? 0.62 : 0.42,
    needsHumanReview: false
  }, request, { confidence: hasImage ? 0.62 : 0.42 });
}

function extractMimoMessageContent(data = {}) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === "string" ? part : part?.text || "").join("\n");
  }
  return "";
}

async function callMimoVisionPostPreview(request = {}) {
  if (!config.mimoApiKey) {
    const error = new Error("MIMO_API_KEY is missing");
    error.status = 500;
    throw error;
  }

  const userContent = [];
  if (request.imageUrl) {
    userContent.push({ type: "image_url", image_url: { url: request.imageUrl } });
  } else if (request.imageBase64) {
    const url = request.imageBase64.startsWith("data:image/")
      ? request.imageBase64
      : `data:image/jpeg;base64,${request.imageBase64}`;
    userContent.push({ type: "image_url", image_url: { url } });
  }
  userContent.push({ type: "text", text: buildPostPreviewPrompt(request) });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_POST_PREVIEW_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.mimoBaseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "api-key": config.mimoApiKey
      },
      body: JSON.stringify({
        model: config.mimoModel,
        messages: [
          {
            role: "system",
            content: "你是 LIAN 校园轻投稿助手。你只能输出严格 JSON，不要输出解释文字。"
          },
          {
            role: "user",
            content: userContent
          }
        ],
        temperature: 0.3,
        max_completion_tokens: 2048,
        thinking: { type: "disabled" }
      })
    });
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`MiMo post preview failed with status ${response.status}`);
      error.status = 502;
      error.detail = text;
      throw error;
    }
    const data = safeParseModelJson(text) || JSON.parse(text);
    const modelText = extractMimoMessageContent(data);
    const parsed = safeParseModelJson(modelText);
    if (!parsed) {
      const error = new Error("MiMo post preview returned invalid JSON");
      error.status = 502;
      throw error;
    }
    return normalizePostPreviewResult(parsed, request);
  } finally {
    clearTimeout(timeout);
  }
}

async function handleAiPostPreview(req, res) {
  const payload = await readJsonBody(req, AI_POST_PREVIEW_MAX_BODY_BYTES);
  const request = normalizePostPreviewRequest(payload);
  const useMock = config.aiPostPreviewMode === "mock" || !config.mimoApiKey;
  if (useMock) {
    return sendJson(res, 200, {
      ok: true,
      mode: "mock",
      ...mockPostPreview(request)
    });
  }

  try {
    const result = await callMimoVisionPostPreview(request);
    return sendJson(res, 200, {
      ok: true,
      mode: "mimo",
      ...result
    });
  } catch (error) {
    const fallback = mockPostPreview(request);
    return sendJson(res, 200, {
      ok: true,
      mode: "mock",
      fallbackReason: "mimo_unavailable",
      draft: fallback.draft,
      locationSuggestions: fallback.locationSuggestions,
      riskFlags: fallback.riskFlags,
      confidence: Math.min(fallback.confidence, 0.5),
      needsHumanReview: true
    });
  }
}

export { handleAiPostPreview };