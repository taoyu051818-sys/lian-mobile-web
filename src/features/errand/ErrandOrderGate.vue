<script setup lang="ts">
/**
 * Errand order gate (issue #647).
 *
 * Renders a single blocking state with a CTA appropriate to the reason
 * code. Reuses the same visual language as the merchant gate so the user
 * recognises this as part of the same flow. The view (ErrandOrderView)
 * picks which gate emits to wire up — login / verification / wallet.
 */
import { computed } from "vue";
import {
  ERRAND_ORDER_GATE_INSUFFICIENT_BALANCE_CTA,
  ERRAND_ORDER_GATE_NOT_LOGGED_IN_CTA,
  ERRAND_ORDER_GATE_NOT_VERIFIED_CTA,
  ERRAND_ORDER_RETRY,
  ERRAND_ORDER_SECTION_LABEL,
} from "../../config/brand";
import type { ErrandOrderGate } from "../../types/errand";
import { gateReasonText } from "./errand-format";

const props = defineProps<{
  gate: ErrandOrderGate;
}>();

const emit = defineEmits<{
  goLogin: [];
  goVerify: [];
  goWallet: [];
  retry: [];
}>();

const reasonText = computed(() => gateReasonText(props.gate));

const ctaLabel = computed(() => {
  switch (props.gate.reason) {
    case "not_logged_in":
      return ERRAND_ORDER_GATE_NOT_LOGGED_IN_CTA;
    case "not_verified":
      return ERRAND_ORDER_GATE_NOT_VERIFIED_CTA;
    case "insufficient_balance":
      return ERRAND_ORDER_GATE_INSUFFICIENT_BALANCE_CTA;
    default:
      return ERRAND_ORDER_RETRY;
  }
});

function handleClick() {
  switch (props.gate.reason) {
    case "not_logged_in":
      emit("goLogin");
      return;
    case "not_verified":
      emit("goVerify");
      return;
    case "insufficient_balance":
      emit("goWallet");
      return;
    default:
      emit("retry");
  }
}
</script>

<template>
  <section
    class="errand-order-gate"
    :aria-label="ERRAND_ORDER_SECTION_LABEL"
    data-testid="errand-order-gate"
    :data-reason="props.gate.reason || 'unknown'"
  >
    <p class="errand-order-gate__reason" data-testid="errand-order-gate-reason">
      {{ reasonText }}
    </p>
    <button
      type="button"
      class="errand-order-gate__cta"
      data-testid="errand-order-gate-cta"
      @click="handleClick"
    >
      {{ ctaLabel }}
    </button>
  </section>
</template>

<style scoped>
.errand-order-gate {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
}

.errand-order-gate__reason {
  margin: 0;
  color: var(--lian-ink);
  font-size: 14px;
  line-height: 1.5;
}

.errand-order-gate__cta {
  justify-self: start;
  appearance: none;
  border: 0;
  border-radius: var(--radius-chip, 999px);
  background: rgba(31, 167, 160, 0.92);
  color: #fff;
  font-weight: 800;
  height: 40px;
  padding: 0 var(--space-3);
}

.errand-order-gate__cta:hover {
  filter: brightness(1.04);
}
</style>
