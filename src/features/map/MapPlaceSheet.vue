<script setup lang="ts">
import { PLACE_SHEET_LABEL, CLOSE_BUTTON_LABEL } from "../../config/brand";
import type { MapLocation, MapPost } from "../../types/map";
import LianIcon from "../../ui/icons/LianIcon.vue";

defineProps<{
  selectedPlace: MapLocation | MapPost | null;
}>();

defineEmits<{
  close: [];
}>();

function placeName(place: MapLocation | MapPost): string {
  return "name" in place ? place.name : place.title || place.locationArea || "";
}
</script>

<template>
  <Transition name="sheet-slide">
    <div v-if="selectedPlace" class="map-place-sheet" role="dialog" :aria-label="PLACE_SHEET_LABEL">
      <div class="map-place-sheet__header">
        <span class="map-place-sheet__title">{{ placeName(selectedPlace) }}</span>
        <button
          class="map-place-sheet__close"
          :aria-label="CLOSE_BUTTON_LABEL"
          @click="$emit('close')"
        >
          <LianIcon name="xmark" :size="16" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.map-place-sheet {
  position: absolute;
  inset: auto 0 0;
  z-index: 750;
  border-top-left-radius: var(--radius-lg, 16px);
  border-top-right-radius: var(--radius-lg, 16px);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-soft);
}

/* Slide-up transition for sheet enter/leave */
.sheet-slide-enter-active {
  transition: transform var(--motion-standard, 250ms) var(--motion-ease-emphasized, cubic-bezier(0.04, 0.04, 0.12, 0.96));
}

.sheet-slide-leave-active {
  transition: transform var(--motion-standard, 250ms) var(--motion-ease-decelerate, cubic-bezier(0.52, 0.16, 0.52, 0.84));
}

.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateY(100%);
}

/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .sheet-slide-enter-active,
  .sheet-slide-leave-active {
    transition: none;
  }
}

.map-place-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
}

.map-place-sheet__title {
  font-weight: 700;
  color: var(--lian-ink);
}

.map-place-sheet__close {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--radius-orb);
  background: rgba(0, 0, 0, 0.06);
  color: var(--lian-muted);
  cursor: pointer;
}
</style>
