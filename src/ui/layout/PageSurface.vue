<script setup lang="ts">
withDefaults(defineProps<{
  as?: string;
  bleed?: boolean;
  padded?: boolean;
}>(), {
  as: "main",
  bleed: false,
  padded: true,
});
</script>

<template>
  <component
    :is="as"
    class="page-surface"
    :class="[{ 'page-surface--bleed': bleed, 'page-surface--padded': padded }]"
  >
    <slot />
  </component>
</template>
