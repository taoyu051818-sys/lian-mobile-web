import { ref } from "vue";
import { fetchMapV2Items, fetchRoadNetworkPreview } from "../api/map";
import type { MapRoadNetworkPreview, MapV2ItemsResponse } from "../types/map";

const cachedData = ref<MapV2ItemsResponse | null>(null);
const cachedRoadPreview = ref<MapRoadNetworkPreview | null>(null);
let fetchPromise: Promise<void> | null = null;

export function useMapDataCache() {
  const loading = ref(false);
  const errorMessage = ref("");

  async function loadMap(forceRefresh = false) {
    if (fetchPromise && !forceRefresh) {
      await fetchPromise;
      return;
    }
    if (cachedData.value && !forceRefresh) return;

    loading.value = true;
    errorMessage.value = "";
    fetchPromise = (async () => {
      try {
        const [items, preview] = await Promise.all([
          fetchMapV2Items(),
          fetchRoadNetworkPreview().catch(() => null),
        ]);
        cachedData.value = items;
        cachedRoadPreview.value = preview;
      } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : "地图数据暂时没加载出来，可以稍后再试。";
      } finally {
        loading.value = false;
        fetchPromise = null;
      }
    })();
    await fetchPromise;
  }

  return {
    mapData: cachedData,
    roadPreview: cachedRoadPreview,
    loading,
    errorMessage,
    loadMap,
  };
}
