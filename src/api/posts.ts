import { apiGet, apiSend } from "./http";
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
  normalizePlaceRef,
  normalizeSourceSignal,
} from "../platform/api-normalizers";
import type { FeedItemId } from "../types/feed";
import type { PostDetail, PostReply } from "../types/post";

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

export function normalizePostDetail(value: unknown, fallbackId: FeedItemId): PostDetail {
  const record = asRecord(value);
  const tid = normalizeFeedItemId(record.tid, fallbackId);
  const rawReplies = Array.isArray(record.replies)
    ? record.replies.filter((reply) => reply && typeof reply === "object")
    : [];
  const bookmarkedValue = "bookmarked" in record ? record.bookmarked : record.saved;
  const event = normalizeEventExtension(record.event);
  const eventJoined = "eventJoined" in record ? asBoolean(record.eventJoined) : undefined;
  const help = normalizeHelpExtension(record.help);
  const helpVoted = "helpVoted" in record ? asBoolean(record.helpVoted) : undefined;

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
    ...(help ? { help } : {}),
    ...(helpVoted !== undefined ? { helpVoted } : {}),
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
