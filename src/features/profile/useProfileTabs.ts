import { computed, ref, type Ref } from "vue";
import { fetchProfileTab } from "../../api/profile";
import { getRecentReadHistoryIds } from "../../platform/browser-storage";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import {
  EMPTY_HISTORY,
  EMPTY_SAVED,
  EMPTY_LIKED,
  ERROR_LOAD_GENERIC,
  PROFILE_TAB_HISTORY,
  PROFILE_TAB_SAVED,
  PROFILE_TAB_LIKED,
  PROFILE_TAB_POSTS,
  PROFILE_TAB_REPLIES,
  PROFILE_TAB_DRAFTS,
  PROFILE_TAB_MAP_CONTRIBUTIONS,
  PROFILE_EMPTY_CONTENT,
  PROFILE_LIST_ERROR_PREFIX,
} from "../../config/brand";
import type { FeedItemId } from "../../types/feed";
import type { ProfileListItem, ProfileTabKey, ProfileUser } from "../../types/profile";

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
  ];

  const listEmptyText = computed(
    () => tabs.find((tab) => tab.key === activeTab.value)?.empty || PROFILE_EMPTY_CONTENT,
  );

  function readHistoryIds() {
    return getRecentReadHistoryIds(localStorage, 50);
  }

  async function fetchProfileTabWithSessionRefresh(tab: ProfileTabKey, tids: FeedItemId[] = []) {
    try {
      return await fetchProfileTab(tab, tids);
    } catch (error) {
      if (!isMissingSessionError(error)) throw error;
      const sessionStillValid = await refreshCurrentSession();
      if (!sessionStillValid) throw error;

      try {
        return await fetchProfileTab(tab, tids);
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
    listLoading.value = true;
    listError.value = "";
    try {
      const response = await fetchProfileTabWithSessionRefresh(
        tab,
        tab === "history" ? readHistoryIds() : [],
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
    loadProfileList,
    resetList,
  };
}
