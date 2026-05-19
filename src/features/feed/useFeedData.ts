import { computed, ref } from "vue";
import { DEFAULT_TABS, fetchFeed } from "../../api/feed";
import type { FeedItem, FeedTab } from "../../types/feed";
import { LOADING_FEED, EMPTY_FEED, ERROR_LOAD_GENERIC, FEED_EMPTY_HINT } from "../../config/brand";
import { readHistoryQuery, rememberReadItem } from "../../platform/browser-storage";

const PAGE_SIZE = 12;

export function useFeedData(options: { detailOpen: () => boolean; closeDetail: () => void }) {
  const tabs = ref<FeedTab[]>(DEFAULT_TABS);
  const activeTab = ref(DEFAULT_TABS[0].id);
  const items = ref<FeedItem[]>([]);
  const page = ref(1);
  const hasMore = ref(true);
  const loading = ref(false);
  const loadingMore = ref(false);
  const errorMessage = ref("");

  const isEmpty = computed(() => !loading.value && !errorMessage.value && items.value.length === 0);
  const canAutoLoadMore = computed(
    () => hasMore.value && !loading.value && !loadingMore.value && !options.detailOpen(),
  );

  async function loadFeed(reset = false) {
    if (loading.value || loadingMore.value) return;
    if (!reset && !hasMore.value) return;

    errorMessage.value = "";
    if (reset) {
      loading.value = true;
      page.value = 1;
      hasMore.value = true;
    } else {
      loadingMore.value = true;
    }

    try {
      const response = await fetchFeed({
        tab: activeTab.value,
        page: reset ? 1 : page.value,
        limit: PAGE_SIZE,
        read: readHistoryQuery(),
      });

      tabs.value = response.tabs.length ? response.tabs : DEFAULT_TABS;
      const nextItems = response.items || [];
      items.value = reset ? nextItems : [...items.value, ...nextItems];
      hasMore.value = Boolean(response.hasMore);
      page.value = response.nextPage || (reset ? 2 : page.value + 1);
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : ERROR_LOAD_GENERIC;
      if (reset) items.value = [];
    } finally {
      loading.value = false;
      loadingMore.value = false;
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
    loadFeed,
    switchTab,
    triggerLoadMore,
    rememberReadItem,
    LOADING_FEED,
    EMPTY_FEED,
    FEED_EMPTY_HINT,
  };
}
