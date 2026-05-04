<script setup lang="ts">
withDefaults(defineProps<{
  avatarText?: string;
  label: string;
  meta?: string;
}>(), {
  avatarText: "同",
  meta: ""
});
</script>

<template>
  <span class="identity-badge">
    <span class="identity-badge__avatar" aria-hidden="true">{{ avatarText }}</span>
    <span class="identity-badge__text">
      <strong>{{ label }}</strong>
      <small v-if="meta">{{ meta }}</small>
    </span>
  </span>
</template>
