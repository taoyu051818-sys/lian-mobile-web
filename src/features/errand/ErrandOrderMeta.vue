<script setup lang="ts">
/**
 * ErrandOrderMeta — displays order metadata (pickup/dropoff, mode, fee, notes).
 *
 * Extracted from ErrandOrderTimelineView to improve modularity and enable
 * reuse in other contexts (e.g., order cards, summaries).
 */
import {
  ERRAND_ORDER_DETAIL_NOTES_LABEL,
  ERRAND_ORDER_DROPOFF_TITLE,
  ERRAND_ORDER_FEE_LABEL,
  ERRAND_ORDER_MODE_TITLE,
  ERRAND_ORDER_PICKUP_TITLE,
  ERRAND_ORDER_POINTS_SUFFIX,
} from "../../config/brand";
import { modeLabel } from "./errand-format";
import type { ErrandOrder } from "../../types/errand";

defineProps<{
  order: ErrandOrder;
  notes?: string;
}>();
</script>

<template>
  <dl class="errand-order-meta" data-testid="errand-order-meta">
    <div class="errand-order-meta__row">
      <dt>{{ ERRAND_ORDER_PICKUP_TITLE }}</dt>
      <dd data-testid="errand-order-meta-pickup">{{ order.pickupLocation.label }}</dd>
    </div>
    <div class="errand-order-meta__row">
      <dt>{{ ERRAND_ORDER_DROPOFF_TITLE }}</dt>
      <dd data-testid="errand-order-meta-dropoff">{{ order.dropoffLocation.label }}</dd>
    </div>
    <div class="errand-order-meta__row">
      <dt>{{ ERRAND_ORDER_MODE_TITLE }}</dt>
      <dd>{{ modeLabel(order.mode) }}</dd>
    </div>
    <div class="errand-order-meta__row">
      <dt>{{ ERRAND_ORDER_FEE_LABEL }}</dt>
      <dd>{{ order.feePoints }} {{ ERRAND_ORDER_POINTS_SUFFIX }}</dd>
    </div>
    <div v-if="notes" class="errand-order-meta__row" data-testid="errand-order-meta-notes">
      <dt>{{ ERRAND_ORDER_DETAIL_NOTES_LABEL }}</dt>
      <dd>{{ notes }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.errand-order-meta {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
}

.errand-order-meta__row {
  display: grid;
  grid-template-columns: 6em 1fr;
  gap: var(--space-2);
}

.errand-order-meta__row dt {
  color: var(--lian-muted);
  font-size: 13px;
}

.errand-order-meta__row dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 14px;
}
</style>
