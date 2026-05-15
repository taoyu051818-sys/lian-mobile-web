<script setup lang="ts">
import { computed, onActivated, onMounted } from "vue";
import type { MapLocation, MapPost } from "../types/map";
import MapCanvas from "./map/MapCanvas.vue";
import MapPlaceSheet from "./map/MapPlaceSheet.vue";
import MapStatus from "./map/MapStatus.vue";
import PostDetailPanel from "./detail/PostDetailPanel.vue";
import { useMapChrome } from "./map/useMapChrome";
import { useMapDataCache } from "../composables/useMapDataCache";
import { useMapSelection } from "./map/useMapSelection";
import { MAP_ARIA_LABEL } from "../config/brand";

defineOptions({ name: "MapLeafletView" });

const { filterActive, toggleFilter, MAP_FILTERS } = useMapChrome();

const { mapData, roadPreview, loading, errorMessage, loadMap } = useMapDataCache();

const {
  selectedTarget,
  selectedPost,
  detailLoading,
  detailError,
  selectLocation,
  closePlaceSheet,
  openPost,
  retryDetail,
  closeDetail,
} = useMapSelection(() => mapData.value?.posts || []);

const selectedPlace = computed<MapLocation | MapPost | null>(() => {
  const target = selectedTarget.value;
  if (target?.kind === "location") return target.item;
  return null;
});

const visibleLayers = computed(() => ({
  locations: filterActive.value.locations,
  posts: filterActive.value.posts,
}));

function isMapPost(place: MapLocation | MapPost): place is MapPost {
  return "tid" in place;
}

function handlePlaceSelect(place: MapLocation | MapPost) {
  if (isMapPost(place)) {
    void openPost(place);
  } else {
    selectLocation(place);
  }
}

function onCanvasError(message: string) {
  errorMessage.value = message;
}

onMounted(() => {
  void loadMap();
});

onActivated(() => {
  if (!mapData.value) void loadMap();
});
</script>

<template>
  <section class="map-view" :aria-label="MAP_ARIA_LABEL">
    <section class="map-view__stage-wrap" :aria-label="MAP_ARIA_LABEL">
      <MapCanvas
        :map-data="mapData"
        :road-preview="roadPreview"
        :loading="loading"
        :visible-layers="visibleLayers"
        @load-error="onCanvasError"
        @place-select="handlePlaceSelect"
      />
      <MapStatus :loading="loading" :error-message="errorMessage" />
      <MapPlaceSheet :selected-place="selectedPlace" @close="closePlaceSheet" />
      <PostDetailPanel
        v-if="selectedPost !== null || detailLoading"
        class="map-view__post-detail"
        :post="selectedPost"
        :loading="detailLoading"
        :error="detailError"
        @close="closeDetail"
        @retry="retryDetail"
      />
    </section>
    <nav class="map-view__filter-bar" aria-label="图层筛选">
      <button
        v-for="f in MAP_FILTERS"
        :key="f.id"
        class="map-view__filter-btn"
        :class="{ 'is-active': filterActive[f.id] }"
        type="button"
        :aria-pressed="filterActive[f.id]"
        @click="toggleFilter(f.id)"
      >
        {{ filterActive[f.id] ? `✓ ${f.label}` : f.label }}
      </button>
    </nav>
  </section>
</template>

<style scoped>
.map-view {
  position: relative;
  display: block;
  width: 100vw;
  min-height: calc(100vh - 92px - env(safe-area-inset-bottom));
  margin-block-start: calc(-1 * (var(--space-2) + env(safe-area-inset-top)));
  margin-inline-start: calc(50% - 50vw);
}

.map-view__stage-wrap {
  position: relative;
  z-index: 0;
  overflow: hidden;
  min-height: calc(100vh - 92px - env(safe-area-inset-bottom));
  border: 0;
  border-radius: 0;
  background: rgba(255, 255, 255, 0.42);
}

.map-view__filter-bar {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
  z-index: 800;
  display: flex;
  gap: var(--space-2);
}

.map-view__filter-btn {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--motion-fast) var(--motion-ease-standard), color var(--motion-fast) var(--motion-ease-standard);
}

.map-view__filter-btn.is-active {
  background: rgba(31, 167, 160, 0.14);
  color: var(--lian-accent, #1fa7a0);
  border-color: rgba(31, 167, 160, 0.36);
}

.map-view__filter-btn:hover {
  background: rgba(255, 255, 255, 0.94);
}

.map-view__post-detail {
  position: sticky;
  bottom: calc(92px + env(safe-area-inset-bottom));
  z-index: 20;
}
</style>
