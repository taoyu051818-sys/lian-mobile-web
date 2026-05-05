import { apiGet } from "./http";
import type { FeedQuery, FeedResponse } from "../types/feed";

export async function fetchFeed(query: FeedQuery): Promise<FeedResponse> {
  const params = new URLSearchParams();
  params.set("tab", query.tab || "此刻");
  params.set("page", String(Math.max(1, query.page || 1)));
  params.set("limit", String(Math.max(1, query.limit || 12)));
  if (query.read) params.set("read", query.read);

  const data = await apiGet<FeedResponse>(`/api/feed?${params.toString()}`);

  return {
    tabs: Array.isArray(data.tabs) ? data.tabs : ["此刻", "精选"],
    items: Array.isArray(data.items) ? data.items : [],
    hasMore: Boolean(data.hasMore),
    nextPage: data.nextPage,
  };
}
