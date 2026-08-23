<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { buildCommerceCatalogHash } from "../../../app/commerce-route";
import * as brand from "../../../config/brand";
import type { CommerceCartItem } from "../../../types/commerce";
import { EmptyState, InlineError } from "../../../ui";
import { useCommerceCart } from "../useCommerceCart";
import { formatCommercePrice } from "../product/formatCommercePrice";

const cart = useCommerceCart();
const catalogHref = buildCommerceCatalogHash();
const quantityPending = computed(
  () => cart.status.value === "loading" && cart.activeTarget.value?.name !== "read",
);
const errorTitle = computed(() => {
  if (cart.status.value === "item-unavailable") {
    return brand.COMMERCE_CART_ITEM_UNAVAILABLE_TITLE;
  }
  if (cart.errorKind.value === "limit") return brand.COMMERCE_CART_LIMIT_TITLE;
  if (cart.errorKind.value === "conflict") return brand.COMMERCE_CART_CONFLICT_TITLE;
  return brand.COMMERCE_CART_ERROR_TITLE;
});
const errorHint = computed(() =>
  cart.status.value === "item-unavailable"
    ? brand.COMMERCE_CART_ITEM_UNAVAILABLE_HINT
    : brand.COMMERCE_CART_ERROR_HINT,
);

function itemName(item: CommerceCartItem) {
  return item.productName ?? brand.COMMERCE_CART_NAME_FALLBACK;
}

function skuName(item: CommerceCartItem) {
  return item.skuName ?? brand.COMMERCE_CART_SKU_FALLBACK;
}

function price(item: CommerceCartItem) {
  return item.referenceUnitPrice
    ? formatCommercePrice(item.referenceUnitPrice.amountMinor)
    : brand.COMMERCE_CART_UNAVAILABLE;
}

onMounted(() => void cart.read());
onBeforeUnmount(cart.dispose);
</script>

<template>
  <div class="commerce-cart" data-testid="commerce-cart-page">
    <header class="commerce-cart__header">
      <a :href="catalogHref">{{ brand.COMMERCE_CART_BACK }}</a>
      <h1>{{ brand.COMMERCE_CART_HEADING }}</h1>
    </header>

    <EmptyState
      v-if="cart.status.value === 'closed'"
      :title="brand.COMMERCE_CLOSED_TITLE"
      :description="brand.COMMERCE_CLOSED_HINT"
      data-testid="commerce-cart-closed"
    />
    <EmptyState
      v-else-if="cart.status.value === 'loading' && cart.items.value.length === 0"
      :description="brand.COMMERCE_CART_LOADING"
      data-testid="commerce-cart-loading"
    />
    <EmptyState
      v-else-if="cart.status.value === 'empty'"
      :title="brand.COMMERCE_CART_EMPTY_TITLE"
      :description="brand.COMMERCE_CART_EMPTY_HINT"
      data-testid="commerce-cart-empty"
    />
    <EmptyState
      v-else-if="cart.status.value === 'login-required'"
      :title="brand.COMMERCE_CART_LOGIN_TITLE"
      :description="brand.COMMERCE_CART_LOGIN_HINT"
      data-testid="commerce-cart-login"
    >
      <template #action>
        <a href="#/profile">{{ brand.COMMERCE_CART_LOGIN_CTA }}</a>
      </template>
    </EmptyState>

    <InlineError
      v-if="cart.status.value === 'error' || cart.status.value === 'item-unavailable'"
      :action-label="brand.COMMERCE_CART_RETRY"
      data-testid="commerce-cart-error"
      @action="cart.retry"
    >
      <strong>{{ errorTitle }}</strong>
      <span>{{ errorHint }}</span>
    </InlineError>

    <ul
      v-if="cart.items.value.length > 0"
      class="commerce-cart__items"
      aria-live="polite"
      data-testid="commerce-cart-items"
    >
      <li
        v-for="item in cart.items.value"
        :key="item.skuId"
        class="commerce-cart__item"
        :data-testid="`commerce-cart-item-${item.skuId}`"
      >
        <span class="commerce-cart__copy">
          <strong>{{ itemName(item) }}</strong>
          <small>{{ skuName(item) }}</small>
          <small> {{ brand.COMMERCE_CART_REFERENCE_PRICE }} {{ price(item) }} </small>
          <small v-if="item.availability === 'unavailable'">
            {{ brand.COMMERCE_CART_UNAVAILABLE }}
          </small>
        </span>
        <span class="commerce-cart__actions">
          <span>{{ brand.COMMERCE_CART_QUANTITY }} {{ item.quantity }}</span>
          <button
            v-if="item.availability === 'unavailable' && item.quantity > 99"
            type="button"
            :disabled="quantityPending"
            data-testid="commerce-cart-normalize-quantity"
            @click="cart.setQuantity(item.skuId, 99)"
          >
            {{ brand.COMMERCE_CART_NORMALIZE_QUANTITY }}
          </button>
          <button
            type="button"
            :aria-label="brand.COMMERCE_CART_DECREASE"
            :disabled="quantityPending || item.availability === 'unavailable' || item.quantity <= 1"
            @click="cart.setQuantity(item.skuId, item.quantity - 1)"
          >
            −
          </button>
          <button
            type="button"
            :aria-label="brand.COMMERCE_CART_INCREASE"
            :disabled="
              quantityPending || item.availability === 'unavailable' || item.quantity >= 99
            "
            @click="cart.setQuantity(item.skuId, item.quantity + 1)"
          >
            +
          </button>
          <button type="button" :disabled="quantityPending" @click="cart.deleteItem(item.skuId)">
            {{ brand.COMMERCE_CART_REMOVE }}
          </button>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.commerce-cart,
.commerce-cart__header,
.commerce-cart__items,
.commerce-cart__item,
.commerce-cart__copy {
  display: grid;
}
.commerce-cart,
.commerce-cart__header,
.commerce-cart__items,
.commerce-cart__copy {
  gap: var(--space-3);
}
.commerce-cart__header h1,
.commerce-cart__items {
  margin: 0;
  padding: 0;
}
.commerce-cart__header a {
  width: fit-content;
  color: var(--lian-primary);
  font-weight: 850;
  text-decoration: none;
}
.commerce-cart__items {
  list-style: none;
}
.commerce-cart__item {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-surface);
}
.commerce-cart__copy small {
  color: var(--lian-muted);
}
.commerce-cart__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: end;
}
.commerce-cart__actions button {
  min-width: 44px;
  min-height: 44px;
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-chip);
  background: var(--lian-surface);
  color: var(--lian-ink);
  font: inherit;
}
@media (max-width: 520px) {
  .commerce-cart__item {
    grid-template-columns: 1fr;
  }
  .commerce-cart__actions {
    justify-content: start;
  }
}
</style>
