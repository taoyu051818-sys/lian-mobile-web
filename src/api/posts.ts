import { apiGet, apiSend } from "./http";
import { normalizeMerchantErrandEligibility } from "./merchant";
import {
  asBoolean,
  asNumber,
  asRecord,
  asString,
  asStringArray,
  normalizeDisplayActor,
  normalizeEventExtension,
  normalizeFeedItemId,
  normalizeHelpExtension,
  normalizeMerchantExtension,
  normalizePlaceRef,
  normalizeSourceSignal,
  normalizeTradeExtension,
} from "../platform/api-normalizers";
import type { FeedItemId } from "../types/feed";
import type { PostDetail, PostReply } from "../types/post";
import type { TradePostExtension, TradeState } from "../types/post-extensions";

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
    id: normalizeFeedItemId(record.id, fallbackId),
    content: asString(record.content),
    actor: normalizeDisplayActor(record.actor),
    source: normalizeSourceSignal(record.source),
    timestampISO: asString(record.timestampISO ?? record.time),
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

export function normalizePostDetail(value: unknown, fallbackId: FeedItemId): PostDetail {
  const record = asRecord(value);
  const tid = normalizeFeedItemId(record.tid, fallbackId);
  const rawReplies = Array.isArray(record.replies)
    ? record.replies.filter((reply) => reply && typeof reply === "object")
    : [];
  const bookmarkedValue = "bookmarked" in record ? record.bookmarked : record.saved;
  const event = normalizeEventExtension(record.event);
  const eventJoined = "eventJoined" in record ? asBoolean(record.eventJoined) : undefined;
  // Issue #703 — backend may ship eventManageable so the detail page does not
  // double-resolve author/admin client-side. Absent value = let the frontend
  // probe via /api/auth/me + /api/admin/me.
  const eventManageable =
    "eventManageable" in record ? asBoolean(record.eventManageable) : undefined;
  const help = normalizeHelpExtension(record.help);
  const helpVoted = "helpVoted" in record ? asBoolean(record.helpVoted) : undefined;
  const helpManageable = "helpManageable" in record ? asBoolean(record.helpManageable) : undefined;
  const merchant = normalizeMerchantExtension(record.merchant);
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
  const trade = normalizeTradeExtensionFromDetail(record.trade);
  const tradeManageable =
    "tradeManageable" in record ? asBoolean(record.tradeManageable) : undefined;

  return {
    tid,
    title: asString(record.title),
    cover: asString(record.cover),
    primaryTag: asString(record.primaryTag),
    actor: normalizeDisplayActor(record.actor),
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
