<script setup lang="ts">
import { computed } from "vue";
import { buildCommerceStoreHash } from "../../../app/commerce-route";
import {
  COMMERCE_AREA_FALLBACK,
  COMMERCE_FAVORITES_LABEL,
  COMMERCE_LOGO_PLACEHOLDER,
  COMMERCE_RATING_EMPTY,
  COMMERCE_RATING_LABEL,
  COMMERCE_RECOMMENDED,
  COMMERCE_SALES_LABEL,
  COMMERCE_SUMMARY_FALLBACK,
} from "../../../config/brand";
import type { CommerceStore } from "../../../types/commerce";

const props = defineProps<{ store: CommerceStore }>();
const href = computed(() => buildCommerceStoreHash(props.store.id));

const ratingText = computed(() =>
  props.store.ratings.description === "0" ? COMMERCE_RATING_EMPTY : props.store.ratings.description,
);
const ratingEmpty = computed(() => props.store.ratings.description === "0");
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
          <span class="commerce-store-card__rating">
            <span class="commerce-store-card__meta-label">{{ COMMERCE_RATING_LABEL }}</span>
            <span class="commerce-store-card__rating-value" :class="{ 'is-empty': ratingEmpty }">{{
              ratingText
            }}</span>
          </span>
          <span class="commerce-store-card__stat">
            <span class="commerce-store-card__meta-label">{{ COMMERCE_SALES_LABEL }}</span>
            {{ store.salesCount }}
          </span>
          <span class="commerce-store-card__stat">
            <span class="commerce-store-card__meta-label">{{ COMMERCE_FAVORITES_LABEL }}</span>
            {{ store.favoriteCount }}
          </span>
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
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-content-card);
  transition:
    box-shadow var(--motion-fast) var(--motion-ease-standard),
    transform var(--motion-fast) var(--motion-ease-standard);
}

.commerce-store-card:has(.commerce-store-card__link:hover) {
  box-shadow: var(--shadow-content-card-hover);
}

.commerce-store-card:has(.commerce-store-card__link:active) {
  transform: scale(0.995);
}

.commerce-store-card__link {
  display: flex;
  min-height: 120px;
  gap: var(--space-3);
  padding: var(--space-3);
  color: inherit;
  text-decoration: none;
}

.commerce-store-card__link:hover {
  background: var(--lian-primary-soft);
}

.commerce-store-card__link:focus-visible {
  background: var(--lian-primary-soft);
  outline: 2px solid var(--lian-primary);
  outline-offset: -3px;
}

.commerce-store-card__logo {
  display: grid;
  flex: 0 0 64px;
  width: 64px;
  height: 64px;
  place-items: center;
  border-radius: var(--radius-content-card);
  background: linear-gradient(150deg, var(--lian-primary-soft), var(--type-food-soft));
  color: var(--lian-primary-deep);
  font-size: 22px;
  font-weight: 900;
}

.commerce-store-card__body,
.commerce-store-card__title-row {
  min-width: 0;
}

.commerce-store-card__body {
  display: grid;
  flex: 1;
  align-content: start;
  gap: var(--space-1);
}

.commerce-store-card__title-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.commerce-store-card__title {
  display: -webkit-box;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--lian-ink);
  font-size: 16px;
  font-weight: 800;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.commerce-store-card__badge {
  flex: none;
  align-self: flex-start;
  padding: 2px var(--space-2);
  border-radius: var(--radius-chip);
  background: var(--type-trade-soft);
  color: var(--lian-ink);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.5;
  white-space: nowrap;
}

.commerce-store-card__area {
  color: var(--lian-primary-deep);
  font-size: 12px;
  font-weight: 700;
}

.commerce-store-card__summary {
  display: -webkit-box;
  overflow: hidden;
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.commerce-store-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-1) var(--space-3);
  margin-top: var(--space-1);
  padding-top: var(--space-2);
  border-top: 1px solid var(--lian-line);
  color: var(--lian-muted);
  font-size: 12px;
}

.commerce-store-card__rating,
.commerce-store-card__stat {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-1);
  white-space: nowrap;
}

.commerce-store-card__meta-label {
  color: var(--lian-faint);
  font-size: 11px;
}

.commerce-store-card__rating-value {
  color: var(--lian-ink);
  font-size: 14px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.commerce-store-card__rating-value.is-empty {
  color: var(--lian-faint);
  font-size: 12px;
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .commerce-store-card {
    transition: none;
  }

  .commerce-store-card:has(.commerce-store-card__link:active) {
    transform: none;
  }
}
</style>
