import { apiGet, apiSend } from "./http";
import type { FeedItemId } from "../types/feed";
import type { PostDetail, PostReply } from "../types/post";

export interface PostLikeResponse {
  liked: boolean;
  likeCount: number;
}

export interface PostSaveResponse {
  saved?: boolean;
  bookmarked?: boolean;
}

export interface ReportPostPayload {
  category: string;
  reason: string;
}

type LegacyPostDetail = PostDetail & Record<string, unknown>;
type LegacyReply = PostReply & Record<string, unknown>;

function ensureClientId() {
  const key = "lian.clientId";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(key, next);
  return next;
}

function asNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function pickString(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asString(item[key]);
    if (value) return value;
  }
  return "";
}

function normalizeReply(reply: LegacyReply): PostReply {
  return {
    ...reply,
    id: reply.id ?? reply.pid ?? reply.replyId,
    username: pickString(reply, ["username", "author", "userName", "displayName"]),
    content: pickString(reply, ["content", "body", "text"]),
    contentHtml: pickString(reply, ["contentHtml", "html", "bodyHtml"]),
    timestampISO: pickString(reply, ["timestampISO", "createdAt", "timestamp", "time"]),
  };
}

function normalizePostDetail(post: LegacyPostDetail): PostDetail {
  const tid = post.tid ?? post.id ?? post.postId ?? post.topicId;
  const rawReplies = Array.isArray(post.replies) ? post.replies : [];
  return {
    ...post,
    tid: tid as FeedItemId,
    title: pickString(post, ["title", "subject", "name"]),
    content: pickString(post, ["content", "body", "excerpt", "text"]),
    contentHtml: pickString(post, ["contentHtml", "html", "bodyHtml"]),
    summary: pickString(post, ["summary", "excerpt", "description", "content"]),
    tag: pickString(post, ["tag", "category", "typeLabel"]),
    type: pickString(post, ["type", "kind", "category"]),
    cover: pickString(post, ["cover", "coverUrl", "image", "imageUrl", "thumbnail"]),
    imageUrl: pickString(post, ["imageUrl", "image", "cover", "coverUrl", "thumbnail"]),
    author: pickString(post, ["author", "username", "userName", "displayName"]),
    authorAvatarText: pickString(post, ["authorAvatarText", "avatarText"]),
    authorIdentityTag: pickString(post, ["authorIdentityTag", "identityTag"]),
    contributionTag: pickString(post, ["contributionTag", "badge"]),
    placeName: pickString(post, ["placeName", "locationName", "place", "location"]),
    locationName: pickString(post, ["locationName", "placeName", "place", "location"]),
    timeLabel: pickString(post, ["timeLabel", "relativeTime"]),
    timestampISO: pickString(post, ["timestampISO", "createdAt", "timestamp", "time"]),
    likeCount: asNumber(post.likeCount ?? post.likes) ?? 0,
    replyCount: asNumber(post.replyCount ?? post.repliesCount ?? post.commentCount ?? post.comments) ?? rawReplies.length,
    commentCount: asNumber(post.commentCount ?? post.comments ?? post.replyCount ?? post.repliesCount) ?? rawReplies.length,
    saveCount: asNumber(post.saveCount ?? post.bookmarkCount ?? post.saves) ?? 0,
    confirmed: Boolean(post.confirmed),
    expired: Boolean(post.expired),
    aiGenerated: Boolean(post.aiGenerated ?? post.ai),
    sourceUrl: pickString(post, ["sourceUrl", "url", "originalUrl"]),
    liked: Boolean(post.liked),
    bookmarked: Boolean(post.bookmarked ?? post.saved),
    replies: rawReplies.map((reply) => normalizeReply(reply as LegacyReply)),
  };
}

export async function fetchPostDetail(id: FeedItemId): Promise<PostDetail> {
  const data = await apiGet<LegacyPostDetail>(`/api/posts/${encodeURIComponent(String(id))}`);
  return normalizePostDetail(data);
}

export async function togglePostLike(id: FeedItemId, liked: boolean): Promise<PostLikeResponse> {
  return apiSend<PostLikeResponse>(`/api/posts/${encodeURIComponent(String(id))}/like`, {
    method: "POST",
    body: JSON.stringify({ liked }),
  });
}

export async function togglePostSave(id: FeedItemId, saved: boolean): Promise<PostSaveResponse> {
  return apiSend<PostSaveResponse>(`/api/posts/${encodeURIComponent(String(id))}/save`, {
    method: "POST",
    body: JSON.stringify({ saved }),
  });
}

export async function reportPost(id: FeedItemId, payload: ReportPostPayload): Promise<void> {
  await apiSend(`/api/posts/${encodeURIComponent(String(id))}/report`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendPostReply(id: FeedItemId, content: string): Promise<void> {
  const clientId = ensureClientId();
  await apiSend(`/api/posts/${encodeURIComponent(String(id))}/replies`, {
    method: "POST",
    headers: { "x-client-id": clientId },
    body: JSON.stringify({ content }),
  });
}
