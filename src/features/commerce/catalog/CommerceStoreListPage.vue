<script setup lang="ts">
import { computed } from "vue";
import {
  COMMERCE_CATALOG_COUNT_SUFFIX,
  COMMERCE_CATALOG_HEADING,
  COMMERCE_CATALOG_HINT,
  COMMERCE_CATALOG_LIST_LABEL,
  COMMERCE_EMPTY_HINT,
  COMMERCE_EMPTY_TITLE,
  COMMERCE_ERROR_HINT,
  COMMERCE_ERROR_TITLE,
  COMMERCE_LOADING,
  COMMERCE_RATE_LIMIT_HINT,
  COMMERCE_RATE_LIMIT_TITLE,
  COMMERCE_RETRY,
  COMMERCE_TIMEOUT_HINT,
  COMMERCE_TIMEOUT_TITLE,
} from "../../../config/brand";
import type { CommerceStore } from "../../../types/commerce";
import { EmptyState, InlineError } from "../../../ui";
import type { CommerceReadErrorKind, CommerceReadStatus } from "../useCommerceStoreRead";
import CommerceStoreCard from "./CommerceStoreCard.vue";

const props = defineProps<{
  status: CommerceReadStatus;
  errorKind: CommerceReadErrorKind;
  items: readonly CommerceStore[];
}>();

const emit = defineEmits<{ retry: [] }>();

/** Skeleton rows keep the first paint close to the settled list height. */
const SKELETON_ROWS = [0, 1, 2] as const;

const errorCopy = computed(() => {
  if (props.errorKind === "rate-limited") {
    return { title: COMMERCE_RATE_LIMIT_TITLE, hint: COMMERCE_RATE_LIMIT_HINT };
  }
  if (props.errorKind === "timeout") {
    return { title: COMMERCE_TIMEOUT_TITLE, hint: COMMERCE_TIMEOUT_HINT };
  }
  return { title: COMMERCE_ERROR_TITLE, hint: COMMERCE_ERROR_HINT };
});
</script>

<template>
  <div
    class="commerce-list-page"
    data-testid="commerce-list-page"
    :aria-busy="status === 'loading' ? 'true' : undefined"
  >
    <header class="commerce-list-page__header">
      <h2 class="commerce-list-page__heading">{{ COMMERCE_CATALOG_HEADING }}</h2>
      <p class="commerce-list-page__hint">{{ COMMERCE_CATALOG_HINT }}</p>
      <p v-if="status === 'ready'" class="commerce-list-page__count">
        {{ items.length }}{{ COMMERCE_CATALOG_COUNT_SUFFIX }}
      </p>
    </header>

    <div
      v-if="status === 'loading'"
      class="commerce-list-page__skeleton"
      role="status"
      data-testid="commerce-loading"
    >
      <span class="commerce-list-page__skeleton-label">{{ COMMERCE_LOADING }}</span>
      <div
        v-for="row in SKELETON_ROWS"
        :key="row"
        class="commerce-list-page__skeleton-card"
        aria-hidden="true"
      >
        <span class="commerce-list-page__skeleton-logo" />
        <span class="commerce-list-page__skeleton-lines">
          <span
            class="commerce-list-page__skeleton-line commerce-list-page__skeleton-line--title"
          />
          <span class="commerce-list-page__skeleton-line commerce-list-page__skeleton-line--area" />
          <span
            class="commerce-list-page__skeleton-line commerce-list-page__skeleton-line--summary"
          />
        </span>
      </div>
    </div>

    <EmptyState
      v-else-if="status === 'empty'"
      class="commerce-list-page__state"
      :title="COMMERCE_EMPTY_TITLE"
      :description="COMMERCE_EMPTY_HINT"
      data-testid="commerce-empty"
    />

    <InlineError
      v-else-if="status === 'error'"
      class="commerce-list-page__error"
      :action-label="COMMERCE_RETRY"
      data-testid="commerce-error"
      @action="emit('retry')"
    >
      <strong>{{ errorCopy.title }}</strong>
      <span>{{ errorCopy.hint }}</span>
    </InlineError>

    <ul
      v-else-if="status === 'ready'"
      class="commerce-list-page__list"
      :aria-label="COMMERCE_CATALOG_LIST_LABEL"
    >
      <li v-for="store in items" :key="store.id">
        <CommerceStoreCard :store="store" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.commerce-list-page,
.commerce-list-page__state,
.commerce-list-page__header {
  display: grid;
  gap: var(--space-3);
}

.commerce-list-page__header {
  gap: var(--space-1);
}

.commerce-list-page__heading {
  margin: 0;
  color: var(--lian-ink);
  font-size: 20px;
  font-weight: 800;
  line-height: 1.35;
  text-wrap: balance;
}

.commerce-list-page__hint {
  margin: 0;
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.5;
  text-wrap: pretty;
}

.commerce-list-page__count {
  margin: 0;
  color: var(--lian-primary-deep);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.commerce-list-page__state {
  min-height: 148px;
}

.commerce-list-page__error :deep(.inline-error__message) {
  display: grid;
  gap: var(--space-1);
}

.commerce-list-page__error strong,
.commerce-list-page__error span {
  display: block;
}

.commerce-list-page__list,
.commerce-list-page__skeleton {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.commerce-list-page__skeleton-label {
  color: var(--lian-muted);
  font-size: 13px;
}

.commerce-list-page__skeleton-card {
  display: flex;
  min-height: 120px;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  animation: commerce-skeleton-pulse 1.6s var(--motion-ease-standard) infinite;
}

.commerce-list-page__skeleton-logo {
  flex: 0 0 64px;
  width: 64px;
  height: 64px;
  border-radius: var(--radius-content-card);
  background: var(--lian-line-strong);
}

.commerce-list-page__skeleton-lines {
  display: grid;
  flex: 1;
  align-content: start;
  gap: var(--space-2);
  min-width: 0;
}

.commerce-list-page__skeleton-line {
  height: 12px;
  border-radius: var(--radius-chip);
  background: var(--lian-line-strong);
}

.commerce-list-page__skeleton-line--title {
  width: 62%;
  height: 16px;
}

.commerce-list-page__skeleton-line--area {
  width: 34%;
}

.commerce-list-page__skeleton-line--summary {
  width: 88%;
}

@keyframes commerce-skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.72;
  }
}

@media (prefers-reduced-motion: reduce) {
  .commerce-list-page__skeleton-card {
    animation: none;
  }
}
</style>
