import { describe, expect, it } from "vitest";

import {
  MAP_DISCOVERY_EMPTY_FILTERS_META,
  MAP_DISCOVERY_FILTERS_META,
  MAP_FILTER_LOCATIONS,
  MAP_FILTER_MERCHANTS,
  MAP_FILTER_POSTS,
  MAP_FILTER_RELATIONS,
} from "../../src/config/brand";
import { useMapChrome } from "../../src/features/map/useMapChrome.ts";

describe("useMapChrome", () => {
  it("exposes active Map V2 type filters and updates them when chrome filters toggle", () => {
    const { activeTypes, toggleFilter } = useMapChrome();

    expect(activeTypes.value).toEqual(["locations", "posts", "merchants", "relations"]);

    toggleFilter("merchants");
    expect(activeTypes.value).toEqual(["locations", "posts", "relations"]);

    toggleFilter("locations");
    expect(activeTypes.value).toEqual(["posts", "relations"]);

    toggleFilter("relations");
    expect(activeTypes.value).toEqual(["posts"]);

    toggleFilter("posts");
    expect(activeTypes.value).toEqual([]);
  });

  it("derives chrome meta from active filters and shows an empty state when none are active", () => {
    const { activeFilterMeta, toggleFilter } = useMapChrome();

    expect(activeFilterMeta.value).toBe(MAP_DISCOVERY_FILTERS_META);

    toggleFilter("merchants");
    toggleFilter("relations");
    expect(activeFilterMeta.value).toBe(`${MAP_FILTER_LOCATIONS} · ${MAP_FILTER_POSTS}`);

    toggleFilter("locations");
    toggleFilter("posts");
    expect(activeFilterMeta.value).toBe(MAP_DISCOVERY_EMPTY_FILTERS_META);
  });

  it("exposes the calm default discovery filter set for the shell chrome", () => {
    const { MAP_FILTERS: filters } = useMapChrome();

    expect(filters).toEqual([
      { id: "locations", label: MAP_FILTER_LOCATIONS, defaultActive: true, discoverable: true },
      { id: "posts", label: MAP_FILTER_POSTS, defaultActive: true, discoverable: true },
      { id: "merchants", label: MAP_FILTER_MERCHANTS, defaultActive: true, discoverable: true },
      { id: "relations", label: MAP_FILTER_RELATIONS, defaultActive: true, discoverable: true },
    ]);
  });

  it("ignores unknown future filter ids without changing Map V2 state", () => {
    const { activeTypes, activeFilterMeta, filterActive, toggleFilter } = useMapChrome();

    toggleFilter("events");

    expect(activeTypes.value).toEqual(["locations", "posts", "merchants", "relations"]);
    expect(activeFilterMeta.value).toBe(MAP_DISCOVERY_FILTERS_META);
    expect(filterActive.value).not.toHaveProperty("events");
  });
});
