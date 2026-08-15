<script setup lang="ts">
import { computed } from "vue";
import { buildCommerceStoreHash } from "../../../app/commerce-route";
import {
  COMMERCE_AREA_FALLBACK,
  COMMERCE_FAVORITES_LABEL,
  COMMERCE_LOGO_PLACEHOLDER,
  COMMERCE_RATING_EMPTY,
  COMMERCE_RECOMMENDED,
  COMMERCE_SALES_LABEL,
  COMMERCE_SUMMARY_FALLBACK,
} from "../../../config/brand";
import type { CommerceStore } from "../../../types/commerce";

const props = defineProps<{ store: CommerceStore }>();
const href = computed(() => buildCommerceStoreHash(props.store.id));

function displayRating(value: string) {
  return value === "0" ? COMMERCE_RATING_EMPTY : value;
}
</script>

<template>
  <article class="commerce-store-card" :data-testid="`commerce-store-${store.id}`">
    <a class="commerce-store-card__link" :href="href">
      <span
        class="commerce-store-card__logo"
        aria-hidden="true"
        data-testid="commerce-logo-placeholder"
      >
        {{ COMMERCE_LOGO_PLACEHOLDER }}
      </span>

      <span class="commerce-store-card__body">
        <span class="commerce-store-card__title-row">
          <strong class="commerce-store-card__title">{{ store.name }}</strong>
          <span v-if="store.recommended" class="commerce-store-card__badge">
            {{ COMMERCE_RECOMMENDED }}
          </span>
        </span>
        <span class="commerce-store-card__area">{{
          store.areaLabel || COMMERCE_AREA_FALLBACK
        }}</span>
        <span class="commerce-store-card__summary">{{
          store.summary || COMMERCE_SUMMARY_FALLBACK
        }}</span>
        <span class="commerce-store-card__meta">
          <span>{{ COMMERCE_SALES_LABEL }} {{ store.salesCount }}</span>
          <span>{{ COMMERCE_FAVORITES_LABEL }} {{ store.favoriteCount }}</span>
          <span>评分 {{ displayRating(store.ratings.description) }}</span>
        </span>
      </span>
    </a>
  </article>
</template>

<style scoped>
.commerce-store-card {
  overflow: hidden;
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: rgba(255, 252, 247, 0.96);
}

.commerce-store-card__link {
  display: flex;
  min-height: 120px;
  gap: var(--space-3);
  padding: var(--space-3);
  color: inherit;
  text-decoration: none;
}

.commerce-store-card__link:hover,
.commerce-store-card__link:focus-visible {
  background: rgba(31, 167, 160, 0.06);
  outline: none;
}

.commerce-store-card__link:focus-visible {
  box-shadow: inset 0 0 0 2px var(--lian-primary);
}

.commerce-store-card__logo {
  display: grid;
  flex: 0 0 72px;
  width: 72px;
  height: 72px;
  place-items: center;
  border-radius: 20px;
  background: linear-gradient(145deg, var(--lian-primary-soft), rgba(255, 159, 67, 0.18));
  color: var(--lian-primary);
  font-size: 25px;
  font-weight: 950;
}

.commerce-store-card__body,
.commerce-store-card__title-row {
  min-width: 0;
}

.commerce-store-card__body {
  display: grid;
  flex: 1;
  gap: var(--space-1);
}

.commerce-store-card__title-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.commerce-store-card__title {
  display: -webkit-box;
  overflow: hidden;
  color: var(--lian-ink);
  font-size: 16px;
  font-weight: 900;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.commerce-store-card__badge {
  flex: none;
  padding: 2px var(--space-2);
  border-radius: var(--radius-chip);
  background: rgba(255, 159, 67, 0.14);
  color: #8a4a00;
  font-size: 11px;
  font-weight: 850;
}

.commerce-store-card__area {
  color: var(--lian-primary);
  font-size: 12px;
  font-weight: 750;
}

.commerce-store-card__summary {
  display: -webkit-box;
  overflow: hidden;
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.commerce-store-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  color: var(--lian-muted);
  font-size: 11px;
}

@media (prefers-reduced-motion: reduce) {
  .commerce-store-card__link {
    scroll-behavior: auto;
  }
}
</style>
