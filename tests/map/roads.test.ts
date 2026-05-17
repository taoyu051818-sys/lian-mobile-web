import { expect, it } from "vitest";

import {
  convertPreviewToRoads,
  previewPoint,
  resolveRoads,
  validateOfficialRoads,
} from "../../src/features/map/roads.ts";
import type { MapRoad, MapRoadNetworkPreview } from "../../src/types/map.ts";

// --- previewPoint ---

it("previewPoint converts projected meters to lat/lng with default transform", () => {
  const origin = previewPoint([18.393453, 110.015821]);
  expect(Math.abs(origin.lat - 18.393453)).toBeLessThan(0.0001);
  expect(Math.abs(origin.lng - 110.015821)).toBeLessThan(0.0001);
});

it("previewPoint applies translateX/translateY offsets", () => {
  const transform = { translateX: 100, translateY: 50, scale: 1, rotation: 0 };
  const result = previewPoint([18.393453, 110.015821], transform);
  expect(result.lng).toBeGreaterThan(110.015821);
  expect(result.lat).toBeGreaterThan(18.393453);
});

it("previewPoint handles missing transform gracefully", () => {
  const result = previewPoint([18.393453, 110.015821], undefined);
  expect(Number.isFinite(result.lat)).toBe(true);
  expect(Number.isFinite(result.lng)).toBe(true);
});

// --- convertPreviewToRoads ---

it("convertPreviewToRoads returns empty for null preview", () => {
  expect(convertPreviewToRoads(null)).toEqual([]);
  expect(convertPreviewToRoads(undefined)).toEqual([]);
});

it("convertPreviewToRoads returns empty for preview with no roads", () => {
  expect(convertPreviewToRoads({ source: "test", roads: [] })).toEqual([]);
});

it("convertPreviewToRoads converts walking roads to pedestrian_path", () => {
  const preview: MapRoadNetworkPreview = {
    source: "test_source",
    transform: { translateX: 0, translateY: 0, scale: 1, rotation: 0 },
    roads: [
      {
        road_id: 1,
        road_type: "walking",
        width_m: 2.5,
        points: [
          [18.393453, 110.015821],
          [18.394, 110.016],
        ],
      },
    ],
  };
  const roads = convertPreviewToRoads(preview);
  expect(roads.length).toBe(1);
  expect(roads[0].type).toBe("pedestrian_path");
  expect(roads[0].id).toBe("preview-road-1");
  expect(roads[0].interactive).toBe(false);
  expect(roads[0].source).toBe("test_source");
});

it("convertPreviewToRoads converts non-walking roads to main_road", () => {
  const preview: MapRoadNetworkPreview = {
    source: "test",
    roads: [
      {
        road_id: 42,
        road_type: "driving",
        width_m: 5,
        points: [
          [18.393453, 110.015821],
          [18.394, 110.016],
        ],
      },
    ],
  };
  const roads = convertPreviewToRoads(preview);
  expect(roads.length).toBe(1);
  expect(roads[0].type).toBe("main_road");
});

it("convertPreviewToRoads filters out roads with fewer than 2 valid points", () => {
  const preview: MapRoadNetworkPreview = {
    source: "test",
    roads: [
      { road_id: 1, points: [[18.393453, 110.015821]] },
      {
        road_id: 2,
        points: [
          [18.393453, 110.015821],
          [18.394, 110.016],
        ],
      },
    ],
  };
  const roads = convertPreviewToRoads(preview);
  expect(roads.length).toBe(1);
  expect(roads[0].id).toBe("preview-road-2");
});

// --- validateOfficialRoads ---

it("validateOfficialRoads returns true for non-empty roads", () => {
  const roads: MapRoad[] = [{ id: "r1", points: [{ lat: 1, lng: 1 }] }];
  expect(validateOfficialRoads(roads)).toBe(true);
});

it("validateOfficialRoads returns false and logs info when preview fallback exists", () => {
  let informed = false;
  const origInfo = console.info;
  console.info = (...args: unknown[]) => {
    if (String(args[0]).includes("using preview road fallback")) informed = true;
  };
  expect(
    validateOfficialRoads([], {
      source: "test",
      roads: [
        {
          road_id: 1,
          points: [
            [1, 1],
            [2, 2],
          ],
        },
      ],
    }),
  ).toBe(false);
  expect(informed).toBe(true);
  console.info = origInfo;
});

it("validateOfficialRoads returns false and warns when all road sources are empty", () => {
  let warned = false;
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (String(args[0]).includes("Official and preview road data are empty")) warned = true;
  };
  expect(validateOfficialRoads(null, null)).toBe(false);
  expect(warned).toBe(true);
  console.warn = origWarn;
});

// --- resolveRoads ---

it("resolveRoads prefers official roads when available", () => {
  const official: MapRoad[] = [{ id: "official-1", points: [{ lat: 1, lng: 1 }] }];
  const preview: MapRoadNetworkPreview = {
    source: "p",
    roads: [
      {
        road_id: 99,
        points: [
          [1, 1],
          [2, 2],
        ],
      },
    ],
  };
  const result = resolveRoads(official, preview);
  expect(result.source).toBe("official");
  expect(result.roads.length).toBe(1);
  expect(result.roads[0].id).toBe("official-1");
});

it("resolveRoads falls back to preview when official roads are empty", () => {
  const preview: MapRoadNetworkPreview = {
    source: "road_network_preview",
    roads: [
      {
        road_id: 10,
        road_type: "walking",
        points: [
          [18.393453, 110.015821],
          [18.394, 110.016],
        ],
      },
    ],
  };
  const result = resolveRoads([], preview);
  expect(result.source).toBe("preview");
  expect(result.roads.length).toBe(1);
  expect(result.roads[0].id).toBe("preview-road-10");
});

it("resolveRoads returns empty source when both official and preview are empty", () => {
  const origWarn = console.warn;
  console.warn = () => {};
  const result = resolveRoads([], { source: "test", roads: [] });
  expect(result.source).toBe("empty");
  expect(result.roads.length).toBe(0);
  console.warn = origWarn;
});

it("resolveRoads falls back to preview when official roads are null", () => {
  const preview: MapRoadNetworkPreview = {
    source: "test",
    roads: [
      {
        road_id: 5,
        road_type: "driving",
        points: [
          [18.393453, 110.015821],
          [18.394, 110.016],
        ],
      },
    ],
  };
  const result = resolveRoads(null, preview);
  expect(result.source).toBe("preview");
  expect(result.roads.length).toBe(1);
});

it("resolveRoads returns empty when official is null and no preview roads exist", () => {
  const origWarn = console.warn;
  console.warn = () => {};
  const result = resolveRoads(null, null);
  expect(result.source).toBe("empty");
  expect(result.roads.length).toBe(0);
  console.warn = origWarn;
});

// --- Preview fallback distinguishability (#297) ---

it("preview fallback roads carry preview-road- id prefix", () => {
  const preview: MapRoadNetworkPreview = {
    source: "road_network_preview",
    roads: [
      {
        road_id: 7,
        road_type: "driving",
        points: [
          [18.393453, 110.015821],
          [18.394, 110.016],
        ],
      },
    ],
  };
  const result = resolveRoads([], preview);
  expect(result.source).toBe("preview");
  expect(result.roads[0].id!.startsWith("preview-road-")).toBe(true);
});

it("preview fallback roads have interactive=false", () => {
  const preview: MapRoadNetworkPreview = {
    source: "test",
    roads: [
      {
        road_id: 1,
        road_type: "walking",
        points: [
          [18.393453, 110.015821],
          [18.394, 110.016],
        ],
      },
    ],
  };
  const result = resolveRoads([], preview);
  expect(result.roads[0].interactive).toBe(false);
});

it("preview fallback roads carry preview source string", () => {
  const preview: MapRoadNetworkPreview = {
    source: "custom_preview_source",
    roads: [
      {
        road_id: 3,
        road_type: "driving",
        points: [
          [18.393453, 110.015821],
          [18.394, 110.016],
        ],
      },
    ],
  };
  const roads = convertPreviewToRoads(preview);
  expect(roads[0].source).toBe("custom_preview_source");
});

it("preview roads default source to road_network_preview when source is missing", () => {
  const preview: MapRoadNetworkPreview = {
    roads: [
      {
        road_id: 2,
        points: [
          [18.393453, 110.015821],
          [18.394, 110.016],
        ],
      },
    ],
  };
  const roads = convertPreviewToRoads(preview);
  expect(roads[0].source).toBe("road_network_preview");
});

it("resolveRoads source=official does not produce preview-prefixed ids", () => {
  const official: MapRoad[] = [{ id: "real-road-1", points: [{ lat: 1, lng: 1 }] }];
  const result = resolveRoads(official, null);
  expect(result.source).toBe("official");
  expect(result.roads[0].id!.startsWith("preview-road-")).toBe(false);
});

// --- Logging idempotency (#297) ---

it("validateOfficialRoads does not re-log preview fallback after first call", () => {
  // Earlier tests already triggered the first log and set the module-level guard.
  // Subsequent calls must produce zero additional log output.
  let logged = false;
  const origInfo = console.info;
  console.info = (...args: unknown[]) => {
    if (String(args[0]).includes("using preview road fallback")) logged = true;
  };
  const preview: MapRoadNetworkPreview = {
    source: "t",
    roads: [
      {
        road_id: 1,
        points: [
          [1, 1],
          [2, 2],
        ],
      },
    ],
  };
  validateOfficialRoads([], preview);
  expect(logged).toBe(false);
  console.info = origInfo;
});

it("validateOfficialRoads does not re-log empty warning after first call", () => {
  let logged = false;
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (String(args[0]).includes("Official and preview road data are empty")) logged = true;
  };
  validateOfficialRoads(null, null);
  expect(logged).toBe(false);
  console.warn = origWarn;
});
