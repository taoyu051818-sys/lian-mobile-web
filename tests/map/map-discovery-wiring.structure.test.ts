import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function readRepoFile(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("map discovery wiring", () => {
  const view = readRepoFile("../../src/features/map/MapLeafletView.vue");
  const canvas = readRepoFile("../../src/features/map/MapCanvas.vue");

  it("reloads Map V2 data from Leaflet viewport changes", () => {
    expect(canvas).toMatch(
      /import type \{[\s\S]*?MapViewportQuery[\s\S]*?\} from "\.\.\/\.\.\/types\/map"/,
    );
    expect(canvas).toMatch(/moveend zoomend/);
    expect(view).toMatch(/@viewport-change="handleViewportChange"/);
    expect(view).toMatch(/loadMap\(mapQuery\.value/);
  });

  it("sends active type filters to Map V2 while still using filters as visible layer chrome", () => {
    expect(view).toMatch(/activeTypes/);
    expect(view).toMatch(/types: activeTypes\.value/);
    expect(view).toMatch(/locations: filterActive\.value\.locations/);
    expect(view).toMatch(/posts: filterActive\.value\.posts/);
    const chrome = readRepoFile("../../src/features/map/useMapChrome.ts");
    expect(chrome).toMatch(/discoverable\?: boolean/);
    expect(chrome).toMatch(/filter\.discoverable && filterActive\.value\[filter\.id\]/);
  });

  it("keeps picker mode routed through the existing picker flag", () => {
    expect(view).toMatch(/const picker = useMapPickerMode\(\)/);
    expect(view).toMatch(/v-if="picker\.isPickerMode\.value"/);
    expect(view).toMatch(/if \(picker\.isPickerMode\.value\)/);
    expect(view).toMatch(/const selectedPlace = computed/);
    expect(view).toMatch(/if \(picker\.isPickerMode\.value\) return null/);
  });

  it("adds local discovery copy to the map chrome and derives copy from active filters", () => {
    expect(view).toMatch(/MAP_DISCOVERY_TITLE/);
    expect(view).toMatch(/activeFilterMeta/);
    expect(view).toMatch(/meta: activeFilterMeta\.value/);
    expect(view).toMatch(/identity:/);
    expect(view).toMatch(/avatarText: "近"/);
    const brand = readRepoFile("../../src/config/brand/map.ts");
    expect(brand).toContain('MAP_DISCOVERY_TITLE = "附近发现"');
    expect(brand).toContain('MAP_DISCOVERY_FILTERS_META = "地点 · 动态 · 商家 · 关系"');
    expect(brand).toContain('MAP_DISCOVERY_EMPTY_FILTERS_META = "未选择类型"');
    expect(brand).toContain('MAP_FILTER_POSTS = "动态"');
    expect(brand).toContain('MAP_FILTER_MERCHANTS = "商家"');
    expect(brand).toContain('MAP_FILTER_RELATIONS = "关系"');
  });
});
