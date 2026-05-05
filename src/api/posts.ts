import { apiGet, apiSend } from "./http";
import type { FeedItemId } from "../types/feed";
import type { PostDetail } from "../types/post";

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

function ensureClientId() {
  const key = "lian.clientId";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(key, next);
  return next;
}

export async function fetchPostDetail(id: FeedItemId): Promise<PostDetail> {
  return apiGet<PostDetail>(`/api/posts/${encodeURIComponent(String(id))}`);
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
