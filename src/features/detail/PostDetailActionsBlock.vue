<script setup lang="ts">
/**
 * Post available actions block (PRD V0.3 §2.4 / B3-1).
 *
 * mw#986 landed `PostDetail.availableActions` as a normalized wire atom —
 * `{ type, enabled?, reason?, reasonText? }`. This block renders a row of
 * buttons, one per action. `enabled === false` produces a disabled button
 * that surfaces `reasonText || reason` via the native `title` tooltip; the
 * label table mirrors `PostDetailRelationsBlock.vue` — known types map to
 * brand strings, unknown types fall back to the literal `type`.
 *
 * Out of scope for B3-1: actually invoking a backend handler. Click only
 * emits `actionInvoked(type)` so a follow-up PR can wire the per-type RPC
 * once the backend publishes the `availableActions[].type` source-of-truth
 * enum.
 */
import { computed } from "vue";
import {
  AVAILABLE_ACTIONS_BLOCK_LABEL,
  AVAILABLE_ACTION_APPROVE_SUBMISSION,
  AVAILABLE_ACTION_CLAIM_REWARD,
  AVAILABLE_ACTION_COMPLETE_ERRAND,
  AVAILABLE_ACTION_MARK_SOLVED,
  AVAILABLE_ACTION_OPEN_SUBMISSION,
  AVAILABLE_ACTION_REQUEST_REVIEW,
  AVAILABLE_ACTION_SUBMIT_REVISION,
} from "../../config/brand";
import type { PostAvailableAction } from "../../types/post";

const props = defineProps<{
  actions?: PostAvailableAction[];
}>();

const emit = defineEmits<{
  actionInvoked: [type: string];
}>();

// Initial mapper. Adding a known type is a brand-string + table change, not
// a renderer change. Unknown types fall back to the `type` literal.
const ACTION_TYPE_LABEL: Record<string, string> = {
  mark_solved: AVAILABLE_ACTION_MARK_SOLVED,
  claim_reward: AVAILABLE_ACTION_CLAIM_REWARD,
  complete_errand: AVAILABLE_ACTION_COMPLETE_ERRAND,
  open_submission: AVAILABLE_ACTION_OPEN_SUBMISSION,
  request_review: AVAILABLE_ACTION_REQUEST_REVIEW,
  submit_revision: AVAILABLE_ACTION_SUBMIT_REVISION,
  approve_submission: AVAILABLE_ACTION_APPROVE_SUBMISSION,
};

function actionTypeLabel(type: string): string {
  return ACTION_TYPE_LABEL[type] ?? type;
}

interface ActionView {
  key: string;
  type: string;
  label: string;
  enabled: boolean;
  tooltip: string;
}

const entries = computed<ActionView[]>(() => {
  const list = props.actions;
  if (!Array.isArray(list) || list.length === 0) return [];
  return list.map((action, index) => {
    // `enabled` defaults to true when absent (PRD V0.3 §2.4).
    const enabled = action.enabled !== false;
    const tooltip = enabled ? "" : action.reasonText || action.reason || "";
    return {
      key: `${action.type}-${index}`,
      type: action.type,
      label: actionTypeLabel(action.type),
      enabled,
      tooltip,
    } satisfies ActionView;
  });
});

function handleClick(view: ActionView) {
  if (!view.enabled) return;
  emit("actionInvoked", view.type);
}
</script>

<template>
  <section
    v-if="entries.length"
    class="post-detail-actions-block"
    :aria-label="AVAILABLE_ACTIONS_BLOCK_LABEL"
    data-testid="post-detail-actions-block"
  >
    <header class="post-detail-actions-block__header">
      <span class="post-detail-actions-block__title">{{ AVAILABLE_ACTIONS_BLOCK_LABEL }}</span>
    </header>
    <div class="post-detail-actions-block__row">
      <button
        v-for="entry in entries"
        :key="entry.key"
        type="button"
        class="post-detail-actions-block__button"
        :data-action-type="entry.type"
        :data-enabled="entry.enabled ? 'true' : 'false'"
        :disabled="!entry.enabled"
        :aria-disabled="!entry.enabled"
        :title="entry.tooltip"
        data-testid="post-detail-actions-button"
        @click="handleClick(entry)"
      >
        {{ entry.label }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.post-detail-actions-block {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-card, 12px);
  background: var(--lian-surface-2, rgba(255, 255, 255, 0.6));
}

.post-detail-actions-block__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.post-detail-actions-block__title {
  color: var(--lian-muted);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.post-detail-actions-block__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.post-detail-actions-block__button {
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

.post-detail-actions-block__button:disabled {
  background: rgba(120, 120, 120, 0.32);
  color: rgba(255, 255, 255, 0.84);
  cursor: not-allowed;
}
</style>
