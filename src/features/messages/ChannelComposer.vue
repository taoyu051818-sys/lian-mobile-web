<script setup lang="ts">
import { computed, ref } from "vue";
import { IdentityBadge, InlineError, LianButton, LianIcon } from "../../ui";
import type { LianIconName } from "../../ui";
import type { AudienceVisibility } from "../../types/audience";
import {
  CHANNEL_DEFAULT_TAG,
  COMPOSER_IDENTITY_SIGNAL,
  COMPOSER_NO_IDENTITY_SIGNAL,
  COMPOSER_SAY_SOMETHING,
  COMPOSER_SEND,
  COMPOSER_VISIBILITY_LABEL,
  COMPOSER_VISIBILITY_PUBLIC,
  COMPOSER_VISIBILITY_CAMPUS,
  COMPOSER_VISIBILITY_SCHOOL,
  COMPOSER_VISIBILITY_PRIVATE,
  COMPOSER_VISIBILITY_LINK_ONLY,
  COMPOSER_CHAR_LIMIT,
  COMPOSER_CHAR_COUNT,
} from "../../config/brand";

interface VisibilityOption {
  value: AudienceVisibility;
  label: string;
  icon: LianIconName;
  disabled?: boolean;
}

const props = defineProps<{
  avatarText: string;
  actorName: string;
  signalMeta: string;
  identityTags: string[];
  content: string;
  identityTag: string;
  visibility: AudienceVisibility;
  sending: boolean;
  sendError: string;
  isGuest: boolean;
}>();

const emit = defineEmits<{
  "update:content": [value: string];
  "update:identityTag": [value: string];
  "update:visibility": [value: AudienceVisibility];
  submit: [];
}>();

const composerRef = ref<HTMLElement | null>(null);
const focused = ref(false);
const isCompact = computed(() => !props.content.trim() && !focused.value);

const charCount = computed(() => props.content.length);
const isOverLimit = computed(() => charCount.value > COMPOSER_CHAR_LIMIT);
const isNearLimit = computed(() => charCount.value >= COMPOSER_CHAR_LIMIT * 0.9);
const charCountText = computed(() =>
  COMPOSER_CHAR_COUNT.replace("{n}", String(charCount.value)).replace(
    "{max}",
    String(COMPOSER_CHAR_LIMIT),
  ),
);
const canSubmit = computed(
  () => props.content.trim().length > 0 && !isOverLimit.value && !props.sending,
);

const visibilityOptions = computed((): VisibilityOption[] => [
  { value: "public", label: COMPOSER_VISIBILITY_PUBLIC, icon: "globe", disabled: false },
  { value: "campus", label: COMPOSER_VISIBILITY_CAMPUS, icon: "building", disabled: props.isGuest },
  {
    value: "school",
    label: COMPOSER_VISIBILITY_SCHOOL,
    icon: "graduation-cap",
    disabled: props.isGuest,
  },
  { value: "private", label: COMPOSER_VISIBILITY_PRIVATE, icon: "lock", disabled: props.isGuest },
  {
    value: "linkOnly",
    label: COMPOSER_VISIBILITY_LINK_ONLY,
    icon: "link",
    disabled: props.isGuest,
  },
]);

const selectedVisibilityOption = computed(
  () =>
    visibilityOptions.value.find((opt) => opt.value === props.visibility) ||
    visibilityOptions.value[0],
);

function handleFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as HTMLElement | null;
  if (next && composerRef.value?.contains(next)) return;
  focused.value = false;
}

function selectVisibility(value: AudienceVisibility) {
  const option = visibilityOptions.value.find((opt) => opt.value === value);
  if (option && !option.disabled) {
    emit("update:visibility", value);
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (canSubmit.value) {
      emit("submit");
    }
  }
}
</script>

<template>
  <form
    ref="composerRef"
    class="messages-view__composer"
    :class="{ 'messages-view__composer--compact': isCompact }"
    data-testid="channel-composer"
    @submit.prevent="emit('submit')"
    @focusin="focused = true"
    @focusout="handleFocusOut"
  >
    <IdentityBadge
      v-if="!isCompact"
      :avatar-text="avatarText"
      :label="actorName"
      :meta="signalMeta"
    />
    <label v-if="!isCompact && identityTags.length" class="messages-view__field">
      <span>{{ COMPOSER_IDENTITY_SIGNAL }}</span>
      <select
        :value="identityTag"
        @input="emit('update:identityTag', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ COMPOSER_NO_IDENTITY_SIGNAL }}</option>
        <option v-for="tag in identityTags" :key="tag" :value="tag">{{ tag }}</option>
      </select>
    </label>
    <div v-if="!isCompact" class="messages-view__field">
      <span>{{ COMPOSER_VISIBILITY_LABEL }}</span>
      <div
        class="messages-view__visibility-chips"
        role="radiogroup"
        :aria-label="COMPOSER_VISIBILITY_LABEL"
      >
        <button
          v-for="opt in visibilityOptions"
          :key="opt.value"
          type="button"
          class="messages-view__visibility-chip"
          :class="{
            'messages-view__visibility-chip--selected': visibility === opt.value,
            'messages-view__visibility-chip--disabled': opt.disabled,
          }"
          :aria-pressed="visibility === opt.value"
          :aria-disabled="opt.disabled"
          :disabled="opt.disabled"
          @click="selectVisibility(opt.value)"
        >
          <LianIcon :name="opt.icon" :size="16" />
          <span>{{ opt.label }}</span>
        </button>
      </div>
    </div>
    <div class="messages-view__input-row">
      <div v-if="isCompact" class="messages-view__compact-visibility">
        <LianIcon
          :name="selectedVisibilityOption.icon"
          :size="18"
          :title="selectedVisibilityOption.label"
        />
      </div>
      <label class="messages-view__field messages-view__field--content">
        <span v-if="!isCompact">{{ COMPOSER_SAY_SOMETHING }}</span>
        <textarea
          :value="content"
          :rows="isCompact ? 1 : 3"
          :placeholder="`发到${CHANNEL_DEFAULT_TAG}…`"
          :maxlength="COMPOSER_CHAR_LIMIT + 50"
          @input="emit('update:content', ($event.target as HTMLTextAreaElement).value)"
          @keydown="handleKeydown"
        />
        <span
          v-if="!isCompact && charCount > 0"
          class="messages-view__char-count"
          :class="{
            'messages-view__char-count--warning': isNearLimit && !isOverLimit,
            'messages-view__char-count--error': isOverLimit,
          }"
        >
          {{ charCountText }}
        </span>
      </label>
      <LianButton
        type="submit"
        :loading="sending"
        :disabled="!canSubmit"
        data-testid="channel-send-button"
        >{{ COMPOSER_SEND }}</LianButton
      >
    </div>
    <InlineError v-if="sendError">{{ sendError }}</InlineError>
  </form>
</template>

<style scoped>
.messages-view__composer {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
}

.messages-view__composer.messages-view__composer--compact {
  gap: 0;
}

.messages-view__field {
  display: grid;
  gap: var(--space-2);
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 800;
}

.messages-view__field select,
.messages-view__field textarea {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-button);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
}

.messages-view__field textarea {
  resize: vertical;
  padding: var(--space-3);
  line-height: 1.5;
}

.messages-view__field textarea::placeholder {
  color: var(--lian-faint);
}

.messages-view__field select {
  padding: 0 var(--space-3);
}

.messages-view__input-row {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
}

.messages-view__input-row .messages-view__field--content {
  flex: 1;
  min-width: 0;
}

.messages-view__composer.messages-view__composer--compact .messages-view__field textarea {
  min-height: 40px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-button);
}

.messages-view__composer.messages-view__composer--compact .messages-view__input-row {
  align-items: center;
}

.messages-view__visibility-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.messages-view__visibility-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-button);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.15s,
    border-color 0.15s,
    color 0.15s;
}

.messages-view__visibility-chip:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.9);
  border-color: var(--lian-accent);
}

.messages-view__visibility-chip--selected {
  background: var(--lian-accent);
  border-color: var(--lian-accent);
  color: white;
}

.messages-view__visibility-chip--selected:hover:not(:disabled) {
  background: var(--lian-accent);
  border-color: var(--lian-accent);
}

.messages-view__visibility-chip--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.messages-view__compact-visibility {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 40px;
  color: var(--lian-muted);
}

.messages-view__field--content {
  position: relative;
}

.messages-view__char-count {
  position: absolute;
  right: var(--space-2);
  bottom: var(--space-2);
  font-size: 11px;
  color: var(--lian-faint);
  pointer-events: none;
  transition: color var(--motion-fast) var(--motion-ease-standard);
}

.messages-view__char-count--warning {
  color: var(--lian-warning, #e6a700);
}

.messages-view__char-count--error {
  color: var(--lian-error, #dc3545);
}
</style>
