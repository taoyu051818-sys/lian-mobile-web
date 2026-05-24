<script setup lang="ts">
/**
 * Event detail block (PRD V0.1 §6.3).
 *
 * Renders the event extension on the post detail panel: status pill, time
 * range, participant count, and a primary join/cancel-join button. The button
 * only enables when `planEventAction()` says it should — disabled state shows
 * the localized reason (full / out-of-scope / not open / already-ended).
 *
 * Issue #703 — when the viewer is the author or an admin (decided upstream by
 * `usePostDetailExtensions`), a creator-side "结束活动" button appears next to
 * the participant action. Clicking it opens an Apple-style confirm sheet; the
 * actual POST happens only on explicit confirm.
 *
 * Apple-gap wave 3-A / mw#827 PR-2 — the primary join/cancel CTA derives its
 * 6-state visual + ARIA contract (enabled / loading / disabled / reason) from
 * the shared `DetailCtaButton`, same as the merchant pilot in PR-1 (#840).
 * `selectEventDetailCtaState` maps `EventActionPlan` + `busy` to that vocab
 * so the view never grows its own ad-hoc `:disabled || busy` ladder. The
 * creator-side `结束活动` button stays bare for now and is covered by the
 * cta-shared-base allowlist — wave 3-B (PR-3 trade/help) owns that migration.
 *
 * All copy comes from brand/i18n; the view only does layout + accessibility.
 */
import { computed, ref } from "vue";
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
  EVENT_REWARD_LABEL,
  EVENT_COMPLETE_BUTTON_LABEL,
  EVENT_COMPLETE_CONFIRM_TITLE,
  EVENT_COMPLETE_CONFIRM_BODY,
  EVENT_COMPLETE_CONFIRM,
  EVENT_COMPLETE_CANCEL,
  EVENT_COMPLETE_PENDING,
} from "../../config/brand";
import {
  derivedEventStatus,
  type EventActionPlan,
  type EventStatus,
} from "../../domain/eventActionPolicy";
import type { EventPostExtension } from "../../types/post-extensions";
import DetailCtaButton from "./DetailCtaButton.vue";
import PostDetailEventSettlement from "./PostDetailEventSettlement.vue";
import { selectEventDetailCtaState } from "./eventDetailCtaState";

const props = withDefaults(
  defineProps<{
    event: EventPostExtension;
    plan: EventActionPlan;
    busy: boolean;
    actionError?: string;
    /** Issue #703 — viewer is author OR admin. Decided upstream. */
    manageable?: boolean;
    completeBusy?: boolean;
    completeActionError?: string;
    /** Issue #793 — action registry controls button visibility, not block visibility. */
    showAction?: boolean;
    showCompleteAction?: boolean;
  }>(),
  {
    actionError: undefined,
    manageable: false,
    completeBusy: false,
    completeActionError: undefined,
  },
);

const emit = defineEmits<{
  act: [];
  complete: [];
}>();

const STATUS_LABEL: Record<EventStatus, string> = {
  open: EVENT_STATUS_OPEN,
  full: EVENT_STATUS_FULL,
  closed: EVENT_STATUS_CLOSED,
  completed: EVENT_STATUS_COMPLETED,
  cancelled: EVENT_STATUS_CANCELLED,
};

// Issue #703 — server-driven status takes precedence when present.
// `derivedEventStatus` is owned by F2 / #704; we read it but do not change it.
const status = computed<EventStatus>(() => {
  if (props.event.status === "completed" || props.event.status === "cancelled") {
    return props.event.status;
  }
  return derivedEventStatus(props.event);
});
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

// Apple-gap wave 3-A / mw#827 PR-2 — derive the shared 6-state CTA token
// from the policy + busy bit. The state owns the visual/ARIA contract:
//   join/cancel + enabled        → enabled
//   busy                         → loading (aria-busy="true")
//   notSignedIn / outOfScope     → reason  (data-cta-cause="permission")
//   alreadyEnded / full / notOpen → disabled (data-cta-cause="state")
// Click is gated at `plan.enabled || busy` exactly as before so this is a
// presentation refactor, not a behavior change.
const primaryCtaState = computed(() =>
  selectEventDetailCtaState({ plan: props.plan, busy: props.busy }),
);

// The reason copy stays where it always was (separate `<p>` line below the
// CTA) so existing structure tests continue to pass byte-identically. The
// shared CTA wrapper exposes a `message` slot, but we keep the dedicated
// `__hint` line so the block layout (and the reward / error siblings) does
// not shift.
const showPrimaryReason = computed(
  () => Boolean(disabledReason.value) && !props.plan.enabled && !props.busy,
);

const showPrimaryAction = computed(() => props.showAction ?? true);

// Issue #703 — completion button is hidden (not just disabled) when:
//   - viewer is not author/admin (manageable === false)
//   - status already completed/cancelled
// Issue #793 lets the upstream action registry override this button-level
// visibility without affecting whether the event block itself renders.
const showCompleteButton = computed(() => {
  if (typeof props.showCompleteAction === "boolean") return props.showCompleteAction;
  if (!props.manageable) return false;
  if (status.value === "completed" || status.value === "cancelled") return false;
  return true;
});

const completeLabel = computed(() =>
  props.completeBusy ? EVENT_COMPLETE_PENDING : EVENT_COMPLETE_BUTTON_LABEL,
);

const confirmOpen = ref(false);

function openConfirm() {
  if (!showCompleteButton.value || props.completeBusy) return;
  confirmOpen.value = true;
}

function dismissConfirm() {
  confirmOpen.value = false;
}

function confirmComplete() {
  if (props.completeBusy) return;
  confirmOpen.value = false;
  emit("complete");
}

// Issue #705 — read-only post-settlement readout. Drives a `v-if` on the
// settled-reward block so events without a settlement render exactly as today.
const settlement = computed(() => props.event.rewardSettlement);
</script>

<template>
  <section
    class="post-detail-event-block"
    :aria-label="EVENT_BLOCK_LABEL"
    data-testid="post-detail-event-block"
  >
    <header class="post-detail-event-block__header">
      <span class="post-detail-event-block__status" :data-status="status">
        {{ statusLabel }}
      </span>
      <span v-if="timeRangeLabel" class="post-detail-event-block__time">
        {{ timeRangeLabel }}
      </span>
    </header>

    <p class="post-detail-event-block__participants">{{ participantLabel }}</p>

    <div
      v-if="event.rewardSummary"
      class="post-detail-event-block__reward"
      data-testid="post-detail-event-reward"
    >
      <span class="post-detail-event-block__reward-label">{{ EVENT_REWARD_LABEL }}</span>
      <span class="post-detail-event-block__reward-body">{{ event.rewardSummary }}</span>
    </div>

    <PostDetailEventSettlement
      v-if="settlement"
      :settlement="settlement"
    />

    <div v-if="showPrimaryAction || showCompleteButton" class="post-detail-event-block__actions">
      <DetailCtaButton
        v-if="showPrimaryAction"
        class="post-detail-event-block__primary-cta"
        :label="buttonLabel"
        :state="primaryCtaState"
        test-id="post-detail-event-action"
        :data-mode="plan.mode"
        @click="emit('act')"
      />

      <button
        v-if="showCompleteButton"
        type="button"
        class="post-detail-event-block__action post-detail-event-block__action--complete"
        :disabled="completeBusy"
        :aria-disabled="completeBusy"
        data-testid="post-detail-event-complete-action"
        @click="openConfirm"
      >
        {{ completeLabel }}
      </button>
    </div>

    <p v-if="showPrimaryAction && showPrimaryReason" class="post-detail-event-block__hint">
      {{ disabledReason }}
    </p>

    <p v-if="actionError" class="post-detail-event-block__error" role="alert">
      {{ actionError }}
    </p>

    <p
      v-if="completeActionError"
      class="post-detail-event-block__error"
      role="alert"
      data-testid="post-detail-event-complete-error"
    >
      {{ completeActionError }}
    </p>

    <Teleport to="body">
      <div
        v-if="confirmOpen"
        class="post-detail-event-block__confirm"
        role="dialog"
        aria-modal="true"
        :aria-label="EVENT_COMPLETE_CONFIRM_TITLE"
        data-testid="post-detail-event-complete-confirm"
      >
        <div class="post-detail-event-block__confirm-backdrop" @click="dismissConfirm" />
        <section class="post-detail-event-block__confirm-panel">
          <h2 class="post-detail-event-block__confirm-title">
            {{ EVENT_COMPLETE_CONFIRM_TITLE }}
          </h2>
          <p class="post-detail-event-block__confirm-body">
            {{ EVENT_COMPLETE_CONFIRM_BODY }}
          </p>
          <div class="post-detail-event-block__confirm-actions">
            <button
              type="button"
              class="post-detail-event-block__confirm-button post-detail-event-block__confirm-button--cancel"
              :disabled="completeBusy"
              data-testid="post-detail-event-complete-cancel"
              @click="dismissConfirm"
            >
              {{ EVENT_COMPLETE_CANCEL }}
            </button>
            <button
              type="button"
              class="post-detail-event-block__confirm-button post-detail-event-block__confirm-button--primary"
              :disabled="completeBusy"
              data-testid="post-detail-event-complete-submit"
              @click="confirmComplete"
            >
              {{ completeBusy ? EVENT_COMPLETE_PENDING : EVENT_COMPLETE_CONFIRM }}
            </button>
          </div>
        </section>
      </div>
    </Teleport>
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

.post-detail-event-block__reward {
  display: grid;
  gap: 2px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-3, 8px);
  background: rgba(31, 167, 160, 0.08);
}

.post-detail-event-block__reward-label {
  color: var(--lian-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.post-detail-event-block__reward-body {
  color: var(--lian-ink);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.post-detail-event-block__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
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

.post-detail-event-block__action--complete {
  background: rgba(120, 120, 120, 0.16);
  color: #444;
  border: 1px solid rgba(120, 120, 120, 0.28);
}

.post-detail-event-block__action--complete:disabled {
  background: rgba(120, 120, 120, 0.16);
  color: rgba(60, 60, 60, 0.6);
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

.post-detail-event-block__confirm {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.post-detail-event-block__confirm-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.32);
}

.post-detail-event-block__confirm-panel {
  position: relative;
  width: min(420px, 100%);
  margin: 0 var(--space-3) calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
  padding: var(--space-4);
  border-radius: var(--radius-card, 14px);
  background: var(--lian-surface-1, rgba(255, 255, 255, 0.96));
  display: grid;
  gap: var(--space-3);
}

.post-detail-event-block__confirm-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--lian-ink);
}

.post-detail-event-block__confirm-body {
  margin: 0;
  color: var(--lian-muted);
  font-size: 14px;
  line-height: 1.5;
}

.post-detail-event-block__confirm-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

.post-detail-event-block__confirm-button {
  appearance: none;
  border: 0;
  border-radius: var(--radius-chip, 999px);
  height: 40px;
  padding: 0 var(--space-4);
  font-weight: 800;
  cursor: pointer;
}

.post-detail-event-block__confirm-button--cancel {
  background: rgba(120, 120, 120, 0.12);
  color: var(--lian-ink);
}

.post-detail-event-block__confirm-button--primary {
  background: var(--lian-danger, #a14040);
  color: white;
}

.post-detail-event-block__confirm-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
