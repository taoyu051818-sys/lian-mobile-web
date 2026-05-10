<script setup lang="ts">
import type { ProfileTabKey } from "../../types/profile";

defineProps<{
  tabs: Array<{ key: ProfileTabKey; label: string; empty: string }>;
  activeTab: ProfileTabKey;
}>();

const emit = defineEmits<{
  select: [tab: ProfileTabKey];
}>();
</script>

<template>
  <nav class="profile-tabs" aria-label="个人内容分类">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      class="profile-tabs__tab"
      :class="{ 'is-active': activeTab === tab.key }"
      @click="emit('select', tab.key)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>

<style scoped>
.profile-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: flex-start;
}

.profile-tabs__tab {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.54);
  color: var(--lian-muted);
  font-weight: 850;
}

.profile-tabs__tab.is-active {
  background: var(--lian-ink);
  color: #fff;
}
</style>
