<script setup lang="ts">
/**
 * Order detail / timeline view (issue #647).
 *
 * Renders after a successful create. Pulls `GET /api/errand-orders/:id`
 * once on mount; the order state machine itself (#648) drives any later
 * transitions via the runner side, so the user-facing read view simply
 * shows whatever the backend currently has.
 */
import { computed, onMounted, onBeforeUnmount, watch } from "vue";
import {
  ERRAND_ORDER_DETAIL_AUTO_REFRESH_HINT,
  ERRAND_ORDER_DETAIL_BACK,
  ERRAND_ORDER_DETAIL_LABEL,
  ERRAND_ORDER_DETAIL_LOAD_ERROR,
  ERRAND_ORDER_DETAIL_NOTES_LABEL,
  ERRAND_ORDER_DETAIL_REFRESH,
  ERRAND_ORDER_DETAIL_REFRESHING,
  ERRAND_ORDER_DETAIL_TIMELINE,
  ERRAND_ORDER_DROPOFF_TITLE,
  ERRAND_ORDER_FEE_LABEL,
  ERRAND_ORDER_LOADING,
  ERRAND_ORDER_MODE_TITLE,
  ERRAND_ORDER_PICKUP_TITLE,
  ERRAND_ORDER_POINTS_SUFFIX,
  ERRAND_ORDER_RETRY,
} from "../../config/brand";
import { useErrandOrderDetail } from "./useErrandOrderDetail";
import {
  formatTimelineTimestamp,
  isTerminalErrandStatus,
  modeLabel,
  statusLabel,
} from "./errand-format";

const props = defineProps<{
  orderId: string;
}>();

const emit = defineEmits<{
  back: [];
}>();

// Destructure refs so the template can read them via auto-unwrap. Vue's
// auto-unwrap only applies to top-level refs returned from setup, not nested
// keys on a returned object — the previous `detail.loading.value` access
// pattern worked at runtime but bypassed the unwrap rule.
const {
  detail: detailRef,
  loading,
  loaded,
  errorMessage,
  refresh: refreshDetail,
  start: startDetail,
  stop: stopDetail,
} = useErrandOrderDetail();

onMounted(() => {
  if (props.orderId) startDetail(props.orderId);
});

watch(
  () => props.orderId,
  (next) => {
    if (next) startDetail(next);
    else stopDetail();
  },
);

onBeforeUnmount(() => {
  stopDetail();
});

const order = computed(() => detailRef.value?.order || null);
const timeline = computed(() => detailRef.value?.timeline || []);
const isLivePolling = computed(() => !!order.value && !isTerminalErrandStatus(order.value.status));

function handleRefresh() {
  if (props.orderId) void refreshDetail(props.orderId);
}
</script>

<template>
  <section
    class="errand-order-timeline-view"
    :aria-label="ERRAND_ORDER_DETAIL_LABEL"
    data-testid="errand-order-timeline-view"
  >
    <header class="errand-order-timeline-view__header">
      <button
        type="button"
        class="errand-order-timeline-view__back"
        data-testid="errand-order-timeline-back"
        @click="emit('back')"
      >
        {{ ERRAND_ORDER_DETAIL_BACK }}
      </button>
      <h2>{{ ERRAND_ORDER_DETAIL_LABEL }}</h2>
      <button
        type="button"
        class="errand-order-timeline-view__refresh"
        :disabled="loading"
        data-testid="errand-order-timeline-refresh"
        @click="handleRefresh"
      >
        {{ loading ? ERRAND_ORDER_DETAIL_REFRESHING : ERRAND_ORDER_DETAIL_REFRESH }}
      </button>
    </header>

    <p
      v-if="isLivePolling"
      class="errand-order-timeline-view__poll-hint"
      data-testid="errand-order-timeline-poll-hint"
    >
      {{ ERRAND_ORDER_DETAIL_AUTO_REFRESH_HINT }}
    </p>

    <p v-if="loading && !loaded" class="errand-order-timeline-view__status" role="status">
      {{ ERRAND_ORDER_LOADING }}
    </p>

    <div
      v-else-if="errorMessage"
      class="errand-order-timeline-view__status is-error"
      role="alert"
      data-testid="errand-order-timeline-error"
    >
      <span>{{ errorMessage || ERRAND_ORDER_DETAIL_LOAD_ERROR }}</span>
      <button
        type="button"
        class="errand-order-timeline-view__retry"
        data-testid="errand-order-timeline-retry"
        :disabled="loading"
        @click="handleRefresh"
      >
        {{ ERRAND_ORDER_RETRY }}
      </button>
    </div>

    <template v-else-if="order">
      <dl class="errand-order-timeline-view__meta">
        <div class="errand-order-timeline-view__row">
          <dt>{{ ERRAND_ORDER_PICKUP_TITLE }}</dt>
          <dd data-testid="errand-order-timeline-pickup">{{ order.pickupLocation.label }}</dd>
        </div>
        <div class="errand-order-timeline-view__row">
          <dt>{{ ERRAND_ORDER_DROPOFF_TITLE }}</dt>
          <dd data-testid="errand-order-timeline-dropoff">{{ order.dropoffLocation.label }}</dd>
        </div>
        <div class="errand-order-timeline-view__row">
          <dt>{{ ERRAND_ORDER_MODE_TITLE }}</dt>
          <dd>{{ modeLabel(order.mode) }}</dd>
        </div>
        <div class="errand-order-timeline-view__row">
          <dt>{{ ERRAND_ORDER_FEE_LABEL }}</dt>
          <dd>{{ order.feeAmount }} {{ ERRAND_ORDER_POINTS_SUFFIX }}</dd>
        </div>
        <div
          v-if="detailRef?.notes"
          class="errand-order-timeline-view__row"
          data-testid="errand-order-timeline-notes"
        >
          <dt>{{ ERRAND_ORDER_DETAIL_NOTES_LABEL }}</dt>
          <dd>{{ detailRef?.notes }}</dd>
        </div>
      </dl>

      <section
        class="errand-order-timeline-view__timeline"
        :aria-label="ERRAND_ORDER_DETAIL_TIMELINE"
        data-testid="errand-order-timeline-list"
      >
        <h3>{{ ERRAND_ORDER_DETAIL_TIMELINE }}</h3>
        <ol>
          <li
            v-for="(event, index) in timeline"
            :key="`${event.status}-${event.at}-${index}`"
            class="errand-order-timeline-view__entry"
            :class="{ 'is-current': index === timeline.length - 1 }"
            data-testid="errand-order-timeline-entry"
          >
            <span class="errand-order-timeline-view__entry-status">{{
              statusLabel(event.status)
            }}</span>
            <span class="errand-order-timeline-view__entry-time">{{
              formatTimelineTimestamp(event.at)
            }}</span>
            <span v-if="event.note" class="errand-order-timeline-view__entry-note">
              {{ event.note }}
            </span>
          </li>
        </ol>
      </section>
    </template>
  </section>
</template>

<style scoped>
.errand-order-timeline-view {
  display: grid;
  gap: var(--space-3);
  padding: calc(var(--floating-bar-height) + var(--space-3)) var(--space-3) var(--space-6);
}

.errand-order-timeline-view__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.errand-order-timeline-view__header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
  flex: 1;
}

.errand-order-timeline-view__back {
  appearance: none;
  border: 0;
  background: rgba(255, 255, 255, 0.72);
  border-radius: var(--radius-chip, 999px);
  color: var(--lian-ink);
  font-weight: 800;
  height: 32px;
  padding: 0 var(--space-3);
}

.errand-order-timeline-view__refresh {
  appearance: none;
  border: 0;
  background: rgba(31, 167, 160, 0.16);
  border-radius: var(--radius-chip, 999px);
  color: var(--lian-primary-deep, #0f6b66);
  font-weight: 800;
  height: 32px;
  padding: 0 var(--space-3);
  cursor: pointer;
}

.errand-order-timeline-view__refresh:disabled {
  opacity: 0.5;
  cursor: progress;
}

.errand-order-timeline-view__poll-hint {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
}

.errand-order-timeline-view__status {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-card);
  background: rgba(120, 120, 120, 0.12);
  color: var(--lian-muted);
  font-size: 13px;
}

.errand-order-timeline-view__status.is-error {
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
}

.errand-order-timeline-view__meta {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
}

.errand-order-timeline-view__row {
  display: grid;
  grid-template-columns: 6em 1fr;
  gap: var(--space-2);
}

.errand-order-timeline-view__row dt {
  color: var(--lian-muted);
  font-size: 13px;
}

.errand-order-timeline-view__row dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 14px;
}

.errand-order-timeline-view__timeline {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
}

.errand-order-timeline-view__timeline h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
}

.errand-order-timeline-view__timeline ol {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-2);
}

.errand-order-timeline-view__entry {
  display: grid;
  grid-template-columns: minmax(5em, max-content) 1fr;
  gap: var(--space-1) var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-card);
  background: rgba(120, 120, 120, 0.06);
}

.errand-order-timeline-view__entry.is-current {
  background: rgba(31, 167, 160, 0.1);
  border: 1px solid rgba(31, 167, 160, 0.32);
}

.errand-order-timeline-view__entry-status {
  font-weight: 800;
  font-size: 14px;
}

.errand-order-timeline-view__entry-time {
  color: var(--lian-muted);
  font-size: 12px;
}

.errand-order-timeline-view__entry-note {
  grid-column: 1 / -1;
  color: var(--lian-ink);
  font-size: 13px;
  line-height: 1.5;
}
</style>
