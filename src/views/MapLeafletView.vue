<script setup lang="ts">
import { onMounted, ref } from "vue";
import { fetchMapV2Items, fetchRoadNetworkPreview } from "../api/map";
import type { MapRoadNetworkPreview, MapV2ItemsResponse } from "../types/map";
import MapCanvas from "./map/MapCanvas.vue";
import MapPlaceSheet from "./map/MapPlaceSheet.vue";
import MapStatus from "./map/MapStatus.vue";

const mapData = ref<MapV2ItemsResponse | null>(null);
const roadPreview = ref<MapRoadNetworkPreview | null>(null);
const loading = ref(false);
const errorMessage = ref("");

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
        @load-error="onCanvasError"
      />
      <MapStatus :loading="loading" :error-message="errorMessage" />
      <MapPlaceSheet :selected-place="null" />
    </section>
  </section>
</template>

<style scoped>
.map-view {
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
</style>
