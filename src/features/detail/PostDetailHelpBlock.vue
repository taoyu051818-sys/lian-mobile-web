<script setup lang="ts">
/**
 * Help detail block (PRD V0.1 §6.5 / §11.3).
 *
 * Renders the help extension on the post detail panel: status pill, vote
 * count, primary vote/unvote button, and a "view linked event" entry when
 * the help has been promoted to an event.
 *
 * mw#827 PR-3: the primary vote / unvote CTA derives the 6-state
 * vocabulary from the shared `DetailCtaButton`. State mapping
 * (`selectHelpCtaState` in `detailCtaState.ts`):
 *   - `vote`   (clickable)            → `enabled`
 *   - `unvote` (clickable, latched)   → `success` so aria-pressed="true"
 *                                       reads as the toggle-on Apple §5
 *                                       pattern asks for
 *   - busy                            → `loading` (aria-busy)
 *   - resolved / closed               → `disabled` + reason
 *   - notSignedIn                     → `reason` (permission cause)
 *   - actionError                     → `failure`
 *
 * The "查看关联活动" entry stays a secondary action (a tonal `LianButton`
 * ghost) so the visual hierarchy keeps the primary vote CTA on top — this
 * is the "作者管理 / vote / link event 与普通互动的优先级分层" the issue
 * calls out. 普通互动 (like / comment) lives in PostReplyDock and stays
 * unchanged; the dock already owns its own state vocabulary (#130).
 */
import { computed } from "vue";
import {
  HELP_BLOCK_LABEL,
  HELP_DISABLED_CLOSED,
  HELP_DISABLED_NOT_SIGNED_IN,
  HELP_DISABLED_RESOLVED,
  HELP_LINKED_EVENT_LABEL,
  HELP_STATUS_CLOSED,
  HELP_STATUS_LINKED_EVENT,
  HELP_STATUS_OPEN,
  HELP_STATUS_RESOLVED,
  HELP_UNVOTE,
  HELP_VOTE,
  HELP_VOTE_COUNT_PREFIX,
  HELP_VOTE_PENDING,
} from "../../config/brand";
import { helpHasLinkedEvent, type HelpVotePlan } from "../../domain/helpVotePolicy";
import type { HelpPostExtension, HelpStatus } from "../../types/post-extensions";
import LianButton from "../../ui/LianButton.vue";
import DetailCtaButton from "./DetailCtaButton.vue";
import { selectHelpCtaState } from "./detailCtaState";

const props = defineProps<{
  help: HelpPostExtension;
  plan: HelpVotePlan;
  busy: boolean;
  actionError?: string;
  /** Issue #793 — action registry controls button visibility, not block visibility. */
  showAction?: boolean;
  showLinkedEntry?: boolean;
}>();

const emit = defineEmits<{
  act: [];
  openLinkedEvent: [tid: number];
}>();

const STATUS_LABEL: Record<HelpStatus, string> = {
  open: HELP_STATUS_OPEN,
  linked_event: HELP_STATUS_LINKED_EVENT,
  resolved: HELP_STATUS_RESOLVED,
  closed: HELP_STATUS_CLOSED,
};

const statusLabel = computed(() => STATUS_LABEL[props.help.status]);
const voteLabel = computed(() => `${HELP_VOTE_COUNT_PREFIX} ${Math.max(0, props.help.voteCount)}`);
const buttonLabel = computed(() => {
  if (props.busy) return HELP_VOTE_PENDING;
  if (props.plan.mode === "unvote") return HELP_UNVOTE;
  return HELP_VOTE;
});
const disabledReason = computed(() => {
  switch (props.plan.reasonKey) {
    case "alreadyResolved":
      return HELP_DISABLED_RESOLVED;
    case "alreadyClosed":
      return HELP_DISABLED_CLOSED;
    case "notSignedIn":
      return HELP_DISABLED_NOT_SIGNED_IN;
    default:
      return "";
  }
});
const showPrimaryAction = computed(() => props.showAction ?? true);
const showLinkedEntry = computed(() => {
  if (typeof props.showLinkedEntry === "boolean") return props.showLinkedEntry;
  return helpHasLinkedEvent(props.help);
});

// mw#827 PR-3 — derive the 6-state CTA from the existing plan + busy +
// actionError signals. Wrappers do not leak any new state into the
// composable — `useHelpVote` keeps owning the busy / error truth.
const ctaState = computed(() =>
  selectHelpCtaState({
    mode: props.plan.mode,
    enabled: props.plan.enabled,
    reasonKey: props.plan.reasonKey,
    busy: props.busy,
    hasError: Boolean(props.actionError),
  }),
);

// Reason copy lives below the CTA. Reuse the existing brand strings — the
// vocabulary swap doesn't change the user-facing copy.
const ctaMessage = computed(() => {
  if (props.actionError) return props.actionError;
  if (!props.plan.enabled && disabledReason.value) return disabledReason.value;
  return "";
});

function handleAct() {
  if (ctaState.value === "loading" || ctaState.value === "disabled" || ctaState.value === "reason") {
    return;
  }
  emit("act");
}

function handleOpenLinkedEvent() {
  if (typeof props.help.linkedEventTid === "number") {
    emit("openLinkedEvent", props.help.linkedEventTid);
  }
}
</script>

<template>
  <section
    class="post-detail-help-block"
    :aria-label="HELP_BLOCK_LABEL"
    data-testid="post-detail-help-block"
  >
    <header class="post-detail-help-block__header">
      <span class="post-detail-help-block__status" :data-status="help.status">
        {{ statusLabel }}
      </span>
      <span class="post-detail-help-block__votes">{{ voteLabel }}</span>
    </header>

    <DetailCtaButton
      v-if="showPrimaryAction"
      :label="buttonLabel"
      :state="ctaState"
      :message="ctaMessage"
      :data-mode="plan.mode"
      test-id="detail-cta-help-vote"
      message-test-id="post-detail-help-hint"
      @click="handleAct"
    />

    <div
      v-if="showLinkedEntry"
      class="post-detail-help-block__secondary"
      data-testid="post-detail-help-secondary-row"
    >
      <LianButton
        variant="ghost"
        size="md"
        class="post-detail-help-block__linked"
        data-testid="post-detail-help-linked-event"
        @click="handleOpenLinkedEvent"
      >
        {{ HELP_LINKED_EVENT_LABEL }}
      </LianButton>
    </div>
  </section>
</template>

<style scoped>
.post-detail-help-block {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-card, 12px);
  background: var(--lian-surface-2, rgba(255, 255, 255, 0.6));
}

.post-detail-help-block__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.post-detail-help-block__status {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--space-2);
  height: 24px;
  border-radius: var(--radius-chip, 999px);
  background: rgba(220, 130, 50, 0.14);
  color: #a05d18;
  font-weight: 700;
  font-size: 13px;
}

.post-detail-help-block__status[data-status="resolved"] {
  background: rgba(80, 160, 100, 0.16);
  color: #2f6f47;
}

.post-detail-help-block__status[data-status="closed"] {
  background: rgba(120, 120, 120, 0.16);
  color: #444;
}

.post-detail-help-block__status[data-status="linked_event"] {
  background: rgba(60, 120, 200, 0.14);
  color: #2858a5;
}

.post-detail-help-block__votes {
  color: var(--lian-muted);
  font-size: 13px;
}

/*
 * Visual hierarchy (mw#827 PR-3): the secondary "linked event" row sits
 * below the primary vote CTA at lower contrast. Smaller font + muted ink
 * keeps the primary vote CTA dominant. 普通互动 (like / comment) lives in
 * the reply dock and stays at its existing contrast — outside this block.
 */
.post-detail-help-block__secondary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.post-detail-help-block__linked {
  font-size: 13px;
}
</style>
