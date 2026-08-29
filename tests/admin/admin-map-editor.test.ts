import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAdminMapDocument,
  putAdminMapDocument,
  uploadAdminMapAsset,
} from "../../src/api/adminMap";
import {
  addMapAsset,
  buildEditableMapData,
  removeMapAsset,
  updateMapAsset,
} from "../../src/features/admin/adminMapEditorState";

const ADMIN_DOCUMENT = {
  ok: true,
  bounds: { south: 18.37, west: 109.98, north: 18.42, east: 110.05 },
  locations: { version: 1, coordSystem: "gcj02", items: [] },
  layers: {
    version: 1,
    coordSystem: "gcj02",
    center: { lat: 18.4, lng: 110.01 },
    zoom: 16,
    areas: [],
    routes: [],
    roads: [],
    assets: [
      {
        id: "camera-1",
        kind: "camera",
        url: "/camera.png",
        position: { lat: 18.4, lng: 110.01 },
        size: [40, 40] as [number, number],
        rotation: 0,
      },
    ],
  },
};

describe("admin map API", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the explicit ops bearer for map reads and writes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(ADMIN_DOCUMENT), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(ADMIN_DOCUMENT), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await fetchAdminMapDocument("ops-secret");
    await putAdminMapDocument("ops-secret", ADMIN_DOCUMENT);

    const getHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    const putHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/map-v2");
    expect(getHeaders.get("authorization")).toBe("Bearer ops-secret");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin/map-v2");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PUT");
    expect(putHeaders.get("authorization")).toBe("Bearer ops-secret");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      locations: ADMIN_DOCUMENT.locations,
      layers: ADMIN_DOCUMENT.layers,
    });
  });

  it("uploads a map asset without placing the ops token in the URL or form body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://cdn.test/camera.png" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "camera.png", {
      type: "image/png",
    });

    await expect(uploadAdminMapAsset("ops-secret", file)).resolves.toBe(
      "https://cdn.test/camera.png",
    );

    const [path, init] = fetchMock.mock.calls[0] || [];
    const headers = new Headers(init?.headers);
    const body = init?.body as FormData;
    expect(path).toBe("/api/admin/map-v2/assets");
    expect(headers.get("authorization")).toBe("Bearer ops-secret");
    expect(headers.has("content-type")).toBe(false);
    const uploaded = body.get("image") as File;
    expect(uploaded).toBeInstanceOf(File);
    expect(uploaded.name).toBe(file.name);
    expect(uploaded.type).toBe(file.type);
    expect(uploaded.size).toBe(file.size);
    expect(Array.from(body.values())).not.toContain("ops-secret");
  });
});

describe("admin map editor state", () => {
  it("adapts the admin document to MapCanvas without losing backend-owned fields", () => {
    const source = structuredClone(ADMIN_DOCUMENT);
    const mapData = buildEditableMapData(source);

    expect(mapData.bounds).toEqual(source.bounds);
    expect(mapData.center).toEqual(source.layers.center);
    expect(mapData.layers?.assets?.[0]?.id).toBe("camera-1");
    expect(source).toEqual(ADMIN_DOCUMENT);
  });

  it("updates, adds and removes assets immutably", () => {
    const source = structuredClone(ADMIN_DOCUMENT);
    const moved = updateMapAsset(source, {
      id: "camera-1",
      lat: 18.401,
      lng: 110.011,
      rotation: 25,
      width: 72,
      height: 54,
    });
    expect(moved.layers.assets?.[0]).toMatchObject({
      position: { lat: 18.401, lng: 110.011 },
      rotation: 25,
      size: [72, 54],
      anchor: [36, 27],
    });
    expect(source.layers.assets?.[0]?.rotation).toBe(0);

    const added = addMapAsset(moved, {
      id: "lamp-2",
      kind: "street-light",
      url: "/lamp.png",
      position: { lat: 18.4, lng: 110.01 },
      size: [48, 48],
      rotation: 0,
      opacity: 1,
    });
    expect(added.layers.assets?.map((asset) => asset.id)).toEqual(["camera-1", "lamp-2"]);

    const removed = removeMapAsset(added, "camera-1");
    expect(removed.layers.assets?.map((asset) => asset.id)).toEqual(["lamp-2"]);
    expect(added.layers.assets).toHaveLength(2);
  });
});
