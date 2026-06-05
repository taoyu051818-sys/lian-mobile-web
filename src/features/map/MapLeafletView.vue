<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from "vue";
import type { MapViewportQuery } from "../../types/map";
import type { FeedItemId } from "../../types/feed";
import type { MapLocation, MapPost } from "../../types/map";
import type { PageChromeSpec } from "../../shell/page-model";
import MapCanvas from "./MapCanvas.vue";
import MapPickerOverlay from "./MapPickerOverlay.vue";
import MapPlaceSheet from "./MapPlaceSheet.vue";
import MapStatus from "./MapStatus.vue";
import { useMapChrome } from "./useMapChrome";
import { useMapDataCache } from "./useMapDataCache";
import { useMapPickerMode } from "./useMapPickerMode";
import { useMapSelection } from "./useMapSelection";
import { useDetailNavigation } from "../../app/detail-navigation";
import {
  MAP_ARIA_LABEL,
  MAP_DISCOVERY_FILTERS_META,
  MAP_DISCOVERY_TITLE,
} from "../../config/brand";
import { DEFAULT_MAP_VIEWPORT_POLICY } from "../../types/map-policy";

defineOptions({ name: "MapLeafletView" });

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

const { filterActive, activeTypes, toggleFilter, MAP_FILTERS } = useMapChrome();
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

// mw#943 — picker mode is driven by `#/map?picker=1`. The composable owns
// the URL query read, picker selection state, and the confirm/cancel
// navigation. Browse-mode behaviour is preserved when the flag is false.
const picker = useMapPickerMode();

const detail = useDetailNavigation();

const selectedPlace = computed<MapLocation | MapPost | null>(() => {
  // Picker mode owns its own selection chrome (the floating overlay), so the
  // legacy place sheet stays hidden — surfacing both at once would clash.
  if (picker.isPickerMode.value) return null;
  const target = selectedTarget.value;
  if (target?.kind === "location") return target.item;
  return null;
});

const visibleLayers = computed(() => ({
  locations: filterActive.value.locations,
  posts: filterActive.value.posts,
}));

const activeFilterMeta = computed(() => {
  const labels = MAP_FILTERS.filter((filter) => filterActive.value[filter.id]).map(
    (filter) => filter.label,
  );
  return labels.length ? labels.join(" · ") : MAP_DISCOVERY_FILTERS_META;
});

const mapQuery = computed<MapViewportQuery | null>(() => {
  if (!viewport.value) return null;
  return {
    ...viewport.value,
    types: activeTypes.value,
  };
});

function isMapPost(place: MapLocation | MapPost): place is MapPost {
  return "tid" in place;
}

function handlePlaceSelect(place: MapLocation | MapPost) {
  // Picker mode reroutes both marker and post taps. Posts are still places
  // on the map, so tapping a post pin in picker mode treats it as the post's
  // anchor location (lat/lng) rather than opening detail. This matches the
  // WeChat / 小红书 behaviour where every visible map dot is a candidate.
  if (picker.isPickerMode.value) {
    if (isMapPost(place)) {
      picker.dropPin({ lat: place.lat, lng: place.lng });
    } else {
      picker.selectLocation(place);
    }
    return;
  }
  if (isMapPost(place)) {
    detail.open(Number(place.tid), "card");
  } else {
    selectLocation(place);
    void openPlaceSheet(place);
  }
}

function openRecentPost(tid: FeedItemId | string) {
  detail.open(Number(tid), "card");
}

function handleLongpress(latlng: { lat: number; lng: number }) {
  // Long-press is a no-op outside picker mode — the regular browse UX has
  // never wired this gesture, so silent ignore is the safe default.
  if (!picker.isPickerMode.value) return;
  picker.dropPin(latlng);
}

function onCanvasError(message: string) {
  errorMessage.value = message;
}

function handleViewportChange(nextViewport: MapViewportQuery) {
  viewport.value = nextViewport;
}

const pageChrome = computed<PageChromeSpec>(() => ({
  top: {
    identity: {
      avatarText: "近",
      name: MAP_DISCOVERY_TITLE,
      meta: activeFilterMeta.value,
    },
    filters: MAP_FILTERS.map((f) => ({
      id: f.id,
      label: f.label,
      active: filterActive.value[f.id] ?? false,
    })),
    onFilterToggle: toggleFilter,
  },
}));

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true });

watch(
  mapQuery,
  (query) => {
    if (query) void loadMap(query);
  },
  { deep: true },
);

onMounted(() => {
  emit("chrome", pageChrome.value);
  void loadMap(mapQuery.value ?? undefined);
});

onActivated(() => {
  // KeepAlive caches this view, so onMounted only fires the first time.
  // Re-emit chrome on every reactivation so the shell state matches the
  // map view instead of whichever view we just left.
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
        @load-error="onCanvasError"
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
