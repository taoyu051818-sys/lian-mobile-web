<script setup lang="ts">
import { useId } from "vue";
import { PROFILE_TABS_LABEL } from "../../config/brand";
import type { ProfileTabKey } from "../../types/profile";

defineProps<{
  tabs: Array<{ key: ProfileTabKey; label: string; empty: string }>;
  activeTab: ProfileTabKey;
}>();

const emit = defineEmits<{
  select: [tab: ProfileTabKey];
}>();

// Generate a unique ID prefix for aria-controls linkage
const idPrefix = useId();
</script>

<template>
  <nav class="profile-tabs" role="tablist" :aria-label="PROFILE_TABS_LABEL">
    <button
      v-for="tab in tabs"
      :id="`${idPrefix}-tab-${tab.key}`"
      :key="tab.key"
      type="button"
      role="tab"
      class="profile-tabs__tab"
      :class="{ 'is-active': activeTab === tab.key }"
      :aria-selected="activeTab === tab.key"
      :aria-controls="`${idPrefix}-panel-${tab.key}`"
      @click="emit('select', tab.key)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>

<style scoped>
.profile-tabs {
  display: flex;
  gap: 0;
  align-items: stretch;
  overflow-x: auto;
  border-bottom: 1px solid rgba(31, 41, 51, 0.08);
  scrollbar-width: none;
}

.profile-tabs::-webkit-scrollbar {
  display: none;
}

.profile-tabs__tab {
  flex: 0 0 auto;
  min-width: 72px;
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: none;
  color: var(--lian-muted);
  font-size: 14px;
  font-weight: 850;
  text-align: center;
  cursor: pointer;
  transition:
    color var(--motion-fast) var(--motion-ease-standard),
    border-color var(--motion-fast) var(--motion-ease-standard);
}

.profile-tabs__tab.is-active {
  border-bottom-color: var(--lian-primary);
  color: var(--lian-ink);
  font-weight: 900;
}
</style>
