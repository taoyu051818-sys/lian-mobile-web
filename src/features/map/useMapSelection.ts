import { ref } from "vue";
import { fetchPlaceSheet } from "../../api/places";
import type { MapLocation, MapPost } from "../../types/map";
import type { PlaceSheet } from "../../types/place";
import { ERROR_LOAD_PLACE } from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";

export type MapTarget = { kind: "location"; item: MapLocation } | { kind: "post"; item: MapPost };

export function placeIdForLocation(location: MapLocation) {
  return location.place?.id || location.placeId || "";
}

export function hasStablePlaceRef(location: MapLocation) {
  return Boolean(placeIdForLocation(location));
}

/**
 * Map-only selection state. Post-detail navigation is owned by the
 * detail-navigation FSM at the app level, so this composable only tracks
 * the place sheet + selected target. Map's "open this post" entry point is
 * `detail.open(tid, "card")` from the view directly.
 */
export function useMapSelection(_getPosts: () => MapPost[]) {
  const selectedTarget = ref<MapTarget | null>(null);
  const selectedPlaceSheet = ref<PlaceSheet | null>(null);
  const placeSheetLoading = ref(false);
  const placeSheetError = ref("");
  const openPlaceId = ref("");
  let placeRequestToken = 0;

  function selectLocation(item: MapLocation) {
    selectedTarget.value = { kind: "location", item };
    selectedPlaceSheet.value = null;
    placeSheetError.value = "";
    placeSheetLoading.value = false;
    openPlaceId.value = "";
    placeRequestToken += 1;
  }

  async function openPlaceSheet(location: MapLocation) {
    const placeId = placeIdForLocation(location);
    if (!placeId) return;
    const requestToken = (placeRequestToken += 1);
    openPlaceId.value = placeId;
    selectedPlaceSheet.value = null;
    placeSheetError.value = "";
    placeSheetLoading.value = true;
    try {
      const sheet = await fetchPlaceSheet(placeId);
      if (openPlaceId.value === placeId && placeRequestToken === requestToken) {
        selectedPlaceSheet.value = sheet;
      }
    } catch (error) {
      if (openPlaceId.value === placeId && placeRequestToken === requestToken) {
        placeSheetError.value = extractErrorMessage(error, ERROR_LOAD_PLACE) || ERROR_LOAD_PLACE;
      }
    } finally {
      if (openPlaceId.value === placeId && placeRequestToken === requestToken) {
        placeSheetLoading.value = false;
      }
    }
  }

  function closePlaceSheet() {
    placeRequestToken += 1;
    openPlaceId.value = "";
    selectedPlaceSheet.value = null;
    placeSheetError.value = "";
    placeSheetLoading.value = false;
  }

  return {
    selectedTarget,
    selectedPlaceSheet,
    placeSheetLoading,
    placeSheetError,
    openPlaceId,
    selectLocation,
    openPlaceSheet,
    closePlaceSheet,
  };
}
