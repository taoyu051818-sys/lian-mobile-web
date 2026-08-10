import { computed, ref } from "vue";
import { DEFAULT_TABS, fetchFeed } from "../../api/feed";
import type { FeedItem, FeedTab } from "../../types/feed";
import type { AudienceVisibility } from "../../types/audience";
import { LOADING_FEED, EMPTY_FEED, ERROR_LOAD_GENERIC, FEED_EMPTY_HINT } from "../../config/brand";
import { readHistoryQuery, rememberReadItem } from "../../platform/browser-storage";

const PAGE_SIZE = 12;

function mergeFeedItems(base: readonly FeedItem[], incoming: readonly FeedItem[]): FeedItem[] {
  const merged: FeedItem[] = [];
  const slotByTid = new Map<FeedItem["tid"], number>();

  for (const item of [...base, ...incoming]) {
    if (!Number.isInteger(item.tid) || item.tid <= 0) {
      merged.push(item);
      continue;
    }
    const slot = slotByTid.get(item.tid);
    if (slot === undefined) {
      slotByTid.set(item.tid, merged.length);
      merged.push(item);
      continue;
    }
    merged[slot] = item;
  }

  return merged;
}

export function useFeedData(options: { detailOpen: () => boolean; closeDetail: () => void }) {
  const tabs = ref<FeedTab[]>(DEFAULT_TABS);
  const activeTab = ref(DEFAULT_TABS[0].id);
  const items = ref<FeedItem[]>([]);
  const page = ref(1);
  const hasMore = ref(true);
  const loading = ref(false);
  const loadingMore = ref(false);
  const errorMessage = ref("");
  const selectedVisibilities = ref<Set<AudienceVisibility>>(new Set());
  let requestGeneration = 0;

  const isEmpty = computed(() => !loading.value && !errorMessage.value && items.value.length === 0);
  const canAutoLoadMore = computed(
    () => hasMore.value && !loading.value && !loadingMore.value && !options.detailOpen(),
  );

  async function loadFeed(reset = false) {
    // A reset represents a new tab/filter context, so it must be allowed to
    // supersede an in-flight request. Pagination remains single-flight.
    if (!reset && (loading.value || loadingMore.value)) return;
    if (!reset && !hasMore.value) return;

    const generation = ++requestGeneration;
    errorMessage.value = "";
    if (reset) {
      loading.value = true;
      loadingMore.value = false;
      page.value = 1;
      hasMore.value = true;
    } else {
      loadingMore.value = true;
    }

    try {
      const visibilityArray =
        selectedVisibilities.value.size > 0 ? Array.from(selectedVisibilities.value) : undefined;

      const response = await fetchFeed({
        tab: activeTab.value,
        page: reset ? 1 : page.value,
        limit: PAGE_SIZE,
        read: readHistoryQuery(),
        visibility: visibilityArray,
      });

      if (generation !== requestGeneration) return;
      tabs.value = response.tabs.length ? response.tabs : DEFAULT_TABS;
      const nextItems = response.items || [];
      items.value = mergeFeedItems(reset ? [] : items.value, nextItems);
      hasMore.value = Boolean(response.hasMore);
      page.value = response.nextPage || (reset ? 2 : page.value + 1);
    } catch (error) {
      if (generation !== requestGeneration) return;
      errorMessage.value = error instanceof Error ? error.message : ERROR_LOAD_GENERIC;
      if (reset) items.value = [];
    } finally {
      // A superseded request must not clear the loading flag owned by the
      // latest request; otherwise the list flashes stale content mid-load.
      if (generation === requestGeneration) {
        if (reset) loading.value = false;
        else loadingMore.value = false;
      }
    }
  }

  // Tab switch is a user-initiated context change. Closing the detail panel
  // is a no-op when no detail is open (the FSM is `closed`), so we can drop
  // the open-check that the legacy code needed.
  function switchTab(tabId: string) {
    options.closeDetail();
    if (activeTab.value !== tabId) activeTab.value = tabId;
    void loadFeed(true);
  }

  function triggerLoadMore() {
    if (!canAutoLoadMore.value) return;
    void loadFeed(false);
  }

  function setSelectedVisibilities(visibilities: Set<AudienceVisibility>) {
    selectedVisibilities.value = visibilities;
    void loadFeed(true);
  }

  return {
    tabs,
    activeTab,
    items,
    page,
    hasMore,
    loading,
    loadingMore,
    errorMessage,
    isEmpty,
    canAutoLoadMore,
    selectedVisibilities,
    loadFeed,
    switchTab,
    triggerLoadMore,
    setSelectedVisibilities,
    rememberReadItem,
    LOADING_FEED,
    EMPTY_FEED,
    FEED_EMPTY_HINT,
  };
}
