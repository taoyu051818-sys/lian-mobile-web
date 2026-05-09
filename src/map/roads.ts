/**
 * Road data adapter for Map V2.
 *
 * Converts preview road network data into official MapRoad format and resolves
 * which road source to render (official API data preferred, preview fallback).
 *
 * Related to #219. Part of #219. Does not close #219.
 */

import type { MapLayerPoint, MapRoad, MapRoadNetworkPreview } from "../types/map";

const PREVIEW_PROJECTION_ORIGIN = { lat: 18.393453, lng: 110.015821 };
const METERS_PER_DEGREE_LAT = 111320;
const METERS_PER_DEGREE_LNG = METERS_PER_DEGREE_LAT * Math.cos(PREVIEW_PROJECTION_ORIGIN.lat * Math.PI / 180);

export interface RoadResolution {
  roads: MapRoad[];
  source: "official" | "preview" | "empty";
}

export function previewPoint(
  point: [number, number],
  transform?: MapRoadNetworkPreview["transform"],
): MapLayerPoint {
  const scale = Number(transform?.scale || 1);
  const rotation = Number(transform?.rotation || 0) * Math.PI / 180;
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

export function convertPreviewToRoads(preview: MapRoadNetworkPreview | null | undefined): MapRoad[] {
  if (!preview?.roads?.length) return [];
  return preview.roads
    .map((road): MapRoad => ({
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
    }))
    .filter((road) => road.points.length >= 2);
}

export function validateOfficialRoads(roads: MapRoad[] | null | undefined): boolean {
  if (!roads || roads.length === 0) {
    console.warn("[map-roads] Official road data is empty — falling back to preview.");
    return false;
  }
  return true;
}

export function resolveRoads(
  officialRoads: MapRoad[] | null | undefined,
  preview: MapRoadNetworkPreview | null | undefined,
): RoadResolution {
  if (validateOfficialRoads(officialRoads)) {
    return { roads: officialRoads!, source: "official" };
  }
  const fallback = convertPreviewToRoads(preview);
  return { roads: fallback, source: fallback.length > 0 ? "preview" : "empty" };
}
