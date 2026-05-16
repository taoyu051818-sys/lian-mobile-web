import { computed, ref } from "vue";
import { fetchProfileTab } from "../../api/profile";
import {
  EMPTY_HISTORY,
  EMPTY_LIKED,
  EMPTY_SAVED,
  ERROR_LOAD_GENERIC,
  PROFILE_EMPTY_CONTENT,
  PROFILE_LIST_ERROR_PREFIX,
  PROFILE_TAB_HISTORY,
  PROFILE_TAB_LIKED,
  PROFILE_TAB_SAVED,
} from "../../config/brand";
import { getRecentReadHistoryIds } from "../../platform/browser-storage";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import type { FeedItemId } from "../../types/feed";
import type { ProfileListItem, ProfileTabKey } from "../../types/profile";

export function useProfileTabs(options: {
  isMissingSessionError: (error: unknown) => boolean;
  refreshCurrentSession: () => Promise<boolean>;
  onUnauthenticated: () => void;
}) {
  const tabs: Array<{ key: ProfileTabKey; label: string; empty: string }> = [
    { key: "history", label: PROFILE_TAB_HISTORY, empty: EMPTY_HISTORY },
    { key: "saved", label: PROFILE_TAB_SAVED, empty: EMPTY_SAVED },
    { key: "liked", label: PROFILE_TAB_LIKED, empty: EMPTY_LIKED },
  ];

  const activeTab = ref<ProfileTabKey>("history");
  const profileItems = ref<ProfileListItem[]>([]);
  const listLoading = ref(false);
  const listError = ref("");
  const listEmptyText = computed(() => tabs.find((tab) => tab.key === activeTab.value)?.empty || PROFILE_EMPTY_CONTENT);

  function readHistoryIds(): FeedItemId[] {
    if (typeof localStorage === "undefined") return [];
    return getRecentReadHistoryIds(localStorage, 50);
  }

  async function fetchProfileTabWithSessionRefresh(tab: ProfileTabKey, tids: FeedItemId[] = []) {
    try {
      return await fetchProfileTab(tab, tids);
    } catch (error) {
      if (!options.isMissingSessionError(error)) throw error;
      const sessionStillValid = await options.refreshCurrentSession();
      if (!sessionStillValid) throw error;

      try {
        return await fetchProfileTab(tab, tids);
      } catch (retryError) {
        if (options.isMissingSessionError(retryError)) {
          throw new Error("登录状态已刷新，但个人列表接口仍返回未授权。请稍后重试，或重新登录后再打开赞过 / 收藏。");
        }
        throw retryError;
      }
    }
  }

  function resetProfileList() {
    profileItems.value = [];
    listLoading.value = false;
    listError.value = "";
  }

  async function loadProfileList(tab: ProfileTabKey) {
    activeTab.value = tab;
    listLoading.value = true;
    listError.value = "";
    try {
      const response = await fetchProfileTabWithSessionRefresh(tab, tab === "history" ? readHistoryIds() : []);
      profileItems.value = response.items || [];
    } catch (error) {
      if (options.isMissingSessionError(error)) {
        resetProfileList();
        options.onUnauthenticated();
      } else {
        listError.value = extractErrorMessage(error, PROFILE_LIST_ERROR_PREFIX + ERROR_LOAD_GENERIC);
        profileItems.value = [];
      }
    } finally {
      listLoading.value = false;
    }
  }

  return {
    tabs,
    activeTab,
    profileItems,
    listLoading,
    listError,
    listEmptyText,
    loadProfileList,
    resetProfileList,
  };
}
