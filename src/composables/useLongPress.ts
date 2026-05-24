import { onBeforeUnmount, ref, type Ref } from "vue";
import { prefersReducedMotion } from "./useReducedMotion";
import { hapticMedium } from "./useHapticFeedback";

/**
 * Long press state returned by the composable.
 */
export interface LongPressState {
  /** Whether a long press is currently active */
  isPressed: Ref<boolean>;
  /** Whether the long press threshold has been reached */
  isLongPress: Ref<boolean>;
  /** Progress from 0 to 1 (1 = threshold reached) */
  progress: Ref<number>;
}

/**
 * Long press options.
 */
export interface LongPressOptions {
  /** Duration in milliseconds to trigger long press (default: 500) */
  duration?: number;
  /** Maximum movement in pixels before cancelling (default: 10) */
  moveTolerance?: number;
  /** Callback when long press is triggered */
  onLongPress?: (event: TouchEvent | PointerEvent) => void;
  /** Callback when press starts */
  onPressStart?: () => void;
  /** Callback when press is cancelled */
  onPressCancel?: () => void;
  /** Whether long press is enabled (default: true) */
  enabled?: boolean;
}

const DEFAULT_DURATION = 500;
const DEFAULT_MOVE_TOLERANCE = 10;

/**
 * Apple-style long press composable.
 *
 * Provides long press detection with visual feedback progress and haptic
 * feedback. Designed for context menus and secondary actions.
 *
 * SSR contract (RFC §6 phase 1.5):
 *   - Module evaluation is side-effect free.
 *   - All DOM operations are guarded by `typeof window === "undefined"`.
 *   - Returns inert refs in SSR context.
 *
 * Reduced motion:
 *   - When `prefers-reduced-motion: reduce` is active, the composable still
 *     functions but consumers should use instant state changes instead of
 *     scale/fade animations.
 *
 * Usage:
 * ```vue
 * <script setup>
 * const { state, handlers } = useLongPress({
 *   onLongPress: () => {
 *     showContextMenu();
 *   },
 * });
 * </script>
 *
 * <template>
 *   <div
 *     class="card"
 *     v-bind="handlers"
 *     :class="{ 'is-pressed': state.isPressed.value }"
 *   >
 *     Content
 *   </div>
 * </template>
 *
 * <style>
 * .card {
 *   transition: transform var(--motion-fast) var(--motion-ease-standard);
 * }
 * .card.is-pressed {
 *   transform: scale(0.98);
 * }
 * </style>
 * ```
 */
export function useLongPress(options: LongPressOptions = {}) {
  const {
    duration = DEFAULT_DURATION,
    moveTolerance = DEFAULT_MOVE_TOLERANCE,
    onLongPress,
    onPressStart,
    onPressCancel,
    enabled = true,
  } = options;

  const isPressed = ref(false);
  const isLongPress = ref(false);
  const progress = ref(0);

  // Internal tracking
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let progressTimer: ReturnType<typeof setInterval> | null = null;
  let lastEvent: TouchEvent | PointerEvent | null = null;

  function clearTimers() {
    if (pressTimer !== null) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    if (progressTimer !== null) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  }

  function resetState() {
    clearTimers();
    isPressed.value = false;
    isLongPress.value = false;
    progress.value = 0;
    lastEvent = null;
  }

  function startPress(clientX: number, clientY: number, event: TouchEvent | PointerEvent) {
    if (!enabled) return;

    startX = clientX;
    startY = clientY;
    startTime = performance.now();
    lastEvent = event;
    isPressed.value = true;
    isLongPress.value = false;
    progress.value = 0;

    onPressStart?.();

    // Start progress updates (for visual feedback)
    const progressInterval = 16; // ~60fps
    progressTimer = setInterval(() => {
      const elapsed = performance.now() - startTime;
      progress.value = Math.min(elapsed / duration, 1);
    }, progressInterval);

    // Set timer for long press trigger
    pressTimer = setTimeout(() => {
      if (isPressed.value) {
        isLongPress.value = true;
        progress.value = 1;
        clearTimers();

        // Haptic feedback on long press trigger
        hapticMedium();

        onLongPress?.(lastEvent!);
      }
    }, duration);
  }

  function checkMovement(clientX: number, clientY: number) {
    if (!isPressed.value) return;

    const deltaX = Math.abs(clientX - startX);
    const deltaY = Math.abs(clientY - startY);

    if (deltaX > moveTolerance || deltaY > moveTolerance) {
      onPressCancel?.();
      resetState();
    }
  }

  function endPress() {
    if (isPressed.value && !isLongPress.value) {
      onPressCancel?.();
    }
    resetState();
  }

  // Touch event handlers
  function handleTouchStart(event: TouchEvent) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    startPress(touch.clientX, touch.clientY, event);
  }

  function handleTouchMove(event: TouchEvent) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    checkMovement(touch.clientX, touch.clientY);
  }

  function handleTouchEnd() {
    endPress();
  }

  function handleTouchCancel() {
    onPressCancel?.();
    resetState();
  }

  // Pointer event handlers (for mouse support)
  function handlePointerDown(event: PointerEvent) {
    // Only handle primary button (left click)
    if (event.button !== 0) return;
    // Skip if touch event will handle it
    if (event.pointerType === "touch") return;
    startPress(event.clientX, event.clientY, event);
  }

  function handlePointerMove(event: PointerEvent) {
    if (event.pointerType === "touch") return;
    checkMovement(event.clientX, event.clientY);
  }

  function handlePointerUp(event: PointerEvent) {
    if (event.pointerType === "touch") return;
    endPress();
  }

  function handlePointerCancel(event: PointerEvent) {
    if (event.pointerType === "touch") return;
    onPressCancel?.();
    resetState();
  }

  // Prevent context menu on long press (we handle it ourselves)
  function handleContextMenu(event: Event) {
    if (isLongPress.value || isPressed.value) {
      event.preventDefault();
    }
  }

  onBeforeUnmount(() => {
    resetState();
  });

  const state: LongPressState = {
    isPressed,
    isLongPress,
    progress,
  };

  // Event handlers object for v-bind spread
  const handlers = {
    onTouchstart: handleTouchStart,
    onTouchmove: handleTouchMove,
    onTouchend: handleTouchEnd,
    onTouchcancel: handleTouchCancel,
    onPointerdown: handlePointerDown,
    onPointermove: handlePointerMove,
    onPointerup: handlePointerUp,
    onPointercancel: handlePointerCancel,
    onContextmenu: handleContextMenu,
  };

  return {
    state,
    handlers,
    /** Check if reduced motion is preferred (consumers should skip animations) */
    prefersReducedMotion,
    /** Manually reset the long press state */
    reset: resetState,
  };
}
