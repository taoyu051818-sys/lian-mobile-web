<script setup lang="ts">
import { computed } from "vue";
import { iconPaths, type LianIconName } from "./paths";

const props = withDefaults(
  defineProps<{
    name: LianIconName;
    size?: number | string;
    strokeWidth?: number;
    title?: string;
  }>(),
  { size: 24, strokeWidth: 1.5, title: undefined },
);

const icon = computed(() => {
  const entry = (iconPaths as Record<string, (typeof iconPaths)[LianIconName]>)[props.name];
  if (!entry && import.meta.env.DEV) {
    // eslint-disable-next-line no-console -- dev-only diagnostic for missing icons
    console.warn(`[LianIcon] unknown icon name: "${props.name}"`);
  }
  return entry;
});

const isStroke = computed(() => {
  const entry = icon.value as { stroke?: boolean } | undefined;
  return entry?.stroke === true;
});
</script>

<template>
  <svg
    v-if="icon"
    :viewBox="icon.viewBox"
    :width="size"
    :height="size"
    :fill="isStroke ? 'none' : 'currentColor'"
    :stroke="isStroke ? 'currentColor' : undefined"
    :stroke-width="isStroke ? strokeWidth : undefined"
    :stroke-linecap="isStroke ? 'round' : undefined"
    :stroke-linejoin="isStroke ? 'round' : undefined"
    xmlns="http://www.w3.org/2000/svg"
    :role="title ? 'img' : undefined"
    :aria-hidden="title ? undefined : 'true'"
  >
    <title v-if="title">{{ title }}</title>
    <path v-for="(d, i) in icon.paths" :key="i" :d="d" />
  </svg>
</template>
