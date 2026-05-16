<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: string;
    icon?: string;
    title?: string;
    description?: string;
  }>(),
  {
    as: "div",
  },
);
</script>

<template>
  <component :is="as" class="empty-state" role="status">
    <span v-if="icon" class="empty-state__icon" aria-hidden="true">{{ icon }}</span>
    <div class="empty-state__copy">
      <p v-if="title" class="empty-state__title">{{ title }}</p>
      <p v-if="description" class="empty-state__description">{{ description }}</p>
    </div>
    <div v-if="$slots.action" class="empty-state__action">
      <slot name="action" />
    </div>
  </component>
</template>
