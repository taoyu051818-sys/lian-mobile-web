<script setup lang="ts">
/**
 * Help detail block (PRD V0.1 §6.5 / §11.3).
 *
 * Renders the help extension on the post detail panel: status pill, vote
 * count, primary vote/unvote button, and a "view linked event" entry when
 * the help has been promoted to an event. The button only enables when
 * `planHelpVote()` says it should — disabled state shows the localized
 * reason (resolved / closed / not signed in).
 *
 * All copy comes from brand/i18n; the view only does layout + accessibility.
 */
import { computed } from "vue";
import {
  HELP_BLOCK_LABEL,
  HELP_STATUS_OPEN,
  HELP_STATUS_LINKED_EVENT,
  HELP_STATUS_RESOLVED,
  HELP_STATUS_CLOSED,
  HELP_VOTE_COUNT_PREFIX,
  HELP_VOTE,
  HELP_UNVOTE,
  HELP_VOTE_PENDING,
  HELP_DISABLED_RESOLVED,
  HELP_DISABLED_CLOSED,
  HELP_DISABLED_NOT_SIGNED_IN,
  HELP_LINKED_EVENT_LABEL,
} from "../../config/brand";
import { helpHasLinkedEvent, type HelpVotePlan } from "../../domain/helpVotePolicy";
import type { HelpPostExtension, HelpStatus } from "../../types/post-extensions";

const props = defineProps<{
  help: HelpPostExtension;
  plan: HelpVotePlan;
  busy: boolean;
  actionError?: string;
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
const showLinkedEntry = computed(() => helpHasLinkedEvent(props.help));

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
      <span class="post-detail-help-block__status" :data-status="help.status">{{
        statusLabel
      }}</span>
      <span class="post-detail-help-block__votes">{{ voteLabel }}</span>
    </header>

    <button
      type="button"
      class="post-detail-help-block__action"
      :disabled="!plan.enabled || busy"
      :aria-disabled="!plan.enabled || busy"
      :data-mode="plan.mode"
      data-testid="post-detail-help-action"
      @click="emit('act')"
    >
      {{ buttonLabel }}
    </button>

    <p v-if="disabledReason && !plan.enabled" class="post-detail-help-block__hint">
      {{ disabledReason }}
    </p>

    <button
      v-if="showLinkedEntry"
      type="button"
      class="post-detail-help-block__linked"
      data-testid="post-detail-help-linked-event"
      @click="handleOpenLinkedEvent"
    >
      {{ HELP_LINKED_EVENT_LABEL }}
    </button>

    <p v-if="actionError" class="post-detail-help-block__error" role="alert">
      {{ actionError }}
    </p>
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

.post-detail-help-block__action {
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

.post-detail-help-block__action:disabled {
  background: rgba(120, 120, 120, 0.32);
  color: rgba(255, 255, 255, 0.84);
  cursor: not-allowed;
}

.post-detail-help-block__action[data-mode="unvote"] {
  background: var(--lian-surface-1, rgba(255, 255, 255, 0.8));
  color: var(--lian-ink);
  border: 1px solid var(--lian-line, rgba(0, 0, 0, 0.12));
}

.post-detail-help-block__hint {
  margin: 0;
  color: var(--lian-muted);
  font-size: 13px;
}

.post-detail-help-block__linked {
  appearance: none;
  border: 1px solid var(--lian-line, rgba(0, 0, 0, 0.12));
  border-radius: var(--radius-chip, 999px);
  background: transparent;
  color: var(--lian-accent, #2858a5);
  height: 36px;
  padding: 0 var(--space-3);
  font-weight: 700;
  cursor: pointer;
  align-self: start;
}

.post-detail-help-block__error {
  margin: 0;
  color: var(--lian-danger, #a14040);
  font-size: 13px;
}
</style>
