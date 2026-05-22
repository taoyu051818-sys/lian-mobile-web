<script setup lang="ts">
/**
 * Trade publish controls (PRD V0.1 §11).
 *
 * Renders the trade-specific form fields and the campus_verified gate. When
 * `campusVerified=false` the form is replaced by a gate panel that links to
 * the verification center; the parent never has to branch on the gate state.
 *
 * Stays passive: state lives in `useTradePublishDraft`, navigation is
 * forwarded as `goVerify`. No fetch / no submit logic here.
 */
import {
  PUBLISH_TRADE_CATEGORY_LABEL,
  PUBLISH_TRADE_CATEGORY_PLACEHOLDER,
  PUBLISH_TRADE_FORM_LABEL,
  PUBLISH_TRADE_GATE_BLOCK,
  PUBLISH_TRADE_GATE_CTA,
  PUBLISH_TRADE_GATE_HINT,
  PUBLISH_TRADE_GATE_TITLE,
  PUBLISH_TRADE_PRICE_LABEL,
  PUBLISH_TRADE_PRICE_PLACEHOLDER,
  PUBLISH_TRADE_STATE_LABEL,
  TRADE_RISK_HINT,
  TRADE_STATE_AVAILABLE,
  TRADE_STATE_CANCELLED,
  TRADE_STATE_RESERVED,
  TRADE_STATE_SOLD,
} from "../../config/brand";
import type { TradeState } from "../../types/post-extensions";
import PublishGateNotice from "./PublishGateNotice.vue";
import PublishMessage from "./PublishMessage.vue";

defineProps<{
  campusVerified: boolean;
  verificationLoaded: boolean;
  price: string;
  state: TradeState;
  category: string;
}>();

const emit = defineEmits<{
  "update:price": [value: string];
  "update:state": [value: TradeState];
  "update:category": [value: string];
  goVerify: [];
}>();

const STATE_OPTIONS: Array<{ value: TradeState; label: string }> = [
  { value: "available", label: TRADE_STATE_AVAILABLE },
  { value: "reserved", label: TRADE_STATE_RESERVED },
  { value: "sold", label: TRADE_STATE_SOLD },
  { value: "cancelled", label: TRADE_STATE_CANCELLED },
];
</script>

<template>
  <PublishGateNotice
    v-if="!campusVerified"
    data-testid="publish-trade-gate"
    :title="PUBLISH_TRADE_GATE_TITLE"
    :cta-label="PUBLISH_TRADE_GATE_CTA"
    @cta="emit('goVerify')"
  >
    <p>{{ PUBLISH_TRADE_GATE_HINT }}</p>
    <p v-if="verificationLoaded" class="publish-gate-notice__block">
      {{ PUBLISH_TRADE_GATE_BLOCK }}
    </p>
  </PublishGateNotice>

  <section
    v-else
    class="publish-trade__form"
    :aria-label="PUBLISH_TRADE_FORM_LABEL"
    data-testid="publish-trade-form"
  >
    <div class="publish-trade__panel-header">
      <strong>{{ PUBLISH_TRADE_FORM_LABEL }}</strong>
    </div>

    <PublishMessage variant="warning" data-testid="publish-trade-risk">
      {{ TRADE_RISK_HINT }}
    </PublishMessage>

    <label class="publish-trade__field">
      <span>{{ PUBLISH_TRADE_PRICE_LABEL }}</span>
      <input
        :value="price"
        :placeholder="PUBLISH_TRADE_PRICE_PLACEHOLDER"
        maxlength="30"
        data-testid="publish-trade-price"
        @input="emit('update:price', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="publish-trade__field">
      <span>{{ PUBLISH_TRADE_STATE_LABEL }}</span>
      <select
        :value="state"
        data-testid="publish-trade-state"
        @change="emit('update:state', ($event.target as HTMLSelectElement).value as TradeState)"
      >
        <option v-for="option in STATE_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>

    <label class="publish-trade__field">
      <span>{{ PUBLISH_TRADE_CATEGORY_LABEL }}</span>
      <input
        :value="category"
        :placeholder="PUBLISH_TRADE_CATEGORY_PLACEHOLDER"
        maxlength="30"
        data-testid="publish-trade-category"
        @input="emit('update:category', ($event.target as HTMLInputElement).value)"
      />
    </label>
  </section>
</template>

<style scoped>
.publish-trade__form {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: calc(var(--radius-card) + 2px);
  background: rgba(255, 255, 255, 0.56);
}

.publish-trade__panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Risk-hint container styling lives in PublishMessage.vue (variant=warning).
 * Gate styling lives in PublishGateNotice.vue.
 */

.publish-trade__field {
  display: grid;
  gap: 6px;
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 800;
}

.publish-trade__field input,
.publish-trade__field select {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  border: 0;
  border-radius: var(--radius-3);
  background: transparent;
  color: var(--lian-ink);
  font: inherit;
}

.publish-trade__field span {
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
</style>
