import { computed, ref } from "vue";
import {
  MAP_DISCOVERY_EMPTY_FILTERS_META,
  MAP_FILTER_LOCATIONS,
  MAP_FILTER_MERCHANTS,
  MAP_FILTER_POSTS,
  MAP_FILTER_RELATIONS,
} from "../../config/brand";

export interface MapFilterDef {
  id: string;
  label: string;
  defaultActive?: boolean;
  discoverable?: boolean;
}

export const MAP_FILTERS: MapFilterDef[] = [
  { id: "locations", label: MAP_FILTER_LOCATIONS, defaultActive: true, discoverable: true },
  { id: "posts", label: MAP_FILTER_POSTS, defaultActive: true, discoverable: true },
  { id: "merchants", label: MAP_FILTER_MERCHANTS, defaultActive: true, discoverable: true },
  { id: "relations", label: MAP_FILTER_RELATIONS, defaultActive: true, discoverable: true },
];

export function useMapChrome() {
  const filterActive = ref<Record<string, boolean>>(
    Object.fromEntries(MAP_FILTERS.map((f) => [f.id, f.defaultActive ?? false])),
  );

  const activeTypes = computed(() =>
    MAP_FILTERS.filter((filter) => filter.discoverable && filterActive.value[filter.id]).map(
      (filter) => filter.id,
    ),
  );

  const activeFilterMeta = computed(() => {
    const labels = MAP_FILTERS.filter((filter) => filterActive.value[filter.id]).map(
      (filter) => filter.label,
    );
    return labels.length ? labels.join(" · ") : MAP_DISCOVERY_EMPTY_FILTERS_META;
  });

  function toggleFilter(id: string) {
    if (!MAP_FILTERS.some((filter) => filter.id === id)) return;
    filterActive.value = { ...filterActive.value, [id]: !filterActive.value[id] };
  }

  return {
    filterActive,
    activeTypes,
    activeFilterMeta,
    toggleFilter,
    MAP_FILTERS,
  };
}
