import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/api/map", () => ({
  fetchMapV2Items: vi.fn(),
  fetchRoadNetworkPreview: vi.fn(),
}));

import { fetchMapV2Items, fetchRoadNetworkPreview } from "../../src/api/map";

const mockFetchItems = vi.mocked(fetchMapV2Items);
const mockFetchPreview = vi.mocked(fetchRoadNetworkPreview);

async function freshCache() {
  const mod = await import("../../src/features/map/useMapDataCache");
  return mod.useMapDataCache();
}

describe("useMapDataCache", () => {
  beforeEach(() => {
    mockFetchItems.mockReset();
    mockFetchPreview.mockReset();
    vi.resetModules();
  });

  it("loadMap fetches items and preview", async () => {
    const items = { locations: [], posts: [] };
    const preview = { roads: [] };
    mockFetchItems.mockResolvedValue(items as any);
    mockFetchPreview.mockResolvedValue(preview as any);

    const cache = await freshCache();
    await cache.loadMap();

    expect(cache.loading.value).toBe(false);
    expect(cache.mapData.value).toEqual(items);
    expect(cache.roadPreview.value).toEqual(preview);
    expect(cache.errorMessage.value).toBe("");
  });

  it("loadMap sets error on fetch failure", async () => {
    mockFetchItems.mockRejectedValue(new Error("网络超时"));
    mockFetchPreview.mockResolvedValue(null as any);

    const cache = await freshCache();
    await cache.loadMap();

    expect(cache.loading.value).toBe(false);
    expect(cache.errorMessage.value).toBe("网络超时");
  });

  it("loadMap uses fallback error for non-Error throws", async () => {
    mockFetchItems.mockRejectedValue("unknown");
    mockFetchPreview.mockResolvedValue(null as any);

    const cache = await freshCache();
    await cache.loadMap();

    expect(cache.errorMessage.value).toBe("地图数据暂时没加载出来，可以稍后再试。");
  });

  it("roadPreview failure does not block items", async () => {
    const items = { locations: [], posts: [] };
    mockFetchItems.mockResolvedValue(items as any);
    mockFetchPreview.mockRejectedValue(new Error("road error"));

    const cache = await freshCache();
    await cache.loadMap();

    expect(cache.mapData.value).toEqual(items);
    expect(cache.roadPreview.value).toBeNull();
  });

  it("skips fetch when cache is populated", async () => {
    const items = { locations: [{ id: "1" }] };
    mockFetchItems.mockResolvedValue(items as any);
    mockFetchPreview.mockResolvedValue(null as any);

    const cache = await freshCache();
    await cache.loadMap();
    mockFetchItems.mockClear();

    await cache.loadMap();
    expect(mockFetchItems).not.toHaveBeenCalled();
    expect(cache.mapData.value).toEqual(items);
  });

  it("reloads when viewport or type filter params change", async () => {
    const items1 = { locations: [{ id: "1" }] };
    const items2 = { posts: [{ tid: 2 }] };
    const firstQuery = {
      bounds: { south: 18.37, west: 109.98, north: 18.42, east: 110.05 },
      zoom: 16,
      types: ["locations"],
    };
    const nextQuery = {
      bounds: { south: 18.38, west: 109.99, north: 18.43, east: 110.06 },
      zoom: 17,
      types: ["posts"],
    };
    mockFetchItems.mockResolvedValueOnce(items1 as any).mockResolvedValueOnce(items2 as any);
    mockFetchPreview.mockResolvedValue(null as any);

    const cache = await freshCache();
    await cache.loadMap(firstQuery);
    await cache.loadMap({ ...firstQuery });
    expect(mockFetchItems).toHaveBeenCalledTimes(1);

    await cache.loadMap(nextQuery);
    expect(mockFetchItems).toHaveBeenCalledTimes(2);
    expect(mockFetchItems).toHaveBeenNthCalledWith(1, firstQuery);
    expect(mockFetchItems).toHaveBeenNthCalledWith(2, nextQuery);
    expect(cache.mapData.value).toEqual(items2);
  });

  it("reloads when only type filter params change", async () => {
    const items1 = { locations: [{ id: "1" }], posts: [] };
    const items2 = { locations: [], posts: [{ tid: 2 }] };
    const bounds = { south: 18.37, west: 109.98, north: 18.42, east: 110.05 };
    const firstQuery = { bounds, zoom: 16, types: ["locations"] };
    const nextQuery = { bounds, zoom: 16, types: ["merchants", "relations"] };
    mockFetchItems.mockResolvedValueOnce(items1 as any).mockResolvedValueOnce(items2 as any);
    mockFetchPreview.mockResolvedValue(null as any);

    const cache = await freshCache();
    await cache.loadMap(firstQuery);
    await cache.loadMap(nextQuery);

    expect(mockFetchItems).toHaveBeenCalledTimes(2);
    expect(mockFetchItems).toHaveBeenNthCalledWith(1, firstQuery);
    expect(mockFetchItems).toHaveBeenNthCalledWith(2, nextQuery);
    expect(cache.mapData.value).toEqual(items2);
  });

  it("normalizes type order when caching map query params", async () => {
    const items = { locations: [{ id: "1" }], posts: [{ tid: 2 }] };
    const bounds = { south: 18.37, west: 109.98, north: 18.42, east: 110.05 };
    mockFetchItems.mockResolvedValue(items as any);
    mockFetchPreview.mockResolvedValue(null as any);

    const cache = await freshCache();
    await cache.loadMap({ bounds, zoom: 16, types: ["posts", "locations"] });
    await cache.loadMap({ bounds, zoom: 16, types: ["locations", "posts"] });

    expect(mockFetchItems).toHaveBeenCalledTimes(1);
  });

  it("keeps the latest viewport response when map loads finish out of order", async () => {
    const firstItems = { locations: [{ id: "old" }] };
    const latestItems = { locations: [{ id: "new" }] };
    const bounds = { south: 18.37, west: 109.98, north: 18.42, east: 110.05 };
    const firstQuery = { bounds, zoom: 16, types: ["locations"] };
    const latestQuery = { bounds: { ...bounds, east: 110.06 }, zoom: 17, types: ["locations"] };
    let resolveFirst!: (value: unknown) => void;
    let resolveLatest!: (value: unknown) => void;
    mockFetchItems
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)) as any)
      .mockReturnValueOnce(new Promise((resolve) => (resolveLatest = resolve)) as any);
    mockFetchPreview.mockResolvedValue(null as any);

    const cache = await freshCache();
    const firstLoad = cache.loadMap(firstQuery);
    const latestLoad = cache.loadMap(latestQuery);

    resolveLatest(latestItems);
    await latestLoad;
    expect(cache.mapData.value).toEqual(latestItems);

    resolveFirst(firstItems);
    await firstLoad;
    expect(cache.mapData.value).toEqual(latestItems);
  });

  it("forceRefresh bypasses cache", async () => {
    const items1 = { locations: [{ id: "1" }] };
    const items2 = { locations: [{ id: "2" }] };
    mockFetchItems.mockResolvedValueOnce(items1 as any);
    mockFetchPreview.mockResolvedValue(null as any);

    const cache = await freshCache();
    await cache.loadMap();
    expect(cache.mapData.value).toEqual(items1);

    mockFetchItems.mockResolvedValueOnce(items2 as any);
    await cache.loadMap(true);
    expect(cache.mapData.value).toEqual(items2);
  });
});
