import { apiGet } from "./http";
import type { FeedQuery, FeedResponse } from "../types/feed";

const DEFAULT_TABS = [
  { id: "此刻", label: "此刻" },
  { id: "精选", label: "精选" },
];

export async function fetchFeed(query: FeedQuery): Promise<FeedResponse> {
  const params = new URLSearchParams();
  params.set("tab", query.tab || DEFAULT_TABS[0].id);
  params.set("page", String(Math.max(1, query.page || 1)));
  params.set("limit", String(Math.max(1, query.limit || 12)));
  if (query.read) params.set("read", query.read);

  const data = await apiGet<FeedResponse>(`/api/feed?${params.toString()}`);

  return {
    tabs: Array.isArray(data.tabs) && data.tabs.length ? data.tabs : DEFAULT_TABS,
    items: Array.isArray(data.items) ? data.items : [],
    hasMore: Boolean(data.hasMore),
    nextPage: typeof data.nextPage === "number" ? data.nextPage : null,
  };
}
