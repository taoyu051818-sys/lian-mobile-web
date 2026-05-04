<script setup lang="ts">
const props = withDefaults(defineProps<{
  tag: string;
}>(), {
  tag: ""
});

function displayTag(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "#";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}
</script>

<template>
  <span class="tag-chip">{{ displayTag(props.tag) }}</span>
</template>
