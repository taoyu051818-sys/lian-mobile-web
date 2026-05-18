<script setup lang="ts">
/**
 * Event detail block (PRD V0.1 §6.3).
 *
 * Renders the event extension on the post detail panel: status pill, time
 * range, participant count, and a primary join/cancel-join button. The button
 * only enables when `planEventAction()` says it should — disabled state shows
 * the localized reason (full / out-of-scope / not open / already-ended).
 *
 * All copy comes from brand/i18n; the view only does layout + accessibility.
 */
import { computed } from "vue";
import {
  EVENT_BLOCK_LABEL,
  EVENT_STATUS_OPEN,
  EVENT_STATUS_FULL,
  EVENT_STATUS_CLOSED,
  EVENT_STATUS_COMPLETED,
  EVENT_STATUS_CANCELLED,
  EVENT_TIME_RANGE_SEPARATOR,
  EVENT_PARTICIPANT_PREFIX,
  EVENT_PARTICIPANT_OF,
  EVENT_CAPACITY_UNLIMITED,
  EVENT_JOIN,
  EVENT_CANCEL_JOIN,
  EVENT_JOIN_PENDING,
  EVENT_DISABLED_NOT_OPEN,
  EVENT_DISABLED_FULL,
  EVENT_DISABLED_OUT_OF_SCOPE,
} from "../../config/brand";
import {
  derivedEventStatus,
  type EventActionPlan,
  type EventStatus,
} from "../../domain/eventActionPolicy";
import type { EventPostExtension } from "../../types/post-extensions";

const props = defineProps<{
  event: EventPostExtension;
  plan: EventActionPlan;
  busy: boolean;
  actionError?: string;
}>();

const emit = defineEmits<{
  act: [];
}>();

const STATUS_LABEL: Record<EventStatus, string> = {
  open: EVENT_STATUS_OPEN,
  full: EVENT_STATUS_FULL,
  closed: EVENT_STATUS_CLOSED,
  completed: EVENT_STATUS_COMPLETED,
  cancelled: EVENT_STATUS_CANCELLED,
};

const status = computed<EventStatus>(() => derivedEventStatus(props.event));
const statusLabel = computed(() => STATUS_LABEL[status.value]);

const participantLabel = computed(() => {
  const cap =
    typeof props.event.capacity === "number" && props.event.capacity > 0
      ? String(props.event.capacity)
      : EVENT_CAPACITY_UNLIMITED;
  return `${EVENT_PARTICIPANT_PREFIX} ${props.event.joinedCount}${EVENT_PARTICIPANT_OF}${cap}`;
});

const timeRangeLabel = computed(() => {
  const { startsAt, endsAt } = props.event;
  if (startsAt && endsAt) return `${startsAt} ${EVENT_TIME_RANGE_SEPARATOR} ${endsAt}`;
  if (startsAt) return startsAt;
  if (endsAt) return endsAt;
  return "";
});

const buttonLabel = computed(() => {
  if (props.busy) return EVENT_JOIN_PENDING;
  if (props.plan.mode === "cancel") return EVENT_CANCEL_JOIN;
  return EVENT_JOIN;
});

const disabledReason = computed(() => {
  switch (props.plan.reasonKey) {
    case "notOpen":
    case "alreadyEnded":
      return EVENT_DISABLED_NOT_OPEN;
    case "full":
      return EVENT_DISABLED_FULL;
    case "outOfScope":
      return EVENT_DISABLED_OUT_OF_SCOPE;
    default:
      return "";
  }
});
</script>

<template>
  <section
    class="post-detail-event-block"
    :aria-label="EVENT_BLOCK_LABEL"
    data-testid="post-detail-event-block"
  >
    <header class="post-detail-event-block__header">
      <span class="post-detail-event-block__status" :data-status="status">{{ statusLabel }}</span>
      <span v-if="timeRangeLabel" class="post-detail-event-block__time">{{ timeRangeLabel }}</span>
    </header>

    <p class="post-detail-event-block__participants">{{ participantLabel }}</p>

    <button
      type="button"
      class="post-detail-event-block__action"
      :disabled="!plan.enabled || busy"
      :aria-disabled="!plan.enabled || busy"
      :data-mode="plan.mode"
      data-testid="post-detail-event-action"
      @click="emit('act')"
    >
      {{ buttonLabel }}
    </button>

    <p v-if="disabledReason && !plan.enabled" class="post-detail-event-block__hint">
      {{ disabledReason }}
    </p>

    <p v-if="actionError" class="post-detail-event-block__error" role="alert">
      {{ actionError }}
    </p>
  </section>
</template>

<style scoped>
.post-detail-event-block {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-card, 12px);
  background: var(--lian-surface-2, rgba(255, 255, 255, 0.6));
}

.post-detail-event-block__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.post-detail-event-block__status {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--space-2);
  height: 24px;
  border-radius: var(--radius-chip, 999px);
  background: var(--lian-accent-soft, rgba(60, 120, 200, 0.12));
  color: var(--lian-accent, #2858a5);
  font-weight: 700;
  font-size: 13px;
}

.post-detail-event-block__status[data-status="full"],
.post-detail-event-block__status[data-status="closed"],
.post-detail-event-block__status[data-status="cancelled"] {
  background: rgba(180, 90, 90, 0.12);
  color: #a14040;
}

.post-detail-event-block__status[data-status="completed"] {
  background: rgba(120, 120, 120, 0.16);
  color: #444;
}

.post-detail-event-block__time {
  color: var(--lian-muted);
  font-size: 13px;
}

.post-detail-event-block__participants {
  margin: 0;
  color: var(--lian-ink);
  font-size: 14px;
}

.post-detail-event-block__action {
  appearance: none;
  border: 0;
  border-radius: var(--radius-chip, 999px);
  background: var(--lian-accent, #2858a5);
  color: white;
  font-weight: 800;
  height: 40px;
  padding: 0 var(--space-4);
  cursor: pointer;
}

.post-detail-event-block__action:disabled {
  background: rgba(120, 120, 120, 0.32);
  color: rgba(255, 255, 255, 0.84);
  cursor: not-allowed;
}

.post-detail-event-block__action[data-mode="cancel"] {
  background: var(--lian-surface-1, rgba(255, 255, 255, 0.8));
  color: var(--lian-ink);
  border: 1px solid var(--lian-line, rgba(0, 0, 0, 0.12));
}

.post-detail-event-block__hint {
  margin: 0;
  color: var(--lian-muted);
  font-size: 13px;
}

.post-detail-event-block__error {
  margin: 0;
  color: var(--lian-danger, #a14040);
  font-size: 13px;
}
</style>
