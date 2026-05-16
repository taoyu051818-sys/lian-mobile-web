import { ref } from "vue";
import { MAP_FILTER_LOCATIONS, MAP_FILTER_POSTS } from "../../config/brand";

export interface MapFilterDef {
  id: string;
  label: string;
  defaultActive?: boolean;
}

export const MAP_FILTERS: MapFilterDef[] = [
  { id: "locations", label: MAP_FILTER_LOCATIONS, defaultActive: true },
  { id: "posts", label: MAP_FILTER_POSTS, defaultActive: true },
];

export function useMapChrome() {
  const filterActive = ref<Record<string, boolean>>(
    Object.fromEntries(MAP_FILTERS.map((f) => [f.id, f.defaultActive ?? false])),
  );

  function toggleFilter(id: string) {
    filterActive.value = { ...filterActive.value, [id]: !filterActive.value[id] };
  }

  return {
    filterActive,
    toggleFilter,
    MAP_FILTERS,
  };
}
