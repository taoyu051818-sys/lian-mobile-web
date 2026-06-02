<script setup lang="ts">
import { computed } from "vue";
import {
  PLACE_SHEET_LABEL,
  CLOSE_BUTTON_LABEL,
  LOADING_PLACE,
  PLACE_SHEET_SETTLING,
  PLACE_SHEET_STATS_LABEL,
  PLACE_SHEET_UPDATED_PREFIX,
  PLACE_SHEET_POST_COUNT_SUFFIX,
  PLACE_SHEET_CORRECTION_SUFFIX,
  PLACE_SHEET_SAVED_SUFFIX,
} from "../../config/brand";
import { actorDisplayName } from "../../domain/actor";
import { placeStatusLabel, placeTypeLabel } from "../../domain/place";
import type { FeedItemId } from "../../types/feed";
import type { MapLocation, MapPost } from "../../types/map";
import type { PlaceSheet } from "../../types/place";
import LianIcon from "../../ui/icons/LianIcon.vue";
import { formatRelativeTime } from "../../utils/time";

const props = defineProps<{
  selectedPlace: MapLocation | MapPost | null;
  placeSheet?: PlaceSheet | null;
  placeSheetLoading?: boolean;
  placeSheetError?: string;
}>();

defineEmits<{
  close: [];
  openPost: [tid: FeedItemId | string];
}>();

const placeTypeText = computed(() => placeTypeLabel(props.placeSheet?.type));
const placeStatusText = computed(() => placeStatusLabel(props.placeSheet?.status));

function placeName(place: MapLocation | MapPost): string {
  return "name" in place ? place.name : place.title || place.locationArea || "";
}
</script>

<template>
  <Transition name="sheet-slide">
    <div v-if="selectedPlace" class="map-place-sheet" role="dialog" :aria-label="PLACE_SHEET_LABEL">
      <div class="map-place-sheet__header">
        <span class="map-place-sheet__title">{{
          placeSheet?.name || placeName(selectedPlace)
        }}</span>
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
        <p v-else-if="placeSheetError" class="map-place-sheet__error">{{ placeSheetError }}</p>
        <template v-else>
          <div v-if="placeSheet" class="map-place-sheet__meta">
            <span>{{ placeStatusText }}</span>
            <span v-if="placeTypeText">{{ placeTypeText }}</span>
            <span v-if="placeSheet.updatedAt"
              >{{ PLACE_SHEET_UPDATED_PREFIX }}
              {{ formatRelativeTime(placeSheet.updatedAt) || placeSheet.updatedAt }}</span
            >
          </div>
          <p v-if="placeSheet?.summary?.text" class="map-place-sheet__summary">
            {{ placeSheet.summary.text }}
          </p>
          <p v-else class="map-place-sheet__empty">{{ PLACE_SHEET_SETTLING }}</p>
          <div
            v-if="placeSheet?.stats"
            class="map-place-sheet__stats"
            :aria-label="PLACE_SHEET_STATS_LABEL"
          >
            <span v-if="placeSheet.stats.postCount != null"
              >{{ placeSheet.stats.postCount }} {{ PLACE_SHEET_POST_COUNT_SUFFIX }}</span
            >
            <span v-if="placeSheet.stats.correctionCount != null"
              >{{ placeSheet.stats.correctionCount }} {{ PLACE_SHEET_CORRECTION_SUFFIX }}</span
            >
            <span v-if="placeSheet.stats.savedCount != null"
              >{{ placeSheet.stats.savedCount }} {{ PLACE_SHEET_SAVED_SUFFIX }}</span
            >
          </div>
          <div v-if="placeSheet?.recentPosts?.length" class="map-place-sheet__posts">
            <article v-for="recent in placeSheet.recentPosts.slice(0, 3)" :key="String(recent.tid)">
              <button type="button" @click="$emit('openPost', recent.tid)">
                <strong v-if="recent.title">{{ recent.title }}</strong>
                <p v-if="recent.excerpt">{{ recent.excerpt }}</p>
                <small
                  v-if="
                    actorDisplayName(recent.actor) || formatRelativeTime(recent.timestampISO || '')
                  "
                >
                  <span v-if="actorDisplayName(recent.actor)">{{
                    actorDisplayName(recent.actor)
                  }}</span>
                  <span
                    v-if="
                      actorDisplayName(recent.actor) &&
                      formatRelativeTime(recent.timestampISO || '')
                    "
                  >
                    ·
                  </span>
                  <span v-if="formatRelativeTime(recent.timestampISO || '')">{{
                    formatRelativeTime(recent.timestampISO || "")
                  }}</span>
                </small>
              </button>
            </article>
          </div>
        </template>
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
  gap: var(--space-2);
  padding: 0 var(--space-4) var(--space-4);
}

.map-place-sheet__state,
.map-place-sheet__error,
.map-place-sheet__empty {
  color: var(--lian-muted);
  text-align: center;
}

.map-place-sheet__error {
  color: var(--lian-danger, #b42318);
}

.map-place-sheet__meta,
.map-place-sheet__stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
}

.map-place-sheet__meta span,
.map-place-sheet__stats span {
  padding: 4px 8px;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.62);
}

.map-place-sheet__posts :deep(button) {
  display: grid;
  gap: var(--space-1);
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.map-place-sheet__summary,
.map-place-sheet__posts :deep(p),
.map-place-sheet__posts :deep(small) {
  color: var(--lian-muted);
  line-height: 1.6;
}

.map-place-sheet__posts :deep(article) {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
}
</style>
