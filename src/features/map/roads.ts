/**
 * Road data adapter for Map V2.
 *
 * Converts preview road network data into official MapRoad format and resolves
 * which road source to render (official API data preferred, preview fallback).
 *
 * Related to #219. Part of #219. Does not close #219.
 *
 * ## Exit criteria for removing preview fallback (#297)
 *
 * The preview road fallback (`/assets/road-network-preview.json`) should be
 * removed or disabled once **all** of the following are true:
 *
 * 1. The official road API (`MapLayerBundle.roads`) returns non-empty road data
 *    for every map tile/bundle that currently falls back to preview data.
 * 2. At least two consecutive releases ship with zero `[map-roads] using preview
 *    road fallback` info-level log events in production telemetry.
 * 3. QA has verified road rendering parity (route, type, style) between official
 *    data and the current preview snapshot for all active campus maps.
 *
 * When those conditions hold, remove `convertPreviewToRoads`, the preview
 * import, and the fallback branch in `resolveRoads`. The `RoadResolution.source`
 * field will then only ever be `"official"` or `"empty"`.
 */

import type { MapLayerPoint, MapRoad, MapRoadNetworkPreview } from "../../types/map";

const PREVIEW_PROJECTION_ORIGIN = { lat: 18.393453, lng: 110.015821 };
const METERS_PER_DEGREE_LAT = 111320;
const METERS_PER_DEGREE_LNG =
  METERS_PER_DEGREE_LAT * Math.cos((PREVIEW_PROJECTION_ORIGIN.lat * Math.PI) / 180);

export interface RoadResolution {
  roads: MapRoad[];
  source: "official" | "preview" | "empty";
}

let loggedPreviewFallback = false;
let loggedEmptyRoads = false;

export function previewPoint(
  point: [number, number],
  transform?: MapRoadNetworkPreview["transform"],
): MapLayerPoint {
  const scale = Number(transform?.scale || 1);
  const rotation = (Number(transform?.rotation || 0) * Math.PI) / 180;
  const translateX = Number(transform?.translateX || 0);
  const translateY = Number(transform?.translateY || 0);
  const lat = Number(point[0]);
  const lng = Number(point[1]);
  const dx = (lng - PREVIEW_PROJECTION_ORIGIN.lng) * METERS_PER_DEGREE_LNG;
  const dy = (lat - PREVIEW_PROJECTION_ORIGIN.lat) * METERS_PER_DEGREE_LAT;
  const scaledX = dx * scale;
  const scaledY = dy * scale;
  const rotatedX = scaledX * Math.cos(rotation) - scaledY * Math.sin(rotation);
  const rotatedY = scaledX * Math.sin(rotation) + scaledY * Math.cos(rotation);
  return {
    lat: PREVIEW_PROJECTION_ORIGIN.lat + (rotatedY + translateY) / METERS_PER_DEGREE_LAT,
    lng: PREVIEW_PROJECTION_ORIGIN.lng + (rotatedX + translateX) / METERS_PER_DEGREE_LNG,
  };
}

/**
 * Converts preview road network data into MapRoad format.
 *
 * Every converted road is marked for distinguishability:
 * - `id` is prefixed with `"preview-road-"` to prevent id collisions with official roads.
 * - `source` is set to the preview's `source` field (defaulting to `"road_network_preview"`).
 * - `interactive` is `false` (preview roads are display-only, not clickable).
 */
export function convertPreviewToRoads(
  preview: MapRoadNetworkPreview | null | undefined,
): MapRoad[] {
  if (!preview?.roads?.length) return [];
  return preview.roads
    .map(
      (road): MapRoad => ({
        id: `preview-road-${road.road_id}`,
        name: `Preview road ${road.road_id}`,
        type: road.road_type === "walking" ? "pedestrian_path" : "main_road",
        points: road.points
          .map((p) => previewPoint(p, preview.transform))
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
        style: {
          color: road.road_type === "walking" ? "#b8a99a" : "#8f98a3",
          weight: Math.max(2, Math.min(6, Number(road.width_m || 3.2))),
          dashArray: road.road_type === "walking" ? "5 5" : "",
        },
        interactive: false,
        status: "active",
        source: preview.source || "road_network_preview",
      }),
    )
    .filter((road) => road.points.length >= 2);
}

/**
 * Checks whether official road data is non-empty.
 *
 * Logs once per session when falling back to preview or when all sources are
 * empty. The info-level "using preview road fallback" log is the primary
 * telemetry signal for the exit criteria described in the module header.
 */
export function validateOfficialRoads(
  roads: MapRoad[] | null | undefined,
  preview?: MapRoadNetworkPreview | null,
): boolean {
  if (!roads || roads.length === 0) {
    if (preview?.roads?.length) {
      if (!loggedPreviewFallback) {
        console.info("[map-roads] Official road data is empty; using preview road fallback.");
        loggedPreviewFallback = true;
      }
    } else if (!loggedEmptyRoads) {
      console.warn("[map-roads] Official and preview road data are empty.");
      loggedEmptyRoads = true;
    }
    return false;
  }
  return true;
}

/**
 * Resolves which road data to render.
 *
 * Official roads are always preferred. When falling back to preview, returned
 * roads carry a `"preview-road-{id}"` id prefix and a `"road_network_preview"`
 * (or preview-specific) source string so callers and telemetry can distinguish
 * them from official data.
 *
 * @see RoadResolution.source — `"official"` | `"preview"` | `"empty"`
 */
export function resolveRoads(
  officialRoads: MapRoad[] | null | undefined,
  preview: MapRoadNetworkPreview | null | undefined,
): RoadResolution {
  if (validateOfficialRoads(officialRoads, preview)) {
    return { roads: officialRoads!, source: "official" };
  }
  const fallback = convertPreviewToRoads(preview);
  return { roads: fallback, source: fallback.length > 0 ? "preview" : "empty" };
}
