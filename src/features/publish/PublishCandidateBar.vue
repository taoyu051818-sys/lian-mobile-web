<script setup lang="ts">
/**
 * PublishCandidateBar (PRD V0.2 step B).
 *
 * Surfaces the LLM-polished body candidate as an explicit, opt-in action:
 *
 *   - bar visible + candidate not yet applied → "✨ 帮我润色"
 *     click → applyBodyCandidate() (saves current body, swaps in the
 *     candidate; the bar morphs into revert mode).
 *   - bar visible + candidate applied        → "↶ 撤回润色"
 *     click → revertBodyCandidate() (restores the saved body; the bar
 *     morphs back into apply mode).
 *   - bar hidden when there is no candidate, when the candidate equals
 *     the current body, or when the user has typed in the body since
 *     (the watch in createBodyCandidate invalidates the slot).
 *
 * Consumes the candidate API via inject so PublishView/PublishComposer
 * don't have to prop-drill the state through every layer.
 *
 * Note: this component never sets `bodyCandidate` itself. Step B is
 * inert — step C will wire LLM responses into the slot.
 */
import {
  PUBLISH_BODY_CANDIDATE_APPLY,
  PUBLISH_BODY_CANDIDATE_REVERT,
  PUBLISH_BODY_CANDIDATE_LABEL,
} from "../../config/brand";
import { useInjectedBodyCandidate } from "./usePublishDraft";

const candidate = useInjectedBodyCandidate();

function onClick() {
  if (candidate.bodyCandidateApplied.value) {
    candidate.revertBodyCandidate();
  } else {
    candidate.applyBodyCandidate();
  }
}
</script>

<template>
  <div
    v-if="candidate.bodyCandidateVisible.value"
    class="publish-candidate-bar"
    :aria-label="PUBLISH_BODY_CANDIDATE_LABEL"
    role="status"
    data-testid="publish-candidate-bar"
  >
    <button
      type="button"
      class="publish-candidate-bar__action"
      :aria-label="
        candidate.bodyCandidateApplied.value
          ? PUBLISH_BODY_CANDIDATE_REVERT
          : PUBLISH_BODY_CANDIDATE_APPLY
      "
      :data-mode="candidate.bodyCandidateApplied.value ? 'revert' : 'apply'"
      data-testid="publish-candidate-bar-action"
      @click="onClick"
    >
      {{
        candidate.bodyCandidateApplied.value
          ? PUBLISH_BODY_CANDIDATE_REVERT
          : PUBLISH_BODY_CANDIDATE_APPLY
      }}
    </button>
  </div>
</template>

<style scoped>
/* Visually quiet — mirrors PublishMessage's muted "info/pending" tone so the
 * bar reads as an opt-in suggestion strip, not a default-popped warning. */
.publish-candidate-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px dashed rgba(31, 167, 160, 0.3);
  border-radius: var(--radius-card);
  background: rgba(31, 167, 160, 0.06);
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
}

.publish-candidate-bar__action {
  appearance: none;
  border: 1px solid rgba(31, 167, 160, 0.32);
  border-radius: var(--radius-chip, 999px);
  background: rgba(255, 255, 255, 0.84);
  color: var(--lian-primary, #1fa7a0);
  font: inherit;
  font-weight: 800;
  min-height: 32px;
  padding: 4px var(--space-3);
  cursor: pointer;
}

.publish-candidate-bar__action:focus-visible {
  outline: 2px solid var(--lian-primary, #1fa7a0);
  outline-offset: 2px;
}

.publish-candidate-bar__action[data-mode="revert"] {
  background: rgba(31, 167, 160, 0.12);
}
</style>
