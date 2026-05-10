import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import { useShellChrome } from "../../shell/useShellChrome";
import type { ShellChromeRegionSpec } from "../../shell/shell-chrome-types";
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

export function defineMapFilterSpec(filters: MapFilterDef[], active: Record<string, boolean>) {
  return filters.map((f) => ({
    id: `filter-${f.id}`,
    label: active[f.id] ? `✓ ${f.label}` : f.label,
    variant: "ghost" as const,
  }));
}

export function defineMapTopChrome(filters: MapFilterDef[], active: Record<string, boolean>): ShellChromeRegionSpec {
  return { buttons: defineMapFilterSpec(filters, active), visible: true };
}

export function defineMapBottomChromeForPlace(
  place: MapLocation | MapPost,
): ShellChromeRegionSpec {
  const name = "name" in place ? place.name : place.title || place.locationArea || "";
  return {
    visible: true,
    buttons: [
      { id: "place-view", label: `查看 ${name}`, variant: "primary" },
      { id: "place-close", label: "关闭", variant: "ghost" },
    ],
  };
}

export function defineMapDefaultBottomChrome(): ShellChromeRegionSpec {
  return { visible: false, buttons: [] };
}

export function useMapChrome() {
  const { applyRegions, setRegion, resetRegions } = useShellChrome();
  const selectedPlace: Ref<MapLocation | MapPost | null> = ref(null);
  const filterActive = ref<Record<string, boolean>>(
    Object.fromEntries(MAP_FILTERS.map((f) => [f.id, f.defaultActive ?? false])),
  );

  function applyTopChrome() {
    setRegion("top", defineMapTopChrome(MAP_FILTERS, filterActive.value));
  }

  function applyBottomChrome() {
    if (selectedPlace.value) {
      setRegion("bottom", defineMapBottomChromeForPlace(selectedPlace.value));
    } else {
      setRegion("bottom", defineMapDefaultBottomChrome());
    }
  }

  function handlePlaceSelect(place: MapLocation | MapPost) {
    selectedPlace.value = place;
    applyBottomChrome();
  }

  function closePlaceSheet() {
    selectedPlace.value = null;
    applyBottomChrome();
  }

  function toggleFilter(id: string) {
    filterActive.value = { ...filterActive.value, [id]: !filterActive.value[id] };
    applyTopChrome();
  }

  onMounted(() => {
    applyRegions({
      top: defineMapTopChrome(MAP_FILTERS, filterActive.value),
      bottom: defineMapDefaultBottomChrome(),
    });
  });

  onBeforeUnmount(() => {
    resetRegions();
  });

  return {
    selectedPlace,
    filterActive,
    handlePlaceSelect,
    closePlaceSheet,
    toggleFilter,
    MAP_FILTERS,
  };
}
