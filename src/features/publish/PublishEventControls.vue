<script setup lang="ts">
/**
 * Event-publish controls (PRD V0.1 §6.3 / §11.2).
 *
 * Renders the event-only fields on the publish form: post-type chooser
 * (post / event), and when event is picked, startAt / endAt / capacity /
 * joinPolicy. participantScope reuses the existing post-level visibility
 * picker — there's only one audience per post.
 *
 * All copy is brand strings; this view does layout + accessibility only.
 */
import {
  PUBLISH_POST_TYPE_LABEL,
  PUBLISH_POST_TYPE_POST,
  PUBLISH_POST_TYPE_EVENT,
  PUBLISH_EVENT_PANEL_LABEL,
  PUBLISH_EVENT_START_AT,
  PUBLISH_EVENT_END_AT,
  PUBLISH_EVENT_TIME_HINT,
  PUBLISH_EVENT_CAPACITY,
  PUBLISH_EVENT_CAPACITY_PLACEHOLDER,
  PUBLISH_EVENT_JOIN_POLICY,
  PUBLISH_EVENT_JOIN_OPEN,
  PUBLISH_EVENT_JOIN_APPROVAL,
  PUBLISH_EVENT_JOIN_ORG,
  PUBLISH_EVENT_JOIN_SCHOOL,
} from "../../config/brand";
import type { EventJoinPolicy } from "../../types/post-extensions";
import type { PublishPostType } from "../../composables/useEventPublishDraft";

defineProps<{
  postType: PublishPostType;
  startAt: string;
  endAt: string;
  capacity: string;
  joinPolicy: EventJoinPolicy;
}>();

const emit = defineEmits<{
  "update:postType": [value: PublishPostType];
  "update:startAt": [value: string];
  "update:endAt": [value: string];
  "update:capacity": [value: string];
  "update:joinPolicy": [value: EventJoinPolicy];
}>();

const POST_TYPE_OPTIONS: Array<{ value: PublishPostType; label: string }> = [
  { value: "post", label: PUBLISH_POST_TYPE_POST },
  { value: "event", label: PUBLISH_POST_TYPE_EVENT },
];

const JOIN_POLICY_OPTIONS: Array<{ value: EventJoinPolicy; label: string }> = [
  { value: "open", label: PUBLISH_EVENT_JOIN_OPEN },
  { value: "approval_required", label: PUBLISH_EVENT_JOIN_APPROVAL },
  { value: "org_only", label: PUBLISH_EVENT_JOIN_ORG },
  { value: "school_only", label: PUBLISH_EVENT_JOIN_SCHOOL },
];
</script>

<template>
  <section class="publish-event__panel" :aria-label="PUBLISH_POST_TYPE_LABEL">
    <div class="publish-event__panel-header">
      <strong>{{ PUBLISH_POST_TYPE_LABEL }}</strong>
    </div>
    <div class="publish-event__type-grid" role="radiogroup" :aria-label="PUBLISH_POST_TYPE_LABEL">
      <button
        v-for="option in POST_TYPE_OPTIONS"
        :key="option.value"
        type="button"
        class="publish-event__type"
        :class="{ 'is-active': postType === option.value }"
        :data-value="option.value"
        :aria-checked="postType === option.value"
        role="radio"
        @click="emit('update:postType', option.value)"
      >
        <strong>{{ option.label }}</strong>
      </button>
    </div>
  </section>

  <section
    v-if="postType === 'event'"
    class="publish-event__panel"
    :aria-label="PUBLISH_EVENT_PANEL_LABEL"
    data-testid="publish-event-panel"
  >
    <div class="publish-event__panel-header">
      <strong>{{ PUBLISH_EVENT_PANEL_LABEL }}</strong>
      <span>{{ PUBLISH_EVENT_TIME_HINT }}</span>
    </div>

    <label class="publish-event__field">
      <span>{{ PUBLISH_EVENT_START_AT }}</span>
      <input
        type="datetime-local"
        :value="startAt"
        data-testid="publish-event-start-at"
        @input="emit('update:startAt', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="publish-event__field">
      <span>{{ PUBLISH_EVENT_END_AT }}</span>
      <input
        type="datetime-local"
        :value="endAt"
        data-testid="publish-event-end-at"
        @input="emit('update:endAt', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="publish-event__field">
      <span>{{ PUBLISH_EVENT_CAPACITY }}</span>
      <input
        type="number"
        inputmode="numeric"
        min="0"
        :value="capacity"
        :placeholder="PUBLISH_EVENT_CAPACITY_PLACEHOLDER"
        data-testid="publish-event-capacity"
        @input="emit('update:capacity', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="publish-event__field">
      <span>{{ PUBLISH_EVENT_JOIN_POLICY }}</span>
      <select
        :value="joinPolicy"
        data-testid="publish-event-join-policy"
        @change="
          emit('update:joinPolicy', ($event.target as HTMLSelectElement).value as EventJoinPolicy)
        "
      >
        <option v-for="option in JOIN_POLICY_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
  </section>
</template>

<style scoped>
.publish-event__panel {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: calc(var(--radius-card) + 2px);
  background: rgba(255, 255, 255, 0.56);
}

.publish-event__panel-header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.publish-event__panel-header span {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 800;
}

.publish-event__type-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.publish-event__type {
  display: grid;
  min-height: 54px;
  place-items: center;
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.1);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.74);
  color: var(--lian-ink);
  text-align: center;
  cursor: pointer;
}

.publish-event__type.is-active {
  border-color: rgba(31, 167, 160, 0.3);
  background: rgba(31, 167, 160, 0.14);
}

.publish-event__field {
  display: grid;
  gap: 6px;
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 800;
}

.publish-event__field span {
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.publish-event__field input,
.publish-event__field select {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  border: 0;
  border-radius: var(--radius-3);
  background: transparent;
  color: var(--lian-ink);
  font: inherit;
}

.publish-event__field input {
  padding: 0;
}

.publish-event__field select {
  padding: 0 var(--space-3);
}
</style>
