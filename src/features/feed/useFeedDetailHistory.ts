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
    // Only treat popstate as a back-out when the URL no longer points to a
    // post detail. If detailTid is still non-null (forward-nav into a
    // detail, or any spurious popstate that fires while the URL still has
    // `#/post/{tid}`), let the FeedView detailTid watch reconcile — calling
    // closeDetail here would race an in-flight loadDetail, bump the loader
    // token, and trigger a Vue unmount mid-render. That cascade left the
    // panel stuck on "正在加载详情…" because Teleport children crashed
    // during the spurious unmount.
    if (detailTid.value !== null) {
      detailHistoryActive.value = true;
      return;
    }
    if (!options.detailOpen.value) return;
    detailHistoryActive.value = false;
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
