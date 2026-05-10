import test from "node:test";
import assert from "node:assert/strict";

import {
  convertPreviewToRoads,
  previewPoint,
  resolveRoads,
  validateOfficialRoads,
} from "../../src/map/roads.ts";
import type { MapRoad, MapRoadNetworkPreview } from "../../src/types/map.ts";

// --- previewPoint ---

test("previewPoint converts projected meters to lat/lng with default transform", () => {
  const origin = previewPoint([18.393453, 110.015821]);
  assert.ok(Math.abs(origin.lat - 18.393453) < 0.0001, "lat near origin");
  assert.ok(Math.abs(origin.lng - 110.015821) < 0.0001, "lng near origin");
});

test("previewPoint applies translateX/translateY offsets", () => {
  const transform = { translateX: 100, translateY: 50, scale: 1, rotation: 0 };
  const result = previewPoint([18.393453, 110.015821], transform);
  assert.ok(result.lng > 110.015821, "lng shifted east by positive translateX");
  assert.ok(result.lat > 18.393453, "lat shifted north by positive translateY");
});

test("previewPoint handles missing transform gracefully", () => {
  const result = previewPoint([18.393453, 110.015821], undefined);
  assert.ok(Number.isFinite(result.lat), "lat is finite");
  assert.ok(Number.isFinite(result.lng), "lng is finite");
});

// --- convertPreviewToRoads ---

test("convertPreviewToRoads returns empty for null preview", () => {
  assert.deepEqual(convertPreviewToRoads(null), []);
  assert.deepEqual(convertPreviewToRoads(undefined), []);
});

test("convertPreviewToRoads returns empty for preview with no roads", () => {
  assert.deepEqual(convertPreviewToRoads({ source: "test", roads: [] }), []);
});

test("convertPreviewToRoads converts walking roads to pedestrian_path", () => {
  const preview: MapRoadNetworkPreview = {
    source: "test_source",
    transform: { translateX: 0, translateY: 0, scale: 1, rotation: 0 },
    roads: [{
      road_id: 1,
      road_type: "walking",
      width_m: 2.5,
      points: [[18.393453, 110.015821], [18.394, 110.016]],
    }],
  };
  const roads = convertPreviewToRoads(preview);
  assert.equal(roads.length, 1);
  assert.equal(roads[0].type, "pedestrian_path");
  assert.equal(roads[0].id, "preview-road-1");
  assert.equal(roads[0].interactive, false);
  assert.equal(roads[0].source, "test_source");
});

test("convertPreviewToRoads converts non-walking roads to main_road", () => {
  const preview: MapRoadNetworkPreview = {
    source: "test",
    roads: [{
      road_id: 42,
      road_type: "driving",
      width_m: 5,
      points: [[18.393453, 110.015821], [18.394, 110.016]],
    }],
  };
  const roads = convertPreviewToRoads(preview);
  assert.equal(roads.length, 1);
  assert.equal(roads[0].type, "main_road");
});

test("convertPreviewToRoads filters out roads with fewer than 2 valid points", () => {
  const preview: MapRoadNetworkPreview = {
    source: "test",
    roads: [
      { road_id: 1, points: [[18.393453, 110.015821]] },
      { road_id: 2, points: [[18.393453, 110.015821], [18.394, 110.016]] },
    ],
  };
  const roads = convertPreviewToRoads(preview);
  assert.equal(roads.length, 1);
  assert.equal(roads[0].id, "preview-road-2");
});

// --- validateOfficialRoads ---

test("validateOfficialRoads returns true for non-empty roads", () => {
  const roads: MapRoad[] = [{ id: "r1", points: [{ lat: 1, lng: 1 }] }];
  assert.equal(validateOfficialRoads(roads), true);
});

test("validateOfficialRoads returns false and logs info when preview fallback exists", () => {
  let informed = false;
  const origInfo = console.info;
  console.info = (...args: unknown[]) => {
    if (String(args[0]).includes("using preview road fallback")) informed = true;
  };
  assert.equal(validateOfficialRoads([], { source: "test", roads: [{ road_id: 1, points: [[1, 1], [2, 2]] }] }), false);
  assert.equal(informed, true, "should log preview fallback info");
  console.info = origInfo;
});

test("validateOfficialRoads returns false and warns when all road sources are empty", () => {
  let warned = false;
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (String(args[0]).includes("Official and preview road data are empty")) warned = true;
  };
  assert.equal(validateOfficialRoads(null, null), false);
  assert.equal(warned, true, "should warn for truly empty roads");
  console.warn = origWarn;
});

// --- resolveRoads ---

test("resolveRoads prefers official roads when available", () => {
  const official: MapRoad[] = [{ id: "official-1", points: [{ lat: 1, lng: 1 }] }];
  const preview: MapRoadNetworkPreview = { source: "p", roads: [{ road_id: 99, points: [[1, 1], [2, 2]] }] };
  const result = resolveRoads(official, preview);
  assert.equal(result.source, "official");
  assert.equal(result.roads.length, 1);
  assert.equal(result.roads[0].id, "official-1");
});

test("resolveRoads falls back to preview when official roads are empty", () => {
  const preview: MapRoadNetworkPreview = {
    source: "road_network_preview",
    roads: [{ road_id: 10, road_type: "walking", points: [[18.393453, 110.015821], [18.394, 110.016]] }],
  };
  const result = resolveRoads([], preview);
  assert.equal(result.source, "preview");
  assert.equal(result.roads.length, 1);
  assert.equal(result.roads[0].id, "preview-road-10");
});

test("resolveRoads returns empty source when both official and preview are empty", () => {
  const origWarn = console.warn;
  console.warn = () => {};
  const result = resolveRoads([], { source: "test", roads: [] });
  assert.equal(result.source, "empty");
  assert.equal(result.roads.length, 0);
  console.warn = origWarn;
});

test("resolveRoads falls back to preview when official roads are null", () => {
  const preview: MapRoadNetworkPreview = {
    source: "test",
    roads: [{ road_id: 5, road_type: "driving", points: [[18.393453, 110.015821], [18.394, 110.016]] }],
  };
  const result = resolveRoads(null, preview);
  assert.equal(result.source, "preview");
  assert.equal(result.roads.length, 1);
});

test("resolveRoads returns empty when official is null and no preview roads exist", () => {
  const origWarn = console.warn;
  console.warn = () => {};
  const result = resolveRoads(null, null);
  assert.equal(result.source, "empty");
  assert.equal(result.roads.length, 0);
  console.warn = origWarn;
});
