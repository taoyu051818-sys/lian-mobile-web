import { apiGet, apiSend } from "./http";
import { normalizeMerchantErrandEligibility } from "./merchant";
import {
  asBoolean,
  asNumber,
  asRecord,
  asString,
  asStringArray,
  extractV2Components,
  normalizeDisplayActor,
  normalizeEventExtensionV2,
  normalizeFeedItemId,
  normalizeHelpExtensionV2,
  normalizeMerchantExtensionV2,
  normalizeMetadataComponents,
  normalizePlaceRef,
  normalizePostAvailableActions,
  normalizePostRelations,
  normalizeSourceSignal,
  normalizeTradeExtension,
  normalizeTradeExtensionV2,
} from "../platform/api-normalizers";
import type { FeedItemId } from "../types/feed";
import {
  normalizePostType,
  type ClubCategory,
  type ClubMetadata,
  type PostDetail,
  type PostReply,
  type PostType,
} from "../types/post";
import type { MetadataComponentV2, TradePostExtension, TradeState } from "../types/post-extensions";
import type { AudienceVisibility } from "../types/audience";

const KNOWN_VISIBILITIES: ReadonlySet<AudienceVisibility> = new Set([
  "public",
  "campus",
  "school",
  "private",
  "linkOnly",
]);
const KNOWN_CLUB_CATEGORIES: ReadonlySet<ClubCategory> = new Set([
  "academic",
  "sports",
  "arts",
  "volunteer",
  "tech",
  "culture",
  "other",
]);

function normalizeVisibility(value: unknown): AudienceVisibility {
  return typeof value === "string" && KNOWN_VISIBILITIES.has(value as AudienceVisibility)
    ? (value as AudienceVisibility)
    : "public";
}

function readableText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return readableText(record.label || record.name || record.title || record.id);
  }
  return "";
}

function normalizeClubCategory(value: unknown): ClubCategory {
  return typeof value === "string" && KNOWN_CLUB_CATEGORIES.has(value as ClubCategory)
    ? (value as ClubCategory)
    : "other";
}

function normalizeClubMetadata(value: unknown): ClubMetadata | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const clubId = readableText(record.clubId || record.id);
  const name = readableText(record.name || record.title);
  if (!clubId || !name) return undefined;

  const president = readableText(record.president || record.leader);
  const foundedAt = readableText(record.foundedAt || record.createdAt);
  const memberCount = Math.max(0, Math.trunc(asNumber(record.memberCount || record.members, 0)));
  const description = readableText(record.description || record.summary);
  const logoUrl = readableText(
    record.logoUrl || record.avatarUrl || record.coverUrl || record.logo,
  );

  return {
    clubId,
    name,
    category: normalizeClubCategory(record.category),
    president,
    foundedAt,
    memberCount,
    ...(description ? { description } : {}),
    ...(logoUrl ? { logoUrl } : {}),
  };
}

export interface PostLikeResponse {
  liked: boolean;
  likeCount: number;
}

export interface PostSaveResponse {
  saved: boolean;
}

export interface ReportPostPayload {
  category: string;
  reason: string;
}

export interface PatchTradeStateResponse {
  ok: boolean;
  tid: FeedItemId;
  state: TradeState;
  trade: TradePostExtension;
}

function normalizePostReply(value: unknown, fallbackId: FeedItemId): PostReply {
  const record = asRecord(value);

  return {
    id: normalizeFeedItemId(record.id ?? record.pid, fallbackId),
    content: asString(record.content),
    actor: normalizeDisplayActor(record.actor || record.user),
    source: normalizeSourceSignal(record.source),
    timestampISO: asString(record.timestampISO ?? record.createdAt ?? record.time),
  };
}

function normalizeTradeState(value: unknown): TradeState {
  const raw = asString(value).toLowerCase();
  if (raw === "reserved" || raw === "sold" || raw === "cancelled" || raw === "hidden") {
    return raw;
  }
  return "available";
}

function normalizeTradeExtensionFromDetail(value: unknown): TradePostExtension | undefined {
  const trade = normalizeTradeExtension(value);
  if (!trade) return undefined;
  const record = asRecord(value);
  const state = normalizeTradeState(record.state);
  return state === trade.state ? trade : { ...trade, state };
}

function normalizeProjectLikeIntent(value: unknown): "project" | "review" | "submission" | null {
  const raw = asString(value).toLowerCase();
  if (raw === "project" || raw === "review" || raw === "submission") return raw;
  return null;
}

function normalizeDetailPostType(value: unknown, hasCover: boolean): PostType {
  const record = asRecord(value);
  const rawType = asString(record.type).toLowerCase();
  const contentType = asString(record.contentType).toLowerCase();
  const metadata = asRecord(record.metadata);
  const presentationIntent = asString(
    record.presentationIntent || metadata.presentationIntent,
  ).toLowerCase();

  if (contentType.startsWith("merchant_") || presentationIntent === "merchant") {
    return "merchant";
  }
  if (rawType === "trade" || contentType === "trade" || presentationIntent === "trade") {
    return "trade";
  }
  if (
    rawType === "event" ||
    rawType === "activity" ||
    contentType === "event" ||
    contentType === "activity" ||
    presentationIntent === "event" ||
    presentationIntent === "activity"
  ) {
    return "event";
  }
  if (rawType === "help" || contentType === "help" || presentationIntent === "help") {
    return "help";
  }
  if (
    rawType === "place" ||
    contentType === "place" ||
    contentType === "location" ||
    contentType === "map" ||
    presentationIntent === "place"
  ) {
    return "place";
  }
  if (rawType === "club" || contentType === "club" || presentationIntent === "club") {
    return "club";
  }
  const projectLikeIntent = normalizeProjectLikeIntent(
    presentationIntent || contentType || rawType,
  );
  if (projectLikeIntent === "project" || projectLikeIntent === "review") {
    return hasCover ? "image" : "text";
  }

  return normalizePostType(record.type, hasCover);
}

export function normalizePostDetail(value: unknown, fallbackId: FeedItemId): PostDetail {
  const record = asRecord(value);
  const rawMetadata = asRecord(record.metadata);
  const tid = normalizeFeedItemId(record.tid, fallbackId);
  const rawReplies = Array.isArray(record.replies)
    ? record.replies.filter((reply) => reply && typeof reply === "object")
    : [];
  const bookmarkedValue = "bookmarked" in record ? record.bookmarked : record.saved;
  const cover = asString(record.cover);
  const type = normalizeDetailPostType(record, Boolean(cover));
  const club = normalizeClubMetadata(record.club || rawMetadata.club);
  const visibility = normalizeVisibility(
    record.visibility || rawMetadata.visibility || rawMetadata.audienceVisibility,
  );

  // V2 metadata components — prefer when present, fall back to V1 flat fields
  const v2Components = extractV2Components(record);
  // PRD V0.3 §2.1.3 — surface the V2 metadata block on the wire when the
  // backend echoes it. PostComponentsSlot consumes this for forward-compat
  // renderers (delivery / groupbuy / channel / ledger). Today the public
  // post-detail DTO does NOT echo `metadata` so this typically lands as
  // undefined; when the backend opens the surface, `metadata.components`
  // becomes the source of truth without a frontend release.
  const metadataVersion = typeof rawMetadata._v === "number" ? rawMetadata._v : undefined;
  const detailMetadata =
    v2Components || metadataVersion !== undefined
      ? {
          ...(metadataVersion !== undefined ? { _v: metadataVersion } : {}),
          ...(v2Components ? { components: v2Components } : {}),
        }
      : undefined;
  const normalizedLegacyComponents = normalizeMetadataComponents(record);
  // Preserve local club/read-side support while also accepting the remote
  // graph primitives from the post-detail DTO.
  const topLevelComponentsRaw = Array.isArray(record.components) ? record.components : undefined;
  const topLevelComponents: MetadataComponentV2[] | undefined = topLevelComponentsRaw
    ? (topLevelComponentsRaw.filter(
        (c): c is MetadataComponentV2 =>
          !!c && typeof c === "object" && typeof (c as { type?: unknown }).type === "string",
      ) as MetadataComponentV2[])
    : undefined;
  const components =
    topLevelComponents && topLevelComponents.length
      ? topLevelComponents
      : v2Components && v2Components.length
        ? v2Components
        : normalizedLegacyComponents && normalizedLegacyComponents.length
          ? normalizedLegacyComponents
          : undefined;
  const relations = normalizePostRelations(record.relations ?? rawMetadata.relations);
  const availableActions = normalizePostAvailableActions(
    record.availableActions ?? rawMetadata.availableActions,
  );
  const event = normalizeEventExtensionV2(v2Components, record.event);
  const eventJoined = "eventJoined" in record ? asBoolean(record.eventJoined) : undefined;
  // Issue #703 — backend may ship eventManageable so the detail page does not
  // double-resolve author/admin client-side. Absent value = let the frontend
  // probe via /api/auth/me + /api/admin/me.
  const eventManageable =
    "eventManageable" in record ? asBoolean(record.eventManageable) : undefined;
  const help = normalizeHelpExtensionV2(v2Components, record.help);
  const helpVoted = "helpVoted" in record ? asBoolean(record.helpVoted) : undefined;
  const helpManageable = "helpManageable" in record ? asBoolean(record.helpManageable) : undefined;
  const merchant = normalizeMerchantExtensionV2(v2Components, record.merchant);
  // `errandEntryAvailable` is hoisted to the top level by the backend DTO. We
  // only surface it when the merchant block is present so callers can rely on
  // `(post.merchant && post.errandEntryAvailable)` without a null check.
  const errandEntryAvailable = merchant
    ? "errandEntryAvailable" in record
      ? asBoolean(record.errandEntryAvailable)
      : merchant.errandSupported
    : undefined;
  // Optional reason details for the unavailable case (issue #646). Backend
  // attaches them either at the top level or under `errand` (the same shape
  // the merchant-center DTO uses) — we accept both so the detail page works
  // against either backend version.
  const errandEligibility = merchant
    ? normalizeMerchantErrandEligibility(record.errand)
    : undefined;
  const errandUnavailableReason =
    merchant && errandEntryAvailable === false
      ? asString(record.errandUnavailableReason) || errandEligibility?.reason || ""
      : undefined;
  const errandUnavailableReasonText =
    merchant && errandEntryAvailable === false
      ? asString(record.errandUnavailableReasonText) || errandEligibility?.reasonText || ""
      : undefined;
  // V2 trade normalizer with state override for detail endpoint compatibility
  const tradeRecord = asRecord(record.trade);
  const trade = normalizeTradeExtensionV2(v2Components, record.trade, tradeRecord.state);
  const tradeManageable =
    "tradeManageable" in record ? asBoolean(record.tradeManageable) : undefined;

  return {
    tid,
    type,
    title: asString(record.title),
    cover,
    primaryTag: asString(record.primaryTag),
    actor: normalizeDisplayActor(record.actor || record.user),
    source: normalizeSourceSignal(record.source),
    place: normalizePlaceRef(record.place),
    timeLabel: asString(record.timeLabel ?? record.time),
    timestampISO: asString(record.timestampISO),
    likeCount: Math.max(0, Math.trunc(asNumber(record.likeCount, 0))),
    liked: asBoolean(record.liked),
    locationArea: asString(record.locationArea),
    contentHtml: asString(record.contentHtml ?? record.html),
    imageUrls: asStringArray(record.imageUrls ?? record.images),
    sourceUrl: asString(record.sourceUrl ?? record.url),
    replies: rawReplies.map((reply, index) => normalizePostReply(reply, tid * 1000 + index + 1)),
    bookmarked: asBoolean(bookmarkedValue),
    ...(visibility !== "public" ? { visibility } : {}),
    ...(club ? { club } : {}),
    ...(components?.length ? { components } : {}),
    ...(relations?.length ? { relations } : {}),
    ...(availableActions?.length ? { availableActions } : {}),
    ...(event ? { event } : {}),
    ...(eventJoined !== undefined ? { eventJoined } : {}),
    ...(eventManageable !== undefined ? { eventManageable } : {}),
    ...(help ? { help } : {}),
    ...(helpVoted !== undefined ? { helpVoted } : {}),
    ...(helpManageable !== undefined ? { helpManageable } : {}),
    ...(merchant ? { merchant } : {}),
    ...(errandEntryAvailable !== undefined ? { errandEntryAvailable } : {}),
    ...(errandUnavailableReason
      ? {
          errandUnavailableReason: errandUnavailableReason as PostDetail["errandUnavailableReason"],
        }
      : {}),
    ...(errandUnavailableReasonText ? { errandUnavailableReasonText } : {}),
    ...(trade ? { trade } : {}),
    ...(tradeManageable !== undefined ? { tradeManageable } : {}),
    ...(detailMetadata ? { metadata: detailMetadata } : {}),
    ...(components?.length ? { components } : {}),
    ...(relations?.length ? { relations } : {}),
    ...(availableActions?.length ? { availableActions } : {}),
  };
}

export function normalizePostLikeResponse(value: unknown): PostLikeResponse {
  const record = asRecord(value);

  return {
    liked: asBoolean(record.liked),
    likeCount: Math.max(0, Math.trunc(asNumber(record.likeCount, 0))),
  };
}

export function normalizePostSaveResponse(value: unknown): PostSaveResponse {
  const record = asRecord(value);

  return {
    saved: asBoolean(record.saved),
  };
}

export function normalizePatchTradeStateResponse(
  value: unknown,
  fallbackId: FeedItemId,
): PatchTradeStateResponse {
  const record = asRecord(value);
  const trade =
    normalizeTradeExtensionFromDetail(record.trade) ||
    ({
      price: "",
      state: normalizeTradeState(record.state),
      category: "",
      verifiedAt: "",
    } satisfies TradePostExtension);

  return {
    ok: asBoolean(record.ok, true),
    tid: normalizeFeedItemId(record.tid, fallbackId),
    state: normalizeTradeState(record.state ?? trade.state),
    trade,
  };
}

export async function fetchPostDetail(id: FeedItemId): Promise<PostDetail> {
  const data = await apiGet<unknown>(`/api/posts/${encodeURIComponent(String(id))}`);
  return normalizePostDetail(data, id);
}

export async function togglePostLike(id: FeedItemId, liked: boolean): Promise<PostLikeResponse> {
  const data = await apiSend<unknown>(`/api/posts/${encodeURIComponent(String(id))}/like`, {
    method: "POST",
    body: JSON.stringify({ liked }),
  });
  return normalizePostLikeResponse(data);
}

export async function togglePostSave(id: FeedItemId, saved: boolean): Promise<PostSaveResponse> {
  const data = await apiSend<unknown>(`/api/posts/${encodeURIComponent(String(id))}/save`, {
    method: "POST",
    body: JSON.stringify({ saved }),
  });
  return normalizePostSaveResponse(data);
}

export async function patchTradeState(
  id: FeedItemId,
  state: TradeState,
): Promise<PatchTradeStateResponse> {
  const data = await apiSend<unknown>(`/api/posts/${encodeURIComponent(String(id))}/trade-state`, {
    method: "PATCH",
    body: JSON.stringify({ state }),
  });
  return normalizePatchTradeStateResponse(data, id);
}

export async function reportPost(id: FeedItemId, payload: ReportPostPayload): Promise<void> {
  await apiSend(`/api/posts/${encodeURIComponent(String(id))}/report`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendPostReply(id: FeedItemId, content: string): Promise<void> {
  await apiSend(`/api/posts/${encodeURIComponent(String(id))}/replies`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}
