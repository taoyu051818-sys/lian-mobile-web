import { computed, onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import { fetchPostDetail } from "../../api/posts";
import type { FeedItem, FeedItemId } from "../../types/feed";
import type { PostDetail } from "../../types/post";

export interface CardOpenPayload {
  item: FeedItem;
  rect: { top: number; left: number; width: number; height: number };
}

export interface CardTransitionSnapshot extends CardOpenPayload {}

interface DetailHistoryState {
  lianDetail?: boolean;
  tid?: string;
}

export interface FeedDetailDeps {
  feedTabsChrome: { show(): void; hide(): void };
  detailChrome: { show(): void; hide(): void };
  emitChrome: (hidden: boolean) => void;
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
  const selectedPostId = ref<FeedItemId | null>(null);
  const selectedPost = ref<PostDetail | null>(null);
  const detailLoading = ref(false);
  const detailError = ref("");
  const lastOpenSnapshot = ref<CardTransitionSnapshot | null>(null);
  const dragStartX = ref(0);
  const dragStartY = ref(0);
  const detailDragX = ref(0);
  const detailDragging = ref(false);
  const detailReturning = ref(false);
  const detailPointerId = ref<number | null>(null);
  const detailGestureLocked = ref<"horizontal" | "vertical" | null>(null);
  const detailHistoryActive = ref(false);
  const ignoreNextPopState = ref(false);
  let pendingReturnTimer: ReturnType<typeof setTimeout> | undefined;

  function cancelPendingReturnTimer() {
    if (pendingReturnTimer !== undefined) {
      clearTimeout(pendingReturnTimer);
      pendingReturnTimer = undefined;
    }
  }

  const detailOpen = computed(() => selectedPostId.value !== null);
  const detailCardifyProgress = computed(() => Math.min(1, Math.max(0, Math.abs(detailDragX.value) / deps.cardifyDistance)));
  const detailTargetScale = computed(() => {
    const snapshot = lastOpenSnapshot.value;
    if (!snapshot) return 0.5;
    const scaleByWidth = snapshot.rect.width / Math.max(1, deps.viewportWidth.value);
    const scaleByHeight = snapshot.rect.height / Math.max(1, deps.viewportHeight.value);
    return Math.max(0.34, Math.min(0.72, Math.max(scaleByWidth, scaleByHeight)));
  });
  const detailTargetX = computed(() => {
    const snapshot = lastOpenSnapshot.value;
    if (!snapshot) return 0;
    return snapshot.rect.left + snapshot.rect.width / 2 - deps.viewportWidth.value / 2;
  });
  const detailTargetY = computed(() => {
    const snapshot = lastOpenSnapshot.value;
    if (!snapshot) return 0;
    return snapshot.rect.top + snapshot.rect.height / 2 - deps.viewportHeight.value / 2;
  });
  const detailDragStyle = computed(() => {
    const progress = detailCardifyProgress.value;
    const returning = detailReturning.value;
    const scale = returning
      ? 1 - (1 - detailTargetScale.value) * progress
      : 1 - (1 - deps.dragStageMinScale) * progress;
    const translateX = returning ? detailTargetX.value * progress : detailDragX.value;
    const translateY = returning ? detailTargetY.value * progress : 0;
    const feedOpacity = detailOpen.value ? Math.max(0.1, progress * 0.9) : 1;
    const feedScale = detailOpen.value ? 0.985 + progress * 0.015 : 1;
    const chromeOpacity = 1;
    const topChromeTranslateY = 0;
    const bottomChromeTranslateY = 0;
    return {
      "--detail-card-progress": String(progress),
      "--detail-card-scale": String(scale),
      "--detail-card-translate-x": `${translateX}px`,
      "--detail-card-translate-y": `${translateY}px`,
      "--detail-card-radius": `${Math.round(progress * 18)}px`,
      "--detail-top-chrome-opacity": String(chromeOpacity),
      "--detail-top-chrome-translate-y": `${topChromeTranslateY}px`,
      "--detail-bottom-chrome-opacity": String(chromeOpacity),
      "--detail-bottom-chrome-translate-y": `${bottomChromeTranslateY}px`,
      "--feed-under-detail-opacity": String(feedOpacity),
      "--feed-under-detail-scale": String(feedScale),
    };
  });

  function normalizeFeedItemId(id: FeedItemId | string | number | null | undefined) {
    return id == null ? "" : String(id);
  }

  function currentHistoryState(): DetailHistoryState {
    if (typeof window === "undefined") return {} as DetailHistoryState;
    return (window.history.state || {}) as DetailHistoryState;
  }

  function pushDetailHistory(id: FeedItemId) {
    if (typeof window === "undefined" || detailHistoryActive.value) return;
    try {
      window.history.pushState({ ...currentHistoryState(), lianDetail: true, tid: String(id) }, "", window.location.href);
      detailHistoryActive.value = true;
    } catch {
      detailHistoryActive.value = false;
    }
  }

  function clearDetailHistory() {
    if (typeof window === "undefined" || !detailHistoryActive.value) return;
    detailHistoryActive.value = false;
    try {
      if (currentHistoryState().lianDetail) {
        ignoreNextPopState.value = true;
        window.history.back();
      }
    } catch {
      ignoreNextPopState.value = false;
    }
  }

  function resetDetailState() {
    selectedPostId.value = null;
    selectedPost.value = null;
    detailLoading.value = false;
    detailError.value = "";
    detailDragX.value = 0;
    detailDragging.value = false;
    detailReturning.value = false;
    detailPointerId.value = null;
    detailGestureLocked.value = null;
    detailHistoryActive.value = false;
    deps.detailChrome.hide();
    deps.feedTabsChrome.show();
    deps.emitChrome(false);
  }

  function closeDetailWithCardify(options: { syncHistory?: boolean; direction?: number } = {}) {
    const syncHistory = options.syncHistory !== false;
    const direction = options.direction ?? (detailDragX.value < 0 ? -1 : 1);
    if (syncHistory) clearDetailHistory();
    if (deps.prefersReducedMotion()) {
      resetDetailState();
      return;
    }
    cancelPendingReturnTimer();
    deps.updateViewport();
    detailDragging.value = false;
    detailReturning.value = true;
    detailPointerId.value = null;
    detailGestureLocked.value = null;

    // Chrome handoff is immediate and has no motion:
    // detail chrome hidden, feed tabs and app bottom bar visible in the same user action.
    deps.detailChrome.hide();
    deps.feedTabsChrome.show();
    deps.emitChrome(false);

    detailDragX.value = Math.sign(direction || 1) * deps.cardifyDistance;
    pendingReturnTimer = window.setTimeout(() => {
      pendingReturnTimer = undefined;
      resetDetailState();
    }, deps.returnAnimationMs);
  }

  function onWindowPopState() {
    if (ignoreNextPopState.value) {
      ignoreNextPopState.value = false;
      return;
    }
    if (!detailOpen.value && !detailHistoryActive.value) return;
    detailHistoryActive.value = false;
    closeDetailWithCardify({ syncHistory: false, direction: detailDragX.value || -1 });
  }

  async function openItem(id: FeedItemId, payload?: CardOpenPayload) {
    deps.updateViewport();
    const normalizedId = normalizeFeedItemId(id);

    // Chrome handoff is immediate and has no motion:
    // feed tabs and app bottom bar hidden, detail chrome visible.
    deps.feedTabsChrome.hide();
    deps.emitChrome(true);

    if (payload && !deps.prefersReducedMotion()) {
      lastOpenSnapshot.value = payload;
    }
    deps.startCardTransition(payload);
    deps.rememberReadItem(id);
    selectedPostId.value = id;
    selectedPost.value = null;
    detailError.value = "";
    detailLoading.value = true;
    deps.detailChrome.show();
    detailDragX.value = 0;
    detailDragging.value = false;
    detailReturning.value = false;
    pushDetailHistory(id);

    try {
      const detail = await fetchPostDetail(id);
      if (normalizeFeedItemId(selectedPostId.value) === normalizedId) {
        selectedPost.value = detail;
      }
    } catch (error) {
      detailError.value = error instanceof Error
        ? error.message
        : "详情暂时没加载出来，可以稍后再试。";
    } finally {
      if (normalizeFeedItemId(selectedPostId.value) === normalizedId) {
        detailLoading.value = false;
      }
    }
  }

  function retryDetail() {
    if (selectedPostId.value == null) return;
    void openItem(selectedPostId.value);
  }

  function closeDetail() {
    closeDetailWithCardify();
  }

  onMounted(() => {
    window.addEventListener("popstate", onWindowPopState);
  });

  onBeforeUnmount(() => {
    cancelPendingReturnTimer();
    clearDetailHistory();
    window.removeEventListener("popstate", onWindowPopState);
  });

  return {
    selectedPostId,
    selectedPost,
    detailLoading,
    detailError,
    lastOpenSnapshot,
    detailOpen,
    detailDragging,
    detailReturning,
    detailDragX,
    detailPointerId,
    detailGestureLocked,
    dragStartX,
    dragStartY,
    detailHistoryActive,
    detailCardifyProgress,
    detailTargetScale,
    detailTargetX,
    detailTargetY,
    detailDragStyle,
    openItem,
    retryDetail,
    closeDetail,
    closeDetailWithCardify,
    resetDetailState,
    pushDetailHistory,
  };
}
