<script setup lang="ts">
defineProps<{
  items: Array<{ key: string; label: string; icon?: string }>;
  activeKey: string;
}>();

const emit = defineEmits<{
  change: [key: string];
}>();
</script>

<template>
  <nav class="bottom-tab-bar" aria-label="主导航">
    <button
      v-for="item in items"
      :key="item.key"
      class="bottom-tab-bar__item"
      :class="{ 'is-active': item.key === activeKey }"
      type="button"
      :aria-current="item.key === activeKey ? 'page' : undefined"
      @click="emit('change', item.key)"
    >
      <span v-if="item.icon" aria-hidden="true">{{ item.icon }}</span>
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>
