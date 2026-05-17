import { onBeforeUnmount, type Ref } from "vue";
import type { FeedItem, FeedItemId } from "../../types/feed";
import { usePostDetailLoader } from "./usePostDetailLoader";
import { useFeedDetailHistory } from "./useFeedDetailHistory";
import { useDetailCardifyMotion } from "./useDetailCardifyMotion";

export interface CardOpenPayload {
  item: FeedItem;
  rect: { top: number; left: number; width: number; height: number };
}

export type CardTransitionSnapshot = CardOpenPayload;

export interface FeedDetailDeps {
  startCardTransition: (payload?: CardOpenPayload) => void;
  rememberReadItem: (id: FeedItemId) => void;
  updateViewport: () => void;
  prefersReducedMotion: () => boolean;
  viewportWidth: Ref<number>;
  viewportHeight: Ref<number>;
  cardifyDistance: number;
  dragStageMinScale: number;
  returnAnimationMs: number;
}

export function useFeedDetail(deps: FeedDetailDeps) {
  const loader = usePostDetailLoader();

  const motion = useDetailCardifyMotion({
    detailOpen: loader.detailOpen,
    detailLoading: loader.detailLoading,
    viewportWidth: deps.viewportWidth,
    viewportHeight: deps.viewportHeight,
    updateViewport: deps.updateViewport,
    prefersReducedMotion: deps.prefersReducedMotion,
    cardifyDistance: deps.cardifyDistance,
    dragStageMinScale: deps.dragStageMinScale,
    returnAnimationMs: deps.returnAnimationMs,
  });

  const history = useFeedDetailHistory({
    detailOpen: loader.detailOpen,
    onPopState: () =>
      closeDetailWithCardify({
        syncHistory: false,
        direction: motion.detailDragX.value || -1,
      }),
  });

  function resetDetailState() {
    loader.resetLoaderState();
    motion.resetMotionState();
    history.resetHistoryState();
  }

  function closeDetailWithCardify(options: { syncHistory?: boolean; direction?: number } = {}) {
    const syncHistory = options.syncHistory !== false;
    const direction = options.direction ?? (motion.detailDragX.value < 0 ? -1 : 1);
    if (syncHistory) history.clearDetailHistory();
    if (deps.prefersReducedMotion()) {
      resetDetailState();
      return;
    }
    motion.cancelPendingReturnTimer();
    void motion.startReturn(direction).then(() => {
      resetDetailState();
    });
  }

  async function openItem(id: FeedItemId, payload?: CardOpenPayload) {
    deps.updateViewport();
    if (payload && !deps.prefersReducedMotion()) {
      motion.lastOpenSnapshot.value = payload;
    }
    deps.startCardTransition(payload);
    deps.rememberReadItem(id);
    loader.selectedPostId.value = id;
    loader.selectedPost.value = null;
    motion.resetDragState();
    history.pushDetailHistory(id);
    await loader.loadDetail(id);
  }

  function closeDetail() {
    closeDetailWithCardify();
  }

  onBeforeUnmount(() => {
    motion.cancelPendingReturnTimer();
  });

  return {
    selectedPostId: loader.selectedPostId,
    selectedPost: loader.selectedPost,
    detailLoading: loader.detailLoading,
    detailError: loader.detailError,
    lastOpenSnapshot: motion.lastOpenSnapshot,
    detailOpen: loader.detailOpen,
    detailPhase: motion.detailPhase,
    detailDragging: motion.detailDragging,
    detailReturning: motion.detailReturning,
    detailDragX: motion.detailDragX,
    detailPointerId: motion.detailPointerId,
    detailGestureLocked: motion.detailGestureLocked,
    dragStartX: motion.dragStartX,
    dragStartY: motion.dragStartY,
    detailHistoryActive: history.detailHistoryActive,
    detailCardifyProgress: motion.detailCardifyProgress,
    detailTargetScale: motion.detailTargetScale,
    detailTargetX: motion.detailTargetX,
    detailTargetY: motion.detailTargetY,
    detailDragStyle: motion.detailDragStyle,
    openItem,
    retryDetail: loader.retryDetail,
    closeDetail,
    closeDetailWithCardify,
    resetDetailState,
    pushDetailHistory: history.pushDetailHistory,
  };
}
