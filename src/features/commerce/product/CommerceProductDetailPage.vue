<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import { buildCommerceCatalogHash, buildCommerceStoreHash } from "../../../app/commerce-route";
import * as brand from "../../../config/brand";
import type { CommerceProductSku } from "../../../types/commerce";
import { EmptyState, InlineError } from "../../../ui";
import { useCommerceProductRead } from "../useCommerceProductRead";
import { formatCommercePrice } from "./formatCommercePrice";

const props = defineProps<{ productId: string }>();
const reader = useCommerceProductRead();
const catalogHref = buildCommerceCatalogHash();

const backHref = computed(() =>
  reader.status.value === "ready" && reader.product.value
    ? buildCommerceStoreHash(reader.product.value.storeId)
    : catalogHref,
);
const productPrice = computed(() => {
  const product = reader.product.value;
  if (!product) return "";
  const minimum = formatCommercePrice(product.priceRange.minAmountMinor);
  const maximum = formatCommercePrice(product.priceRange.maxAmountMinor);
  return minimum === maximum ? minimum : `${minimum}–${maximum}`;
});
const errorCopy = computed(() => {
  if (reader.errorKind.value === "rate-limited") {
    return {
      title: brand.COMMERCE_PRODUCT_RATE_LIMIT_TITLE,
      hint: brand.COMMERCE_PRODUCT_RATE_LIMIT_HINT,
    };
  }
  if (reader.errorKind.value === "timeout") {
    return {
      title: brand.COMMERCE_PRODUCT_TIMEOUT_TITLE,
      hint: brand.COMMERCE_PRODUCT_TIMEOUT_HINT,
    };
  }
  return { title: brand.COMMERCE_PRODUCT_ERROR_TITLE, hint: brand.COMMERCE_PRODUCT_ERROR_HINT };
});

function displayRating(value: string) {
  return value === "0" ? brand.COMMERCE_RATING_EMPTY : value;
}

function skuName(sku: CommerceProductSku) {
  return sku.name || brand.COMMERCE_PRODUCT_SKU_NAME_FALLBACK;
}

function skuAvailability(sku: CommerceProductSku) {
  return sku.availability === "available"
    ? brand.COMMERCE_PRODUCT_SKU_AVAILABLE
    : brand.COMMERCE_PRODUCT_SKU_UNAVAILABLE;
}

watch(
  () => props.productId,
  (productId) => {
    void reader.loadTarget({ name: "product", productId });
  },
  { immediate: true },
);

onBeforeUnmount(reader.dispose);
</script>

<template>
  <div class="commerce-product-detail" data-testid="commerce-product-detail-page">
    <a class="commerce-product-detail__back" :href="backHref">
      {{ reader.product.value ? brand.COMMERCE_BACK_TO_STORE : brand.COMMERCE_BACK_TO_CATALOG }}
    </a>

    <EmptyState
      v-if="reader.status.value === 'closed'"
      class="commerce-product-detail__state"
      :title="brand.COMMERCE_PRODUCT_CLOSED_TITLE"
      :description="brand.COMMERCE_PRODUCT_CLOSED_HINT"
      data-testid="commerce-product-closed"
    />

    <EmptyState
      v-else-if="reader.status.value === 'loading'"
      class="commerce-product-detail__state"
      :description="brand.COMMERCE_PRODUCT_LOADING"
      data-testid="commerce-product-loading"
    />

    <EmptyState
      v-else-if="reader.status.value === 'not-found' || reader.status.value === 'empty'"
      class="commerce-product-detail__state"
      :title="brand.COMMERCE_PRODUCT_NOT_FOUND_TITLE"
      :description="brand.COMMERCE_PRODUCT_NOT_FOUND_HINT"
      data-testid="commerce-product-not-found"
    />

    <InlineError
      v-else-if="reader.status.value === 'error'"
      class="commerce-product-detail__error"
      :action-label="brand.COMMERCE_RETRY"
      data-testid="commerce-product-error"
      @action="reader.retry"
    >
      <strong>{{ errorCopy.title }}</strong>
      <span>{{ errorCopy.hint }}</span>
    </InlineError>

    <article
      v-else-if="reader.status.value === 'ready' && reader.product.value"
      class="commerce-product-detail__card"
    >
      <header class="commerce-product-detail__hero">
        <span
          class="commerce-product-detail__cover"
          aria-hidden="true"
          data-testid="commerce-product-cover-placeholder"
        >
          {{ brand.COMMERCE_PRODUCT_COVER_PLACEHOLDER }}
        </span>
        <span class="commerce-product-detail__heading">
          <span class="commerce-product-detail__title-row">
            <h1>{{ reader.product.value.name }}</h1>
            <span v-if="reader.product.value.recommended" class="commerce-product-detail__badge">
              {{ brand.COMMERCE_RECOMMENDED }}
            </span>
          </span>
          <span class="commerce-product-detail__price">
            {{ brand.COMMERCE_PRODUCT_PRICE_LABEL }} {{ productPrice }}
          </span>
        </span>
      </header>

      <p class="commerce-product-detail__subtitle">
        {{ reader.product.value.subtitle || brand.COMMERCE_PRODUCT_SUBTITLE_FALLBACK }}
      </p>

      <p class="commerce-product-detail__meta">
        <span>
          {{ brand.COMMERCE_PRODUCT_RATING_LABEL }} {{ displayRating(reader.product.value.rating) }}
        </span>
        <span>{{ brand.COMMERCE_SALES_LABEL }} {{ reader.product.value.salesCount }}</span>
      </p>

      <p class="commerce-product-detail__notice">{{ brand.COMMERCE_PRODUCT_DISCOVERY_NOTICE }}</p>

      <section
        class="commerce-product-detail__skus"
        :aria-label="brand.COMMERCE_PRODUCT_SKU_HEADING"
      >
        <h2>{{ brand.COMMERCE_PRODUCT_SKU_HEADING }}</h2>
        <ul>
          <li v-for="sku in reader.product.value.skus" :key="sku.id">
            <span class="commerce-product-detail__sku-copy">
              <strong>{{ skuName(sku) }}</strong>
              <small v-if="sku.default">{{ brand.COMMERCE_PRODUCT_SKU_DEFAULT }}</small>
            </span>
            <span class="commerce-product-detail__sku-status">
              <strong>{{ formatCommercePrice(sku.price.amountMinor) }}</strong>
              <small>{{ skuAvailability(sku) }}</small>
            </span>
          </li>
        </ul>
      </section>
    </article>
  </div>
</template>

<style scoped>
.commerce-product-detail {
  display: grid;
  gap: var(--space-3);
}
.commerce-product-detail__back {
  display: inline-flex;
  width: fit-content;
  min-height: 44px;
  align-items: center;
  color: var(--lian-primary);
  font-weight: 850;
  text-decoration: none;
}
.commerce-product-detail__card,
.commerce-product-detail__skus,
.commerce-product-detail__skus ul,
.commerce-product-detail__sku-copy,
.commerce-product-detail__sku-status {
  display: grid;
}
.commerce-product-detail__card {
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: rgba(255, 252, 247, 0.96);
}
.commerce-product-detail__hero {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}
.commerce-product-detail__cover {
  display: grid;
  flex: 0 0 88px;
  width: 88px;
  height: 92px;
  place-items: center;
  border-radius: var(--radius-card);
  background: linear-gradient(145deg, var(--lian-primary-soft), rgba(91, 184, 214, 0.18));
  color: var(--lian-primary-deep);
}
.commerce-product-detail__heading,
.commerce-product-detail__title-row {
  min-width: 0;
}
.commerce-product-detail__heading {
  display: grid;
  gap: var(--space-2);
}
.commerce-product-detail__title-row {
  display: flex;
  gap: var(--space-2);
}
.commerce-product-detail__title-row h1 {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--lian-ink);
  font-size: 21px;
  font-weight: 950;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.commerce-product-detail__badge {
  flex: none;
  padding: 2px var(--space-2);
  border-radius: var(--radius-chip);
  background: rgba(255, 159, 67, 0.14);
  color: #8a4a00;
}
.commerce-product-detail__subtitle,
.commerce-product-detail__meta,
.commerce-product-detail__notice {
  margin: 0;
}
.commerce-product-detail__subtitle {
  color: var(--lian-muted);
  line-height: 1.65;
}
.commerce-product-detail__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  color: var(--lian-muted);
  font-size: 12px;
}
.commerce-product-detail__notice {
  padding: var(--space-3);
  border-radius: 14px;
  background: rgba(31, 167, 160, 0.07);
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.65;
}
.commerce-product-detail__skus {
  gap: var(--space-2);
}
.commerce-product-detail__skus h2 {
  margin: 0;
  font-size: 16px;
}
.commerce-product-detail__skus ul {
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.commerce-product-detail__skus li {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: 12px;
}
.commerce-product-detail__sku-copy,
.commerce-product-detail__sku-status {
  gap: 2px;
}
.commerce-product-detail__sku-copy small,
.commerce-product-detail__sku-status small {
  color: var(--lian-muted);
}
.commerce-product-detail__sku-status {
  flex: none;
  justify-items: end;
}
</style>
