<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { buildCommerceCartHash } from "../../../app/commerce-route";
import * as brand from "../../../config/brand";
import type { CommerceProductSku } from "../../../types/commerce";
import { useCommerceCart } from "../useCommerceCart";
import { formatCommercePrice } from "./formatCommercePrice";

const props = defineProps<{ skus: readonly CommerceProductSku[] }>();
const cart = useCommerceCart();
const cartHref = buildCommerceCartHash();
const selectedSkuId = ref("");
const addSucceeded = computed(
  () =>
    cart.status.value === "ready" &&
    cart.items.value.some(
      (item) =>
        item.skuId === selectedSkuId.value &&
        item.quantity === 1 &&
        item.availability === "available",
    ),
);

function skuName(sku: CommerceProductSku) {
  return sku.name || brand.COMMERCE_PRODUCT_SKU_NAME_FALLBACK;
}

function skuAvailability(sku: CommerceProductSku) {
  return sku.availability === "available"
    ? brand.COMMERCE_PRODUCT_SKU_AVAILABLE
    : brand.COMMERCE_PRODUCT_SKU_UNAVAILABLE;
}

function addSelectedSku() {
  if (!selectedSkuId.value) return;
  void cart.setQuantity(selectedSkuId.value, 1);
}

watch(
  () => props.skus,
  (skus) => {
    cart.dispose();
    const selected =
      skus.find((sku) => sku.default && sku.availability === "available") ??
      skus.find((sku) => sku.availability === "available");
    selectedSkuId.value = selected?.id ?? "";
  },
  { immediate: true },
);

onBeforeUnmount(cart.dispose);
</script>

<template>
  <section class="commerce-product-cart-controls">
    <fieldset>
      <legend>{{ brand.COMMERCE_PRODUCT_SKU_HEADING }}</legend>
      <label v-for="sku in skus" :key="sku.id">
        <input
          v-model="selectedSkuId"
          type="radio"
          name="commerce-product-cart-sku"
          :value="sku.id"
          :disabled="sku.availability === 'unavailable'"
        />
        <span class="commerce-product-cart-controls__copy">
          <strong>{{ skuName(sku) }}</strong>
          <small v-if="sku.default">{{ brand.COMMERCE_PRODUCT_SKU_DEFAULT }}</small>
        </span>
        <span class="commerce-product-cart-controls__status">
          <strong>{{ formatCommercePrice(sku.price.amountMinor) }}</strong>
          <small>{{ skuAvailability(sku) }}</small>
        </span>
      </label>
    </fieldset>
    <span class="commerce-product-cart-controls__actions">
      <button
        type="button"
        :disabled="!selectedSkuId || cart.status.value === 'loading'"
        data-testid="commerce-add-to-cart"
        @click="addSelectedSku"
      >
        {{
          cart.status.value === "loading"
            ? brand.COMMERCE_PRODUCT_ADDING_TO_CART
            : brand.COMMERCE_PRODUCT_ADD_TO_CART
        }}
      </button>
      <a :href="cartHref">{{ brand.COMMERCE_CART_OPEN }}</a>
    </span>
    <p v-if="addSucceeded" role="status" data-testid="commerce-add-success">
      {{ brand.COMMERCE_PRODUCT_ADDED_TO_CART }}
    </p>
    <p v-else-if="cart.status.value === 'login-required'" role="alert">
      {{ brand.COMMERCE_CART_LOGIN_HINT }}
      <a href="#/profile">{{ brand.COMMERCE_CART_LOGIN_CTA }}</a>
    </p>
    <p v-else-if="cart.status.value === 'item-unavailable'" role="alert">
      {{ brand.COMMERCE_CART_ITEM_UNAVAILABLE_HINT }}
    </p>
    <p v-else-if="cart.status.value === 'error'" role="alert">
      {{ brand.COMMERCE_CART_ERROR_HINT }}
    </p>
  </section>
</template>

<style scoped>
.commerce-product-cart-controls,
.commerce-product-cart-controls fieldset {
  display: grid;
  gap: var(--space-3);
}
.commerce-product-cart-controls fieldset {
  margin: 0;
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
}
.commerce-product-cart-controls label,
.commerce-product-cart-controls__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}
.commerce-product-cart-controls label {
  min-height: 52px;
  padding: var(--space-2);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-chip);
}
.commerce-product-cart-controls__copy,
.commerce-product-cart-controls__status {
  display: grid;
  gap: 2px;
}
.commerce-product-cart-controls__status {
  margin-inline-start: auto;
  justify-items: end;
}
.commerce-product-cart-controls small {
  color: var(--lian-muted);
}
.commerce-product-cart-controls__actions button,
.commerce-product-cart-controls__actions a {
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--lian-primary);
  border-radius: var(--radius-chip);
  background: var(--lian-primary);
  color: var(--lian-surface);
  font: inherit;
  font-weight: 850;
  text-decoration: none;
}
.commerce-product-cart-controls p {
  margin: 0;
  color: var(--lian-muted);
}
</style>
