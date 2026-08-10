import { computed, ref, watch, type Ref } from "vue";
import { fetchMapV2Items } from "../../api/map";
import {
  ERROR_PUBLISH_LOCATION,
  PUBLISH_LOCATION_UNBOUND,
  PUBLISH_LOCATION_MANUAL_HINT,
  PUBLISH_LOCATION_BOUND,
  PUBLISH_LOCATION_MAP_PIN_BOUND,
  PUBLISH_LOCATION_PIN_LABEL,
  PUBLISH_OPTIONAL,
} from "../../config/brand";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { createMapV2LocationDraft } from "../../api/publish";
import type { MapLocation } from "../../types/map";
import type { PlaceRef } from "../../types/place";
import type { PublishLocationDraft } from "../../types/publish";
import type { PublishMapPickerLocationHandoff } from "./usePublishLocationHandoff";

export function usePublishLocationOptions(placeName: Ref<string>) {
  const mapLocations = ref<MapLocation[]>([]);
  const selectedMapLocation = ref<MapLocation | null>(null);
  const mapPickerBinding = ref<PublishMapPickerLocationHandoff | null>(null);
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
    return (
      location.place || {
        id,
        name: location.name,
        type: location.type,
      }
    );
  }

  const filteredMapLocations = computed(() => {
    const keyword = locationSearch.value.trim().toLowerCase();
    const list = keyword
      ? mapLocations.value.filter((location) =>
          `${location.name} ${location.type || ""} ${location.place?.name || ""} ${location.place?.type || ""}`
            .toLowerCase()
            .includes(keyword),
        )
      : mapLocations.value;
    return list.slice(0, 18);
  });

  const selectedLocationDraft = computed<PublishLocationDraft | null>(() => {
    const binding = mapPickerBinding.value;
    if (binding) {
      if (binding.kind === "place") {
        return createMapV2LocationDraft({
          locationId: binding.locationId || "",
          name: binding.name,
          lat: binding.lat,
          lng: binding.lng,
          placeId: binding.placeId,
          place: {
            id: binding.placeId,
            name: binding.name,
            type: binding.type,
          },
        });
      }
      return createMapV2LocationDraft({
        locationId: "",
        name: placeName.value.trim() || binding.label || PUBLISH_LOCATION_PIN_LABEL,
        lat: binding.lat,
        lng: binding.lng,
      });
    }
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
    if (location) return placeRefForLocation(location)?.name || location.name;
    const binding = mapPickerBinding.value;
    if (!binding) return "";
    return binding.kind === "place"
      ? binding.name
      : placeName.value.trim() || binding.label || PUBLISH_LOCATION_PIN_LABEL;
  });

  const hasStructuredMapBinding = computed(() =>
    Boolean(selectedMapLocation.value || mapPickerBinding.value),
  );

  const locationPreviewLabel = computed(
    () => knownPlaceLabel.value || placeName.value.trim() || PUBLISH_LOCATION_UNBOUND,
  );
  const locationBindingMeta = computed(() =>
    mapPickerBinding.value?.kind === "coords"
      ? PUBLISH_LOCATION_MAP_PIN_BOUND
      : hasStructuredMapBinding.value
        ? PUBLISH_LOCATION_BOUND
        : PUBLISH_LOCATION_MANUAL_HINT,
  );
  const locationToolLabel = computed(() => {
    if (hasStructuredMapBinding.value) return knownPlaceLabel.value;
    if (placeName.value.trim()) return placeName.value.trim();
    return PUBLISH_OPTIONAL;
  });

  async function loadMapLocations() {
    mapLocationLoading.value = true;
    mapLocationError.value = "";
    try {
      const data = await fetchMapV2Items();
      mapLocations.value = data.locations || [];
      reconcileMapPickerBinding();
    } catch (error) {
      mapLocationError.value = extractErrorMessage(error, ERROR_PUBLISH_LOCATION);
    } finally {
      mapLocationLoading.value = false;
    }
  }

  function selectMapLocation(location: MapLocation) {
    mapPickerBinding.value = null;
    selectedMapLocation.value = location;
    placeName.value = location.name;
    locationSearch.value = location.name;
    locationPanelOpen.value = true;
    mapLocationError.value = "";
  }

  function clearMapLocation() {
    selectedMapLocation.value = null;
    mapPickerBinding.value = null;
    locationPanelOpen.value = true;
  }

  function reconcileMapPickerBinding() {
    const binding = mapPickerBinding.value;
    if (!binding || binding.kind !== "place") return;
    const known = mapLocations.value.find(
      (location) => placeIdForLocation(location) === binding.placeId,
    );
    selectedMapLocation.value = known || null;
  }

  function applyMapPickerHandoff(binding: PublishMapPickerLocationHandoff) {
    // Last action wins: remove A completely before exposing any field from B.
    selectedMapLocation.value = null;
    mapPickerBinding.value = null;
    mapPickerBinding.value = binding;
    const label =
      binding.kind === "place" ? binding.name : binding.label || PUBLISH_LOCATION_PIN_LABEL;
    placeName.value = label;
    locationSearch.value = label;
    locationPanelOpen.value = true;
    mapLocationError.value = "";
    reconcileMapPickerBinding();
  }

  function applyDisplayOnlyLocation(label?: string) {
    const replacedStructuredLocation = hasStructuredMapBinding.value;
    selectedMapLocation.value = null;
    mapPickerBinding.value = null;
    const nextLabel = label?.trim() || (replacedStructuredLocation ? "" : placeName.value);
    placeName.value = nextLabel;
    locationSearch.value = nextLabel;
    locationPanelOpen.value = true;
    mapLocationError.value = "";
  }

  function toggleLocationPanel() {
    locationPanelOpen.value = !locationPanelOpen.value;
  }

  function clearLocationState() {
    selectedMapLocation.value = null;
    mapPickerBinding.value = null;
    locationSearch.value = "";
    locationPanelOpen.value = false;
  }

  watch([mapPickerBinding, mapLocations], reconcileMapPickerBinding);

  return {
    mapLocations,
    selectedMapLocation,
    mapPickerBinding,
    mapLocationLoading,
    mapLocationError,
    locationSearch,
    locationPanelOpen,
    filteredMapLocations,
    selectedLocationDraft,
    knownPlaceLabel,
    hasStructuredMapBinding,
    locationPreviewLabel,
    locationBindingMeta,
    locationToolLabel,
    loadMapLocations,
    selectMapLocation,
    applyMapPickerHandoff,
    applyDisplayOnlyLocation,
    reconcileMapPickerBinding,
    clearMapLocation,
    toggleLocationPanel,
    clearLocationState,
  };
}
