<script setup lang="ts">
import LianIcon from "./icons/LianIcon.vue";
import type { LianIconName } from "./icons/paths";

defineProps<{
  items: Array<{ key: string; label: string; icon?: LianIconName }>;
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
      <LianIcon v-if="item.icon" :name="item.icon" :size="22" />
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>
