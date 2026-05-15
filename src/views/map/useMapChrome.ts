import { ref, type Ref } from "vue";
import type { MapLocation, MapPost } from "../../types/map";

export interface MapFilterDef {
  id: string;
  label: string;
  defaultActive?: boolean;
}

const MAP_FILTERS: MapFilterDef[] = [
  { id: "locations", label: "地点", defaultActive: true },
  { id: "posts", label: "内容", defaultActive: true },
];

/** @deprecated Helper retained for test compatibility; will be removed in PR 2. */
export function defineMapFilterSpec(filters: MapFilterDef[], active: Record<string, boolean>) {
  return filters.map((f) => ({
    id: `filter-${f.id}`,
    label: active[f.id] ? `✓ ${f.label}` : f.label,
    variant: "ghost" as const,
  }));
}

/** @deprecated Helper retained for test compatibility; will be removed in PR 2. */
export function defineMapTopChrome(filters: MapFilterDef[], active: Record<string, boolean>) {
  return { buttons: defineMapFilterSpec(filters, active), visible: true };
}

/** @deprecated Helper retained for test compatibility; will be removed in PR 2. */
export function defineMapBottomChromeForPlace(place: MapLocation | MapPost) {
  const name = "name" in place ? place.name : place.title || place.locationArea || "";
  return {
    visible: true,
    buttons: [
      { id: "place-view", label: `查看 ${name}`, variant: "primary" as const },
      { id: "place-close", label: "关闭", variant: "ghost" as const },
    ],
  };
}

/** @deprecated Helper retained for test compatibility; will be removed in PR 2. */
export function defineMapDefaultBottomChrome() {
  return { visible: false, buttons: [] };
}

export function useMapChrome() {
  const selectedPlace: Ref<MapLocation | MapPost | null> = ref(null);
  const filterActive = ref<Record<string, boolean>>(
    Object.fromEntries(MAP_FILTERS.map((f) => [f.id, f.defaultActive ?? false])),
  );

  function handlePlaceSelect(place: MapLocation | MapPost) {
    selectedPlace.value = place;
  }

  function closePlaceSheet() {
    selectedPlace.value = null;
  }

  function toggleFilter(id: string) {
    filterActive.value = { ...filterActive.value, [id]: !filterActive.value[id] };
  }

  return {
    selectedPlace,
    filterActive,
    handlePlaceSelect,
    closePlaceSheet,
    toggleFilter,
    MAP_FILTERS,
  };
}
