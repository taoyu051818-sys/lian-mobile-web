<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchMapV2Items, fetchRoadNetworkPreview } from "../api/map";
import type { MapRoadNetworkPreview, MapV2ItemsResponse } from "../types/map";
import MapCanvas from "./map/MapCanvas.vue";
import MapPlaceSheet from "./map/MapPlaceSheet.vue";
import MapStatus from "./map/MapStatus.vue";
import { useMapChrome } from "./map/useMapChrome";

const { selectedPlace, filterActive, handlePlaceSelect, closePlaceSheet, toggleFilter, MAP_FILTERS } = useMapChrome();

const mapData = ref<MapV2ItemsResponse | null>(null);
const roadPreview = ref<MapRoadNetworkPreview | null>(null);
const loading = ref(false);
const errorMessage = ref("");

const visibleLayers = computed(() => ({
  locations: filterActive.value.locations,
  posts: filterActive.value.posts,
}));

async function loadMap() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const [items, preview] = await Promise.all([
      fetchMapV2Items(),
      fetchRoadNetworkPreview().catch(() => null),
    ]);
    mapData.value = items;
    roadPreview.value = preview;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "地图数据暂时没加载出来，可以稍后再试。";
  } finally {
    loading.value = false;
  }
}

function onCanvasError(message: string) {
  errorMessage.value = message;
}

onMounted(() => {
  void loadMap();
});
</script>

<template>
  <section class="map-view" aria-label="校园地图">
    <section class="map-view__stage-wrap" aria-label="校园地图">
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
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(8px);
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s, color 0.18s;
}

.map-view__filter-btn.is-active {
  background: rgba(31, 167, 160, 0.14);
  color: var(--lian-accent, #1fa7a0);
  border-color: rgba(31, 167, 160, 0.36);
}

.map-view__filter-btn:hover {
  background: rgba(255, 255, 255, 0.94);
}
</style>
