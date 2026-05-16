<script setup lang="ts">
defineProps<{
  src?: string;
  alt?: string;
}>();

defineEmits<{
  close: [];
}>();
</script>

<template>
  <div v-if="src" class="post-detail-lightbox" role="dialog" aria-modal="true" aria-label="查看图片" @click="$emit('close')">
    <img :src="src" :alt="alt" />
  </div>
</template>

<style scoped>
.post-detail-lightbox {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgba(0, 0, 0, 0.82);
}

.post-detail-lightbox img {
  max-width: 100%;
  max-height: 92vh;
  border-radius: var(--radius-card);
  object-fit: contain;
}
</style>
