import { apiGet } from "./http";
import type { FeedQuery, FeedResponse, FeedTab } from "../types/feed";

const DEFAULT_TABS: FeedTab[] = [
  { id: "此刻", label: "此刻" },
  { id: "精选", label: "精选" },
];

function readableTabText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return readableTabText(record.label || record.name || record.title || record.id);
  }
  return "";
}

function normalizeTabs(value: unknown): FeedTab[] {
  if (!Array.isArray(value)) return DEFAULT_TABS;

  const tabs = value
    .map((entry) => {
      const label = readableTabText(entry);
      const id = typeof entry === "object" && entry
        ? readableTabText((entry as Record<string, unknown>).id) || label
        : label;
      return id && label ? { id, label } : null;
    })
    .filter((tab): tab is FeedTab => Boolean(tab));

  return tabs.length ? tabs : DEFAULT_TABS;
}

export async function fetchFeed(query: FeedQuery): Promise<FeedResponse> {
  const params = new URLSearchParams();
  params.set("tab", query.tab || DEFAULT_TABS[0].id);
  params.set("page", String(Math.max(1, query.page || 1)));
  params.set("limit", String(Math.max(1, query.limit || 12)));
  if (query.read) params.set("read", query.read);

  const data = await apiGet<FeedResponse>(`/api/feed?${params.toString()}`);

  return {
    tabs: normalizeTabs(data.tabs),
    items: Array.isArray(data.items) ? data.items : [],
    hasMore: Boolean(data.hasMore),
    nextPage: typeof data.nextPage === "number" ? data.nextPage : null,
  };
}
