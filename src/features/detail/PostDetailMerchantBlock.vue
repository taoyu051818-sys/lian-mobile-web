<script setup lang="ts">
/**
 * Merchant detail block (PRD V0.1 §10).
 *
 * Renders the merchant extension on the post detail panel: category pill,
 * verification stamp, hours/contact rows, and an errand CTA when the
 * publisher opted in. The CTA is informational-only here (PRD §12 errand UI
 * is a separate workstream); we surface intent without wiring it up so the
 * downstream errand entry has a known mounting point.
 */
import { computed } from "vue";
import {
  MERCHANT_BLOCK_LABEL,
  MERCHANT_CATEGORY_FOOD,
  MERCHANT_CATEGORY_LABEL,
  MERCHANT_CATEGORY_RETAIL,
  MERCHANT_CATEGORY_SERVICE,
  MERCHANT_CONTACT_LABEL,
  MERCHANT_CONTACT_UNSET,
  MERCHANT_ERRAND_AVAILABLE,
  MERCHANT_ERRAND_CTA,
  MERCHANT_ERRAND_HINT,
  MERCHANT_HOURS_LABEL,
  MERCHANT_HOURS_UNSET,
  MERCHANT_VERIFIED_AT_PREFIX,
  MERCHANT_VERIFIED_PREFIX,
} from "../../config/brand";
import type { MerchantCategory, MerchantPostExtension } from "../../types/post-extensions";

const props = defineProps<{
  merchant: MerchantPostExtension;
  errandEntryAvailable?: boolean;
}>();

const CATEGORY_LABEL: Record<MerchantCategory, string> = {
  food: MERCHANT_CATEGORY_FOOD,
  service: MERCHANT_CATEGORY_SERVICE,
  retail: MERCHANT_CATEGORY_RETAIL,
};

const categoryLabel = computed(() => CATEGORY_LABEL[props.merchant.category]);
const hoursLabel = computed(() => props.merchant.hours || MERCHANT_HOURS_UNSET);
const contactLabel = computed(() => props.merchant.contact || MERCHANT_CONTACT_UNSET);

const verifiedAtLabel = computed(() => {
  const raw = props.merchant.verifiedAt;
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${MERCHANT_VERIFIED_AT_PREFIX} ${yyyy}-${mm}-${dd}`;
});
</script>

<template>
  <section
    class="post-detail-merchant-block"
    :aria-label="MERCHANT_BLOCK_LABEL"
    data-testid="post-detail-merchant-block"
  >
    <header class="post-detail-merchant-block__header">
      <span class="post-detail-merchant-block__category" :data-category="merchant.category">
        {{ categoryLabel }}
      </span>
      <span class="post-detail-merchant-block__verified">
        {{ MERCHANT_VERIFIED_PREFIX }}
      </span>
      <span v-if="verifiedAtLabel" class="post-detail-merchant-block__verified-at">
        {{ verifiedAtLabel }}
      </span>
    </header>

    <h3 class="post-detail-merchant-block__name">{{ merchant.name }}</h3>

    <dl class="post-detail-merchant-block__meta">
      <div class="post-detail-merchant-block__row">
        <dt>{{ MERCHANT_CATEGORY_LABEL }}</dt>
        <dd>{{ categoryLabel }}</dd>
      </div>
      <div class="post-detail-merchant-block__row">
        <dt>{{ MERCHANT_HOURS_LABEL }}</dt>
        <dd>{{ hoursLabel }}</dd>
      </div>
      <div class="post-detail-merchant-block__row">
        <dt>{{ MERCHANT_CONTACT_LABEL }}</dt>
        <dd>{{ contactLabel }}</dd>
      </div>
    </dl>

    <div
      v-if="errandEntryAvailable"
      class="post-detail-merchant-block__errand"
      data-testid="post-detail-merchant-errand-entry"
    >
      <p class="post-detail-merchant-block__errand-line">{{ MERCHANT_ERRAND_AVAILABLE }}</p>
      <button
        type="button"
        class="post-detail-merchant-block__errand-cta"
        disabled
        aria-disabled="true"
      >
        {{ MERCHANT_ERRAND_CTA }}
      </button>
      <p class="post-detail-merchant-block__errand-hint">{{ MERCHANT_ERRAND_HINT }}</p>
    </div>
  </section>
</template>

<style scoped>
.post-detail-merchant-block {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-card, 12px);
  background: var(--lian-surface-2, rgba(255, 255, 255, 0.6));
}

.post-detail-merchant-block__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.post-detail-merchant-block__category {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--space-2);
  height: 24px;
  border-radius: var(--radius-chip, 999px);
  background: rgba(255, 167, 38, 0.16);
  color: #a05a00;
  font-weight: 700;
  font-size: 13px;
}

.post-detail-merchant-block__category[data-category="service"] {
  background: rgba(31, 167, 160, 0.14);
  color: #1a6f6c;
}

.post-detail-merchant-block__category[data-category="retail"] {
  background: rgba(120, 100, 200, 0.16);
  color: #5a4aa0;
}

.post-detail-merchant-block__verified {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--space-2);
  height: 24px;
  border-radius: var(--radius-chip, 999px);
  background: rgba(31, 167, 160, 0.18);
  color: #1a6f6c;
  font-weight: 700;
  font-size: 13px;
}

.post-detail-merchant-block__verified-at {
  color: var(--lian-muted);
  font-size: 13px;
}

.post-detail-merchant-block__name {
  margin: 0;
  color: var(--lian-ink);
  font-size: 16px;
  line-height: 1.4;
}

.post-detail-merchant-block__meta {
  display: grid;
  gap: var(--space-1);
  margin: 0;
}

.post-detail-merchant-block__row {
  display: grid;
  grid-template-columns: 5em 1fr;
  gap: var(--space-2);
}

.post-detail-merchant-block__row dt {
  color: var(--lian-muted);
  font-size: 13px;
}

.post-detail-merchant-block__row dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 14px;
}

.post-detail-merchant-block__errand {
  display: grid;
  gap: 4px;
  padding: var(--space-2) var(--space-3);
  border: 1px dashed rgba(31, 167, 160, 0.35);
  border-radius: var(--radius-card, 12px);
  background: rgba(31, 167, 160, 0.06);
}

.post-detail-merchant-block__errand-line {
  margin: 0;
  color: var(--lian-ink);
  font-weight: 700;
  font-size: 14px;
}

.post-detail-merchant-block__errand-cta {
  justify-self: start;
  appearance: none;
  border: 0;
  border-radius: var(--radius-chip, 999px);
  background: rgba(120, 120, 120, 0.32);
  color: rgba(255, 255, 255, 0.9);
  font-weight: 800;
  height: 36px;
  padding: 0 var(--space-3);
  cursor: not-allowed;
}

.post-detail-merchant-block__errand-hint {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
}
</style>
