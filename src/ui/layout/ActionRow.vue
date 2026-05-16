<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: string;
    justify?: "start" | "center" | "end" | "between" | "around";
    wrap?: boolean;
  }>(),
  {
    as: "div",
    justify: "end",
    wrap: false,
  },
);
</script>

<template>
  <component
    :is="as"
    class="action-row"
    :class="[`action-row--justify-${justify}`, { 'action-row--wrap': wrap }]"
  >
    <slot />
  </component>
</template>
