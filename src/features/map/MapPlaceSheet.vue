<script setup lang="ts">
import {
  CLOSE_BUTTON_LABEL,
  LOADING_PLACE,
  PLACE_SHEET_LABEL,
  PLACE_SHEET_POST_COUNT_SUFFIX,
  PLACE_SHEET_CORRECTION_SUFFIX,
  PLACE_SHEET_SAVED_SUFFIX,
  PLACE_SHEET_SETTLING,
  PLACE_STATUS_AI_ORGANIZED,
  PLACE_STATUS_CONFIRMED,
  PLACE_STATUS_DISPUTED,
  PLACE_STATUS_EXPIRED,
  PLACE_STATUS_OFFICIAL,
  PLACE_STATUS_PENDING,
  PLACE_TYPE_BUILDING,
  PLACE_TYPE_CANTEEN,
  PLACE_TYPE_DORMITORY,
  PLACE_TYPE_FALLBACK,
  PLACE_TYPE_GARDEN,
  PLACE_TYPE_LAB,
  PLACE_TYPE_LIBRARY,
  PLACE_TYPE_OFFICE,
  PLACE_TYPE_SHOP,
  PLACE_TYPE_SPORTS,
  PLACE_TYPE_TRANSIT,
} from "../../config/brand";
import type { FeedItemId } from "../../types/feed";
import type { MapLocation, MapPost } from "../../types/map";
import type { PlaceSheet, PlaceStatus } from "../../types/place";
import LianIcon from "../../ui/icons/LianIcon.vue";

const {
  selectedPlace,
  placeSheet,
  placeSheetLoading = false,
  placeSheetError = "",
} = defineProps<{
  selectedPlace: MapLocation | MapPost | null;
  placeSheet?: PlaceSheet | null;
  placeSheetLoading?: boolean;
  placeSheetError?: string;
}>();

defineEmits<{
  close: [];
  openPost: [tid: FeedItemId | string];
}>();

const statusLabels: Record<PlaceStatus, string> = {
  confirmed: PLACE_STATUS_CONFIRMED,
  pending: PLACE_STATUS_PENDING,
  disputed: PLACE_STATUS_DISPUTED,
  expired: PLACE_STATUS_EXPIRED,
  "ai-organized": PLACE_STATUS_AI_ORGANIZED,
  official: PLACE_STATUS_OFFICIAL,
};

const typeLabels: Record<string, string> = {
  canteen: PLACE_TYPE_CANTEEN,
  dining: PLACE_TYPE_CANTEEN,
  library: PLACE_TYPE_LIBRARY,
  building: PLACE_TYPE_BUILDING,
  dormitory: PLACE_TYPE_DORMITORY,
  transit: PLACE_TYPE_TRANSIT,
  sports: PLACE_TYPE_SPORTS,
  lab: PLACE_TYPE_LAB,
  office: PLACE_TYPE_OFFICE,
  garden: PLACE_TYPE_GARDEN,
  shop: PLACE_TYPE_SHOP,
};

function placeName(place: MapLocation | MapPost): string {
  return "name" in place ? place.name : place.title || place.locationArea || "";
}

function sheetTitle(selectedPlace: MapLocation | MapPost): string {
  return placeSheet?.name || placeName(selectedPlace);
}

function statusLabel(status: PlaceStatus): string {
  return statusLabels[status] || PLACE_STATUS_PENDING;
}

function typeLabel(type?: string): string {
  if (!type) return PLACE_TYPE_FALLBACK;
  return typeLabels[type] || type;
}
</script>

<template>
  <Transition name="sheet-slide">
    <div v-if="selectedPlace" class="map-place-sheet" role="dialog" :aria-label="PLACE_SHEET_LABEL">
      <div class="map-place-sheet__header">
        <span class="map-place-sheet__title">{{ sheetTitle(selectedPlace) }}</span>
        <button
          class="map-place-sheet__close"
          :aria-label="CLOSE_BUTTON_LABEL"
          @click="$emit('close')"
        >
          <LianIcon name="xmark" :size="16" />
        </button>
      </div>
      <div class="map-place-sheet__body">
        <p v-if="placeSheetLoading" class="map-place-sheet__state">{{ LOADING_PLACE }}</p>
        <p v-else-if="placeSheetError" class="map-place-sheet__state map-place-sheet__state--error">
          {{ placeSheetError }}
        </p>
        <template v-else-if="placeSheet">
          <div class="map-place-sheet__meta">
            <span>{{ statusLabel(placeSheet.status) }}</span>
            <span>{{ typeLabel(placeSheet.type) }}</span>
          </div>
          <p v-if="placeSheet?.summary?.text" class="map-place-sheet__summary">
            {{ placeSheet.summary.text }}
          </p>
          <div v-if="placeSheet?.stats" class="map-place-sheet__stats">
            <span v-if="placeSheet.stats.postCount !== undefined">
              {{ placeSheet.stats.postCount }} {{ PLACE_SHEET_POST_COUNT_SUFFIX }}
            </span>
            <span v-if="placeSheet.stats.correctionCount !== undefined">
              {{ placeSheet.stats.correctionCount }} {{ PLACE_SHEET_CORRECTION_SUFFIX }}
            </span>
            <span v-if="placeSheet.stats.savedCount !== undefined">
              {{ placeSheet.stats.savedCount }} {{ PLACE_SHEET_SAVED_SUFFIX }}
            </span>
          </div>
          <div v-if="placeSheet?.recentPosts?.length" class="map-place-sheet__recent">
            <button
              v-for="recent in placeSheet.recentPosts"
              :key="recent.tid"
              class="map-place-sheet__recent-item"
              type="button"
              @click="$emit('openPost', recent.tid)"
            >
              <span class="map-place-sheet__recent-title">{{ recent.title || recent.tid }}</span>
              <span v-if="recent.excerpt" class="map-place-sheet__recent-excerpt">
                {{ recent.excerpt }}
              </span>
            </button>
          </div>
          <p
            v-if="
              !placeSheet?.summary?.text && !placeSheet?.stats && !placeSheet?.recentPosts?.length
            "
            class="map-place-sheet__state"
          >
            {{ PLACE_SHEET_SETTLING }}
          </p>
        </template>
        <p v-else class="map-place-sheet__state">{{ PLACE_SHEET_SETTLING }}</p>
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

.sheet-slide-enter-active {
  transition: transform var(--motion-standard, 250ms)
    var(--motion-ease-emphasized, cubic-bezier(0.04, 0.04, 0.12, 0.96));
}

.sheet-slide-leave-active {
  transition: transform var(--motion-standard, 250ms)
    var(--motion-ease-decelerate, cubic-bezier(0.52, 0.16, 0.52, 0.84));
}

.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateY(100%);
}

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

.map-place-sheet__body {
  display: grid;
  gap: var(--space-3);
  padding: 0 var(--space-4) var(--space-4);
}

.map-place-sheet__state,
.map-place-sheet__summary {
  margin: 0;
  color: var(--lian-muted);
  line-height: 1.5;
}

.map-place-sheet__state--error {
  color: var(--lian-danger, #b42318);
}

.map-place-sheet__meta,
.map-place-sheet__stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  color: var(--lian-muted);
  font-size: 12px;
}

.map-place-sheet__meta span,
.map-place-sheet__stats span {
  border-radius: var(--radius-pill, 999px);
  background: rgba(0, 0, 0, 0.05);
  padding: 3px 8px;
}

.map-place-sheet__recent {
  display: grid;
  gap: var(--space-2);
}

.map-place-sheet__recent-item {
  display: grid;
  gap: 2px;
  width: 100%;
  border: 0;
  border-radius: var(--radius-md, 12px);
  background: rgba(0, 0, 0, 0.04);
  padding: var(--space-2) var(--space-3);
  color: var(--lian-ink);
  text-align: start;
  cursor: pointer;
}

.map-place-sheet__recent-title {
  font-weight: 600;
}

.map-place-sheet__recent-excerpt {
  color: var(--lian-muted);
  font-size: 12px;
}
</style>
