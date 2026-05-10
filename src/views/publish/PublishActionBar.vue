<script setup lang="ts">
import { LianButton } from "../../ui";

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
  <div class="publish-action__bar">
    <LianButton type="button" variant="ghost" :disabled="publishing || uploading" @click="emit('resetForm')">清空</LianButton>
    <LianButton type="submit" variant="primary" :loading="publishing" :disabled="!canSubmit">发布</LianButton>
  </div>
</template>

<style scoped>
.publish-action__bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: flex-end;
}
</style>
