import { apiSend } from "./http";
import type {
  PublishLocationDraft,
  PublishPayload,
  PublishResponse,
  PublishVisibility,
  UploadImageResponse,
} from "../types/publish";

declare global {
  interface Window {
    LIAN_API_BASE_URL?: string;
  }
}

const API_BASE = typeof window !== "undefined" ? window.LIAN_API_BASE_URL || "" : "";

function withApiBase(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith("/") ? `${API_BASE}${path}` : path;
}

export function normalizePublishTag(value = "") {
  const body = Array.from(String(value || "")
    .trim()
    .replace(/^#+/, ""))
    .filter((char) => /[\p{L}\p{N}_-]/u.test(char))
    .join("")
    .slice(0, 15);
  return body ? `#${body}` : "";
}

export function normalizePublishTags(value: string | string[] = "") {
  const source = Array.isArray(value) ? value.join(" ") : String(value || "");
  return [...new Set(source
    .replace(/#/g, " #")
    .split(/[\s,，]+/)
    .map(normalizePublishTag)
    .filter(Boolean))]
    .slice(0, 5);
}

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
    mapVersion: "legacy",
    confidence: value ? 0.65 : 0,
    skipped: !value,
    note: "",
  };
}

export function buildPublishPayload(input: {
  imageUrls: string[];
  title: string;
  body: string;
  tags: string | string[];
  placeName: string;
  visibility: PublishVisibility;
  aliasId?: string;
}): PublishPayload {
  const locationDraft = createManualLocationDraft(input.placeName);
  const locationArea = locationDraft.skipped ? "" : locationDraft.locationArea;
  const metadata = {
    locationArea,
    visibility: input.visibility,
    distribution: locationArea ? ["home", "map", "search", "detail"] : ["home", "search", "detail"],
  };

  return {
    imageUrl: input.imageUrls[0] || "",
    imageUrls: input.imageUrls,
    title: input.title.trim(),
    body: input.body.trim(),
    tags: normalizePublishTags(input.tags),
    metadata,
    locationDraft,
    riskFlags: [],
    confidence: locationArea ? 0.65 : 0,
    needsHumanReview: false,
    aiMode: "manual-vue-canary",
    aliasId: input.aliasId,
  };
}

export async function uploadPublishImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("image", file, file.name || "image.jpg");

  const response = await fetch(withApiBase("/api/upload/image?purpose=publish-v2"), {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const data = await response.json().catch(() => ({} as UploadImageResponse));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || "图片上传失败，可以换一张图片或稍后再试。");
  }
  if (!data.url) throw new Error("图片上传成功但没有返回地址，请稍后再试。");
  return data.url;
}

export async function publishPost(payload: PublishPayload): Promise<PublishResponse> {
  return apiSend<PublishResponse>("/api/ai/post-publish", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
