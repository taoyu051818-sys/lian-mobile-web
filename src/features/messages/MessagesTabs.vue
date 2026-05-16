<script setup lang="ts">
import { MESSAGE_TAB_LABEL } from "../../config/brand";
import type { MessageTabKey } from "../../types/messages";

defineProps<{
  tabs: Array<{ key: MessageTabKey; label: string }>;
  activeTab: MessageTabKey;
}>();

const emit = defineEmits<{
  switch: [tab: MessageTabKey];
}>();
</script>

<template>
  <nav class="messages-view__tabs" :aria-label="MESSAGE_TAB_LABEL">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      class="messages-view__tab"
      :class="{ 'is-active': activeTab === tab.key }"
      @click="emit('switch', tab.key)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>

<style scoped>
.messages-view__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
  justify-content: flex-start;
}

.messages-view__tab {
  flex: 0 0 auto;
  min-height: var(--floating-bar-button-height, 36px);
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-chip);
  background: transparent;
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 850;
  white-space: nowrap;
}

.messages-view__tab.is-active {
  background: var(--lian-ink);
  color: #fff;
  transform: translateY(-1px);
}
</style>
