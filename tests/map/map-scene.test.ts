import { describe, expect, it } from "vitest";
import {
  buildMapScene,
  projectMapPoint,
  unprojectScenePoint,
} from "../../src/features/map/mapScene";
import type { MapBounds, MapV2ItemsResponse } from "../../src/types/map";

const bounds: MapBounds = {
  south: 18.37,
  west: 109.98,
  north: 18.42,
  east: 110.05,
};

describe("Konva map scene", () => {
  it("round-trips geographic points through scene coordinates", () => {
    const source = { lat: 18.395, lng: 110.015 };
    const point = projectMapPoint(bounds, source, { width: 1429, height: 1101 });
    const restored = unprojectScenePoint(bounds, point, { width: 1429, height: 1101 });

    expect(restored.lat).toBeCloseTo(source.lat, 8);
    expect(restored.lng).toBeCloseTo(source.lng, 8);
  });

  it("adapts the existing Map V2 response into a JSON-first linked scene", () => {
    const payload: MapV2ItemsResponse = {
      bounds,
      center: { lat: 18.395, lng: 110.015 },
      zoom: 16,
      locations: [
        { id: "library", placeId: "place-library", name: "图书馆", lat: 18.39, lng: 110.01 },
        { id: "marker-only", name: "临时标记", lat: 18.391, lng: 110.011 },
      ],
      posts: [{ tid: 42, title: "失物招领", lat: 18.4, lng: 110.02 }],
      layers: {
        assets: [
          {
            id: "camera-1",
            kind: "camera",
            url: "/assets/camera.png",
            position: { lat: 18.4, lng: 110.02 },
            rotation: 15,
          },
        ],
      },
    };

    const scene = buildMapScene(payload, null);

    expect(scene.version).toBe(1);
    expect(scene.background.url).toBe("/assets/campus-base-map.png");
    expect(scene.locations[0]?.linkedEntity).toEqual({
      kind: "place",
      id: "place-library",
    });
    expect(scene.locations[1]?.id).toBe("marker-only");
    expect(scene.locations[1]?.linkedEntity).toBeUndefined();
    expect(scene.posts[0]?.linkedEntity).toEqual({ kind: "post", id: "42" });
    expect(scene.assets[0]?.linkedEntity).toEqual({ kind: "device", id: "camera-1" });
  });
});
