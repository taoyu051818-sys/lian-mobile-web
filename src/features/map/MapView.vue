<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from "vue";
import { useDetailNavigation } from "../../app/detail-navigation";
import { MAP_ARIA_LABEL, MAP_DISCOVERY_TITLE } from "../../config/brand";
import type { PageChromeSpec } from "../../shell/page-model";
import type { FeedItemId } from "../../types/feed";
import type { MapLocation, MapPost, MapViewportQuery } from "../../types/map";
import { DEFAULT_MAP_VIEWPORT_POLICY } from "../../types/map-policy";
import MapCanvas from "./MapCanvas.vue";
import MapPickerOverlay from "./MapPickerOverlay.vue";
import MapPlaceSheet from "./MapPlaceSheet.vue";
import MapStatus from "./MapStatus.vue";
import { useMapChrome } from "./useMapChrome";
import { useMapDataCache } from "./useMapDataCache";
import { useMapPickerMode } from "./useMapPickerMode";
import { useMapSelection } from "./useMapSelection";

defineOptions({ name: "MapView" });

const emit = defineEmits<{ chrome: [spec: PageChromeSpec] }>();
const { filterActive, activeTypes, activeFilterMeta, toggleFilter, MAP_FILTERS } = useMapChrome();
const viewport = ref<MapViewportQuery | null>(null);
const { mapData, roadPreview, loading, errorMessage, loadMap } = useMapDataCache();
const {
  selectedTarget,
  selectedPlaceSheet,
  placeSheetLoading,
  placeSheetError,
  selectLocation,
  openPlaceSheet,
  closePlaceSheet,
} = useMapSelection(() => mapData.value?.posts || []);
const picker = useMapPickerMode();
const detail = useDetailNavigation();

const selectedPlace = computed<MapLocation | MapPost | null>(() => {
  if (picker.isPickerMode.value) return null;
  const target = selectedTarget.value;
  return target?.kind === "location" ? target.item : null;
});

const visibleLayers = computed(() => ({
  locations: filterActive.value.locations,
  posts: filterActive.value.posts,
}));

const mapQuery = computed<MapViewportQuery | null>(() => {
  if (!viewport.value) return null;
  return { ...viewport.value, types: activeTypes.value };
});

function isMapPost(place: MapLocation | MapPost): place is MapPost {
  return "tid" in place;
}

function handlePlaceSelect(place: MapLocation | MapPost) {
  if (picker.isPickerMode.value) {
    if (isMapPost(place)) picker.dropPin({ lat: place.lat, lng: place.lng });
    else picker.selectLocation(place);
    return;
  }
  if (isMapPost(place)) detail.open(Number(place.tid), "card");
  else {
    selectLocation(place);
    void openPlaceSheet(place);
  }
}

function openRecentPost(tid: FeedItemId | string) {
  detail.open(Number(tid), "card");
}

function handleLongpress(latlng: { lat: number; lng: number }) {
  if (picker.isPickerMode.value) picker.dropPin(latlng);
}

function handleViewportChange(nextViewport: MapViewportQuery) {
  const current = viewport.value;
  if (
    current &&
    current.zoom === nextViewport.zoom &&
    current.bounds.south === nextViewport.bounds.south &&
    current.bounds.west === nextViewport.bounds.west &&
    current.bounds.north === nextViewport.bounds.north &&
    current.bounds.east === nextViewport.bounds.east
  ) {
    return;
  }
  viewport.value = nextViewport;
}

const pageChrome = computed<PageChromeSpec>(() => ({
  top: {
    identity: { avatarText: "近", name: MAP_DISCOVERY_TITLE, meta: activeFilterMeta.value },
    filters: MAP_FILTERS.map((filter) => ({
      id: filter.id,
      label: filter.label,
      active: filterActive.value[filter.id] ?? false,
    })),
    onFilterToggle: toggleFilter,
  },
}));

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true });
watch(mapQuery, (query) => query && void loadMap(query), { deep: true });

onMounted(() => {
  emit("chrome", pageChrome.value);
  void loadMap(mapQuery.value ?? undefined);
});

onActivated(() => {
  emit("chrome", pageChrome.value);
  if (!mapData.value) void loadMap(mapQuery.value ?? undefined);
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
        :viewport-policy="DEFAULT_MAP_VIEWPORT_POLICY"
        @load-error="errorMessage = $event"
        @place-select="handlePlaceSelect"
        @map-longpress="handleLongpress"
        @viewport-change="handleViewportChange"
      />
      <MapStatus :loading="loading" :error-message="errorMessage" />
      <MapPlaceSheet
        :selected-place="selectedPlace"
        :place-sheet="selectedPlaceSheet"
        :place-sheet-loading="placeSheetLoading"
        :place-sheet-error="placeSheetError"
        @close="closePlaceSheet"
        @open-post="openRecentPost"
      />
      <MapPickerOverlay
        v-if="picker.isPickerMode.value"
        :selection="picker.selection.value"
        data-testid="map-picker-overlay"
        @confirm="picker.commitSelection"
        @cancel="picker.cancel"
      />
    </section>
  </section>
</template>

<style scoped>
.map-view {
  position: relative;
  display: block;
  width: 100vw;
  min-height: calc(100vh - 92px - env(safe-area-inset-bottom));
  margin-inline-start: calc(50% - 50vw);
  padding-top: calc(var(--floating-bar-height) + env(safe-area-inset-top));
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
</style>
