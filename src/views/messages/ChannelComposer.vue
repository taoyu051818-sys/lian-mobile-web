<script setup lang="ts">
import { computed, ref } from "vue";
import { IdentityBadge, InlineError, LianButton } from "../../ui";

const props = defineProps<{
  avatarText: string;
  actorName: string;
  signalMeta: string;
  identityTags: string[];
  content: string;
  identityTag: string;
  sending: boolean;
  sendError: string;
}>();

const emit = defineEmits<{
  "update:content": [value: string];
  "update:identityTag": [value: string];
  submit: [];
}>();

const composerRef = ref<HTMLElement | null>(null);
const focused = ref(false);
const isCompact = computed(() => !props.content.trim() && !focused.value);

function handleFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as HTMLElement | null;
  if (next && composerRef.value?.contains(next)) return;
  focused.value = false;
}
</script>

<template>
  <form ref="composerRef" class="messages-view__composer" :class="{ 'is-compact': isCompact }" @submit.prevent="emit('submit')" @focusin="focused = true" @focusout="handleFocusOut">
    <IdentityBadge v-if="!isCompact" :avatar-text="avatarText" :label="actorName" :meta="signalMeta" />
    <label v-if="!isCompact && identityTags.length" class="messages-view__field">
      <span>身份信号</span>
      <select :value="identityTag" @input="emit('update:identityTag', ($event.target as HTMLSelectElement).value)">
        <option value="">不使用身份信号</option>
        <option v-for="tag in identityTags" :key="tag" :value="tag">{{ tag }}</option>
      </select>
    </label>
    <div class="messages-view__input-row">
      <label class="messages-view__field messages-view__field--content">
        <span v-if="!isCompact">说点什么</span>
        <textarea
          :value="content"
          :rows="isCompact ? 1 : 3"
          placeholder="发到校园频道…"
          @input="emit('update:content', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
      <LianButton type="submit" :loading="sending">发送</LianButton>
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

.messages-view__composer.is-compact {
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

.messages-view__composer.is-compact .messages-view__field textarea {
  min-height: 40px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-button);
}

.messages-view__composer.is-compact .messages-view__input-row {
  align-items: center;
}
</style>
