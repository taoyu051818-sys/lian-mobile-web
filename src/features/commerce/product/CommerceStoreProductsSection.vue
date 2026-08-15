<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import {
  COMMERCE_PRODUCT_CLOSED_HINT,
  COMMERCE_PRODUCT_CLOSED_TITLE,
  COMMERCE_PRODUCT_DISCOVERY_NOTICE,
  COMMERCE_PRODUCT_EMPTY_HINT,
  COMMERCE_PRODUCT_EMPTY_TITLE,
  COMMERCE_PRODUCT_ERROR_HINT,
  COMMERCE_PRODUCT_ERROR_TITLE,
  COMMERCE_PRODUCT_LOADING,
  COMMERCE_PRODUCT_NOT_FOUND_HINT,
  COMMERCE_PRODUCT_NOT_FOUND_TITLE,
  COMMERCE_PRODUCT_PARTIAL_NOTICE,
  COMMERCE_PRODUCT_RATE_LIMIT_HINT,
  COMMERCE_PRODUCT_RATE_LIMIT_TITLE,
  COMMERCE_PRODUCT_TIMEOUT_HINT,
  COMMERCE_PRODUCT_TIMEOUT_TITLE,
  COMMERCE_PRODUCTS_HEADING,
  COMMERCE_RETRY,
} from "../../../config/brand";
import { EmptyState, InlineError } from "../../../ui";
import { useCommerceProductRead } from "../useCommerceProductRead";
import CommerceProductCard from "./CommerceProductCard.vue";

const props = defineProps<{ storeId: string }>();
const reader = useCommerceProductRead();

const errorCopy = computed(() => {
  if (reader.errorKind.value === "rate-limited") {
    return { title: COMMERCE_PRODUCT_RATE_LIMIT_TITLE, hint: COMMERCE_PRODUCT_RATE_LIMIT_HINT };
  }
  if (reader.errorKind.value === "timeout") {
    return { title: COMMERCE_PRODUCT_TIMEOUT_TITLE, hint: COMMERCE_PRODUCT_TIMEOUT_HINT };
  }
  return { title: COMMERCE_PRODUCT_ERROR_TITLE, hint: COMMERCE_PRODUCT_ERROR_HINT };
});

const isPartial = computed(() => reader.page.value?.hasMore === true);

watch(
  () => props.storeId,
  (storeId) => {
    void reader.loadTarget({ name: "store-products", storeId });
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  reader.dispose();
});
</script>

<template>
  <section class="commerce-products-section" data-testid="commerce-products-section">
    <h2>{{ COMMERCE_PRODUCTS_HEADING }}</h2>

    <p
      v-if="reader.status.value === 'ready' || reader.status.value === 'empty'"
      class="commerce-products-section__notice"
      data-testid="commerce-product-discovery-notice"
    >
      {{ COMMERCE_PRODUCT_DISCOVERY_NOTICE }}
    </p>

    <EmptyState
      v-if="reader.status.value === 'closed'"
      class="commerce-products-section__state"
      :title="COMMERCE_PRODUCT_CLOSED_TITLE"
      :description="COMMERCE_PRODUCT_CLOSED_HINT"
      data-testid="commerce-product-closed"
    />

    <EmptyState
      v-else-if="reader.status.value === 'loading'"
      class="commerce-products-section__state"
      :description="COMMERCE_PRODUCT_LOADING"
      data-testid="commerce-product-loading"
    />

    <EmptyState
      v-else-if="reader.status.value === 'not-found'"
      class="commerce-products-section__state"
      :title="COMMERCE_PRODUCT_NOT_FOUND_TITLE"
      :description="COMMERCE_PRODUCT_NOT_FOUND_HINT"
      data-testid="commerce-product-not-found"
    />

    <EmptyState
      v-else-if="reader.status.value === 'empty'"
      class="commerce-products-section__state"
      :title="COMMERCE_PRODUCT_EMPTY_TITLE"
      :description="COMMERCE_PRODUCT_EMPTY_HINT"
      data-testid="commerce-product-empty"
    />

    <InlineError
      v-else-if="reader.status.value === 'error'"
      class="commerce-products-section__error"
      :action-label="COMMERCE_RETRY"
      data-testid="commerce-product-error"
      @action="reader.retry"
    >
      <strong>{{ errorCopy.title }}</strong>
      <span>{{ errorCopy.hint }}</span>
    </InlineError>

    <ul v-else-if="reader.status.value === 'ready'" class="commerce-products-section__list">
      <li v-for="product in reader.items.value" :key="product.id">
        <CommerceProductCard :product="product" />
      </li>
    </ul>

    <p
      v-if="isPartial"
      class="commerce-products-section__partial"
      data-testid="commerce-product-partial"
    >
      {{ COMMERCE_PRODUCT_PARTIAL_NOTICE }}
    </p>
  </section>
</template>

<style scoped>
.commerce-products-section {
  display: grid;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

.commerce-products-section h2 {
  margin: 0;
  color: var(--lian-ink);
  font-size: 18px;
  font-weight: 950;
}

.commerce-products-section__state {
  min-height: 132px;
}

.commerce-products-section__error :deep(.inline-error__message) {
  display: grid;
  gap: var(--space-1);
}

.commerce-products-section__error strong,
.commerce-products-section__error span {
  display: block;
}

.commerce-products-section__list {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.commerce-products-section__partial {
  margin: 0;
  padding: var(--space-3);
  border: 1px solid rgba(31, 167, 160, 0.16);
  border-radius: var(--radius-card);
  background: rgba(31, 167, 160, 0.06);
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.6;
}

.commerce-products-section__notice {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.6;
}
</style>
