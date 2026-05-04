<script setup lang="ts">
withDefaults(defineProps<{
  as?: string;
  tone?: "default" | "strong" | "subtle";
  padded?: boolean;
}>(), {
  as: "section",
  tone: "default",
  padded: true
});
</script>

<template>
  <component :is="as" class="glass-panel" :class="[`glass-panel--${tone}`, { 'glass-panel--padded': padded }]">
    <slot />
  </component>
</template>
