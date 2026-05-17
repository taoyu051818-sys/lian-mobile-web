<script setup lang="ts">
import { TagChip } from "../../ui";
import {
  PUBLISH_TAG_SETTINGS,
  PUBLISH_TAG_LABEL,
  PUBLISH_TAG_HINT,
  PUBLISH_POST_TAG,
  PUBLISH_TAG_PLACEHOLDER,
  PUBLISH_TAG_PREVIEW,
  PUBLISH_IDENTITY_TAG,
  PUBLISH_NO_IDENTITY_TAG,
  PUBLISH_VISIBILITY,
} from "../../config/brand";
import type { PublishVisibility } from "../../types/publish";

const props = defineProps<{
  tagPanelOpen: boolean;
  visibilityPanelOpen: boolean;
  tagInput: string;
  normalizedTag: string;
  identityTag: string;
  identityTagOptions: string[];
  visibility: PublishVisibility;
  visibilityOptions: Array<{ value: PublishVisibility; label: string }>;
  visibilityLabel: string;
  // PRD V0.1 §3.1 — backend-driven gating. Optional: when omitted (older
  // wiring), every option behaves as enabled.
  isVisibilityAllowed?: (value: PublishVisibility) => boolean;
  visibilityDisabledReason?: (value: PublishVisibility) => string;
}>();

const emit = defineEmits<{
  "update:tagInput": [value: string];
  "update:identityTag": [value: string];
  "update:visibility": [value: PublishVisibility];
}>();

function isAllowed(value: PublishVisibility): boolean {
  return props.isVisibilityAllowed ? props.isVisibilityAllowed(value) : true;
}
function disabledReasonFor(value: PublishVisibility): string {
  return props.visibilityDisabledReason ? props.visibilityDisabledReason(value) : "";
}
function selectVisibility(value: PublishVisibility) {
  if (!isAllowed(value)) return;
  emit("update:visibility", value);
}
</script>

<template>
  <section
    v-if="tagPanelOpen || normalizedTag || identityTag"
    class="publish-meta__panel"
    :aria-label="PUBLISH_TAG_SETTINGS"
  >
    <div class="publish-meta__panel-header">
      <strong>{{ PUBLISH_TAG_LABEL }}</strong>
      <span>{{ PUBLISH_TAG_HINT }}</span>
    </div>

    <label class="publish-meta__field publish-meta__field--compact">
      <span>{{ PUBLISH_POST_TAG }}</span>
      <input
        :value="tagInput"
        maxlength="18"
        :placeholder="PUBLISH_TAG_PLACEHOLDER"
        @input="emit('update:tagInput', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <div v-if="normalizedTag" class="publish-meta__tags" :aria-label="PUBLISH_TAG_PREVIEW">
      <TagChip :tag="normalizedTag" />
    </div>

    <label
      v-if="identityTagOptions.length"
      class="publish-meta__field publish-meta__field--compact"
    >
      <span>{{ PUBLISH_IDENTITY_TAG }}</span>
      <select
        :value="identityTag"
        @change="emit('update:identityTag', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ PUBLISH_NO_IDENTITY_TAG }}</option>
        <option v-for="tag in identityTagOptions" :key="tag" :value="tag">{{ tag }}</option>
      </select>
    </label>
  </section>

  <section
    v-if="visibilityPanelOpen"
    class="publish-meta__panel"
    aria-labelledby="publish-visibility-title"
  >
    <div class="publish-meta__panel-header">
      <strong id="publish-visibility-title">{{ PUBLISH_VISIBILITY }}</strong>
      <span>{{ visibilityLabel }}</span>
    </div>
    <div class="publish-meta__visibility-grid">
      <button
        v-for="option in visibilityOptions"
        :key="option.value"
        type="button"
        class="publish-meta__visibility"
        :class="{
          'is-active': visibility === option.value,
          'is-disabled': !isAllowed(option.value),
        }"
        :disabled="!isAllowed(option.value)"
        :title="disabledReasonFor(option.value) || undefined"
        :aria-disabled="!isAllowed(option.value)"
        @click="selectVisibility(option.value)"
      >
        <strong>{{ option.label }}</strong>
        <span
          v-if="!isAllowed(option.value) && disabledReasonFor(option.value)"
          class="publish-meta__visibility-reason"
        >
          {{ disabledReasonFor(option.value) }}
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.publish-meta__panel {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: calc(var(--radius-card) + 2px);
  background: rgba(255, 255, 255, 0.56);
}

.publish-meta__panel-header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.publish-meta__panel-header span {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 800;
}

.publish-meta__field {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 800;
}

.publish-meta__field input,
.publish-meta__field select {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  border: 0;
  border-radius: var(--radius-3);
  background: transparent;
  color: var(--lian-ink);
  font: inherit;
}

.publish-meta__field input {
  padding: 0;
}

.publish-meta__field select {
  padding: 0 var(--space-3);
}

.publish-meta__field--compact {
  gap: 6px;
}

.publish-meta__field span {
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.publish-meta__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: flex-start;
}

.publish-meta__visibility-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}

.publish-meta__visibility {
  display: grid;
  min-height: 54px;
  place-items: center;
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.1);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.74);
  color: var(--lian-ink);
  text-align: center;
}

.publish-meta__visibility.is-active {
  border-color: rgba(31, 167, 160, 0.3);
  background: rgba(31, 167, 160, 0.14);
}

.publish-meta__visibility.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.publish-meta__visibility-reason {
  display: block;
  margin-top: 4px;
  color: var(--lian-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: normal;
  text-transform: none;
}

@media (max-width: 640px) {
  .publish-meta__visibility-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
