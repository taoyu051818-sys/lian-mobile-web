import { computed, ref, type Ref } from "vue";
import { fetchMapV2Items } from "../../api/map";
import { ERROR_PUBLISH_LOCATION, PUBLISH_LOCATION_UNBOUND, PUBLISH_LOCATION_MANUAL_HINT, PUBLISH_LOCATION_BOUND, PUBLISH_OPTIONAL } from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { createMapV2LocationDraft } from "../../api/publish";
import type { MapLocation } from "../../types/map";
import type { PlaceRef } from "../../types/place";
import type { PublishLocationDraft } from "../../types/publish";

export function usePublishLocationOptions(placeName: Ref<string>) {
  const mapLocations = ref<MapLocation[]>([]);
  const selectedMapLocation = ref<MapLocation | null>(null);
  const mapLocationLoading = ref(false);
  const mapLocationError = ref("");
  const locationSearch = ref("");
  const locationPanelOpen = ref(false);

  function placeIdForLocation(location: MapLocation) {
    return location.place?.id || location.placeId || "";
  }

  function placeRefForLocation(location: MapLocation): PlaceRef | undefined {
    const id = placeIdForLocation(location);
    if (!id) return undefined;
    return location.place || {
      id,
      name: location.name,
      type: location.type,
    };
  }

  const filteredMapLocations = computed(() => {
    const keyword = locationSearch.value.trim().toLowerCase();
    const list = keyword
      ? mapLocations.value.filter((location) => `${location.name} ${location.type || ""} ${location.place?.name || ""} ${location.place?.type || ""}`.toLowerCase().includes(keyword))
      : mapLocations.value;
    return list.slice(0, 18);
  });

  const selectedLocationDraft = computed<PublishLocationDraft | null>(() => {
    const location = selectedMapLocation.value;
    if (!location) return null;
    return createMapV2LocationDraft({
      locationId: location.id,
      name: location.name,
      lat: location.lat,
      lng: location.lng,
      placeId: placeIdForLocation(location),
      place: placeRefForLocation(location),
    });
  });

  const knownPlaceLabel = computed(() => {
    const location = selectedMapLocation.value;
    if (!location) return "";
    return placeRefForLocation(location)?.name || location.name;
  });

  const locationPreviewLabel = computed(() => knownPlaceLabel.value || placeName.value.trim() || PUBLISH_LOCATION_UNBOUND);
  const locationBindingMeta = computed(() => selectedMapLocation.value ? PUBLISH_LOCATION_BOUND : PUBLISH_LOCATION_MANUAL_HINT);
  const locationToolLabel = computed(() => {
    if (selectedMapLocation.value) return knownPlaceLabel.value;
    if (placeName.value.trim()) return placeName.value.trim();
    return PUBLISH_OPTIONAL;
  });

  async function loadMapLocations() {
    mapLocationLoading.value = true;
    mapLocationError.value = "";
    try {
      const data = await fetchMapV2Items();
      mapLocations.value = data.locations || [];
    } catch (error) {
      mapLocationError.value = extractErrorMessage(error, ERROR_PUBLISH_LOCATION);
    } finally {
      mapLocationLoading.value = false;
    }
  }

  function selectMapLocation(location: MapLocation) {
    selectedMapLocation.value = location;
    placeName.value = location.name;
    locationSearch.value = location.name;
    locationPanelOpen.value = true;
    mapLocationError.value = "";
  }

  function clearMapLocation() {
    selectedMapLocation.value = null;
    locationPanelOpen.value = true;
  }

  function toggleLocationPanel() {
    locationPanelOpen.value = !locationPanelOpen.value;
  }

  function clearLocationState() {
    selectedMapLocation.value = null;
    locationSearch.value = "";
    locationPanelOpen.value = false;
  }

  return {
    mapLocations, selectedMapLocation, mapLocationLoading, mapLocationError,
    locationSearch, locationPanelOpen,
    filteredMapLocations, selectedLocationDraft, knownPlaceLabel,
    locationPreviewLabel, locationBindingMeta, locationToolLabel,
    loadMapLocations, selectMapLocation, clearMapLocation,
    toggleLocationPanel, clearLocationState,
  };
}
