import { computed, ref, type Ref } from "vue";
import { fetchProfileTab } from "../../api/profile";
import { getRecentReadHistoryIds } from "../../platform/browser-storage";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import {
  EMPTY_HISTORY,
  EMPTY_SAVED,
  EMPTY_LIKED,
  ERROR_LOAD_GENERIC,
  ORDERS_LIST_EMPTY_HEADLINE,
  PROFILE_TAB_HISTORY,
  PROFILE_TAB_SAVED,
  PROFILE_TAB_LIKED,
  PROFILE_TAB_POSTS,
  PROFILE_TAB_REPLIES,
  PROFILE_TAB_DRAFTS,
  PROFILE_TAB_MAP_CONTRIBUTIONS,
  PROFILE_TAB_ORDERS,
  PROFILE_EMPTY_CONTENT,
  PROFILE_LIST_ERROR_PREFIX,
} from "../../config/brand";
import type { FeedItemId } from "../../types/feed";
import type {
  ProfileListItem,
  ProfilePostsContentFilter,
  ProfileTabKey,
  ProfileUser,
} from "../../types/profile";

export function useProfileTabs(options: {
  user: Ref<ProfileUser | null>;
  enterGuestState: () => void;
  isMissingSessionError: (error: unknown) => boolean;
  refreshCurrentSession: () => Promise<boolean>;
}) {
  const { enterGuestState, isMissingSessionError, refreshCurrentSession } = options;

  const listLoading = ref(false);
  const listError = ref("");
  const activeTab = ref<ProfileTabKey>("history");
  const profileItems = ref<ProfileListItem[]>([]);
  // PR-C of #611 — posts-tab content filter. Only used when activeTab is
  // "posts"; switching to other tabs leaves the value untouched so a return
  // to posts restores the previous chip selection.
  const postsContentFilter = ref<ProfilePostsContentFilter>("all");

  const tabs: Array<{ key: ProfileTabKey; label: string; empty: string }> = [
    { key: "history", label: PROFILE_TAB_HISTORY, empty: EMPTY_HISTORY },
    { key: "saved", label: PROFILE_TAB_SAVED, empty: EMPTY_SAVED },
    { key: "liked", label: PROFILE_TAB_LIKED, empty: EMPTY_LIKED },
    { key: "posts", label: PROFILE_TAB_POSTS, empty: PROFILE_EMPTY_CONTENT },
    { key: "replies", label: PROFILE_TAB_REPLIES, empty: PROFILE_EMPTY_CONTENT },
    { key: "drafts", label: PROFILE_TAB_DRAFTS, empty: PROFILE_EMPTY_CONTENT },
    {
      key: "map-contributions",
      label: PROFILE_TAB_MAP_CONTRIBUTIONS,
      empty: PROFILE_EMPTY_CONTENT,
    },
    // Errand orders tab — issue #609 PR1. The list itself does NOT come
    // through `fetchProfileTab`; ProfileView renders ProfileErrandOrdersBlock
    // (which has its own /api/errands/orders/mine fetch) when this tab is
    // active. We keep the tab in the same array so the underline / active
    // dispatch is identical across all tabs.
    { key: "orders", label: PROFILE_TAB_ORDERS, empty: ORDERS_LIST_EMPTY_HEADLINE },
  ];

  const listEmptyText = computed(
    () => tabs.find((tab) => tab.key === activeTab.value)?.empty || PROFILE_EMPTY_CONTENT,
  );

  function readHistoryIds() {
    return getRecentReadHistoryIds(localStorage, 50);
  }

  async function fetchProfileTabWithSessionRefresh(
    tab: ProfileTabKey,
    tids: FeedItemId[] = [],
    contentFilter: ProfilePostsContentFilter = "all",
  ) {
    try {
      return await fetchProfileTab(tab, tids, { contentFilter });
    } catch (error) {
      if (!isMissingSessionError(error)) throw error;
      const sessionStillValid = await refreshCurrentSession();
      if (!sessionStillValid) throw error;

      try {
        return await fetchProfileTab(tab, tids, { contentFilter });
      } catch (retryError) {
        if (isMissingSessionError(retryError)) {
          throw new Error(
            "登录状态已刷新，但个人列表接口仍返回未授权。请稍后重试，或重新登录后再打开赞过 / 收藏。",
            { cause: retryError },
          );
        }
        throw retryError;
      }
    }
  }

  async function loadProfileList(tab: ProfileTabKey) {
    activeTab.value = tab;
    // Errand orders tab is rendered by ProfileErrandOrdersBlock, which has
    // its own fetch (fetchMyErrandOrders / `useMyErrandOrders`). Short-
    // circuiting here keeps `fetchProfileTab` from being called for "orders"
    // (it would 404 — there is no /api/profile/orders) and resets the shared
    // collection-list state so the previously-active tab's items don't bleed
    // through behind the orders block.
    if (tab === "orders") {
      profileItems.value = [];
      listError.value = "";
      listLoading.value = false;
      return;
    }
    listLoading.value = true;
    listError.value = "";
    try {
      const response = await fetchProfileTabWithSessionRefresh(
        tab,
        tab === "history" ? readHistoryIds() : [],
        tab === "posts" ? postsContentFilter.value : "all",
      );
      profileItems.value = response.items || [];
    } catch (error) {
      if (isMissingSessionError(error)) {
        enterGuestState();
      } else {
        listError.value = extractErrorMessage(
          error,
          PROFILE_LIST_ERROR_PREFIX + ERROR_LOAD_GENERIC,
        );
        profileItems.value = [];
      }
    } finally {
      listLoading.value = false;
    }
  }

  /**
   * Pick a posts-tab content filter chip and refetch the posts collection.
   * No-op if the user is not on the posts tab; the chip strip is gated on
   * `activeTab === "posts"` in the view, so this is defensive.
   */
  async function selectPostsContentFilter(filter: ProfilePostsContentFilter) {
    if (postsContentFilter.value === filter) return;
    postsContentFilter.value = filter;
    if (activeTab.value !== "posts") return;
    await loadProfileList("posts");
  }

  function resetList() {
    profileItems.value = [];
    listError.value = "";
  }

  return {
    listLoading,
    listError,
    activeTab,
    profileItems,
    tabs,
    listEmptyText,
    postsContentFilter,
    loadProfileList,
    selectPostsContentFilter,
    resetList,
  };
}
