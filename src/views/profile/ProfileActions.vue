<script setup lang="ts">
import { LianButton } from "../../ui";

defineProps<{
  editorOpen: boolean;
}>();

const emit = defineEmits<{
  "toggle-editor": [];
  logout: [];
}>();
</script>

<template>
  <div class="profile-actions">
    <LianButton variant="tonal" @click="emit('toggle-editor')">
      {{ editorOpen ? "收起编辑" : "编辑资料" }}
    </LianButton>
    <LianButton variant="ghost" @click="emit('logout')">退出登录</LianButton>
  </div>
</template>

<style scoped>
.profile-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: flex-start;
}
</style>
