<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: string;
    gap?: "sm" | "md" | "lg";
    align?: "start" | "center" | "end" | "stretch";
  }>(),
  {
    as: "div",
    gap: "md",
    align: "stretch",
  },
);
</script>

<template>
  <component
    :is="as"
    class="content-stack"
    :class="[`content-stack--gap-${gap}`, `content-stack--align-${align}`]"
  >
    <slot />
  </component>
</template>
