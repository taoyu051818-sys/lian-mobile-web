<script setup lang="ts">
import { IdentityBadge, InlineError, LianButton } from "../../ui";

defineProps<{
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
</script>

<template>
  <form class="messages-view__composer" @submit.prevent="emit('submit')">
    <IdentityBadge :avatar-text="avatarText" :label="actorName" :meta="signalMeta" />
    <label v-if="identityTags.length" class="messages-view__field">
      <span>身份信号</span>
      <select :value="identityTag" @input="emit('update:identityTag', ($event.target as HTMLSelectElement).value)">
        <option value="">不使用身份信号</option>
        <option v-for="tag in identityTags" :key="tag" :value="tag">{{ tag }}</option>
      </select>
    </label>
    <label class="messages-view__field messages-view__field--content">
      <span>说点什么</span>
      <textarea :value="content" rows="3" placeholder="发到校园频道…" @input="emit('update:content', ($event.target as HTMLTextAreaElement).value)" />
    </label>
    <InlineError v-if="sendError">{{ sendError }}</InlineError>
    <LianButton type="submit" :loading="sending">发送</LianButton>
  </form>
</template>

<style scoped>
.messages-view__composer {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
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
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
}

.messages-view__field textarea {
  resize: vertical;
  padding: var(--space-3);
  line-height: 1.5;
}

.messages-view__field select {
  padding: 0 var(--space-3);
}
</style>
