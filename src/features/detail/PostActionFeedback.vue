<script setup lang="ts">
import { InlineError } from "../../ui";

defineProps<{
  actionError?: string;
  actionMessage?: string;
}>();
</script>

<template>
  <div class="post-action-feedback">
    <InlineError v-if="actionError">{{ actionError }}</InlineError>
    <p v-if="actionMessage" class="post-action-feedback__success">{{ actionMessage }}</p>
  </div>
</template>

<style scoped>
.post-action-feedback :deep(.inline-error) {
  color: var(--lian-muted);
}

.post-action-feedback :deep(.inline-error button) {
  min-height: 32px;
  margin-left: var(--space-2);
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: currentColor;
  font-weight: 900;
}

.post-action-feedback__success {
  color: var(--lian-primary);
  font-size: 13px;
  font-weight: 850;
}
</style>
