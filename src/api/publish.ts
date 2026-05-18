import { apiSend, apiUpload } from "./http";
import type { PlaceRef } from "../types/place";
import type {
  MerchantContentType,
  MerchantPublishInput,
  PublishLocationDraft,
  PublishPayload,
  PublishResponse,
  PublishVisibility,
  UploadImageResponse,
} from "../types/publish";
import {
  type Audience,
  DEFAULT_AUDIENCE,
  isDefaultAudience,
  normalizeAudience,
} from "../types/audience";
export const MAX_PUBLISH_IMAGE_COUNT = 9;
export const MAX_PUBLISH_IMAGE_BYTES = 10 * 1024 * 1024;
export const PUBLISH_IMAGE_HELP_TEXT = `支持常见图片格式，单张不超过 ${formatPublishImageSize(MAX_PUBLISH_IMAGE_BYTES)}，最多 ${MAX_PUBLISH_IMAGE_COUNT} 张。`;
export const PUBLISH_IMAGE_PRIVACY_NOTICE =
  "上传前请确认图片里没有住址、证件、课表或其他会直接暴露身份的信息。当前页面只做基础格式和大小校验；图片元数据清理能力以后端已确认的上传 contract 为准。";

function formatPublishImageSize(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function isPublishImageFile(file: Pick<File, "type">) {
  return typeof file.type === "string" && file.type.startsWith("image/");
}

export function normalizePublishTag(value = "") {
  const body = Array.from(
    String(value || "")
      .trim()
      .replace(/^#+/, ""),
  )
    .filter((char) => /[\p{L}\p{N}_-]/u.test(char))
    .join("")
    .slice(0, 15);
  return body ? `#${body}` : "";
}

export function normalizeIdentityTag(value = "") {
  return String(value || "")
    .trim()
    .slice(0, 16);
}

export function validatePublishImageFile(file: Pick<File, "type" | "size">) {
  if (!isPublishImageFile(file)) return "请上传图片文件。";
  if (file.size > MAX_PUBLISH_IMAGE_BYTES) {
    return `单张图片不能超过 ${formatPublishImageSize(MAX_PUBLISH_IMAGE_BYTES)}。`;
  }
  return "";
}

export function validatePublishImageSelection(files: File[], existingCount = 0) {
  const acceptedFiles: File[] = [];
  const remainingSlots = Math.max(0, MAX_PUBLISH_IMAGE_COUNT - existingCount);
  let invalidCount = 0;
  let oversizedCount = 0;
  let overflowCount = 0;

  files.forEach((file) => {
    const error = validatePublishImageFile(file);
    if (error) {
      if (!isPublishImageFile(file)) invalidCount += 1;
      else oversizedCount += 1;
      return;
    }
    if (acceptedFiles.length >= remainingSlots) {
      overflowCount += 1;
      return;
    }
    acceptedFiles.push(file);
  });

  const notices: string[] = [];
  if (invalidCount > 0) notices.push(`已跳过 ${invalidCount} 个非图片文件`);
  if (oversizedCount > 0)
    notices.push(
      `已跳过 ${oversizedCount} 张超过 ${formatPublishImageSize(MAX_PUBLISH_IMAGE_BYTES)} 的图片`,
    );
  if (overflowCount > 0 || (files.length > 0 && remainingSlots === 0)) {
    notices.push(`最多只能上传 ${MAX_PUBLISH_IMAGE_COUNT} 张图片`);
  }

  return {
    acceptedFiles,
    message: notices.length ? `${notices.join("，")}。` : "",
  };
}

/**
 * Creates a display-only fallback draft from free-text place name.
 * When `placeName` is non-empty the source is "manual"; when empty the
 * source is "skipped" and all location fields are zeroed out.
 *
 * Uses `mapVersion: "manual"` to distinguish this from resolved map
 * selections (`"gaode_v2"`) and legacy records (`"legacy"`).
 */
export function createManualLocationDraft(placeName: string): PublishLocationDraft {
  const value = placeName.trim();
  return {
    source: value ? "manual" : "skipped",
    locationId: "",
    locationArea: value,
    displayName: value,
    lat: null,
    lng: null,
    legacyPoint: { x: null, y: null },
    imagePoint: { x: null, y: null },
    mapVersion: "manual",
    confidence: value ? 0.65 : 0,
    skipped: !value,
    note: "",
  };
}

/**
 * Creates a draft from a resolved Gaode Map V2 location selection.
 * Coordinates are rounded to 7 decimal places for backend consistency.
 */
export function createMapV2LocationDraft(input: {
  locationId: string;
  name: string;
  lat: number;
  lng: number;
  placeId?: string;
  place?: PlaceRef;
  note?: string;
}): PublishLocationDraft {
  const name = input.name.trim();
  const placeId = input.place?.id || input.placeId || "";
  return {
    source: "map_v2",
    locationId: input.locationId,
    placeId: placeId || undefined,
    place: input.place || (placeId ? { id: placeId, name, type: undefined } : undefined),
    locationArea: name,
    displayName: name,
    lat: Number(input.lat.toFixed(7)),
    lng: Number(input.lng.toFixed(7)),
    legacyPoint: { x: null, y: null },
    imagePoint: { x: null, y: null },
    mapVersion: "gaode_v2",
    confidence: 0.86,
    skipped: false,
    note: input.note || "Vue MapV2 location selection",
  };
}

/**
 * Assembles the full publish payload. Falls back to a manual location
 * draft when no `locationDraft` is provided, using `placeName` as
 * the display-only fallback text.
 *
 * `audience` (PRD V0.1 §6.2) is optional. When omitted or equal to the
 * default public audience, the payload skips the field on the wire so
 * older backends keep authorizing on `metadata.visibility` alone.
 */
export function buildPublishPayload(input: {
  imageUrls: string[];
  title: string;
  body: string;
  tag: string;
  identityTag?: string;
  placeName: string;
  visibility: PublishVisibility;
  aliasId?: string;
  locationDraft?: PublishLocationDraft | null;
  audience?: Audience;
  /**
   * PRD §10 — when present, the post enters the merchant publish path:
   * `metadata.presentationIntent = "merchant"` + top-level `contentType`
   * (`merchant_food` / `_service` / `_retail`) + top-level `merchant` block.
   * Backend (#383) requires `merchant_verified` on the actor for this path.
   */
  merchant?: { input: MerchantPublishInput; contentType: MerchantContentType };
}): PublishPayload {
  const locationDraft = input.locationDraft || createManualLocationDraft(input.placeName);
  const locationArea = locationDraft.skipped ? "" : locationDraft.locationArea;
  const tag = normalizePublishTag(input.tag);
  const identityTag = normalizeIdentityTag(input.identityTag || "");
  const audience = input.audience ? normalizeAudience(input.audience) : DEFAULT_AUDIENCE;
  const metadata: PublishPayload["metadata"] = {
    locationArea,
    visibility: input.visibility,
    distribution: locationArea ? ["home", "map", "search", "detail"] : ["home", "search", "detail"],
    primaryTag: tag,
    identityTag,
  };
  if (!isDefaultAudience(audience)) {
    metadata.audience = audience;
  }
  if (input.merchant) {
    metadata.presentationIntent = "merchant";
  }

  return {
    imageUrl: input.imageUrls[0] || "",
    imageUrls: input.imageUrls,
    title: input.title.trim(),
    body: input.body.trim(),
    tag,
    identityTag,
    metadata,
    locationDraft,
    riskFlags: [],
    confidence: locationDraft.confidence,
    needsHumanReview: false,
    aiMode: locationDraft.source === "map_v2" ? "manual-vue-map-v2" : "manual-vue",
    aliasId: input.aliasId,
    ...(input.merchant
      ? { contentType: input.merchant.contentType, merchant: input.merchant.input }
      : {}),
  };
}

export async function uploadPublishImage(file: File): Promise<string> {
  const validationError = validatePublishImageFile(file);
  if (validationError) throw new Error(validationError);

  const form = new FormData();
  form.append("image", file, file.name || "image.jpg");

  const data = await apiUpload<UploadImageResponse>(
    "/api/upload/image?purpose=publish-v2",
    form,
    "图片上传失败，可以换一张图片或稍后再试。",
  );
  if (!data.url) throw new Error("图片上传成功但没有返回地址，请稍后再试。");
  return data.url;
}

export async function publishPost(payload: PublishPayload): Promise<PublishResponse> {
  return apiSend<PublishResponse>("/api/ai/post-publish", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
