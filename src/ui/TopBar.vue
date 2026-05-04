<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  subtitle?: string;
}>(), {
  subtitle: ""
});
</script>

<template>
  <header class="top-bar">
    <slot name="leading" />
    <div class="top-bar__copy">
      <h1>{{ title }}</h1>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <slot name="trailing" />
  </header>
</template>
