<script setup lang="ts">
import { computed } from "vue";
import { buildCommerceProductHash } from "../../../app/commerce-route";
import {
  COMMERCE_PRODUCT_COVER_PLACEHOLDER,
  COMMERCE_PRODUCT_PRICE_LABEL,
  COMMERCE_PRODUCT_RATING_LABEL,
  COMMERCE_PRODUCT_SUBTITLE_FALLBACK,
  COMMERCE_RATING_EMPTY,
  COMMERCE_RECOMMENDED,
  COMMERCE_SALES_LABEL,
} from "../../../config/brand";
import type { CommerceProductSummary } from "../../../types/commerce";
import { formatCommercePrice } from "./formatCommercePrice";

const props = defineProps<{ product: CommerceProductSummary }>();
const href = computed(() => buildCommerceProductHash(props.product.id));
const price = computed(() => {
  const minimum = formatCommercePrice(props.product.priceRange.minAmountMinor);
  const maximum = formatCommercePrice(props.product.priceRange.maxAmountMinor);
  return minimum === maximum ? minimum : `${minimum}–${maximum}`;
});

function displayRating(value: string) {
  return value === "0" ? COMMERCE_RATING_EMPTY : value;
}
</script>

<template>
  <article class="commerce-product-card" :data-testid="`commerce-product-card-${product.id}`">
    <a class="commerce-product-card__link" :href="href">
      <span
        class="commerce-product-card__cover"
        aria-hidden="true"
        data-testid="commerce-product-cover-placeholder"
      >
        {{ COMMERCE_PRODUCT_COVER_PLACEHOLDER }}
      </span>

      <span class="commerce-product-card__body">
        <span class="commerce-product-card__title-row">
          <strong class="commerce-product-card__title">{{ product.name }}</strong>
          <span v-if="product.recommended" class="commerce-product-card__badge">
            {{ COMMERCE_RECOMMENDED }}
          </span>
        </span>
        <span class="commerce-product-card__subtitle">
          {{ product.subtitle || COMMERCE_PRODUCT_SUBTITLE_FALLBACK }}
        </span>
        <span class="commerce-product-card__price">
          <small>{{ COMMERCE_PRODUCT_PRICE_LABEL }}</small>
          <strong>{{ price }}</strong>
        </span>
        <span class="commerce-product-card__meta">
          <span>{{ COMMERCE_PRODUCT_RATING_LABEL }} {{ displayRating(product.rating) }}</span>
          <span>{{ COMMERCE_SALES_LABEL }} {{ product.salesCount }}</span>
        </span>
      </span>
    </a>
  </article>
</template>

<style scoped>
.commerce-product-card {
  overflow: hidden;
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: rgba(255, 252, 247, 0.96);
}

.commerce-product-card__link {
  display: flex;
  min-height: 116px;
  gap: var(--space-3);
  padding: var(--space-3);
  color: inherit;
  text-decoration: none;
}

.commerce-product-card__link:hover,
.commerce-product-card__link:focus-visible {
  background: rgba(31, 167, 160, 0.06);
  outline: none;
}

.commerce-product-card__link:focus-visible {
  box-shadow: inset 0 0 0 2px var(--lian-primary);
}

.commerce-product-card__cover {
  display: grid;
  flex: 0 0 76px;
  width: 76px;
  height: 76px;
  place-items: center;
  border-radius: var(--radius-cover);
  background: linear-gradient(145deg, var(--lian-primary-soft), rgba(91, 184, 214, 0.18));
  color: var(--lian-primary-deep);
  font-size: 14px;
  font-weight: 900;
}

.commerce-product-card__body,
.commerce-product-card__title-row {
  min-width: 0;
}

.commerce-product-card__body {
  display: grid;
  flex: 1;
  gap: var(--space-1);
}

.commerce-product-card__title-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.commerce-product-card__title {
  display: -webkit-box;
  overflow: hidden;
  color: var(--lian-ink);
  font-size: 15px;
  font-weight: 900;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.commerce-product-card__badge {
  flex: none;
  padding: 2px var(--space-2);
  border-radius: var(--radius-chip);
  background: rgba(255, 159, 67, 0.14);
  color: #8a4a00;
  font-size: 11px;
  font-weight: 850;
}

.commerce-product-card__subtitle {
  display: -webkit-box;
  overflow: hidden;
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.commerce-product-card__price {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  color: var(--lian-primary-deep);
}

.commerce-product-card__price small {
  color: var(--lian-muted);
  font-size: 11px;
}

.commerce-product-card__price strong {
  font-size: 15px;
}

.commerce-product-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  color: var(--lian-muted);
  font-size: 11px;
}

@media (prefers-reduced-motion: reduce) {
  .commerce-product-card__link {
    scroll-behavior: auto;
  }
}
</style>
