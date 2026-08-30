<script setup lang="ts">
import { computed, onBeforeUnmount } from "vue";
import * as brand from "../../../config/brand";
import type { CommerceCartItem } from "../../../types/commerce";
import { useCommerceCheckoutQuote } from "../useCommerceCheckoutQuote";
import { formatCommercePrice } from "../product/formatCommercePrice";

const props = defineProps<{
  items: readonly CommerceCartItem[];
  cartReady: boolean;
}>();
const quote = useCommerceCheckoutQuote();
const canQuote = computed(
  () =>
    props.cartReady &&
    props.items.length > 0 &&
    props.items.every((item) => item.availability === "available") &&
    quote.status.value !== "loading",
);

onBeforeUnmount(quote.dispose);
</script>

<template>
  <section class="commerce-quote">
    <button
      type="button"
      :disabled="!canQuote"
      data-testid="commerce-checkout-quote-create"
      @click="quote.create"
    >
      {{
        quote.status.value === "loading"
          ? brand.COMMERCE_QUOTE_LOADING
          : brand.COMMERCE_QUOTE_ACTION
      }}
    </button>
    <div
      v-if="quote.status.value === 'ready' && quote.result.value"
      data-testid="commerce-checkout-quote-result"
    >
      <strong>
        {{ brand.COMMERCE_QUOTE_HEADING }}：{{
          formatCommercePrice(quote.result.value.quote.merchandiseAmountMinor)
        }}
      </strong>
      <small>{{ brand.COMMERCE_QUOTE_NOTICE }}</small>
    </div>
    <small v-else-if="quote.status.value === 'cart-invalid'">
      {{ brand.COMMERCE_QUOTE_CART_INVALID }}
    </small>
    <small v-else-if="quote.status.value === 'error'">
      {{ brand.COMMERCE_QUOTE_ERROR }}
    </small>
  </section>
</template>

<style scoped>
.commerce-quote {
  display: grid;
  gap: var(--space-2);
  justify-items: end;
  padding-top: var(--space-3);
  border-top: 1px solid var(--lian-line);
}
.commerce-quote div {
  display: grid;
  gap: var(--space-1);
  text-align: right;
}
.commerce-quote small {
  color: var(--lian-muted);
}
.commerce-quote button {
  min-height: 44px;
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-chip);
  background: var(--lian-primary);
  color: white;
  font: inherit;
  font-weight: 850;
}
.commerce-quote button:disabled {
  opacity: 0.55;
}
</style>
