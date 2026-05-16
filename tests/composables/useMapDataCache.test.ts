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
