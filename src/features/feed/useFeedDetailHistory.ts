import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import type { FeedItemId } from "../../types/feed";
import { clearPostDetailHash, pushPostDetailHash, getDetailTidRef } from "../../app/useDeepLink";

export interface UseFeedDetailHistoryOptions {
  detailOpen: Ref<boolean>;
  onPopState: () => void;
}

/**
 * Mirrors detail-panel open state into `window.location.hash` (`#/post/{tid}`)
 * and listens to popstate so the back button closes the detail. The deep-link
 * singleton in `app/useDeepLink` is the source of truth for the parsed tid;
 * this composable only translates Feed-level open/close events to that
 * singleton's push/clear helpers.
 */
export function useFeedDetailHistory(options: UseFeedDetailHistoryOptions) {
  const detailHistoryActive = ref(false);
  const detailTid = getDetailTidRef();

  function pushDetailHistory(id: FeedItemId) {
    if (typeof window === "undefined") return;
    pushPostDetailHash(Number(id));
    detailHistoryActive.value = true;
  }

  function clearDetailHistory() {
    if (typeof window === "undefined") return;
    clearPostDetailHash();
    detailHistoryActive.value = false;
  }

  function onWindowPopState() {
    // After popstate fires, the deep-link singleton has already re-synced
    // from window.location.hash. If the hash no longer matches a post detail
    // (back-out), close the panel; if it now matches a *different* post,
    // re-resolve through onPopState so the loader can pick up the new tid.
    if (!options.detailOpen.value && detailTid.value === null) return;
    detailHistoryActive.value = detailTid.value !== null;
    options.onPopState();
  }

  function resetHistoryState() {
    detailHistoryActive.value = false;
  }

  onMounted(() => {
    window.addEventListener("popstate", onWindowPopState);
  });

  onBeforeUnmount(() => {
    clearDetailHistory();
    window.removeEventListener("popstate", onWindowPopState);
  });

  return {
    detailHistoryActive,
    pushDetailHistory,
    clearDetailHistory,
    resetHistoryState,
  };
}
