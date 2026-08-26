<script setup lang="ts">
import { computed } from "vue";
import { LianButton } from "../../ui";
import {
  ERRAND_ORDER_STATUS_COMPLETED,
  ERRAND_ORDER_STATUS_REFUNDED,
  ERRAND_ORDER_STATUS_UNKNOWN,
  RUNNER_ACTION_ACCEPT,
  RUNNER_ACTION_AT_SHOP,
  RUNNER_ACTION_DELIVER,
  RUNNER_ACTION_PENDING,
  RUNNER_ACTION_PICKUP,
  RUNNER_FIELD_DELIVER_BY,
  RUNNER_FIELD_DISTANCE,
  RUNNER_FIELD_DROPOFF,
  RUNNER_FIELD_NOTE,
  RUNNER_FIELD_PICKUP,
  RUNNER_FIELD_REWARD,
  RUNNER_POINTS_SUFFIX,
  RUNNER_STATUS_ACCEPTED,
  RUNNER_STATUS_AT_SHOP,
  RUNNER_STATUS_AVAILABLE,
  RUNNER_STATUS_CANCELLED,
  RUNNER_STATUS_DELIVERED,
  RUNNER_STATUS_PICKED_UP,
} from "../../config/brand";
import type { RunnerOrder, RunnerOrderStatus, RunnerTransitionAction } from "../../types/runner";

const props = defineProps<{
  order: RunnerOrder;
  pendingAction?: RunnerTransitionAction;
}>();

defineEmits<{
  accept: [orderId: string];
  "at-shop": [orderId: string];
  pickup: [orderId: string];
  deliver: [orderId: string];
}>();

const STATUS_LABELS: Record<RunnerOrderStatus, string> = {
  available: RUNNER_STATUS_AVAILABLE,
  accepted: RUNNER_STATUS_ACCEPTED,
  at_shop: RUNNER_STATUS_AT_SHOP,
  picked_up: RUNNER_STATUS_PICKED_UP,
  delivered: RUNNER_STATUS_DELIVERED,
  completed: ERRAND_ORDER_STATUS_COMPLETED,
  cancelled: RUNNER_STATUS_CANCELLED,
  refunded: ERRAND_ORDER_STATUS_REFUNDED,
  unknown: ERRAND_ORDER_STATUS_UNKNOWN,
};

const statusLabel = computed(() => STATUS_LABELS[props.order.status] ?? props.order.status);
const isPending = computed(() => Boolean(props.pendingAction));

const rewardLabel = computed(() => {
  const points = props.order.rewardPoints;
  if (typeof points !== "number" || !Number.isFinite(points)) return "";
  return `${Math.max(0, Math.trunc(points))} ${RUNNER_POINTS_SUFFIX}`;
});

const distanceLabel = computed(() => {
  const m = props.order.distanceMeters;
  if (typeof m !== "number" || !Number.isFinite(m)) return "";
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
});

function formatLocation(loc: RunnerOrder["pickup"]): string {
  if (!loc) return "";
  return loc.label || loc.address || "";
}

function formatDeliverBy(iso: string | undefined): string {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const date = new Date(ts);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${date.getMonth() + 1}/${date.getDate()} ${hh}:${mm}`;
}
</script>

<template>
  <article
    class="runner-order-card"
    :data-status="order.status"
    :data-testid="`runner-order-${order.id}`"
  >
    <header class="runner-order-card__head">
      <h3 class="runner-order-card__title">{{ order.title }}</h3>
      <span class="runner-order-card__status">{{ statusLabel }}</span>
    </header>

    <p v-if="order.summary" class="runner-order-card__summary">{{ order.summary }}</p>

    <dl class="runner-order-card__meta">
      <template v-if="formatLocation(order.pickup)">
        <dt>{{ RUNNER_FIELD_PICKUP }}</dt>
        <dd>{{ formatLocation(order.pickup) }}</dd>
      </template>
      <template v-if="formatLocation(order.dropoff)">
        <dt>{{ RUNNER_FIELD_DROPOFF }}</dt>
        <dd>{{ formatLocation(order.dropoff) }}</dd>
      </template>
      <template v-if="rewardLabel">
        <dt>{{ RUNNER_FIELD_REWARD }}</dt>
        <dd>{{ rewardLabel }}</dd>
      </template>
      <template v-if="distanceLabel">
        <dt>{{ RUNNER_FIELD_DISTANCE }}</dt>
        <dd>{{ distanceLabel }}</dd>
      </template>
      <template v-if="order.deliverBy">
        <dt>{{ RUNNER_FIELD_DELIVER_BY }}</dt>
        <dd>{{ formatDeliverBy(order.deliverBy) }}</dd>
      </template>
      <template v-if="order.note">
        <dt>{{ RUNNER_FIELD_NOTE }}</dt>
        <dd>{{ order.note }}</dd>
      </template>
    </dl>

    <footer class="runner-order-card__actions">
      <LianButton
        v-if="order.status === 'available'"
        variant="primary"
        size="sm"
        :disabled="isPending"
        :data-testid="`runner-action-accept-${order.id}`"
        @click="$emit('accept', order.id)"
      >
        {{ pendingAction === "accept" ? RUNNER_ACTION_PENDING : RUNNER_ACTION_ACCEPT }}
      </LianButton>

      <LianButton
        v-else-if="order.status === 'accepted'"
        variant="primary"
        size="sm"
        :disabled="isPending"
        :data-testid="`runner-action-at-shop-${order.id}`"
        @click="$emit('at-shop', order.id)"
      >
        {{ pendingAction === "at_shop" ? RUNNER_ACTION_PENDING : RUNNER_ACTION_AT_SHOP }}
      </LianButton>

      <LianButton
        v-else-if="order.status === 'at_shop'"
        variant="primary"
        size="sm"
        :disabled="isPending"
        :data-testid="`runner-action-pickup-${order.id}`"
        @click="$emit('pickup', order.id)"
      >
        {{ pendingAction === "pickup" ? RUNNER_ACTION_PENDING : RUNNER_ACTION_PICKUP }}
      </LianButton>

      <LianButton
        v-else-if="order.status === 'picked_up'"
        variant="primary"
        size="sm"
        :disabled="isPending"
        :data-testid="`runner-action-deliver-${order.id}`"
        @click="$emit('deliver', order.id)"
      >
        {{ pendingAction === "deliver" ? RUNNER_ACTION_PENDING : RUNNER_ACTION_DELIVER }}
      </LianButton>
    </footer>
  </article>
</template>

<style scoped>
.runner-order-card {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
}

.runner-order-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.runner-order-card__title {
  margin: 0;
  font-size: 15px;
  font-weight: 900;
}

.runner-order-card__status {
  padding: 2px var(--space-2);
  border-radius: var(--radius-chip);
  background: rgba(124, 92, 255, 0.14);
  color: #5a3fbf;
  font-size: 12px;
  font-weight: 850;
}

.runner-order-card[data-status="available"] .runner-order-card__status {
  background: rgba(120, 120, 120, 0.14);
  color: var(--lian-muted);
}

.runner-order-card[data-status="delivered"] .runner-order-card__status {
  background: rgba(34, 197, 94, 0.16);
  color: rgb(21, 128, 61);
}

.runner-order-card__summary {
  margin: 0;
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.5;
}

.runner-order-card__meta {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px var(--space-2);
  margin: 0;
  font-size: 12px;
  color: var(--lian-muted);
}

.runner-order-card__meta dt {
  font-weight: 700;
}

.runner-order-card__meta dd {
  margin: 0;
}

.runner-order-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
