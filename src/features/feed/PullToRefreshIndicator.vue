<script setup lang="ts">
/**
 * Apple-style pull-to-refresh indicator.
 *
 * Displays a circular progress indicator that fills as the user pulls down.
 * Shows a spinner during refresh. Respects reduced motion preference.
 *
 * Usage:
 * ```vue
 * <PullToRefreshIndicator
 *   :progress="state.progress.value"
 *   :is-refreshing="state.isRefreshing.value"
 *   :can-refresh="state.canRefresh.value"
 *   :pull-distance="state.pullDistance.value"
 * />
 * ```
 */
import { computed } from "vue";
import { useReducedMotion } from "../../composables/useReducedMotion";
import {
  GESTURE_PULL_TO_REFRESH,
  GESTURE_RELEASE_TO_REFRESH,
  GESTURE_REFRESHING,
} from "../../config/brand";

const props = defineProps<{
  progress: number;
  isRefreshing: boolean;
  canRefresh: boolean;
  pullDistance: number;
}>();

const reduced = useReducedMotion();

const indicatorStyle = computed(() => ({
  transform: `translateY(${props.pullDistance - 60}px)`,
  opacity: Math.min(props.progress, 1),
  transition:
    props.pullDistance > 0
      ? "none"
      : reduced.value
        ? "none"
        : "transform var(--motion-return, 380ms) var(--motion-ease-overshoot, cubic-bezier(0.76, 0.665, 0.37, 1.35)), opacity var(--motion-fast, 160ms) var(--motion-ease-standard, ease)",
}));

// SVG circle progress
const circleRadius = 18;
const circleCircumference = 2 * Math.PI * circleRadius;
const strokeDashoffset = computed(() => {
  return circleCircumference * (1 - props.progress);
});

const statusText = computed(() => {
  if (props.isRefreshing) return GESTURE_REFRESHING;
  if (props.canRefresh) return GESTURE_RELEASE_TO_REFRESH;
  return GESTURE_PULL_TO_REFRESH;
});
</script>

<template>
  <div
    class="pull-refresh-indicator"
    :class="{
      'is-refreshing': isRefreshing,
      'can-refresh': canRefresh,
      'pull-refresh-indicator--reduced': reduced,
    }"
    :style="indicatorStyle"
    role="status"
    :aria-label="statusText"
  >
    <div class="pull-refresh-indicator__circle">
      <!-- Progress ring -->
      <svg
        v-if="!isRefreshing"
        class="pull-refresh-indicator__progress"
        width="44"
        height="44"
        viewBox="0 0 44 44"
      >
        <circle
          class="pull-refresh-indicator__track"
          cx="22"
          cy="22"
          :r="circleRadius"
          fill="none"
          stroke-width="3"
        />
        <circle
          class="pull-refresh-indicator__fill"
          cx="22"
          cy="22"
          :r="circleRadius"
          fill="none"
          stroke-width="3"
          stroke-linecap="round"
          :stroke-dasharray="circleCircumference"
          :stroke-dashoffset="strokeDashoffset"
        />
      </svg>

      <!-- Spinner during refresh -->
      <svg
        v-else
        class="pull-refresh-indicator__spinner"
        width="44"
        height="44"
        viewBox="0 0 44 44"
      >
        <circle
          class="pull-refresh-indicator__spinner-track"
          cx="22"
          cy="22"
          :r="circleRadius"
          fill="none"
          stroke-width="3"
        />
      </svg>

      <!-- Arrow icon -->
      <svg
        v-if="!isRefreshing"
        class="pull-refresh-indicator__arrow"
        :class="{ 'is-flipped': canRefresh }"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
      </svg>
    </div>

    <span class="pull-refresh-indicator__text">{{ statusText }}</span>
  </div>
</template>

<style scoped>
.pull-refresh-indicator {
  position: absolute;
  top: 0;
  left: 50%;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  align-items: center;
  padding: var(--space-3, 12px);
  transform: translateX(-50%);
  pointer-events: none;
}

.pull-refresh-indicator__circle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
}

.pull-refresh-indicator__progress,
.pull-refresh-indicator__spinner {
  position: absolute;
  inset: 0;
}

.pull-refresh-indicator__track {
  stroke: rgba(31, 167, 160, 0.2);
}

.pull-refresh-indicator__fill {
  stroke: var(--lian-primary, #1fa7a0);
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dashoffset var(--motion-micro, 120ms) var(--motion-ease-standard, ease);
}

.pull-refresh-indicator--reduced .pull-refresh-indicator__fill {
  transition: none;
}

.pull-refresh-indicator__spinner-track {
  stroke: var(--lian-primary, #1fa7a0);
  stroke-dasharray: 60 113;
  animation: pull-refresh-spin 1s linear infinite;
}

.pull-refresh-indicator--reduced .pull-refresh-indicator__spinner-track {
  animation: none;
  stroke-dasharray: 113;
}

.pull-refresh-indicator__arrow {
  position: absolute;
  color: var(--lian-primary, #1fa7a0);
  transition: transform var(--motion-fast, 160ms) var(--motion-ease-standard, ease);
}

.pull-refresh-indicator__arrow.is-flipped {
  transform: rotate(180deg);
}

.pull-refresh-indicator--reduced .pull-refresh-indicator__arrow {
  transition: none;
}

.pull-refresh-indicator__text {
  color: var(--lian-muted, #6b7280);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

@keyframes pull-refresh-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pull-refresh-indicator__fill,
  .pull-refresh-indicator__arrow {
    transition: none;
  }

  .pull-refresh-indicator__spinner-track {
    animation: none;
    stroke-dasharray: 113;
  }
}
</style>
