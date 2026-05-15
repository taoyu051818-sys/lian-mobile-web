import { computed, type ComputedRef, watch } from "vue";
import { actorAvatarText, actorAvatarUrl, actorDisplayName } from "../../domain/actor";
import { sanitizeHtml } from "../../utils/html";
import { placeStatusLabel } from "../../domain/place";
import type { PlaceSheet } from "../../types/place";
import type { PostDetail } from "../../types/post";
import { formatTimestampLabel } from "../../utils/time";

export function usePostDetailPresentation(post: ComputedRef<PostDetail | null>, placeSheet: ComputedRef<PlaceSheet | null>) {
  const postId = computed(() => post.value?.tid ?? null);
  const title = computed(() => post.value?.title || "");
  const authorLabel = computed(() => actorDisplayName(post.value?.actor));
  const authorAvatarUrl = computed(() => actorAvatarUrl(post.value?.actor));
  const authorInitial = computed(() => actorAvatarText(post.value?.actor, authorLabel.value));
  const hasAuthorIdentity = computed(() => Boolean(authorLabel.value || authorAvatarUrl.value || authorInitial.value));
  const structuredPlace = computed(() => post.value?.place || null);
  const placeLabel = computed(() => structuredPlace.value?.name || post.value?.locationArea || "");
  const primaryTag = computed(() => normalizePostTag(post.value?.primaryTag || ""));
  const rawBodyHtml = computed(() => post.value?.contentHtml || "");
  const bodyHtml = computed(() => stripDecorativeContentFromHtml(sanitizeHtml(rawBodyHtml.value)));
  const replies = computed(() => post.value?.replies || []);
  const images = computed(() => uniqueGalleryImages([post.value?.cover || "", ...(post.value?.imageUrls || [])]).slice(0, 8));
  const fullResolutionImages = computed(() => images.value.map(toFullResolutionImageUrl));
  const timeLabel = computed(() => formatTimestampLabel(post.value?.timestampISO, post.value?.timeLabel || ""));
  const placeStatusText = computed(() => placeStatusLabel(placeSheet.value?.status || structuredPlace.value?.status));

  watch(fullResolutionImages, (urls) => {
    preloadImages(urls);
  }, { immediate: true });

  return {
    postId,
    title,
    authorLabel,
    authorAvatarUrl,
    authorInitial,
    hasAuthorIdentity,
    structuredPlace,
    placeLabel,
    primaryTag,
    bodyHtml,
    replies,
    images,
    fullResolutionImages,
    timeLabel,
    placeStatusText,
  };
}

function normalizePostTag(value: string) {
  const text = String(value || "").trim().replace(/^#+/, "");
  return text ? `#${text}` : "";
}

function galleryImageKey(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, typeof window !== "undefined" ? window.location.origin : "https://lian.invalid");
    const pathname = url.pathname.replace(/^\/+/, "");
    const uploadIndex = pathname.indexOf("/upload/");
    if (uploadIndex >= 0) {
      return pathname
        .slice(uploadIndex + "/upload/".length)
        .replace(/^(?:[^/]+\/)*v\d+\//, "")
        .replace(/^v\d+\//, "")
        .replace(/\.[a-z0-9]+$/i, "");
    }
    return pathname.replace(/\.[a-z0-9]+$/i, "");
  } catch {
    return raw.replace(/\?.*$/, "").replace(/\.[a-z0-9]+$/i, "");
  }
}

function uniqueGalleryImages(urls: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    const value = String(url || "").trim();
    if (!value) continue;
    const key = galleryImageKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function toFullResolutionImageUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, typeof window !== "undefined" ? window.location.origin : "https://lian.invalid");
    if (!url.hostname.includes("cloudinary.com") || !url.pathname.includes("/upload/")) return raw;
    url.pathname = url.pathname.replace(/\/upload\/[^/]+\//, "/upload/f_auto,q_auto/");
    return url.toString();
  } catch {
    return raw;
  }
}

function preloadImages(urls: string[]) {
  if (typeof window === "undefined") return;
  for (const url of urls) {
    if (!url) continue;
    const image = new Image();
    image.decoding = "async";
    image.src = url;
  }
}

function stripDecorativeContentFromHtml(value: string) {
  return String(value || "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<p[^>]*>\s*<strong>\s*#+[^<]+\s*<\/strong>\s*<\/p>/gi, "")
    .replace(/<p[^>]*>\s*#+[^<]+\s*<\/p>/gi, "")
    .trim();
}

