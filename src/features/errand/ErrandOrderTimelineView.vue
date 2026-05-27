<script setup lang="ts">
/**
 * Order detail / timeline view (issue #647 read side; cancel CTA + V0.2
 * runner-location placeholder added by issue #609 PR1).
 *
 * Surfaces every transition the V0.1 backend can write — created, paid_locked,
 * assigned, picked_up, delivering, delivered, completed, plus the cancelled / refunded
 * terminals — using `useErrandOrderDetail`. The state machine itself runs
 * runner-side (#648); this view only renders what the backend currently has
 * and exposes:
 *
 * - cancel CTA — only while the order is non-terminal. Calls
 *   `POST /api/errands/orders/:id/cancel` (one of the five real V0.1 routes).
 *   `assign` and `runner-location` are 501 NOT_IMPLEMENTED_V0_1 by design,
 *   so the UI must NOT call them — the runner-location panel below is a
 *   pure read-only placeholder, no fetch.
 * - V0.2 runner-location placeholder — once the order has a runner assigned,
 *   we surface a labeled "实时位置 V0.2 即将开放" panel instead of the
 *   actual map. This keeps the user informed without lying about a feature
 *   that isn't shipped.
 */
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import {
  ERRAND_ORDER_DETAIL_AUTO_REFRESH_HINT,
  ERRAND_ORDER_DETAIL_BACK,
  ERRAND_ORDER_DETAIL_LABEL,
  ERRAND_ORDER_DETAIL_LOAD_ERROR,
  ERRAND_ORDER_DETAIL_REFRESH,
  ERRAND_ORDER_DETAIL_REFRESHING,
  ERRAND_ORDER_DETAIL_TIMELINE,
  ERRAND_ORDER_LOADING,
  ERRAND_ORDER_RETRY,
  ORDERS_CANCEL_CONFIRM,
  ORDERS_CANCEL_CTA,
  ORDERS_CANCEL_PENDING,
  ORDERS_RUNNER_LOCATION_DEFERRED,
  ORDERS_RUNNER_LOCATION_DEFERRED_HINT,
  ORDERS_RUNNER_LOCATION_TITLE,
  ORDERS_SHARE_RECRUIT_CTA,
  ORDERS_SHARE_RECRUIT_HINT,
} from "../../config/brand";
import { useErrandOrderDetail } from "./useErrandOrderDetail";
import { useErrandOrderShare } from "./useErrandOrderShare";
import { formatTimelineTimestamp, isTerminalErrandStatus, statusLabel } from "./errand-format";
import { ShareCardSheet } from "../detail";
import ErrandOrderMeta from "./ErrandOrderMeta.vue";

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
  cancelling,
  cancelError,
  canCancel,
  refresh: refreshDetail,
  start: startDetail,
  stop: stopDetail,
  cancel: cancelDetail,
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
// V0.2 runner-location placeholder shows up once a runner is on the order.
// We deliberately do NOT call the runner-location endpoint (501 in V0.1) —
// the panel is purely read-only, derived from `runnerUserId` already on
// the order detail payload.
const hasRunnerAssigned = computed(() => !!order.value?.runnerUserId);

function handleRefresh() {
  if (props.orderId) void refreshDetail(props.orderId);
}

async function handleCancel() {
  if (!props.orderId || !canCancel.value) return;
  // Two-tap inline confirm — first tap arms the CTA into a "再次点击确认"
  // state (so a single accidental tap can't terminate the order), second tap
  // fires the API. We deliberately avoid `window.confirm` because the
  // unsafe-DOM-sink guard bans alert/prompt/confirm. This pattern keeps the
  // gate visible inline + accessible without a custom modal component, which
  // is a follow-up.
  if (!confirmingCancel.value) {
    confirmingCancel.value = true;
    return;
  }
  confirmingCancel.value = false;
  await cancelDetail(props.orderId);
}

const confirmingCancel = ref(false);

// Share functionality for recruiting runners (mw#892)
const actionMessage = ref("");
const actionError = ref("");

function showActionMessage(message: string) {
  actionError.value = "";
  actionMessage.value = message;
}

function showError(_error: unknown, fallback: string) {
  actionMessage.value = "";
  actionError.value = fallback;
}

const {
  handleShare,
  handleShareConfirm,
  handleShareClose,
  handleShareRetry,
  sharePreviewOpen,
  sharePreviewStatus,
  sharePreviewCard,
  sharePreviewErrorMessage,
  sharePreviewCanRetry,
} = useErrandOrderShare({
  orderId: () => props.orderId,
  showActionMessage,
  showError,
});

// Show share button only for pending/accepted (non-terminal, no runner yet)
const canShare = computed(() => {
  const o = order.value;
  if (!o) return false;
  // Only show for orders that are still looking for a runner
  return o.status === "created" || o.status === "paid_locked";
});

// Reset the inline confirm whenever the order changes — a different order
// must not inherit the previous one's "armed" state, otherwise a tap meant
// for the new order would fire immediately.
watch(
  () => props.orderId,
  () => {
    confirmingCancel.value = false;
  },
);
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
      <ErrandOrderMeta :order="order" :notes="detailRef?.notes" />

      <section
        class="errand-order-timeline-view__timeline"
        :aria-label="ERRAND_ORDER_DETAIL_TIMELINE"
        data-testid="errand-order-timeline-list"
      >
        <h3>{{ ERRAND_ORDER_DETAIL_TIMELINE }}</h3>
        <ol>
          <!--
            Performance: v-memo skips re-rendering timeline entries when their
            key properties haven't changed. Timeline events are immutable.
          -->
          <li
            v-for="(event, index) in timeline"
            :key="`${event.status}-${event.at}-${index}`"
            v-memo="[event.status, event.at, event.note, index === timeline.length - 1]"
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

      <!--
        V0.2 runner-location placeholder (issue #609 PR1). The runner-location
        backend route is 501 NOT_IMPLEMENTED_V0_1 by design — we render a
        labeled deferred panel instead of an empty box, and we never call
        the endpoint. Surfaces only after the order has a runner assigned
        so V0.1 orders without a runner don't carry empty visual real estate.
      -->
      <section
        v-if="hasRunnerAssigned"
        class="errand-order-timeline-view__runner-location is-deferred"
        :aria-label="ORDERS_RUNNER_LOCATION_TITLE"
        data-testid="errand-order-timeline-runner-location"
      >
        <h3>{{ ORDERS_RUNNER_LOCATION_TITLE }}</h3>
        <p class="errand-order-timeline-view__runner-location-banner">
          {{ ORDERS_RUNNER_LOCATION_DEFERRED }}
        </p>
        <p class="errand-order-timeline-view__runner-location-hint">
          {{ ORDERS_RUNNER_LOCATION_DEFERRED_HINT }}
        </p>
      </section>

      <!--
        Share/recruit CTA (mw#892) — only while the order is pending/paid_locked
        (still looking for a runner). Once assigned, the share button disappears.
      -->
      <section
        v-if="canShare"
        class="errand-order-timeline-view__share-recruit"
        data-testid="errand-order-timeline-share-recruit"
      >
        <p class="errand-order-timeline-view__share-recruit-hint">
          {{ ORDERS_SHARE_RECRUIT_HINT }}
        </p>
        <button
          type="button"
          class="errand-order-timeline-view__share-recruit-cta"
          data-testid="errand-order-timeline-share-cta"
          @click="handleShare"
        >
          {{ ORDERS_SHARE_RECRUIT_CTA }}
        </button>
      </section>

      <!--
        Cancel CTA — only while the order is non-terminal. The composable's
        `canCancel` already excludes terminal states + an in-flight cancel.
        We do NOT touch the assign endpoint (501); cancel is one of the five
        live V0.1 routes.

        Two-tap inline confirm pattern: first tap arms (`confirmingCancel`),
        button label flips to `ORDERS_CANCEL_CONFIRM`, second tap fires the
        API. Window.confirm/alert/prompt are blocked by the unsafe-DOM-sink
        guard, and a custom modal is out-of-scope for PR1.
      -->
      <div
        v-if="canCancel"
        class="errand-order-timeline-view__actions"
        data-testid="errand-order-timeline-actions"
      >
        <button
          type="button"
          class="errand-order-timeline-view__cancel"
          :class="{ 'is-confirming': confirmingCancel }"
          :disabled="cancelling"
          data-testid="errand-order-timeline-cancel"
          @click="() => void handleCancel()"
        >
          {{
            cancelling
              ? ORDERS_CANCEL_PENDING
              : confirmingCancel
                ? ORDERS_CANCEL_CONFIRM
                : ORDERS_CANCEL_CTA
          }}
        </button>
      </div>

      <p
        v-if="cancelError"
        class="errand-order-timeline-view__status is-error"
        role="alert"
        data-testid="errand-order-timeline-cancel-error"
      >
        {{ cancelError }}
      </p>

      <p
        v-if="actionMessage"
        class="errand-order-timeline-view__status is-success"
        role="status"
        data-testid="errand-order-timeline-action-message"
      >
        {{ actionMessage }}
      </p>

      <p
        v-if="actionError"
        class="errand-order-timeline-view__status is-error"
        role="alert"
        data-testid="errand-order-timeline-action-error"
      >
        {{ actionError }}
      </p>
    </template>

    <ShareCardSheet
      :open="sharePreviewOpen"
      :status="sharePreviewStatus"
      :card="sharePreviewCard"
      :error-message="sharePreviewErrorMessage"
      :can-retry="sharePreviewCanRetry"
      @close="handleShareClose"
      @confirm="handleShareConfirm"
      @retry="handleShareRetry"
    />
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

.errand-order-timeline-view__runner-location {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3);
  border: 1px dashed rgba(124, 92, 255, 0.32);
  border-radius: var(--radius-card);
  background: rgba(124, 92, 255, 0.06);
}

.errand-order-timeline-view__runner-location h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 900;
  color: var(--lian-ink);
}

.errand-order-timeline-view__runner-location-banner {
  margin: 0;
  font-size: 13px;
  font-weight: 800;
  color: #5a3fbf;
}

.errand-order-timeline-view__runner-location-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--lian-muted);
}

.errand-order-timeline-view__actions {
  display: flex;
  justify-content: flex-end;
}

.errand-order-timeline-view__cancel {
  appearance: none;
  border: 0;
  border-radius: var(--radius-chip, 999px);
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
  font-weight: 800;
  height: 36px;
  padding: 0 var(--space-3);
  cursor: pointer;
}

.errand-order-timeline-view__cancel:disabled {
  opacity: 0.5;
  cursor: progress;
}

.errand-order-timeline-view__share-recruit {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid rgba(31, 167, 160, 0.32);
  border-radius: var(--radius-card);
  background: rgba(31, 167, 160, 0.06);
}

.errand-order-timeline-view__share-recruit-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--lian-muted);
}

.errand-order-timeline-view__share-recruit-cta {
  appearance: none;
  border: 0;
  border-radius: var(--radius-chip, 999px);
  background: var(--lian-primary, #1fa7a0);
  color: #fff;
  font-weight: 800;
  height: 40px;
  padding: 0 var(--space-4);
  cursor: pointer;
}

.errand-order-timeline-view__share-recruit-cta:hover {
  background: var(--lian-primary-deep, #0f6b66);
}

.errand-order-timeline-view__status.is-success {
  background: rgba(31, 167, 160, 0.12);
  color: var(--lian-primary-deep, #0f6b66);
}
</style>
