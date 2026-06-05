import { ref } from "vue";
import { fetchMapV2Items, fetchRoadNetworkPreview, type MapViewportQuery } from "../../api/map";
import type { MapRoadNetworkPreview, MapV2ItemsResponse } from "../../types/map";
import { ERROR_LOAD_MAP } from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";

const cachedData = ref<MapV2ItemsResponse | null>(null);
const cachedRoadPreview = ref<MapRoadNetworkPreview | null>(null);
let inFlightRequest: { promise: Promise<void>; queryKey: string; requestId: number } | null = null;
let cachedQueryKey = "";
let activeRequestId = 0;

function normalizeMapQuery(query?: MapViewportQuery): MapViewportQuery | undefined {
  if (!query) return undefined;
  return {
    bounds: query.bounds,
    zoom: query.zoom,
    types: [...(query.types ?? [])].sort(),
  };
}

function mapQueryKey(query?: MapViewportQuery): string {
  return JSON.stringify(normalizeMapQuery(query) ?? null);
}

export function useMapDataCache() {
  const loading = ref(false);
  const errorMessage = ref("");

  async function loadMap(
    queryOrForceRefresh: MapViewportQuery | boolean = false,
    forceRefresh = false,
  ) {
    const query = typeof queryOrForceRefresh === "boolean" ? undefined : queryOrForceRefresh;
    const shouldForceRefresh =
      typeof queryOrForceRefresh === "boolean" ? queryOrForceRefresh : forceRefresh;
    const queryKey = mapQueryKey(query);
    if (inFlightRequest && !shouldForceRefresh && inFlightRequest.queryKey === queryKey) {
      await inFlightRequest.promise;
      return;
    }
    if (cachedData.value && !shouldForceRefresh && cachedQueryKey === queryKey) return;

    const requestId = activeRequestId + 1;
    activeRequestId = requestId;
    loading.value = true;
    errorMessage.value = "";
    const promise = (async () => {
      try {
        const [items, preview] = await Promise.all([
          fetchMapV2Items(query),
          fetchRoadNetworkPreview().catch(() => null),
        ]);
        if (requestId !== activeRequestId) return;
        cachedData.value = items;
        cachedRoadPreview.value = preview;
        cachedQueryKey = queryKey;
      } catch (error) {
        if (requestId !== activeRequestId) return;
        errorMessage.value = extractErrorMessage(error, ERROR_LOAD_MAP);
      } finally {
        if (requestId === activeRequestId) loading.value = false;
        if (inFlightRequest?.requestId === requestId) inFlightRequest = null;
      }
    })();
    inFlightRequest = { promise, queryKey, requestId };
    await promise;
  }

  return {
    mapData: cachedData,
    roadPreview: cachedRoadPreview,
    loading,
    errorMessage,
    loadMap,
  };
}
