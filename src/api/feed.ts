import { apiGet } from "./http";
import type { FeedItem, FeedQuery, FeedResponse } from "../types/feed";

type LegacyFeedItem = FeedItem & Record<string, unknown>;
type LegacyFeedResponse = FeedResponse & {
  data?: unknown;
  results?: unknown;
  posts?: unknown;
  topics?: unknown;
};

const DEFAULT_TABS = ["此刻", "精选"];

function asNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function pickString(item: LegacyFeedItem, keys: string[]) {
  for (const key of keys) {
    const value = asString(item[key]);
    if (value) return value;
  }
  return "";
}

function normalizeFeedItem(item: LegacyFeedItem): FeedItem {
  const tid = item.tid ?? item.id ?? item.postId ?? item.topicId;
  return {
    ...item,
    tid: tid as FeedItem["tid"],
    title: pickString(item, ["title", "subject", "name"]),
    content: pickString(item, ["content", "body", "excerpt", "text"]),
    contentHtml: pickString(item, ["contentHtml", "html", "bodyHtml"]),
    summary: pickString(item, ["summary", "excerpt", "description", "content"]),
    tag: pickString(item, ["tag", "category", "typeLabel"]),
    type: pickString(item, ["type", "kind", "category"]),
    cover: pickString(item, ["cover", "coverUrl", "image", "imageUrl", "thumbnail"]),
    imageUrl: pickString(item, ["imageUrl", "image", "cover", "coverUrl", "thumbnail"]),
    author: pickString(item, ["author", "username", "userName", "displayName"]),
    authorAvatarText: pickString(item, ["authorAvatarText", "avatarText"]),
    authorIdentityTag: pickString(item, ["authorIdentityTag", "identityTag"]),
    contributionTag: pickString(item, ["contributionTag", "badge"]),
    placeName: pickString(item, ["placeName", "locationName", "place", "location"]),
    locationName: pickString(item, ["locationName", "placeName", "place", "location"]),
    timeLabel: pickString(item, ["timeLabel", "relativeTime"]),
    timestampISO: pickString(item, ["timestampISO", "createdAt", "timestamp", "time"]),
    likeCount: asNumber(item.likeCount ?? item.likes) ?? 0,
    replyCount: asNumber(item.replyCount ?? item.replies ?? item.commentCount ?? item.comments) ?? 0,
    commentCount: asNumber(item.commentCount ?? item.comments ?? item.replyCount ?? item.replies) ?? 0,
    saveCount: asNumber(item.saveCount ?? item.bookmarkCount ?? item.saves) ?? 0,
    confirmed: Boolean(item.confirmed),
    expired: Boolean(item.expired),
    aiGenerated: Boolean(item.aiGenerated ?? item.ai),
    sourceUrl: pickString(item, ["sourceUrl", "url", "originalUrl"]),
  };
}

function extractItems(data: LegacyFeedResponse) {
  const candidates = [data.items, data.data, data.results, data.posts, data.topics];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as LegacyFeedItem[];
  }
  return [];
}

export async function fetchFeed(query: FeedQuery): Promise<FeedResponse> {
  const params = new URLSearchParams();
  params.set("tab", query.tab || DEFAULT_TABS[0]);
  params.set("page", String(Math.max(1, query.page || 1)));
  params.set("limit", String(Math.max(1, query.limit || 12)));
  if (query.read) params.set("read", query.read);

  const data = await apiGet<LegacyFeedResponse>(`/api/feed?${params.toString()}`);
  const items = extractItems(data).filter((item) => item.tid ?? item.id ?? item.postId ?? item.topicId);

  return {
    tabs: Array.isArray(data.tabs) && data.tabs.length ? data.tabs : DEFAULT_TABS,
    items: items.map(normalizeFeedItem),
    hasMore: Boolean(data.hasMore),
    nextPage: typeof data.nextPage === "number" ? data.nextPage : undefined,
  };
}
