<script setup lang="ts">
/**
 * ErrorBoundary component for catching synchronous render errors in child components.
 *
 * Vue's onErrorCaptured hook catches errors during render, lifecycle hooks, and
 * watchers. This component provides a fallback UI when a child component crashes,
 * preventing the entire app from going white-screen.
 *
 * Usage:
 * ```vue
 * <ErrorBoundary>
 *   <SomeRiskyComponent />
 * </ErrorBoundary>
 * ```
 *
 * With custom fallback:
 * ```vue
 * <ErrorBoundary>
 *   <template #default>
 *     <SomeRiskyComponent />
 *   </template>
 *   <template #fallback="{ error, reset }">
 *     <div>Custom error: {{ error.message }}</div>
 *     <button @click="reset">Retry</button>
 *   </template>
 * </ErrorBoundary>
 * ```
 */
import { ref, onErrorCaptured } from "vue";
import { PAGE_ERROR, PAGE_ERROR_LABEL, PAGE_RELOAD } from "../config/brand";

const hasError = ref(false);
const capturedError = ref<Error | null>(null);

onErrorCaptured((error: Error, _instance, info) => {
  hasError.value = true;
  capturedError.value = error;

  // Log for debugging in development
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console -- surface boundary-caught errors to dev console for triage
    console.error("[ErrorBoundary] Caught error:", error);
    // eslint-disable-next-line no-console -- preserve component info alongside the error log line
    console.error("[ErrorBoundary] Component info:", info);
  }

  // Return false to stop error propagation (handled here)
  return false;
});

function reset() {
  hasError.value = false;
  capturedError.value = null;
}
</script>

<template>
  <slot v-if="!hasError" />
  <slot v-else name="fallback" :error="capturedError" :reset="reset">
    <section class="error-boundary-fallback" role="alert" :aria-label="PAGE_ERROR_LABEL">
      <p>{{ PAGE_ERROR }}</p>
      <button type="button" class="error-boundary-fallback__retry" @click="reset">
        {{ PAGE_RELOAD }}
      </button>
    </section>
  </slot>
</template>

<style scoped>
.error-boundary-fallback {
  display: grid;
  gap: var(--space-3);
  min-height: 40vh;
  place-content: center;
  place-items: center;
  color: var(--lian-muted);
  font-size: 14px;
  font-weight: 800;
  text-align: center;
}

.error-boundary-fallback p {
  margin: 0;
}

.error-boundary-fallback__retry {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font-weight: 900;
  cursor: pointer;
}

.error-boundary-fallback__retry:focus-visible {
  outline: 3px solid rgba(31, 167, 160, 0.32);
  outline-offset: 2px;
}
</style>
