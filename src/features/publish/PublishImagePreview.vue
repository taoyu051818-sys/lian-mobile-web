<script setup lang="ts">
import { computed } from "vue";
import {
  PUBLISH_IMAGE_TOOLBAR,
  PUBLISH_IMAGE_PREVIEW_LABEL,
  PUBLISH_IMAGE_PREVIEW_ALT,
  PUBLISH_IMAGE_REMOVE_LABEL,
} from "../../config/brand";

const props = defineProps<{
  localPreviewUrls: string[];
  imageStatus: string;
  uploading?: boolean;
  uploadedCount?: number;
}>();

const emit = defineEmits<{
  removeImage: [index: number];
}>();

// Progress percentage for the upload bar
const uploadProgress = computed(() => {
  if (!props.uploading || !props.localPreviewUrls.length) return 100;
  const uploaded = props.uploadedCount ?? 0;
  return Math.round((uploaded / props.localPreviewUrls.length) * 100);
});
</script>

<template>
  <section
    v-if="localPreviewUrls.length"
    class="publish-image-preview"
    :aria-label="PUBLISH_IMAGE_PREVIEW_LABEL"
  >
    <div class="publish-image-preview__header">
      <strong>{{ PUBLISH_IMAGE_TOOLBAR }}</strong>
      <span>{{ imageStatus }}</span>
    </div>
    <div
      v-if="uploading"
      class="publish-image-preview__progress"
      role="progressbar"
      :aria-valuenow="uploadProgress"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="publish-image-preview__progress-bar"
        :style="{ width: `${uploadProgress}%` }"
      ></div>
    </div>
    <div class="publish-image-preview__grid">
      <div v-for="(url, index) in localPreviewUrls" :key="url" class="publish-image-preview__item">
        <img :src="url" :alt="PUBLISH_IMAGE_PREVIEW_ALT" loading="lazy" />
        <button
          type="button"
          :aria-label="PUBLISH_IMAGE_REMOVE_LABEL"
          @click="emit('removeImage', index)"
        >
          &times;
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.publish-image-preview {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: calc(var(--radius-card) + 2px);
  background: rgba(255, 255, 255, 0.56);
}

.publish-image-preview__header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.publish-image-preview__header span {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 800;
}

.publish-image-preview__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: var(--space-2);
}

.publish-image-preview__item {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-3);
  background: rgba(31, 41, 51, 0.06);
}

.publish-image-preview__item img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.publish-image-preview__item button {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  width: 32px;
  height: 32px;
  min-width: 32px;
  place-items: center;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: var(--lian-ink);
  font-size: 18px;
  font-weight: 900;
}
</style>
