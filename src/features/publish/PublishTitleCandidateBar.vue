<script setup lang="ts">
/**
 * PublishTitleCandidateBar (PRD V0.2 step D).
 *
 * Title-side mirror of PublishCandidateBar (step B). Same state machine,
 * different slot:
 *
 *   - bar visible + candidate not yet applied → "✨ 帮我起标题"
 *     click → applyTitleCandidate() (saves current title, swaps in the
 *     candidate; the bar morphs into revert mode).
 *   - bar visible + candidate applied        → "↶ 撤回标题"
 *     click → revertTitleCandidate() (restores the saved title; the bar
 *     morphs back into apply mode).
 *   - bar hidden when there is no candidate, when the candidate equals
 *     the current title, or when the user has typed in the title since
 *     (the watch in createTitleCandidate invalidates the slot).
 *
 * Consumes the title-candidate API via inject so PublishView/PublishComposer
 * don't have to prop-drill the state.
 *
 * Note: this component never sets `titleCandidate` itself. Step D is inert
 * — steps E/F will wire LLM responses into the slot.
 */
import {
  PUBLISH_TITLE_CANDIDATE_APPLY,
  PUBLISH_TITLE_CANDIDATE_REVERT,
  PUBLISH_TITLE_CANDIDATE_LABEL,
} from "../../config/brand";
import { useInjectedTitleCandidate } from "./usePublishDraft";

const candidate = useInjectedTitleCandidate();

function onClick() {
  if (candidate.titleCandidateApplied.value) {
    candidate.revertTitleCandidate();
  } else {
    candidate.applyTitleCandidate();
  }
}
</script>

<template>
  <div
    v-if="candidate.titleCandidateVisible.value"
    class="publish-title-candidate-bar"
    :aria-label="PUBLISH_TITLE_CANDIDATE_LABEL"
    role="status"
    data-testid="publish-title-candidate-bar"
  >
    <button
      type="button"
      class="publish-title-candidate-bar__action"
      :aria-label="
        candidate.titleCandidateApplied.value
          ? PUBLISH_TITLE_CANDIDATE_REVERT
          : PUBLISH_TITLE_CANDIDATE_APPLY
      "
      :data-mode="candidate.titleCandidateApplied.value ? 'revert' : 'apply'"
      data-testid="publish-title-candidate-bar-action"
      @click="onClick"
    >
      {{
        candidate.titleCandidateApplied.value
          ? PUBLISH_TITLE_CANDIDATE_REVERT
          : PUBLISH_TITLE_CANDIDATE_APPLY
      }}
    </button>
  </div>
</template>

<style scoped>
/* Visually quiet — same muted "info/pending" tone as PublishCandidateBar
 * (step B) so the title and body bars read as the same primitive in two
 * placements, not two competing surfaces. */
.publish-title-candidate-bar {
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

.publish-title-candidate-bar__action {
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

.publish-title-candidate-bar__action:focus-visible {
  outline: 2px solid var(--lian-primary, #1fa7a0);
  outline-offset: 2px;
}

.publish-title-candidate-bar__action[data-mode="revert"] {
  background: rgba(31, 167, 160, 0.12);
}
</style>
