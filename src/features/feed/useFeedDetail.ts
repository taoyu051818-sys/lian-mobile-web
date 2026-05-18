import type { FeedItem, FeedItemId } from "../../types/feed";
import { usePostDetailLoader } from "./usePostDetailLoader";
import { useFeedDetailHistory } from "./useFeedDetailHistory";

export interface CardOpenPayload {
  item: FeedItem;
  rect: { top: number; left: number; width: number; height: number };
}

export interface FeedDetailDeps {
  rememberReadItem: (id: FeedItemId) => void;
}

export function useFeedDetail(deps: FeedDetailDeps) {
  const loader = usePostDetailLoader();

  const history = useFeedDetailHistory({
    detailOpen: loader.detailOpen,
    onPopState: () => closeDetail({ syncHistory: false }),
  });

  function resetDetailState() {
    loader.resetLoaderState();
    history.resetHistoryState();
  }

  function closeDetail(options: { syncHistory?: boolean } = {}) {
    const syncHistory = options.syncHistory !== false;
    if (syncHistory) history.clearDetailHistory();
    resetDetailState();
  }

  async function openItem(id: FeedItemId, _payload?: CardOpenPayload) {
    deps.rememberReadItem(id);
    loader.selectedPostId.value = id;
    loader.selectedPost.value = null;
    history.pushDetailHistory(id);
    await loader.loadDetail(id);
  }

  // Open from a `#/post/{tid}` deep link — the URL is already correct, so we
  // skip history.pushDetailHistory and the read-history mark (the user has
  // not actively browsed to the card yet, only landed on the URL).
  async function openFromDeepLink(id: FeedItemId) {
    if (loader.selectedPostId.value === id) return;
    loader.selectedPostId.value = id;
    loader.selectedPost.value = null;
    await loader.loadDetail(id);
  }

  return {
    selectedPostId: loader.selectedPostId,
    selectedPost: loader.selectedPost,
    detailLoading: loader.detailLoading,
    detailError: loader.detailError,
    detailOpen: loader.detailOpen,
    detailHistoryActive: history.detailHistoryActive,
    openItem,
    openFromDeepLink,
    retryDetail: loader.retryDetail,
    closeDetail,
    resetDetailState,
    pushDetailHistory: history.pushDetailHistory,
  };
}
