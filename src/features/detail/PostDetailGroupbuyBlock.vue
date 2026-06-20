<script setup lang="ts">
import { computed } from "vue";
import {
  GROUPBUY_BLOCK_LABEL,
  GROUPBUY_CHANNEL_LABEL,
  GROUPBUY_CHANNEL_PREFIX,
  GROUPBUY_JOIN_CTA,
  GROUPBUY_JOINED,
  GROUPBUY_PARTICIPANT_LABEL,
  GROUPBUY_PAYMENT_STATUS_LABEL,
  GROUPBUY_PAYMENT_STATUS_PAID,
  GROUPBUY_PAYMENT_STATUS_PENDING,
  GROUPBUY_PAYMENT_STATUS_REFUNDED,
  GROUPBUY_PAYMENT_STATUS_UNPAID,
  GROUPBUY_SETTLEMENT_HINT,
  GROUPBUY_STATE_CLOSED,
  GROUPBUY_STATE_FAILED,
  GROUPBUY_STATE_FORMING,
  GROUPBUY_STATE_SUCCESS,
  GROUPBUY_STATE_UNKNOWN_PREFIX,
  GROUPBUY_TARGET_UNSET,
  GROUPBUY_VIEWER_STATUS_CREATOR,
  GROUPBUY_VIEWER_STATUS_JOINED,
  GROUPBUY_VIEWER_STATUS_LABEL,
  GROUPBUY_VIEWER_STATUS_NOT_JOINED,
} from "../../config/brand";
import type { GroupbuyComponentV2 } from "../../types/post-extensions";

const props = defineProps<{
  component: GroupbuyComponentV2;
}>();

const STATE_LABEL: Record<string, string> = {
  forming: GROUPBUY_STATE_FORMING,
  success: GROUPBUY_STATE_SUCCESS,
  failed: GROUPBUY_STATE_FAILED,
  closed: GROUPBUY_STATE_CLOSED,
};
const VIEWER_STATUS_LABEL: Record<string, string> = {
  joined: GROUPBUY_VIEWER_STATUS_JOINED,
  not_joined: GROUPBUY_VIEWER_STATUS_NOT_JOINED,
  creator: GROUPBUY_VIEWER_STATUS_CREATOR,
};
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: GROUPBUY_PAYMENT_STATUS_UNPAID,
  pending: GROUPBUY_PAYMENT_STATUS_PENDING,
  paid: GROUPBUY_PAYMENT_STATUS_PAID,
  refunded: GROUPBUY_PAYMENT_STATUS_REFUNDED,
};

const stateValue = computed(() => props.component.state || "forming");
const stateLabel = computed(
  () => STATE_LABEL[stateValue.value] ?? `${GROUPBUY_STATE_UNKNOWN_PREFIX}：${stateValue.value}`,
);
const targetLabel = computed(() => props.component.targetCount ?? GROUPBUY_TARGET_UNSET);
const participantLabel = computed(() => props.component.participantCount ?? 0);
const viewerStatusValue = computed(
  () => props.component.viewerStatus || (props.component.joined ? "joined" : "not_joined"),
);
const viewerStatusLabel = computed(
  () => VIEWER_STATUS_LABEL[viewerStatusValue.value] ?? viewerStatusValue.value,
);
const paymentStatusLabel = computed(() => {
  if (!props.component.paymentStatus) return "";
  return PAYMENT_STATUS_LABEL[props.component.paymentStatus] ?? props.component.paymentStatus;
});
const participationLabel = computed(() =>
  viewerStatusValue.value === "joined" || viewerStatusValue.value === "creator"
    ? GROUPBUY_JOINED
    : GROUPBUY_JOIN_CTA,
);
const channelLabel = computed(() => {
  if (!props.component.channelId) return "";
  return `${GROUPBUY_CHANNEL_PREFIX} #${props.component.channelId}`;
});
</script>

<template>
  <section
    class="post-detail-groupbuy-block"
    :aria-label="GROUPBUY_BLOCK_LABEL"
    data-testid="post-detail-groupbuy-block"
  >
    <header class="post-detail-groupbuy-block__header">
      <span class="post-detail-groupbuy-block__state" :data-state="stateValue">
        {{ stateLabel }}
      </span>
      <strong>{{ GROUPBUY_BLOCK_LABEL }}</strong>
    </header>

    <dl class="post-detail-groupbuy-block__meta">
      <div class="post-detail-groupbuy-block__row">
        <dt>{{ GROUPBUY_PARTICIPANT_LABEL }}</dt>
        <dd data-testid="post-detail-groupbuy-participants">
          {{ participantLabel }} / {{ targetLabel }}
        </dd>
      </div>
      <div class="post-detail-groupbuy-block__row">
        <dt>{{ GROUPBUY_VIEWER_STATUS_LABEL }}</dt>
        <dd data-testid="post-detail-groupbuy-viewer-status">{{ viewerStatusLabel }}</dd>
      </div>
      <div v-if="paymentStatusLabel" class="post-detail-groupbuy-block__row">
        <dt>{{ GROUPBUY_PAYMENT_STATUS_LABEL }}</dt>
        <dd data-testid="post-detail-groupbuy-payment-status">{{ paymentStatusLabel }}</dd>
      </div>
      <div v-if="channelLabel" class="post-detail-groupbuy-block__row">
        <dt>{{ GROUPBUY_CHANNEL_LABEL }}</dt>
        <dd data-testid="post-detail-groupbuy-channel">{{ channelLabel }}</dd>
      </div>
    </dl>

    <p class="post-detail-groupbuy-block__participation" data-testid="post-detail-groupbuy-join">
      {{ participationLabel }}
    </p>
    <p class="post-detail-groupbuy-block__hint">{{ GROUPBUY_SETTLEMENT_HINT }}</p>
  </section>
</template>

<style scoped>
.post-detail-groupbuy-block {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-card, 12px);
  background: rgba(31, 167, 160, 0.08);
}

.post-detail-groupbuy-block__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  color: var(--lian-ink);
}

.post-detail-groupbuy-block__state,
.post-detail-groupbuy-block__participation {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 24px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-chip, 999px);
  background: rgba(31, 167, 160, 0.18);
  color: #1a6f6c;
  font-weight: 800;
  font-size: 13px;
}

.post-detail-groupbuy-block__state[data-state="success"] {
  background: rgba(76, 175, 80, 0.16);
  color: #276b2d;
}

.post-detail-groupbuy-block__state[data-state="failed"],
.post-detail-groupbuy-block__state[data-state="closed"] {
  background: rgba(120, 120, 120, 0.18);
  color: #444;
}

.post-detail-groupbuy-block__meta {
  display: grid;
  gap: var(--space-1);
  margin: 0;
}

.post-detail-groupbuy-block__row {
  display: grid;
  grid-template-columns: 5em 1fr;
  gap: var(--space-2);
}

.post-detail-groupbuy-block__row dt {
  color: var(--lian-muted);
  font-size: 13px;
}

.post-detail-groupbuy-block__row dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 14px;
}

.post-detail-groupbuy-block__hint {
  margin: 0;
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.5;
}
</style>
