<script setup lang="ts">
import { computed } from "vue";
import { buildCommerceCatalogHash } from "../../../app/commerce-route";
import {
  COMMERCE_AREA_FALLBACK,
  COMMERCE_BACK_TO_CATALOG,
  COMMERCE_ERROR_HINT,
  COMMERCE_ERROR_TITLE,
  COMMERCE_FAVORITES_LABEL,
  COMMERCE_LOADING,
  COMMERCE_LOGO_PLACEHOLDER,
  COMMERCE_RATE_LIMIT_HINT,
  COMMERCE_RATE_LIMIT_TITLE,
  COMMERCE_RATING_DESCRIPTION,
  COMMERCE_RATING_EMPTY,
  COMMERCE_RATING_LOGISTICS,
  COMMERCE_RATING_SERVICE,
  COMMERCE_RECOMMENDED,
  COMMERCE_RETRY,
  COMMERCE_SALES_LABEL,
  COMMERCE_STORE_NOT_FOUND_HINT,
  COMMERCE_STORE_NOT_FOUND_TITLE,
  COMMERCE_SUMMARY_FALLBACK,
  COMMERCE_TIMEOUT_HINT,
  COMMERCE_TIMEOUT_TITLE,
} from "../../../config/brand";
import type { CommerceStore } from "../../../types/commerce";
import { EmptyState, InlineError } from "../../../ui";
import type { CommerceReadErrorKind, CommerceReadStatus } from "../useCommerceStoreRead";

const props = defineProps<{
  status: CommerceReadStatus;
  errorKind: CommerceReadErrorKind;
  store: CommerceStore | null;
}>();

const emit = defineEmits<{ retry: [] }>();
const catalogHref = buildCommerceCatalogHash();

const errorCopy = computed(() => {
  if (props.errorKind === "rate-limited") {
    return { title: COMMERCE_RATE_LIMIT_TITLE, hint: COMMERCE_RATE_LIMIT_HINT };
  }
  if (props.errorKind === "timeout") {
    return { title: COMMERCE_TIMEOUT_TITLE, hint: COMMERCE_TIMEOUT_HINT };
  }
  return { title: COMMERCE_ERROR_TITLE, hint: COMMERCE_ERROR_HINT };
});

function displayRating(value: string) {
  return value === "0" ? COMMERCE_RATING_EMPTY : value;
}
</script>

<template>
  <div class="commerce-detail-page" data-testid="commerce-detail-page">
    <a class="commerce-detail-page__back" :href="catalogHref">{{ COMMERCE_BACK_TO_CATALOG }}</a>

    <EmptyState
      v-if="status === 'loading'"
      class="commerce-detail-page__state"
      :description="COMMERCE_LOADING"
      data-testid="commerce-loading"
    />

    <EmptyState
      v-else-if="status === 'not-found'"
      class="commerce-detail-page__state"
      :title="COMMERCE_STORE_NOT_FOUND_TITLE"
      :description="COMMERCE_STORE_NOT_FOUND_HINT"
      data-testid="commerce-not-found"
    />

    <InlineError
      v-else-if="status === 'error'"
      class="commerce-detail-page__error"
      :action-label="COMMERCE_RETRY"
      data-testid="commerce-error"
      @action="emit('retry')"
    >
      <strong>{{ errorCopy.title }}</strong>
      <span>{{ errorCopy.hint }}</span>
    </InlineError>

    <article v-else-if="status === 'ready' && store" class="commerce-detail-page__card">
      <header class="commerce-detail-page__hero">
        <span
          class="commerce-detail-page__logo"
          aria-hidden="true"
          data-testid="commerce-logo-placeholder"
        >
          {{ COMMERCE_LOGO_PLACEHOLDER }}
        </span>
        <span class="commerce-detail-page__heading">
          <span class="commerce-detail-page__title-row">
            <h1>{{ store.name }}</h1>
            <span v-if="store.recommended" class="commerce-detail-page__badge">
              {{ COMMERCE_RECOMMENDED }}
            </span>
          </span>
          <span class="commerce-detail-page__area">
            {{ store.areaLabel || COMMERCE_AREA_FALLBACK }}
          </span>
        </span>
      </header>

      <p class="commerce-detail-page__summary">
        {{ store.summary || COMMERCE_SUMMARY_FALLBACK }}
      </p>

      <dl class="commerce-detail-page__ratings">
        <div>
          <dt>{{ COMMERCE_RATING_DESCRIPTION }}</dt>
          <dd>{{ displayRating(store.ratings.description) }}</dd>
        </div>
        <div>
          <dt>{{ COMMERCE_RATING_SERVICE }}</dt>
          <dd>{{ displayRating(store.ratings.service) }}</dd>
        </div>
        <div>
          <dt>{{ COMMERCE_RATING_LOGISTICS }}</dt>
          <dd>{{ displayRating(store.ratings.logistics) }}</dd>
        </div>
      </dl>

      <p class="commerce-detail-page__counts">
        <span>{{ COMMERCE_SALES_LABEL }} {{ store.salesCount }}</span>
        <span>{{ COMMERCE_FAVORITES_LABEL }} {{ store.favoriteCount }}</span>
      </p>
    </article>
  </div>
</template>

<style scoped>
.commerce-detail-page {
  display: grid;
  gap: var(--space-3);
}

.commerce-detail-page__back {
  display: inline-flex;
  width: fit-content;
  min-height: 44px;
  align-items: center;
  color: var(--lian-primary);
  font-size: 13px;
  font-weight: 850;
  text-decoration: none;
}

.commerce-detail-page__back:hover,
.commerce-detail-page__back:focus-visible {
  text-decoration: underline;
}

.commerce-detail-page__state {
  min-height: 148px;
}

.commerce-detail-page__error :deep(.inline-error__message) {
  display: grid;
  gap: var(--space-1);
}

.commerce-detail-page__error strong,
.commerce-detail-page__error span {
  display: block;
}

.commerce-detail-page__card {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: rgba(255, 252, 247, 0.96);
}

.commerce-detail-page__hero {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.commerce-detail-page__logo {
  display: grid;
  flex: 0 0 84px;
  width: 84px;
  height: 84px;
  place-items: center;
  border-radius: 24px;
  background: linear-gradient(145deg, var(--lian-primary-soft), rgba(255, 159, 67, 0.18));
  color: var(--lian-primary);
  font-size: 28px;
  font-weight: 950;
}

.commerce-detail-page__heading {
  display: grid;
  min-width: 0;
  gap: var(--space-1);
}

.commerce-detail-page__title-row {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: var(--space-2);
}

.commerce-detail-page__title-row h1 {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--lian-ink);
  font-size: 21px;
  font-weight: 950;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.commerce-detail-page__badge {
  flex: none;
  padding: 2px var(--space-2);
  border-radius: var(--radius-chip);
  background: rgba(255, 159, 67, 0.14);
  color: #8a4a00;
  font-size: 11px;
  font-weight: 850;
}

.commerce-detail-page__area {
  color: var(--lian-primary);
  font-size: 13px;
  font-weight: 800;
}

.commerce-detail-page__summary {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--lian-muted);
  font-size: 14px;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.commerce-detail-page__ratings {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  padding: var(--space-3);
  border-radius: 14px;
  background: rgba(31, 167, 160, 0.07);
}

.commerce-detail-page__ratings div {
  display: grid;
  justify-items: center;
  gap: var(--space-1);
}

.commerce-detail-page__ratings dt {
  color: var(--lian-muted);
  font-size: 12px;
}

.commerce-detail-page__ratings dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 15px;
  font-weight: 900;
}

.commerce-detail-page__counts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
}
</style>
