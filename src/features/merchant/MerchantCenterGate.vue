<script setup lang="ts">
/**
 * Gate shown when the user reaches the merchant center without an active
 * `merchant_verified` grant. Routes the user to the verification center; the
 * view never inlines that workflow because verification is the canonical
 * entry point for ALL grant types.
 */
import {
  MERCHANT_CENTER_GATE_BLOCK,
  MERCHANT_CENTER_GATE_CTA,
  MERCHANT_CENTER_GATE_HINT,
  MERCHANT_CENTER_GATE_TITLE,
} from "../../config/brand";

defineProps<{
  block?: boolean;
}>();

const emit = defineEmits<{
  goVerify: [];
}>();
</script>

<template>
  <section
    class="merchant-center-gate"
    :aria-label="MERCHANT_CENTER_GATE_TITLE"
    data-testid="merchant-center-gate"
  >
    <strong>{{ MERCHANT_CENTER_GATE_TITLE }}</strong>
    <p>{{ MERCHANT_CENTER_GATE_HINT }}</p>
    <p v-if="block" class="merchant-center-gate__block">
      {{ MERCHANT_CENTER_GATE_BLOCK }}
    </p>
    <button
      type="button"
      class="merchant-center-gate__cta"
      data-testid="merchant-center-gate-cta"
      @click="emit('goVerify')"
    >
      {{ MERCHANT_CENTER_GATE_CTA }}
    </button>
  </section>
</template>

<style scoped>
.merchant-center-gate {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
}

.merchant-center-gate strong {
  font-size: 16px;
  font-weight: 900;
}

.merchant-center-gate p {
  margin: 0;
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.5;
}

.merchant-center-gate__block {
  color: #a14040;
  font-weight: 700;
}

.merchant-center-gate__cta {
  justify-self: start;
  appearance: none;
  border: 0;
  border-radius: var(--radius-chip, 999px);
  background: var(--lian-primary, #1fa7a0);
  color: white;
  font-weight: 800;
  height: 40px;
  padding: 0 var(--space-4);
  cursor: pointer;
}
</style>
