import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchMapV2Items, fetchRoadNetworkPreview } from "../../src/api/map";
import { useMapDataCache } from "../../src/features/map/useMapDataCache";
import type { MapViewportQuery } from "../../src/types/map";

vi.mock("../../src/api/map", () => ({
  fetchMapV2Items: vi.fn(),
  fetchRoadNetworkPreview: vi.fn(),
}));

const fetchMapV2ItemsMock = vi.mocked(fetchMapV2Items);
const fetchRoadNetworkPreviewMock = vi.mocked(fetchRoadNetworkPreview);

const viewportQuery: MapViewportQuery = {
  bounds: { south: 18.37, west: 109.98, north: 18.42, east: 110.05 },
  zoom: 16,
  types: ["locations", "posts", "merchants", "relations"],
};

describe("useMapDataCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMapV2ItemsMock.mockResolvedValue({ locations: [], posts: [] });
    fetchRoadNetworkPreviewMock.mockResolvedValue(null);
  });

  it("loads Map V2 data with the current viewport and active type filters", async () => {
    const { loadMap, mapData, errorMessage } = useMapDataCache();

    await loadMap(viewportQuery, true);

    expect(fetchMapV2ItemsMock).toHaveBeenCalledTimes(1);
    expect(fetchMapV2ItemsMock).toHaveBeenCalledWith(viewportQuery);
    expect(mapData.value).toEqual({ locations: [], posts: [] });
    expect(errorMessage.value).toBe("");
  });

  it("treats type filter changes as a distinct Map V2 query", async () => {
    const { loadMap } = useMapDataCache();

    await loadMap(viewportQuery, true);
    await loadMap({ ...viewportQuery, types: ["locations", "posts"] });

    expect(fetchMapV2ItemsMock).toHaveBeenCalledTimes(2);
    expect(fetchMapV2ItemsMock).toHaveBeenLastCalledWith({
      ...viewportQuery,
      types: ["locations", "posts"],
    });
  });
});
