<script setup lang="ts">
/**
 * Merchant publish controls (PRD V0.1 §10).
 *
 * Renders the merchant-specific form fields and the verification gate. When
 * `merchantVerified=false` the form is replaced by a gate panel that links to
 * the verification center; the parent never has to branch on the gate state.
 *
 * Stays passive: state lives in `useMerchantPublishDraft`, navigation is
 * forwarded as `goVerify`. No fetch / no submit logic here.
 */
import {
  PUBLISH_MERCHANT_CATEGORY_LABEL,
  PUBLISH_MERCHANT_CONTACT_LABEL,
  PUBLISH_MERCHANT_CONTACT_PLACEHOLDER,
  PUBLISH_MERCHANT_ERRAND_HINT,
  PUBLISH_MERCHANT_ERRAND_LABEL,
  PUBLISH_MERCHANT_FORM_LABEL,
  PUBLISH_MERCHANT_GATE_BLOCK,
  PUBLISH_MERCHANT_GATE_CTA,
  PUBLISH_MERCHANT_GATE_HINT,
  PUBLISH_MERCHANT_GATE_TITLE,
  PUBLISH_MERCHANT_HOURS_LABEL,
  PUBLISH_MERCHANT_HOURS_PLACEHOLDER,
  PUBLISH_MERCHANT_NAME_LABEL,
  PUBLISH_MERCHANT_NAME_PLACEHOLDER,
  MERCHANT_CATEGORY_FOOD,
  MERCHANT_CATEGORY_RETAIL,
  MERCHANT_CATEGORY_SERVICE,
} from "../../config/brand";
import type { MerchantCategory } from "../../types/post-extensions";
import PublishGateNotice from "./PublishGateNotice.vue";

defineProps<{
  merchantVerified: boolean;
  verificationLoaded: boolean;
  name: string;
  category: MerchantCategory;
  hours: string;
  contact: string;
  errandSupported: boolean;
}>();

const emit = defineEmits<{
  "update:name": [value: string];
  "update:category": [value: MerchantCategory];
  "update:hours": [value: string];
  "update:contact": [value: string];
  "update:errandSupported": [value: boolean];
  goVerify: [];
}>();

const CATEGORY_OPTIONS: Array<{ value: MerchantCategory; label: string }> = [
  { value: "food", label: MERCHANT_CATEGORY_FOOD },
  { value: "service", label: MERCHANT_CATEGORY_SERVICE },
  { value: "retail", label: MERCHANT_CATEGORY_RETAIL },
];
</script>

<template>
  <PublishGateNotice
    v-if="!merchantVerified"
    data-testid="publish-merchant-gate"
    :title="PUBLISH_MERCHANT_GATE_TITLE"
    :cta-label="PUBLISH_MERCHANT_GATE_CTA"
    :default-open="false"
    @cta="emit('goVerify')"
  >
    <p>{{ PUBLISH_MERCHANT_GATE_HINT }}</p>
    <p v-if="verificationLoaded" class="publish-gate-notice__block">
      {{ PUBLISH_MERCHANT_GATE_BLOCK }}
    </p>
  </PublishGateNotice>

  <section
    v-else
    class="publish-merchant__form"
    :aria-label="PUBLISH_MERCHANT_FORM_LABEL"
    data-testid="publish-merchant-form"
  >
    <div class="publish-merchant__panel-header">
      <strong>{{ PUBLISH_MERCHANT_FORM_LABEL }}</strong>
    </div>

    <label class="publish-merchant__field">
      <span>{{ PUBLISH_MERCHANT_NAME_LABEL }}</span>
      <input
        :value="name"
        :placeholder="PUBLISH_MERCHANT_NAME_PLACEHOLDER"
        maxlength="60"
        data-testid="publish-merchant-name"
        @input="emit('update:name', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="publish-merchant__field">
      <span>{{ PUBLISH_MERCHANT_CATEGORY_LABEL }}</span>
      <select
        :value="category"
        data-testid="publish-merchant-category"
        @change="
          emit('update:category', ($event.target as HTMLSelectElement).value as MerchantCategory)
        "
      >
        <option v-for="option in CATEGORY_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>

    <label class="publish-merchant__field">
      <span>{{ PUBLISH_MERCHANT_HOURS_LABEL }}</span>
      <input
        :value="hours"
        :placeholder="PUBLISH_MERCHANT_HOURS_PLACEHOLDER"
        maxlength="80"
        @input="emit('update:hours', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="publish-merchant__field">
      <span>{{ PUBLISH_MERCHANT_CONTACT_LABEL }}</span>
      <input
        :value="contact"
        :placeholder="PUBLISH_MERCHANT_CONTACT_PLACEHOLDER"
        maxlength="80"
        @input="emit('update:contact', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="publish-merchant__field publish-merchant__field--inline">
      <span>{{ PUBLISH_MERCHANT_ERRAND_LABEL }}</span>
      <span class="publish-merchant__inline-row">
        <input
          type="checkbox"
          :checked="errandSupported"
          data-testid="publish-merchant-errand-toggle"
          @change="emit('update:errandSupported', ($event.target as HTMLInputElement).checked)"
        />
        <small>{{ PUBLISH_MERCHANT_ERRAND_HINT }}</small>
      </span>
    </label>
  </section>
</template>

<style scoped>
.publish-merchant__form {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: calc(var(--radius-card) + 2px);
  background: rgba(255, 255, 255, 0.56);
}

.publish-merchant__panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Gate styling lives in PublishGateNotice.vue. */

.publish-merchant__field {
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

.publish-merchant__field input,
.publish-merchant__field select {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  border: 0;
  border-radius: var(--radius-3);
  background: transparent;
  color: var(--lian-ink);
  font: inherit;
}

.publish-merchant__field span {
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.publish-merchant__inline-row {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: var(--space-2);
  align-items: center;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 700;
}

.publish-merchant__inline-row input {
  width: 22px;
  min-height: 22px;
  height: 22px;
  margin: 0;
}

.publish-merchant__inline-row small {
  display: block;
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 700;
}
</style>
