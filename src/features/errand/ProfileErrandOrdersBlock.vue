<script setup lang="ts">
/**
 * Profile-side surface for "我的跑腿订单" (issue #647 follow-up).
 *
 * Lets the requester re-enter the timeline view for any of their existing
 * orders after they've closed the secret view. Tap → route singleton flips
 * to the orderId branch + setActiveView pivots back into the secret view,
 * same path the post-submit handoff uses.
 */
import { onMounted } from "vue";
import {
  PROFILE_ERRAND_ORDERS_DROPOFF_PREFIX,
  PROFILE_ERRAND_ORDERS_EMPTY,
  PROFILE_ERRAND_ORDERS_LOADING,
  PROFILE_ERRAND_ORDERS_OPEN,
  PROFILE_ERRAND_ORDERS_PICKUP_PREFIX,
  PROFILE_ERRAND_ORDERS_RELOAD,
  PROFILE_ERRAND_ORDERS_SECTION_LABEL,
} from "../../config/brand";
import { useActiveView } from "../../app/useActiveView";
import { formatTimelineTimestamp, modeLabel, statusLabel } from "./errand-format";
import { useErrandOrderRoute } from "./useErrandOrderRoute";
import { useMyErrandOrders } from "./useMyErrandOrders";

const route = useErrandOrderRoute();
const { setActiveView } = useActiveView();
const orders = useMyErrandOrders();

onMounted(() => {
  void orders.refresh();
});

function openOrder(orderId: string) {
  if (!orderId) return;
  route.enterForOrder(orderId);
  setActiveView("errand-order");
}
</script>

<template>
  <section
    class="profile-errand-orders"
    :aria-label="PROFILE_ERRAND_ORDERS_SECTION_LABEL"
    data-testid="profile-errand-orders"
  >
    <header class="profile-errand-orders__header">
      <h3>{{ PROFILE_ERRAND_ORDERS_SECTION_LABEL }}</h3>
      <button
        v-if="orders.loaded.value || orders.errorMessage.value"
        type="button"
        class="profile-errand-orders__reload"
        :disabled="orders.loading.value"
        data-testid="profile-errand-orders-reload"
        @click="() => void orders.refresh()"
      >
        {{ PROFILE_ERRAND_ORDERS_RELOAD }}
      </button>
    </header>

    <p
      v-if="orders.loading.value && !orders.loaded.value"
      class="profile-errand-orders__hint"
      role="status"
    >
      {{ PROFILE_ERRAND_ORDERS_LOADING }}
    </p>

    <p
      v-else-if="orders.errorMessage.value"
      class="profile-errand-orders__hint is-error"
      role="alert"
      data-testid="profile-errand-orders-error"
    >
      {{ orders.errorMessage.value }}
    </p>

    <p
      v-else-if="!orders.items.value.length"
      class="profile-errand-orders__hint"
      data-testid="profile-errand-orders-empty"
    >
      {{ PROFILE_ERRAND_ORDERS_EMPTY }}
    </p>

    <ul v-else class="profile-errand-orders__list" data-testid="profile-errand-orders-list">
      <li
        v-for="order in orders.items.value"
        :key="order.orderId"
        class="profile-errand-orders__item"
        data-testid="profile-errand-orders-item"
      >
        <header class="profile-errand-orders__item-header">
          <span class="profile-errand-orders__status" :data-status="order.status">
            {{ statusLabel(order.status) }}
          </span>
          <span class="profile-errand-orders__mode">{{ modeLabel(order.mode) }}</span>
          <time v-if="order.createdAt" class="profile-errand-orders__time">
            {{ formatTimelineTimestamp(order.createdAt) }}
          </time>
        </header>
        <p v-if="order.pickupLabel" class="profile-errand-orders__line">
          <span>{{ PROFILE_ERRAND_ORDERS_PICKUP_PREFIX }}</span>
          <strong>{{ order.pickupLabel }}</strong>
        </p>
        <p v-if="order.dropoffLabel" class="profile-errand-orders__line">
          <span>{{ PROFILE_ERRAND_ORDERS_DROPOFF_PREFIX }}</span>
          <strong>{{ order.dropoffLabel }}</strong>
        </p>
        <button
          type="button"
          class="profile-errand-orders__open"
          data-testid="profile-errand-orders-open"
          @click="openOrder(order.orderId)"
        >
          {{ PROFILE_ERRAND_ORDERS_OPEN }}
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.profile-errand-orders {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-top: 1px dashed rgba(31, 167, 160, 0.18);
}

.profile-errand-orders__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}

.profile-errand-orders__header h3 {
  margin: 0;
  color: var(--lian-ink);
  font-size: 13px;
  font-weight: 900;
}

.profile-errand-orders__reload {
  appearance: none;
  border: 0;
  border-radius: var(--radius-chip, 999px);
  background: rgba(31, 167, 160, 0.16);
  color: var(--lian-primary-deep, #0f6b66);
  font-weight: 800;
  height: 28px;
  padding: 0 var(--space-2);
  cursor: pointer;
}

.profile-errand-orders__reload:disabled {
  opacity: 0.5;
  cursor: progress;
}

.profile-errand-orders__hint {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.5;
}

.profile-errand-orders__hint.is-error {
  color: rgb(185, 28, 28);
}

.profile-errand-orders__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.profile-errand-orders__item {
  display: grid;
  gap: 4px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.6);
}

.profile-errand-orders__item-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.profile-errand-orders__status {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-chip, 999px);
  background: rgba(31, 167, 160, 0.18);
  color: var(--lian-primary-deep, #0f6b66);
  font-weight: 800;
  font-size: 12px;
}

.profile-errand-orders__status[data-status="cancelled"],
.profile-errand-orders__status[data-status="refunded"] {
  background: rgba(120, 120, 120, 0.16);
  color: var(--lian-muted);
}

.profile-errand-orders__status[data-status="disputed"] {
  background: rgba(239, 68, 68, 0.14);
  color: rgb(185, 28, 28);
}

.profile-errand-orders__mode {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 700;
}

.profile-errand-orders__time {
  margin-left: auto;
  color: var(--lian-muted);
  font-size: 11px;
}

.profile-errand-orders__line {
  display: grid;
  grid-template-columns: 1.4em 1fr;
  gap: var(--space-1);
  margin: 0;
  color: var(--lian-ink);
  font-size: 13px;
}

.profile-errand-orders__line span {
  color: var(--lian-muted);
  font-size: 12px;
}

.profile-errand-orders__line strong {
  font-weight: 800;
}

.profile-errand-orders__open {
  justify-self: start;
  appearance: none;
  border: 0;
  border-radius: var(--radius-chip, 999px);
  background: var(--lian-primary, #1fa7a0);
  color: #fff;
  font-weight: 800;
  height: 30px;
  padding: 0 var(--space-3);
  cursor: pointer;
}
</style>
