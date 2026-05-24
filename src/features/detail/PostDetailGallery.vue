<script setup lang="ts">
defineProps<{
  images?: string[];
  title?: string;
}>();

const emit = defineEmits<{
  galleryPointerDown: [event: PointerEvent];
  galleryPointerMove: [event: PointerEvent];
  openGalleryImage: [index: number];
}>();
</script>

<template>
  <section
    v-if="images?.length"
    class="post-detail-gallery"
    :class="{ 'is-single': images.length === 1 }"
    aria-label="图片"
  >
    <button
      v-for="(url, index) in images"
      :key="url"
      class="post-detail-gallery__item"
      type="button"
      :aria-label="`查看图片 ${index + 1}，共 ${images.length} 张${title ? `：${title}` : ''}`"
      @pointerdown="emit('galleryPointerDown', $event)"
      @pointermove="emit('galleryPointerMove', $event)"
      @click="emit('openGalleryImage', index)"
    >
      <img :src="url" :alt="title || `图片 ${index + 1}`" loading="eager" decoding="async" />
    </button>
  </section>
</template>

<style scoped>
.post-detail-gallery {
  display: flex;
  gap: var(--space-3);
  overflow: hidden;
  margin-inline: calc(var(--space-3) * -1);
  padding-inline: max(var(--space-3), 6vw);
  touch-action: pan-y;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}

.post-detail-gallery::-webkit-scrollbar {
  display: none;
}

.post-detail-gallery.is-single {
  justify-content: center;
}

.post-detail-gallery__item {
  flex: 0 0 min(88vw, 420px);
  overflow: hidden;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--lian-ink);
  font: inherit;
  border-radius: var(--radius-card);
  touch-action: pan-y;
  user-select: none;
  -webkit-user-drag: none;
}

.post-detail-gallery img {
  display: block;
  width: 100%;
  height: min(62vh, 460px);
  aspect-ratio: 0.9;
  object-fit: cover;
  pointer-events: none;
}
</style>
