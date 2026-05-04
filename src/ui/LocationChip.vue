<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string;
}>(), {
  icon: "⌖"
});
</script>

<template>
  <span class="location-chip">
    <span aria-hidden="true">{{ icon }}</span>
    <slot />
  </span>
</template>
