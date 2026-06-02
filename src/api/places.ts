import { apiGet } from "./http";
import { ERROR_MISSING_PLACE_ID } from "../config/brand";
import type {
  PlaceRecentPost,
  PlaceSheet,
  PlaceStats,
  PlaceStatus,
  PlaceSummary,
} from "../types/place";
import {
  asBoolean,
  asEnum,
  asNumber,
  asRecord,
  asString,
  normalizeDisplayActor,
  normalizeFeedItemId,
  normalizeSourceSignal,
} from "../platform/api-normalizers";

const PLACE_STATUSES: ReadonlySet<PlaceStatus> = new Set([
  "confirmed",
  "pending",
  "disputed",
  "expired",
  "ai-organized",
  "official",
]);

function optionalString(value: unknown): string | undefined {
  const normalized = asString(value);
  return normalized || undefined;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const normalized = asNumber(value, Number.NaN);
  return Number.isFinite(normalized) ? normalized : undefined;
}

function normalizePlaceSummary(value: unknown): PlaceSummary | undefined {
  const record = asRecord(value);
  const summary: PlaceSummary = {};
  const text = optionalString(record.text);
  const sourceCount = optionalNumber(record.sourceCount ?? record.source_count);
  const confidenceLabel = optionalString(record.confidenceLabel ?? record.confidence_label);

  if (text) summary.text = text;
  if (sourceCount !== undefined) summary.sourceCount = sourceCount;
  if ("aiGenerated" in record || "ai_generated" in record) {
    summary.aiGenerated = asBoolean(record.aiGenerated ?? record.ai_generated);
  }
  if (confidenceLabel) summary.confidenceLabel = confidenceLabel;

  return Object.keys(summary).length ? summary : undefined;
}

function normalizePlaceStats(value: unknown): PlaceStats | undefined {
  const record = asRecord(value);
  const stats: PlaceStats = {};
  const postCount = optionalNumber(record.postCount ?? record.post_count);
  const correctionCount = optionalNumber(record.correctionCount ?? record.correction_count);
  const savedCount = optionalNumber(record.savedCount ?? record.saved_count);

  if (postCount !== undefined) stats.postCount = postCount;
  if (correctionCount !== undefined) stats.correctionCount = correctionCount;
  if (savedCount !== undefined) stats.savedCount = savedCount;

  return Object.keys(stats).length ? stats : undefined;
}

function normalizeRecentPost(value: unknown): PlaceRecentPost | undefined {
  const record = asRecord(value);
  const tid = normalizeFeedItemId(record.tid, Number.NaN);
  if (!Number.isFinite(tid)) return undefined;

  const title = optionalString(record.title);
  const excerpt = optionalString(record.excerpt);
  const imageUrl = optionalString(record.imageUrl ?? record.image_url);
  const actor = normalizeDisplayActor(record.actor ?? record.user);
  const timestampISO = optionalString(
    record.timestampISO ?? record.timestamp_iso ?? record.createdAt ?? record.created_at,
  );
  const primaryTag = optionalString(record.primaryTag ?? record.primary_tag);

  return {
    tid,
    ...(title ? { title } : {}),
    ...(excerpt ? { excerpt } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(actor ? { actor } : {}),
    ...(timestampISO ? { timestampISO } : {}),
    ...(primaryTag ? { primaryTag } : {}),
  };
}

export function normalizePlaceSheet(value: unknown): PlaceSheet {
  const record = asRecord(value);
  const id = asString(record.id);
  const name = asString(record.name);
  const type = optionalString(record.type);
  const lat = optionalNumber(record.lat);
  const lng = optionalNumber(record.lng);
  const status = asEnum(record.status, PLACE_STATUSES) ?? "pending";
  const updatedAt = optionalString(record.updatedAt ?? record.updated_at);
  const source = normalizeSourceSignal(record.source);
  const summary = normalizePlaceSummary(record.summary);
  const stats = normalizePlaceStats(record.stats);
  const rawRecentPosts = record.recentPosts ?? record.recent_posts;
  const recentPosts = Array.isArray(rawRecentPosts)
    ? rawRecentPosts
        .map(normalizeRecentPost)
        .filter((post): post is PlaceRecentPost => Boolean(post))
    : [];

  return {
    id,
    name,
    ...(type ? { type } : {}),
    ...(lat !== undefined ? { lat } : {}),
    ...(lng !== undefined ? { lng } : {}),
    status,
    ...(updatedAt ? { updatedAt } : {}),
    ...(source ? { source } : {}),
    ...(summary ? { summary } : {}),
    ...(stats ? { stats } : {}),
    ...(recentPosts.length ? { recentPosts } : {}),
  };
}

export async function fetchPlaceSheet(id: string): Promise<PlaceSheet> {
  const placeId = String(id || "").trim();
  if (!placeId) throw new Error(ERROR_MISSING_PLACE_ID);
  return normalizePlaceSheet(
    await apiGet<unknown>(`/api/place-sheets/${encodeURIComponent(placeId)}`),
  );
}
