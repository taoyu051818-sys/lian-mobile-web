<script setup lang="ts">
import { PLACE_SHEET_LABEL, CLOSE_BUTTON_LABEL } from "../../config/brand";
import type { MapLocation, MapPost } from "../../types/map";

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
  <div v-if="selectedPlace" class="map-place-sheet" role="dialog" :aria-label="PLACE_SHEET_LABEL">
    <div class="map-place-sheet__header">
      <span class="map-place-sheet__title">{{ placeName(selectedPlace) }}</span>
      <button class="map-place-sheet__close" :aria-label="CLOSE_BUTTON_LABEL" @click="$emit('close')">×</button>
    </div>
  </div>
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
  font-size: 18px;
  cursor: pointer;
}
</style>
