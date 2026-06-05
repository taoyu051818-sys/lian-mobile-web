import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMapV2Items } from "../../src/api/map";

describe("map api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes viewport bounds and active type filters to Map V2", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ locations: [], posts: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchMapV2Items({
      bounds: { south: 18.37, west: 109.98, north: 18.42, east: 110.05 },
      zoom: 16,
      types: ["locations", "posts", "merchants", "relations"],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      "/api/map/v2/items?south=18.37&west=109.98&north=18.42&east=110.05&zoom=16&types=locations%2Cposts%2Cmerchants%2Crelations",
    );
  });

  it("preserves an explicitly empty active type filter set", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ locations: [], posts: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchMapV2Items({
      bounds: { south: 18.37, west: 109.98, north: 18.42, east: 110.05 },
      zoom: 16,
      types: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      "/api/map/v2/items?south=18.37&west=109.98&north=18.42&east=110.05&zoom=16&types=",
    );
  });

  it("omits missing type filters from the Map V2 query string", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ locations: [], posts: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchMapV2Items({
      bounds: { south: 18.37, west: 109.98, north: 18.42, east: 110.05 },
      zoom: 16,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/map/v2/items?south=18.37&west=109.98&north=18.42&east=110.05&zoom=16");
  });

  it("skips non-finite viewport numbers when building Map V2 params", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ locations: [], posts: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchMapV2Items({
      bounds: { south: Number.NaN, west: 109.98, north: Number.POSITIVE_INFINITY, east: 110.05 },
      zoom: Number.NEGATIVE_INFINITY,
      types: ["locations"],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/map/v2/items?west=109.98&east=110.05&types=locations");
  });

  it("keeps the legacy Map V2 path when no params are provided", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ locations: [], posts: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchMapV2Items();

    expect(fetchMock).toHaveBeenCalledWith("/api/map/v2/items", expect.any(Object));
  });
});
