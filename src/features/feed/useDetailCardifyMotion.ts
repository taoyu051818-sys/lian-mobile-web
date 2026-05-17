import { computed, ref, type Ref } from "vue";
import type { CardTransitionSnapshot } from "./useFeedDetail";

export interface UseDetailCardifyMotionOptions {
  detailOpen: Ref<boolean>;
  detailLoading: Ref<boolean>;
  viewportWidth: Ref<number>;
  viewportHeight: Ref<number>;
  updateViewport: () => void;
  prefersReducedMotion: () => boolean;
  cardifyDistance: number;
  dragStageMinScale: number;
  returnAnimationMs: number;
}

export function useDetailCardifyMotion(options: UseDetailCardifyMotionOptions) {
  const lastOpenSnapshot = ref<CardTransitionSnapshot | null>(null);
  const dragStartX = ref(0);
  const dragStartY = ref(0);
  const detailDragX = ref(0);
  const detailDragging = ref(false);
  const detailReturning = ref(false);
  const detailPointerId = ref<number | null>(null);
  const detailGestureLocked = ref<"horizontal" | "vertical" | null>(null);
  let pendingReturnTimer: ReturnType<typeof setTimeout> | undefined;

  function cancelPendingReturnTimer() {
    if (pendingReturnTimer !== undefined) {
      clearTimeout(pendingReturnTimer);
      pendingReturnTimer = undefined;
    }
  }

  const detailPhase = computed(() => {
    if (detailReturning.value) return "returning";
    if (detailDragging.value) return "dragging";
    if (options.detailOpen.value) return options.detailLoading.value ? "opening" : "open";
    return "idle";
  });

  const detailCardifyProgress = computed(() =>
    Math.min(1, Math.max(0, Math.abs(detailDragX.value) / options.cardifyDistance)),
  );

  const detailTargetScale = computed(() => {
    const snapshot = lastOpenSnapshot.value;
    if (!snapshot) return 0.5;
    const scaleByWidth = snapshot.rect.width / Math.max(1, options.viewportWidth.value);
    const scaleByHeight = snapshot.rect.height / Math.max(1, options.viewportHeight.value);
    return Math.max(0.34, Math.min(0.72, Math.max(scaleByWidth, scaleByHeight)));
  });

  const detailTargetX = computed(() => {
    const snapshot = lastOpenSnapshot.value;
    if (!snapshot) return 0;
    return snapshot.rect.left + snapshot.rect.width / 2 - options.viewportWidth.value / 2;
  });

  const detailTargetY = computed(() => {
    const snapshot = lastOpenSnapshot.value;
    if (!snapshot) return 0;
    return snapshot.rect.top + snapshot.rect.height / 2 - options.viewportHeight.value / 2;
  });

  const detailDragStyle = computed(() => {
    const progress = detailCardifyProgress.value;
    const returning = detailReturning.value;
    const scale = returning
      ? 1 - (1 - detailTargetScale.value) * progress
      : 1 - (1 - options.dragStageMinScale) * progress;
    const translateX = returning ? detailTargetX.value * progress : detailDragX.value;
    const translateY = returning ? detailTargetY.value * progress : 0;
    const feedOpacity = options.detailOpen.value ? Math.max(0.1, progress * 0.9) : 1;
    const feedScale = options.detailOpen.value ? 0.985 + progress * 0.015 : 1;
    return {
      "--detail-card-progress": String(progress),
      "--detail-card-scale": String(scale),
      "--detail-card-translate-x": `${translateX}px`,
      "--detail-card-translate-y": `${translateY}px`,
      "--detail-card-radius": `${Math.round(progress * 18)}px`,
      "--feed-under-detail-opacity": String(feedOpacity),
      "--feed-under-detail-scale": String(feedScale),
    };
  });

  function resetDragState() {
    detailDragX.value = 0;
    detailDragging.value = false;
    detailReturning.value = false;
    detailPointerId.value = null;
    detailGestureLocked.value = null;
  }

  function resetMotionState() {
    resetDragState();
    lastOpenSnapshot.value = null;
  }

  /**
   * Start the return-to-card animation. Returns a promise that resolves
   * when the animation duration has elapsed.
   */
  function startReturn(direction: number): Promise<void> {
    cancelPendingReturnTimer();
    options.updateViewport();
    detailDragging.value = false;
    detailReturning.value = true;
    detailPointerId.value = null;
    detailGestureLocked.value = null;
    detailDragX.value = Math.sign(direction || 1) * options.cardifyDistance;

    return new Promise<void>((resolve) => {
      pendingReturnTimer = window.setTimeout(() => {
        pendingReturnTimer = undefined;
        resolve();
      }, options.returnAnimationMs);
    });
  }

  return {
    lastOpenSnapshot,
    dragStartX,
    dragStartY,
    detailDragX,
    detailDragging,
    detailReturning,
    detailPointerId,
    detailGestureLocked,
    detailPhase,
    detailCardifyProgress,
    detailTargetScale,
    detailTargetX,
    detailTargetY,
    detailDragStyle,
    resetDragState,
    resetMotionState,
    startReturn,
    cancelPendingReturnTimer,
  };
}
