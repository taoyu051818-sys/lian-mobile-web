<script setup lang="ts">
/**
 * Trade detail block (PRD V0.1 §11).
 *
 * Renders the trade extension on the post detail panel: state badge, price,
 * category row, verified-campus stamp, and the §J7 risk hint with a contact
 * cue that points back to the existing reply dock (no DM in V0.1).
 */
import { computed } from "vue";
import {
  TRADE_BLOCK_LABEL,
  TRADE_CATEGORY_LABEL,
  TRADE_CATEGORY_UNSET,
  TRADE_CONTACT_CTA,
  TRADE_CONTACT_HINT,
  TRADE_PRICE_LABEL,
  TRADE_RISK_HINT,
  TRADE_STATE_AVAILABLE,
  TRADE_STATE_CANCELLED,
  TRADE_STATE_HIDDEN,
  TRADE_STATE_RESERVED,
  TRADE_STATE_SOLD,
  TRADE_VERIFIED_AT_PREFIX,
  TRADE_VERIFIED_PREFIX,
} from "../../config/brand";
import type { TradePostExtension, TradeState } from "../../types/post-extensions";

const props = defineProps<{
  trade: TradePostExtension;
}>();

const STATE_LABEL: Record<TradeState, string> = {
  available: TRADE_STATE_AVAILABLE,
  reserved: TRADE_STATE_RESERVED,
  sold: TRADE_STATE_SOLD,
  cancelled: TRADE_STATE_CANCELLED,
  hidden: TRADE_STATE_HIDDEN,
};

const stateLabel = computed(() => STATE_LABEL[props.trade.state]);
const categoryLabel = computed(() => props.trade.category || TRADE_CATEGORY_UNSET);

const verifiedAtLabel = computed(() => {
  const raw = props.trade.verifiedAt;
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${TRADE_VERIFIED_AT_PREFIX} ${yyyy}-${mm}-${dd}`;
});
</script>

<template>
  <section
    class="post-detail-trade-block"
    :aria-label="TRADE_BLOCK_LABEL"
    data-testid="post-detail-trade-block"
  >
    <header class="post-detail-trade-block__header">
      <span class="post-detail-trade-block__state" :data-state="trade.state">
        {{ stateLabel }}
      </span>
      <span class="post-detail-trade-block__verified">
        {{ TRADE_VERIFIED_PREFIX }}
      </span>
      <span v-if="verifiedAtLabel" class="post-detail-trade-block__verified-at">
        {{ verifiedAtLabel }}
      </span>
    </header>

    <p class="post-detail-trade-block__price" data-testid="post-detail-trade-price">
      {{ trade.price }}
    </p>

    <dl class="post-detail-trade-block__meta">
      <div class="post-detail-trade-block__row">
        <dt>{{ TRADE_PRICE_LABEL }}</dt>
        <dd>{{ trade.price }}</dd>
      </div>
      <div class="post-detail-trade-block__row">
        <dt>{{ TRADE_CATEGORY_LABEL }}</dt>
        <dd>{{ categoryLabel }}</dd>
      </div>
    </dl>

    <p class="post-detail-trade-block__risk" data-testid="post-detail-trade-risk">
      {{ TRADE_RISK_HINT }}
    </p>

    <div class="post-detail-trade-block__contact" data-testid="post-detail-trade-contact">
      <p class="post-detail-trade-block__contact-line">{{ TRADE_CONTACT_CTA }}</p>
      <p class="post-detail-trade-block__contact-hint">{{ TRADE_CONTACT_HINT }}</p>
    </div>
  </section>
</template>

<style scoped>
.post-detail-trade-block {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-card, 12px);
  background: var(--lian-surface-2, rgba(255, 255, 255, 0.6));
}

.post-detail-trade-block__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.post-detail-trade-block__state {
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

.post-detail-trade-block__state[data-state="reserved"] {
  background: rgba(255, 167, 38, 0.16);
  color: #a05a00;
}

.post-detail-trade-block__state[data-state="sold"] {
  background: rgba(120, 120, 120, 0.22);
  color: #444;
}

.post-detail-trade-block__state[data-state="cancelled"] {
  background: rgba(220, 60, 60, 0.16);
  color: #8a2020;
}

.post-detail-trade-block__state[data-state="hidden"] {
  background: rgba(86, 96, 117, 0.16);
  color: #3f495b;
}

.post-detail-trade-block__verified {
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

.post-detail-trade-block__verified-at {
  color: var(--lian-muted);
  font-size: 13px;
}

.post-detail-trade-block__price {
  margin: 0;
  color: var(--lian-ink);
  font-weight: 800;
  font-size: 20px;
  line-height: 1.2;
}

.post-detail-trade-block__meta {
  display: grid;
  gap: var(--space-1);
  margin: 0;
}

.post-detail-trade-block__row {
  display: grid;
  grid-template-columns: 5em 1fr;
  gap: var(--space-2);
}

.post-detail-trade-block__row dt {
  color: var(--lian-muted);
  font-size: 13px;
}

.post-detail-trade-block__row dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 14px;
}

.post-detail-trade-block__risk {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-card, 12px);
  background: rgba(220, 60, 60, 0.08);
  color: #8a2020;
  font-weight: 700;
  font-size: 13px;
}

.post-detail-trade-block__contact {
  display: grid;
  gap: 4px;
  padding: var(--space-2) var(--space-3);
  border: 1px dashed rgba(31, 167, 160, 0.35);
  border-radius: var(--radius-card, 12px);
  background: rgba(31, 167, 160, 0.06);
}

.post-detail-trade-block__contact-line {
  margin: 0;
  color: var(--lian-ink);
  font-weight: 700;
  font-size: 14px;
}

.post-detail-trade-block__contact-hint {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
}
</style>
