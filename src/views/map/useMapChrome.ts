import { ref } from "vue";

export interface MapFilterDef {
  id: string;
  label: string;
  defaultActive?: boolean;
}

export const MAP_FILTERS: MapFilterDef[] = [
  { id: "locations", label: "地点", defaultActive: true },
  { id: "posts", label: "内容", defaultActive: true },
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
