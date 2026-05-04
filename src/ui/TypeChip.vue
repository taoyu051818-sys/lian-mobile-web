<script setup lang="ts">
type ContentType = "experience" | "discussion" | "hot" | "food" | "place" | "ai" | "official" | "trade" | "contribution" | "default";

withDefaults(defineProps<{
  type?: ContentType;
  icon?: string;
}>(), {
  type: "default",
  icon: ""
});
</script>

<template>
  <span class="type-chip" :class="`type-chip--${type}`">
    <span v-if="icon" aria-hidden="true">{{ icon }}</span>
    <slot />
  </span>
</template>
