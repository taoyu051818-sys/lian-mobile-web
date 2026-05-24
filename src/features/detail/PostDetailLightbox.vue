<script setup lang="ts">
import { computed } from "vue";
import { useBodyScrollLock } from "../../composables/useBodyScrollLock";
import { useEscapeListener } from "../../composables/useEscapeListener";

const props = defineProps<{
  src?: string;
  alt?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const isOpen = computed(() => Boolean(props.src));

useBodyScrollLock(isOpen);
useEscapeListener(isOpen, () => emit("close"));
</script>

<template>
  <Transition name="lightbox">
    <div
      v-if="src"
      class="post-detail-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="查看图片"
      @click="$emit('close')"
    >
      <img :src="src" :alt="alt" />
    </div>
  </Transition>
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

<style>
/*
 * Lightbox enter/leave transition: fade + scale
 * Uses --motion-ease-emphasized for intentional reveal (matches sheet/modal pattern).
 * Reduced-motion honored via media query below.
 */
.lightbox-enter-active,
.lightbox-leave-active {
  transition:
    opacity var(--motion-standard) var(--motion-ease-emphasized),
    transform var(--motion-standard) var(--motion-ease-emphasized);
}

.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

@media (prefers-reduced-motion: reduce) {
  .lightbox-enter-active,
  .lightbox-leave-active {
    transition: none;
  }
}
</style>
