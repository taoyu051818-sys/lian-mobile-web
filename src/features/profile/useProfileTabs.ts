import { computed, ref, type Ref } from "vue";
import { fetchProfileTab } from "../../api/profile";
import { getRecentReadHistoryIds } from "../../platform/browser-storage";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import {
  EMPTY_DRAFTS,
  EMPTY_HISTORY,
  EMPTY_LIKED,
  EMPTY_MAP_CONTRIBUTIONS,
  EMPTY_POSTS,
  EMPTY_REPLIES,
  EMPTY_SAVED,
  ERROR_LOAD_GENERIC,
  PROFILE_EMPTY_CONTENT,
  PROFILE_FORUM_LINK_MISSING,
  PROFILE_LIST_ERROR_PREFIX,
  PROFILE_TAB_DRAFTS,
  PROFILE_TAB_HISTORY,
  PROFILE_TAB_LIKED,
  PROFILE_TAB_MAP,
  PROFILE_TAB_POSTS,
  PROFILE_TAB_REPLIES,
  PROFILE_TAB_SAVED,
} from "../../config/brand";
import type { FeedItemId } from "../../types/feed";
import type { ProfileListItem, ProfileTabKey, ProfileUser } from "../../types/profile";

const FORUM_LINKED_TABS = new Set<ProfileTabKey>(["posts", "replies", "map-contributions"]);

export function useProfileTabs(options: {
  user: Ref<ProfileUser | null>;
  enterGuestState: () => void;
  isMissingSessionError: (error: unknown) => boolean;
  refreshCurrentSession: () => Promise<boolean>;
}) {
  const { user, enterGuestState, isMissingSessionError, refreshCurrentSession } = options;

  const listLoading = ref(false);
  const listError = ref("");
  const activeTab = ref<ProfileTabKey>("history");
  const profileItems = ref<ProfileListItem[]>([]);

  const tabs: Array<{ key: ProfileTabKey; label: string; empty: string }> = [
    { key: "history", label: PROFILE_TAB_HISTORY, empty: EMPTY_HISTORY },
    { key: "saved", label: PROFILE_TAB_SAVED, empty: EMPTY_SAVED },
    { key: "liked", label: PROFILE_TAB_LIKED, empty: EMPTY_LIKED },
    { key: "posts", label: PROFILE_TAB_POSTS, empty: EMPTY_POSTS },
    { key: "replies", label: PROFILE_TAB_REPLIES, empty: EMPTY_REPLIES },
    { key: "drafts", label: PROFILE_TAB_DRAFTS, empty: EMPTY_DRAFTS },
    { key: "map-contributions", label: PROFILE_TAB_MAP, empty: EMPTY_MAP_CONTRIBUTIONS },
  ];

  const listEmptyText = computed(() => {
    if (FORUM_LINKED_TABS.has(activeTab.value) && !user.value?.nodebbUid) {
      return PROFILE_FORUM_LINK_MISSING;
    }
    return tabs.find((tab) => tab.key === activeTab.value)?.empty || PROFILE_EMPTY_CONTENT;
  });

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
            "登录状态已刷新，但个人列表接口仍返回未授权。请稍后重试，或重新登录后再打开个人主页。",
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
      if (FORUM_LINKED_TABS.has(tab) && !user.value?.nodebbUid) {
        profileItems.value = [];
        return;
      }

      const response = await fetchProfileTabWithSessionRefresh(
        tab,
        tab === "history" ? readHistoryIds() : [],
      );
      profileItems.value = response.items;
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
