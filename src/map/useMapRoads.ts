import type { ComputedRef, Ref } from "vue";
import type {
  LeafletLayerGroupLike,
  LeafletMapLike,
} from "../platform/leaflet";
import { getLeaflet, tryGetLeaflet } from "../platform/leaflet";
import type { MapRoad } from "../types/map";

export type RoadVisualStyle = {
  asphalt: string;
  edge: string;
  shadow: string;
  centerline: string;
  weight: number;
  edgeExtra: number;
  shadowExtra: number;
  opacity: number;
  minZoom: number;
  centerlineDashArray: string;
  centerlineWeight: number;
  centerlineOpacity: number;
  previewOpacity: number;
  previewWeight: number;
  drivable: boolean;
};

export const ROAD_STYLE: Record<string, RoadVisualStyle> = {
  main_road: {
    asphalt: "rgba(43, 48, 52, 0.9)",
    edge: "rgba(230, 238, 246, 0.76)",
    shadow: "rgba(11, 18, 24, 0.24)",
    centerline: "rgba(255, 207, 79, 0.86)",
    weight: 10,
    edgeExtra: 5,
    shadowExtra: 8,
    opacity: 0.94,
    minZoom: 15,
    centerlineDashArray: "18 12",
    centerlineWeight: 1.7,
    centerlineOpacity: 0.86,
    previewOpacity: 0.48,
    previewWeight: 0.78,
    drivable: true,
  },
  pedestrian_path: {
    asphalt: "transparent",
    edge: "transparent",
    shadow: "transparent",
    centerline: "transparent",
    weight: 0,
    edgeExtra: 0,
    shadowExtra: 0,
    opacity: 0,
    minZoom: 99,
    centerlineDashArray: "",
    centerlineWeight: 0,
    centerlineOpacity: 0,
    previewOpacity: 0,
    previewWeight: 0,
    drivable: false,
  },
  shuttle_route: {
    asphalt: "transparent",
    edge: "transparent",
    shadow: "transparent",
    centerline: "transparent",
    weight: 0,
    edgeExtra: 0,
    shadowExtra: 0,
    opacity: 0,
    minZoom: 99,
    centerlineDashArray: "",
    centerlineWeight: 0,
    centerlineOpacity: 0,
    previewOpacity: 0,
    previewWeight: 0,
    drivable: false,
  },
  service_path: {
    asphalt: "transparent",
    edge: "transparent",
    shadow: "transparent",
    centerline: "transparent",
    weight: 0,
    edgeExtra: 0,
    shadowExtra: 0,
    opacity: 0,
    minZoom: 99,
    centerlineDashArray: "",
    centerlineWeight: 0,
    centerlineOpacity: 0,
    previewOpacity: 0,
    previewWeight: 0,
    drivable: false,
  },
  default: {
    asphalt: "rgba(48, 53, 57, 0.88)",
    edge: "rgba(230, 238, 246, 0.68)",
    shadow: "rgba(11, 18, 24, 0.2)",
    centerline: "rgba(255, 207, 79, 0.76)",
    weight: 8,
    edgeExtra: 4,
    shadowExtra: 7,
    opacity: 0.88,
    minZoom: 15,
    centerlineDashArray: "16 12",
    centerlineWeight: 1.4,
    centerlineOpacity: 0.76,
    previewOpacity: 0.42,
    previewWeight: 0.76,
    drivable: true,
  },
};

function escapeHtml(value = ""): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function points(list: { lat?: number; lng?: number; x?: number; y?: number }[] = []): [number, number][] {
  return list
    .map((point): [number, number] => [Number(point.lat), Number(point.lng)])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

export function roadStyle(road: MapRoad): RoadVisualStyle {
  const base = ROAD_STYLE[road.type || ""] || ROAD_STYLE.default;
  const weight = Number(road.style?.weight || 0);
  return {
    ...base,
    weight: weight > 0 ? weight : base.weight,
  };
}

export function roadZoomScale(zoom: number): number {
  if (zoom <= 15) return 0.82;
  if (zoom >= 17) return 1.18;
  return 1;
}

export function isPreviewRoad(road: MapRoad): boolean {
  return String(road.source || "").includes("preview") || String(road.id || "").startsWith("preview:");
}

function renderDualLaneRoad(
  road: MapRoad,
  roadPoints: [number, number][],
  style: RoadVisualStyle,
  zoom: number,
  layers: Record<string, LeafletLayerGroupLike>,
) {
  const scale = roadZoomScale(zoom);
  const sourceOpacity = isPreviewRoad(road) ? style.previewOpacity : 1;
  const sourceWeight = isPreviewRoad(road) ? style.previewWeight : 1;
  const weight = style.weight * scale * sourceWeight;
  const opacity = style.opacity * sourceOpacity;
  const classSuffix = escapeHtml(road.type || "default");
  const baseOptions = {
    lineCap: "round" as const,
    lineJoin: "round" as const,
    interactive: false,
  };

  getLeaflet().polyline(roadPoints, {
    ...baseOptions,
    color: style.shadow,
    weight: weight + style.shadowExtra * scale,
    opacity: Math.min(0.9, 0.78 * sourceOpacity),
    className: `vue-map-road-shadow vue-map-road-shadow--${classSuffix}`,
  }).addTo(layers.roadsCasing);

  getLeaflet().polyline(roadPoints, {
    ...baseOptions,
    color: style.edge,
    weight: weight + style.edgeExtra * scale,
    opacity: Math.min(0.95, 0.86 * sourceOpacity),
    className: `vue-map-road-edge vue-map-road-edge--${classSuffix}`,
  }).addTo(layers.roadsCasing);

  getLeaflet().polyline(roadPoints, {
    ...baseOptions,
    color: style.asphalt,
    weight,
    opacity,
    className: `vue-map-road-asphalt vue-map-road-asphalt--${classSuffix}`,
  }).addTo(layers.roads);

  getLeaflet().polyline(roadPoints, {
    ...baseOptions,
    color: "rgba(255, 255, 255, 0.12)",
    weight: Math.max(1.2, weight * 0.42),
    opacity: 0.34 * sourceOpacity,
    className: `vue-map-road-asphalt-highlight vue-map-road-asphalt-highlight--${classSuffix}`,
  }).addTo(layers.roads);

  if (style.centerlineWeight > 0 && style.centerline !== "transparent") {
    getLeaflet().polyline(roadPoints, {
      ...baseOptions,
      color: style.centerline,
      weight: Math.max(1, style.centerlineWeight * scale * sourceWeight),
      dashArray: style.centerlineDashArray,
      opacity: style.centerlineOpacity * sourceOpacity,
      lineCap: "butt",
      className: `vue-map-road-centerline vue-map-road-centerline--${classSuffix}`,
    }).addTo(layers.roads);
  }
}

export function renderRoads(
  map: LeafletMapLike,
  layers: Record<string, LeafletLayerGroupLike>,
  roads: MapRoad[],
) {
  if (!tryGetLeaflet()) return;
  const zoom = map.getZoom?.() || 16;
  roads.forEach((road) => {
    if (road.status && road.status !== "active") return;
    const style = roadStyle(road);
    if (!style.drivable || zoom < style.minZoom) return;
    const roadPoints = points(road.points);
    if (roadPoints.length < 2) return;
    renderDualLaneRoad(road, roadPoints, style, zoom, layers);
  });
}
