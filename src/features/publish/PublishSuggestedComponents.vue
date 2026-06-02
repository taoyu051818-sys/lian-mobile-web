<script setup lang="ts">
/**
 * PublishSuggestedComponents (PRD V0.2 step E-main, §4.2.3).
 *
 * Renders the LLM's `suggestedComponents` ref as a list of inline ghost
 * cards under the body editor. Each card carries:
 *
 *   - a kind-specific emoji + the model's `reason` (already pre-trimmed by
 *     `parseSuggestedComponents` in `aiPreview.ts`),
 *   - an "加入" button that calls `accept(component)` — the actions API
 *     decides per-kind what to materialize on the draft (publishKind /
 *     tagInput / etc.) and removes the entry from the list,
 *   - an "忽略" button that calls `dismiss(component)` and removes the
 *     entry without touching the draft.
 *
 * Visual contract (matches step B `PublishCandidateBar` and step D
 * `PublishTitleCandidateBar`): dashed border, primary tint at low opacity.
 *
 * Reduced-motion: the only animated affordance is the per-card
 * appearance (subtle slide + fade). When `prefers-reduced-motion: reduce`
 * is set we drop the transition entirely — see the
 * `publish-suggested--reduced` BEM modifier in the scoped block below
 * (the state-class vocabulary keeps `.is-*` reserved for the canonical
 * loading / disabled / pressed / etc. set; per-component motion gates
 * use BEM modifiers instead).
 *
 * a11y per PRD §4.2.3:
 *   - the section is a `<ul>` with `aria-label` "AI 建议添加"
 *   - each list item is keyboard-reachable via the two `<button>` actions
 *   - the accept button's `aria-label` reads "建议添加 {label}" so screen
 *     readers announce the LLM's reason verbatim, not just "加入"
 */

import { computed } from "vue";
import {
  PUBLISH_SUGGESTED_ACCEPT,
  PUBLISH_SUGGESTED_COMPONENTS_LABEL,
  PUBLISH_SUGGESTED_DISMISS,
  PUBLISH_SUGGESTED_HINT_PREFIX,
  PUBLISH_SUGGESTED_KIND_ICON_AUDIENCE,
  PUBLISH_SUGGESTED_KIND_ICON_EVENT,
  PUBLISH_SUGGESTED_KIND_ICON_GROUPBUY,
  PUBLISH_SUGGESTED_KIND_ICON_HELP,
  PUBLISH_SUGGESTED_KIND_ICON_LOCATION,
  PUBLISH_SUGGESTED_KIND_ICON_MEDIA,
  PUBLISH_SUGGESTED_KIND_ICON_MERCHANT,
  PUBLISH_SUGGESTED_KIND_ICON_QUALITY,
  PUBLISH_SUGGESTED_KIND_ICON_TAGS,
  PUBLISH_SUGGESTED_KIND_ICON_TIME,
  PUBLISH_SUGGESTED_KIND_ICON_TRADE,
} from "../../config/brand";
import { useReducedMotion } from "../../composables/useReducedMotion";
import type { SuggestedComponent, SuggestedComponentKind } from "../../types/publishSuggestion";
import { useInjectedSuggestedComponentsActions } from "./usePublishDraft";

// V0.3 stage B2 (paired with ps#624): V2 kinds — 11 of them.
const KIND_ICON: Record<SuggestedComponentKind, string> = {
  location: PUBLISH_SUGGESTED_KIND_ICON_LOCATION,
  time: PUBLISH_SUGGESTED_KIND_ICON_TIME,
  media: PUBLISH_SUGGESTED_KIND_ICON_MEDIA,
  quality: PUBLISH_SUGGESTED_KIND_ICON_QUALITY,
  audience: PUBLISH_SUGGESTED_KIND_ICON_AUDIENCE,
  tags: PUBLISH_SUGGESTED_KIND_ICON_TAGS,
  event: PUBLISH_SUGGESTED_KIND_ICON_EVENT,
  merchant: PUBLISH_SUGGESTED_KIND_ICON_MERCHANT,
  trade: PUBLISH_SUGGESTED_KIND_ICON_TRADE,
  help: PUBLISH_SUGGESTED_KIND_ICON_HELP,
  groupbuy: PUBLISH_SUGGESTED_KIND_ICON_GROUPBUY,
};

const actions = useInjectedSuggestedComponentsActions();
const reduced = useReducedMotion();

const items = computed(() => actions.components.value);

function onAccept(component: SuggestedComponent) {
  actions.accept(component);
}

function onDismiss(component: SuggestedComponent) {
  actions.dismiss(component);
}

function acceptAriaLabel(component: SuggestedComponent): string {
  // PRD §4.2.3 a11y: the screen-reader announcement carries the LLM's
  // reason ("建议添加 加个地点"), not just the generic action verb.
  return `${PUBLISH_SUGGESTED_HINT_PREFIX} ${component.label}`;
}
</script>

<template>
  <ul
    v-if="items.length > 0"
    class="publish-suggested"
    :class="{ 'publish-suggested--reduced': reduced }"
    :aria-label="PUBLISH_SUGGESTED_COMPONENTS_LABEL"
    data-testid="publish-suggested-components"
  >
    <li
      v-for="component in items"
      :key="`${component.kind}::${component.label}`"
      class="publish-suggested__item"
      :data-kind="component.kind"
      data-testid="publish-suggested-item"
    >
      <span class="publish-suggested__icon" aria-hidden="true">
        {{ KIND_ICON[component.kind] }}
      </span>
      <span class="publish-suggested__label">
        {{ component.label }}
      </span>
      <div class="publish-suggested__actions">
        <button
          type="button"
          class="publish-suggested__action publish-suggested__action--accept"
          :aria-label="acceptAriaLabel(component)"
          data-testid="publish-suggested-accept"
          @click="onAccept(component)"
        >
          {{ PUBLISH_SUGGESTED_ACCEPT }}
        </button>
        <button
          type="button"
          class="publish-suggested__action publish-suggested__action--dismiss"
          :aria-label="PUBLISH_SUGGESTED_DISMISS"
          data-testid="publish-suggested-dismiss"
          @click="onDismiss(component)"
        >
          {{ PUBLISH_SUGGESTED_DISMISS }}
        </button>
      </div>
    </li>
  </ul>
</template>

<style scoped>
/* Visual language matches PublishCandidateBar (step B) and
 * PublishTitleCandidateBar (step D): dashed primary tint border, very low
 * opacity background, mid-weight muted body text. The `is-ghost` state
 * class exists so a future motion / theme pass can target the whole list
 * without re-deriving the predicate.
 */
.publish-suggested {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.publish-suggested__item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px dashed rgba(31, 167, 160, 0.3);
  border-radius: var(--radius-card);
  background: rgba(31, 167, 160, 0.06);
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
  /* Subtle reveal — kept inside the scoped block so it doesn't leak
   * to neighbouring publish surfaces. The `publish-suggested--reduced`
   * BEM modifier on the <ul> turns this off when prefers-reduced-motion
   * is set.
   */
  transition:
    opacity 160ms var(--motion-ease-standard, ease-out),
    transform 160ms var(--motion-ease-standard, ease-out);
}

.publish-suggested--reduced .publish-suggested__item {
  transition: none;
}

.publish-suggested__icon {
  font-size: 16px;
  line-height: 1;
}

.publish-suggested__label {
  min-width: 0;
  color: var(--lian-ink);
  font-weight: 700;
  word-break: break-word;
}

.publish-suggested__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.publish-suggested__action {
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

.publish-suggested__action:focus-visible {
  outline: 2px solid var(--lian-primary, #1fa7a0);
  outline-offset: 2px;
}

.publish-suggested__action--accept {
  background: rgba(31, 167, 160, 0.12);
}

.publish-suggested__action--dismiss {
  color: var(--lian-muted);
  border-color: rgba(31, 41, 51, 0.16);
}
</style>
