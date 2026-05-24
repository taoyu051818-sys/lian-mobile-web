import { onBeforeUnmount, ref, type Ref } from "vue";
import { prefersReducedMotion } from "./useReducedMotion";
import { hapticMedium } from "./useHapticFeedback";

/**
 * Pull-to-refresh state returned by the composable.
 */
export interface PullToRefreshState {
  /** Whether the user is currently pulling */
  isPulling: Ref<boolean>;
  /** Whether the refresh is in progress */
  isRefreshing: Ref<boolean>;
  /** Current pull distance in pixels */
  pullDistance: Ref<number>;
  /** Progress from 0 to 1 (1 = threshold reached) */
  progress: Ref<number>;
  /** Whether the threshold has been reached (ready to refresh on release) */
  canRefresh: Ref<boolean>;
}

/**
 * Pull-to-refresh options.
 */
export interface PullToRefreshOptions {
  /** Distance in pixels required to trigger refresh (default: 80) */
  threshold?: number;
  /** Maximum pull distance in pixels (default: 150) */
  maxPull?: number;
  /** Resistance factor for over-pull (0-1, default: 0.5) */
  resistance?: number;
  /** Callback when refresh is triggered */
  onRefresh?: () => void | Promise<void>;
  /** Whether pull-to-refresh is enabled (default: true) */
  enabled?: boolean;
}

const DEFAULT_THRESHOLD = 80;
const DEFAULT_MAX_PULL = 150;
const DEFAULT_RESISTANCE = 0.5;

/**
 * Apple-style pull-to-refresh composable.
 *
 * Provides pull-to-refresh functionality with spring-style animations and
 * haptic feedback. Designed for use at the top of scrollable containers.
 *
 * SSR contract (RFC §6 phase 1.5):
 *   - Module evaluation is side-effect free.
 *   - All DOM operations are guarded by `typeof window === "undefined"`.
 *   - Returns inert refs in SSR context.
 *
 * Reduced motion:
 *   - When `prefers-reduced-motion: reduce` is active, the composable still
 *     functions but consumers should use instant transitions instead of
 *     spring animations.
 *
 * Usage:
 * ```vue
 * <script setup>
 * const { state, handlers, indicatorStyle } = usePullToRefresh({
 *   onRefresh: async () => {
 *     await fetchData();
 *   },
 * });
 * </script>
 *
 * <template>
 *   <div class="scroll-container" v-bind="handlers">
 *     <div class="refresh-indicator" :style="indicatorStyle">
 *       <span v-if="state.isRefreshing.value">Refreshing...</span>
 *       <span v-else-if="state.canRefresh.value">Release to refresh</span>
 *       <span v-else>Pull to refresh</span>
 *     </div>
 *     <div class="content">...</div>
 *   </div>
 * </template>
 * ```
 */
export function usePullToRefresh(options: PullToRefreshOptions = {}) {
  const {
    threshold = DEFAULT_THRESHOLD,
    maxPull = DEFAULT_MAX_PULL,
    resistance = DEFAULT_RESISTANCE,
    onRefresh,
    enabled = true,
  } = options;

  const isPulling = ref(false);
  const isRefreshing = ref(false);
  const pullDistance = ref(0);
  const progress = ref(0);
  const canRefresh = ref(false);

  // Internal tracking
  let startY = 0;
  let isTracking = false;
  let touchId: number | null = null;

  function resetState() {
    isPulling.value = false;
    pullDistance.value = 0;
    progress.value = 0;
    canRefresh.value = false;
    isTracking = false;
    touchId = null;
  }

  function getScrollTop(element: HTMLElement): number {
    // Check if the element itself is scrollable
    if (element.scrollTop > 0) return element.scrollTop;

    // Check parent scroll containers
    let parent = element.parentElement;
    while (parent) {
      if (parent.scrollTop > 0) return parent.scrollTop;
      parent = parent.parentElement;
    }

    // Fall back to window scroll
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  function handleTouchStart(event: TouchEvent) {
    if (!enabled || isRefreshing.value) return;
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    const target = event.currentTarget as HTMLElement;
    const scrollTop = getScrollTop(target);

    // Only start tracking if at the top of the scroll container
    if (scrollTop > 5) return;

    startY = touch.clientY;
    touchId = touch.identifier;
    isTracking = true;
  }

  function handleTouchMove(event: TouchEvent) {
    if (!isTracking || isRefreshing.value) return;

    const touch = Array.from(event.touches).find((t) => t.identifier === touchId);
    if (!touch) return;

    const target = event.currentTarget as HTMLElement;
    const currentScrollTop = getScrollTop(target);

    // Stop tracking if user scrolled down
    if (currentScrollTop > 5) {
      resetState();
      return;
    }

    const deltaY = touch.clientY - startY;

    // Only track downward pulls
    if (deltaY <= 0) {
      if (isPulling.value) resetState();
      return;
    }

    // Apply resistance for over-pull
    let adjustedDelta = deltaY;
    if (deltaY > threshold) {
      const overPull = deltaY - threshold;
      adjustedDelta = threshold + overPull * resistance;
    }

    // Clamp to max pull
    adjustedDelta = Math.min(adjustedDelta, maxPull);

    isPulling.value = true;
    pullDistance.value = adjustedDelta;
    progress.value = Math.min(deltaY / threshold, 1);

    const wasCanRefresh = canRefresh.value;
    canRefresh.value = deltaY >= threshold;

    // Haptic feedback when crossing threshold
    if (canRefresh.value && !wasCanRefresh) {
      hapticMedium();
    }

    // Prevent default scroll when pulling
    if (deltaY > 0 && currentScrollTop <= 0) {
      event.preventDefault();
    }
  }

  function handleTouchEnd(event: TouchEvent) {
    if (!isTracking) return;

    const touch = Array.from(event.changedTouches).find((t) => t.identifier === touchId);
    if (!touch) return;

    if (canRefresh.value && onRefresh) {
      triggerRefresh();
    } else {
      resetState();
    }
  }

  function handleTouchCancel() {
    resetState();
  }

  async function triggerRefresh() {
    isRefreshing.value = true;
    isPulling.value = false;
    canRefresh.value = false;
    // Keep indicator visible at threshold during refresh
    pullDistance.value = threshold;
    progress.value = 1;

    try {
      await onRefresh?.();
    } finally {
      isRefreshing.value = false;
      resetState();
    }
  }

  onBeforeUnmount(() => {
    resetState();
  });

  const state: PullToRefreshState = {
    isPulling,
    isRefreshing,
    pullDistance,
    progress,
    canRefresh,
  };

  // Event handlers object for v-bind spread
  // Note: touchmove needs { passive: false } to allow preventDefault
  const handlers = {
    onTouchstart: handleTouchStart,
    onTouchmove: handleTouchMove,
    onTouchend: handleTouchEnd,
    onTouchcancel: handleTouchCancel,
  };

  // Computed style for the refresh indicator
  const indicatorStyle = {
    get transform() {
      const reduced = prefersReducedMotion();
      if (isRefreshing.value) {
        return `translateY(${threshold}px)`;
      }
      if (reduced) {
        // No transform animation for reduced motion
        return pullDistance.value > 0 ? `translateY(${pullDistance.value}px)` : "translateY(0)";
      }
      return `translateY(${pullDistance.value}px)`;
    },
    get transition() {
      const reduced = prefersReducedMotion();
      if (isPulling.value) {
        return "none";
      }
      if (reduced) {
        return "none";
      }
      // Spring-style return animation using --motion-return and --motion-ease-overshoot
      return "transform var(--motion-return, 380ms) var(--motion-ease-overshoot, cubic-bezier(0.76, 0.665, 0.37, 1.35))";
    },
    get opacity() {
      return Math.min(progress.value, 1);
    },
  };

  return {
    state,
    handlers,
    indicatorStyle,
    /** Check if reduced motion is preferred (consumers should skip animations) */
    prefersReducedMotion,
    /** Manually trigger a refresh */
    refresh: triggerRefresh,
    /** Manually reset the pull state */
    reset: resetState,
  };
}
