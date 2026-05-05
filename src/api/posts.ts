import { apiGet } from "./http";
import type { FeedItemId } from "../types/feed";
import type { PostDetail } from "../types/post";

export async function fetchPostDetail(id: FeedItemId): Promise<PostDetail> {
  return apiGet<PostDetail>(`/api/posts/${encodeURIComponent(String(id))}`);
}
