<script setup lang="ts">
/**
 * Event reward settlement readout (extracted from PostDetailEventBlock).
 *
 * Pure presentation component that renders the post-settlement summary when
 * an event's reward has been distributed. Displays per-joiner amount, total
 * paid, joiner count, and settlement timestamp.
 *
 * Issue #705 — read-only post-settlement readout. The parent decides whether
 * to render this block based on `event.rewardSettlement` presence.
 */
import {
  EVENT_REWARD_SETTLED_LABEL,
  EVENT_REWARD_SETTLED_PER_JOINER,
  EVENT_REWARD_SETTLED_TOTAL,
  EVENT_REWARD_SETTLED_AT,
} from "../../config/brand";
import { formatRelativeTime } from "../../utils/time";

export interface RewardSettlement {
  perJoiner: number;
  totalPaid: number;
  joinerCount: number;
  settledAt?: string;
}

const props = defineProps<{
  settlement: RewardSettlement;
}>();

function fillTemplate(template: string, params: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : `{${key}}`,
  );
}

const perJoinerLabel = fillTemplate(EVENT_REWARD_SETTLED_PER_JOINER, {
  amount: props.settlement.perJoiner,
});

const totalLabel = fillTemplate(EVENT_REWARD_SETTLED_TOTAL, {
  total: props.settlement.totalPaid,
  count: props.settlement.joinerCount,
});

// Reuse the relative-time helper (same one feed cards use). Falls back to
// the raw ISO when parsing fails so the user is never shown an empty hint.
const settledAtLabel = (() => {
  const at = props.settlement.settledAt;
  if (!at) return "";
  const humanized = formatRelativeTime(at) || at;
  return fillTemplate(EVENT_REWARD_SETTLED_AT, { at: humanized });
})();
</script>

<template>
  <div
    class="post-detail-event-settlement"
    data-testid="post-detail-event-reward-settlement"
  >
    <span class="post-detail-event-settlement__label">
      {{ EVENT_REWARD_SETTLED_LABEL }}
    </span>
    <dl class="post-detail-event-settlement__body">
      <div data-settlement-field="per-joiner">
        <dd>{{ perJoinerLabel }}</dd>
      </div>
      <div data-settlement-field="total">
        <dd>{{ totalLabel }}</dd>
      </div>
      <div v-if="settledAtLabel" data-settlement-field="settled-at">
        <dd>{{ settledAtLabel }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.post-detail-event-settlement {
  display: grid;
  gap: 4px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-3, 8px);
  background: rgba(31, 167, 160, 0.12);
}

.post-detail-event-settlement__label {
  color: var(--lian-primary-deep, #0f6b66);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.post-detail-event-settlement__body {
  display: grid;
  gap: 2px;
  margin: 0;
}

.post-detail-event-settlement__body > div {
  margin: 0;
}

.post-detail-event-settlement__body dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 13px;
  line-height: 1.5;
}
</style>
