import { onBeforeUnmount, ref, type Ref } from "vue";
import { prefersReducedMotion } from "./useReducedMotion";

/**
 * Swipe gesture direction.
 */
export type SwipeDirection = "left" | "right" | "up" | "down";

/**
 * Swipe gesture state returned by the composable.
 */
export interface SwipeGestureState {
  /** Whether a swipe is currently in progress */
  isSwiping: Ref<boolean>;
  /** Current horizontal offset in pixels (positive = right, negative = left) */
  offsetX: Ref<number>;
  /** Current vertical offset in pixels (positive = down, negative = up) */
  offsetY: Ref<number>;
  /** Detected swipe direction (null if not yet determined) */
  direction: Ref<SwipeDirection | null>;
}

/**
 * Swipe gesture options.
 */
export interface SwipeGestureOptions {
  /** Minimum distance in pixels to trigger a swipe action (default: 80) */
  threshold?: number;
  /** Maximum vertical movement allowed for horizontal swipes (default: 50) */
  verticalTolerance?: number;
  /** Maximum horizontal movement allowed for vertical swipes (default: 50) */
  horizontalTolerance?: number;
  /** Callback when swipe completes past threshold */
  onSwipe?: (direction: SwipeDirection) => void;
  /** Callback during swipe movement */
  onMove?: (offsetX: number, offsetY: number) => void;
  /** Callback when swipe is cancelled or released before threshold */
  onCancel?: () => void;
  /** Allowed swipe directions (default: all) */
  directions?: SwipeDirection[];
}

const DEFAULT_THRESHOLD = 80;
const DEFAULT_VERTICAL_TOLERANCE = 50;
const DEFAULT_HORIZONTAL_TOLERANCE = 50;

/**
 * Apple-style swipe gesture composable.
 *
 * Provides horizontal and vertical swipe detection with configurable thresholds.
 * Uses touch events with passive listeners for optimal scroll performance.
 *
 * SSR contract (RFC §6 phase 1.5):
 *   - Module evaluation is side-effect free.
 *   - All DOM operations are guarded by `typeof window === "undefined"`.
 *   - Returns inert refs in SSR context.
 *
 * Reduced motion:
 *   - When `prefers-reduced-motion: reduce` is active, the composable still
 *     functions but consumers should skip transform animations and use
 *     instant state changes instead.
 *
 * Usage:
 * ```ts
 * const { state, handlers } = useSwipeGesture({
 *   threshold: 100,
 *   directions: ['left', 'right'],
 *   onSwipe: (dir) => {
 *     if (dir === 'left') deleteItem();
 *     if (dir === 'right') archiveItem();
 *   },
 * });
 *
 * // In template:
 * // <div v-bind="handlers" :style="{ transform: `translateX(${state.offsetX.value}px)` }">
 * ```
 */
export function useSwipeGesture(options: SwipeGestureOptions = {}) {
  const {
    threshold = DEFAULT_THRESHOLD,
    verticalTolerance = DEFAULT_VERTICAL_TOLERANCE,
    horizontalTolerance = DEFAULT_HORIZONTAL_TOLERANCE,
    onSwipe,
    onMove,
    onCancel,
    directions = ["left", "right", "up", "down"],
  } = options;

  const isSwiping = ref(false);
  const offsetX = ref(0);
  const offsetY = ref(0);
  const direction = ref<SwipeDirection | null>(null);

  // Internal tracking
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let isTracking = false;
  let directionLocked = false;

  function resetState() {
    isSwiping.value = false;
    offsetX.value = 0;
    offsetY.value = 0;
    direction.value = null;
    isTracking = false;
    directionLocked = false;
  }

  function handleTouchStart(event: TouchEvent) {
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startTime = performance.now();
    isTracking = true;
    directionLocked = false;
    direction.value = null;
  }

  function handleTouchMove(event: TouchEvent) {
    if (!isTracking || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Determine direction on first significant movement
    if (!directionLocked && (absX > 10 || absY > 10)) {
      if (absX > absY) {
        // Horizontal swipe
        const dir = deltaX > 0 ? "right" : "left";
        if (!directions.includes(dir)) {
          resetState();
          return;
        }
        direction.value = dir;
        directionLocked = true;
      } else {
        // Vertical swipe
        const dir = deltaY > 0 ? "down" : "up";
        if (!directions.includes(dir)) {
          resetState();
          return;
        }
        direction.value = dir;
        directionLocked = true;
      }
    }

    if (!directionLocked) return;

    // Check tolerance based on direction
    const isHorizontal = direction.value === "left" || direction.value === "right";
    if (isHorizontal && absY > verticalTolerance) {
      resetState();
      onCancel?.();
      return;
    }
    if (!isHorizontal && absX > horizontalTolerance) {
      resetState();
      onCancel?.();
      return;
    }

    isSwiping.value = true;
    offsetX.value = isHorizontal ? deltaX : 0;
    offsetY.value = isHorizontal ? 0 : deltaY;

    onMove?.(offsetX.value, offsetY.value);
  }

  function handleTouchEnd() {
    if (!isTracking) return;

    const absX = Math.abs(offsetX.value);
    const absY = Math.abs(offsetY.value);
    const isHorizontal = direction.value === "left" || direction.value === "right";
    const distance = isHorizontal ? absX : absY;

    if (direction.value && distance >= threshold) {
      onSwipe?.(direction.value);
    } else {
      onCancel?.();
    }

    resetState();
  }

  function handleTouchCancel() {
    if (isTracking) {
      onCancel?.();
      resetState();
    }
  }

  onBeforeUnmount(() => {
    resetState();
  });

  const state: SwipeGestureState = {
    isSwiping,
    offsetX,
    offsetY,
    direction,
  };

  // Event handlers object for v-bind spread
  const handlers = {
    onTouchstart: handleTouchStart,
    onTouchmove: handleTouchMove,
    onTouchend: handleTouchEnd,
    onTouchcancel: handleTouchCancel,
  };

  return {
    state,
    handlers,
    /** Check if reduced motion is preferred (consumers should skip animations) */
    prefersReducedMotion,
    /** Manually reset the swipe state */
    reset: resetState,
  };
}
