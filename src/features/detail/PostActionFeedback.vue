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
.post-action-feedback__success {
  color: var(--lian-primary);
  font-size: 13px;
  font-weight: 850;
}
</style>
