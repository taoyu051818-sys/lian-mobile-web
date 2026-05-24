<script setup lang="ts">
import { LianButton } from "../../ui";
import { PUBLISH_CLEAR, PUBLISH_SUBMIT } from "../../config/brand";

defineProps<{
  publishing: boolean;
  uploading: boolean;
  canSubmit: boolean;
}>();

const emit = defineEmits<{
  resetForm: [];
  submit: [];
}>();
</script>

<template>
  <div class="publish-action-bar">
    <LianButton
      type="button"
      variant="ghost"
      :disabled="publishing || uploading"
      @click="emit('resetForm')"
      >{{ PUBLISH_CLEAR }}</LianButton
    >
    <LianButton
      type="submit"
      variant="primary"
      :loading="publishing || uploading"
      :disabled="!canSubmit"
      :aria-busy="uploading || publishing"
      >{{ uploading ? PUBLISH_UPLOADING : PUBLISH_SUBMIT }}</LianButton
    >
  </div>
</template>

<style scoped>
.publish-action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: flex-end;
}
</style>
