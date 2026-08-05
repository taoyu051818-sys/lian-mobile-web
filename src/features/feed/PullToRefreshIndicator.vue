<script setup lang="ts">
/**
 * Apple-style pull-to-refresh indicator.
 *
 * Displays a compact tonal refresh capsule that fills as the user pulls down.
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
  "--pull-refresh-y": `${props.pullDistance - 20}px`,
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
  display: inline-flex;
  gap: var(--space-2, 8px);
  align-items: center;
  box-sizing: border-box;
  min-height: 44px;
  padding: 5px var(--space-3, 12px) 5px 6px;
  border: 1px solid rgba(31, 167, 160, 0.18);
  border-radius: var(--radius-chip, 999px);
  background: var(--lian-primary-soft, #e4f7f5);
  box-shadow: var(--shadow-card, 0 2px 8px rgba(0, 0, 0, 0.06));
  color: var(--lian-primary-deep, #087b78);
  transform: translate(-50%, var(--pull-refresh-y, -20px));
  pointer-events: none;
  backdrop-filter: blur(var(--glass-blur-light, 12px)) saturate(var(--glass-saturate, 1.28));
  -webkit-backdrop-filter: blur(var(--glass-blur-light, 12px)) saturate(var(--glass-saturate, 1.28));
}

.pull-refresh-indicator.can-refresh,
.pull-refresh-indicator.is-refreshing {
  border-color: rgba(31, 167, 160, 0.28);
  background: rgba(31, 167, 160, 0.16);
}

.pull-refresh-indicator__circle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.pull-refresh-indicator__progress,
.pull-refresh-indicator__spinner {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.pull-refresh-indicator__track {
  stroke: rgba(31, 167, 160, 0.2);
}

.pull-refresh-indicator__fill {
  stroke: var(--lian-primary-deep, #087b78);
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dashoffset var(--motion-micro, 120ms) var(--motion-ease-standard, ease);
}

.pull-refresh-indicator--reduced .pull-refresh-indicator__fill {
  transition: none;
}

.pull-refresh-indicator__spinner-track {
  stroke: var(--lian-primary-deep, #087b78);
  stroke-dasharray: 60 113;
  animation: pull-refresh-spin 1s linear infinite;
}

.pull-refresh-indicator--reduced .pull-refresh-indicator__spinner-track {
  animation: none;
  stroke-dasharray: 113;
}

.pull-refresh-indicator__arrow {
  position: absolute;
  width: 16px;
  height: 16px;
  color: currentColor;
  transition: transform var(--motion-fast, 160ms) var(--motion-ease-standard, ease);
}

.pull-refresh-indicator__arrow.is-flipped {
  transform: rotate(180deg);
}

.pull-refresh-indicator--reduced .pull-refresh-indicator__arrow {
  transition: none;
}

.pull-refresh-indicator__text {
  color: currentColor;
  font-size: 12px;
  font-weight: 800;
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
