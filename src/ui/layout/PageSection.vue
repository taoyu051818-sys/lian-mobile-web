<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: string;
    title?: string;
    description?: string;
  }>(),
  {
    as: "section",
  },
);
</script>

<template>
  <component :is="as" class="page-section">
    <header v-if="title || $slots.header" class="page-section__header">
      <slot name="header">
        <h2 v-if="title" class="page-section__title">{{ title }}</h2>
        <p v-if="description" class="page-section__description">{{ description }}</p>
      </slot>
    </header>
    <slot />
  </component>
</template>
