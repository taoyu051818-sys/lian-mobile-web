<script setup lang="ts">
import { computed, onActivated, onMounted, watch } from "vue";
import type { MapLocation, MapPost } from "../../types/map";
import type { PageChromeSpec } from "../../shell/page-model";
import MapCanvas from "./MapCanvas.vue";
import MapPlaceSheet from "./MapPlaceSheet.vue";
import MapStatus from "./MapStatus.vue";
import { PostDetailPanel } from "../detail";
import { useMapChrome } from "./useMapChrome";
import { useMapDataCache } from "./useMapDataCache";
import { useMapSelection } from "./useMapSelection";
import { useDetailNavigation } from "../../app/detail-navigation";
import { MAP_ARIA_LABEL } from "../../config/brand";
import { DEFAULT_MAP_VIEWPORT_POLICY } from "../../types/map-policy";

defineOptions({ name: "MapLeafletView" });

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

const { filterActive, toggleFilter, MAP_FILTERS } = useMapChrome();

const { mapData, roadPreview, loading, errorMessage, loadMap } = useMapDataCache();

const { selectedTarget, selectLocation, closePlaceSheet } = useMapSelection(
  () => mapData.value?.posts || [],
);

const detail = useDetailNavigation();

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
    detail.open(Number(place.tid), "card");
  } else {
    selectLocation(place);
  }
}

function onCanvasError(message: string) {
  errorMessage.value = message;
}

const pageChrome = computed<PageChromeSpec>(() => ({
  top: {
    filters: MAP_FILTERS.map((f) => ({
      id: f.id,
      label: f.label,
      active: filterActive.value[f.id] ?? false,
    })),
    onFilterToggle: toggleFilter,
  },
}));

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true });

onMounted(() => {
  emit("chrome", pageChrome.value);
  void loadMap();
});

onActivated(() => {
  // KeepAlive caches this view, so onMounted only fires the first time.
  // Re-emit chrome on every reactivation so the shell state matches the
  // map view instead of whichever view we just left.
  emit("chrome", pageChrome.value);
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
        :viewport-policy="DEFAULT_MAP_VIEWPORT_POLICY"
        @load-error="onCanvasError"
        @place-select="handlePlaceSelect"
      />
      <MapStatus :loading="loading" :error-message="errorMessage" />
      <MapPlaceSheet :selected-place="selectedPlace" @close="closePlaceSheet" />
      <PostDetailPanel
        v-if="detail.detailOpen.value"
        class="map-view__post-detail"
        :post="detail.detailPost.value"
        :loading="detail.detailLoading.value"
        :error="detail.detailError.value"
        @close="detail.close('user-tap')"
        @retry="detail.retry()"
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

.map-view__post-detail {
  position: sticky;
  bottom: calc(92px + env(safe-area-inset-bottom));
  z-index: 20;
}
</style>
