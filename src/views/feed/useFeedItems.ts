import { ref } from "vue";

export interface FeedItem {
  id?: string;
  tid?: number | string;
  title?: string;
  summary?: string;
  cover?: string;
  tag?: string;
  tags?: string[];
  locationArea?: string;
  timeLabel?: string;
  timestampISO?: string;
  author?: string;
  likeCount?: number;
  replyCount?: number;
}

interface FeedEdition {
  mode?: string;
  pageNote?: string;
}

interface FeedResponse {
  items?: FeedItem[];
  nextPage?: number | null;
  hasMore?: boolean;
  tabs?: string[];
  feedEdition?: FeedEdition;
  dataSource?: string;
}

const DEFAULT_LIMIT = 6;
const DEFAULT_TAB = "此刻";

function itemKey(item: FeedItem, index: number) {
  return String(item.id || item.tid || index);
}

function itemTitle(item: FeedItem) {
  return String(item.title || "未命名内容").trim();
}

function itemMeta(item: FeedItem) {
  return [item.locationArea, item.timeLabel || item.timestampISO, item.author]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" · ");
}

async function fetchFeedItems({ tab = DEFAULT_TAB, limit = DEFAULT_LIMIT } = {}) {
  const params = new URLSearchParams({ tab, limit: String(limit) });
  const response = await fetch(`/api/feed?${params.toString()}`, {
    credentials: "include",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Feed API returned HTTP ${response.status}`);
  }

  return await response.json() as FeedResponse;
}

export function useFeedItems() {
  const items = ref<FeedItem[]>([]);
  const loading = ref(false);
  const error = ref("");
  const hasMore = ref(false);
  const dataSource = ref("");
  const feedMode = ref("");
  const pageNote = ref("");

  async function load() {
    loading.value = true;
    error.value = "";
    try {
      const payload = await fetchFeedItems();
      items.value = Array.isArray(payload.items) ? payload.items : [];
      hasMore.value = Boolean(payload.hasMore || payload.nextPage);
      dataSource.value = payload.dataSource || "api";
      feedMode.value = payload.feedEdition?.mode || "";
      pageNote.value = payload.feedEdition?.pageNote || "";
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : "Feed API 请求失败";
    } finally {
      loading.value = false;
    }
  }

  return {
    dataSource,
    error,
    feedMode,
    hasMore,
    itemKey,
    itemMeta,
    itemTitle,
    items,
    load,
    loading,
    pageNote
  };
}
