<script setup lang="ts">
import { computed } from "vue";
import {
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
  <div class="commerce-list-page" data-testid="commerce-list-page">
    <EmptyState
      v-if="status === 'loading'"
      class="commerce-list-page__state"
      :description="COMMERCE_LOADING"
      data-testid="commerce-loading"
    />

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

    <ul v-else-if="status === 'ready'" class="commerce-list-page__list">
      <li v-for="store in items" :key="store.id">
        <CommerceStoreCard :store="store" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.commerce-list-page,
.commerce-list-page__state {
  display: grid;
  gap: var(--space-3);
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

.commerce-list-page__list {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
