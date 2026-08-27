import type {
  MapAsset,
  MapBounds,
  MapLayerPoint,
  MapLocation,
  MapPost,
  MapRoad,
  MapRoadNetworkPreview,
  MapV2ItemsResponse,
} from "../../types/map";
import { resolveRoads } from "./roads";

export const MAP_SCENE_SIZE = Object.freeze({ width: 1429, height: 1101 });
export const MAP_SCENE_BACKGROUND = "/assets/campus-base-map.png";

const DEFAULT_BOUNDS: MapBounds = {
  south: 18.37107,
  west: 109.98464,
  north: 18.4173,
  east: 110.04775,
};

const MAX_RENDERED_LOCATIONS = 120;
const MAX_RENDERED_POSTS = 60;
const MAX_RENDERED_ASSETS = 120;

export interface MapSceneSize {
  width: number;
  height: number;
}

export interface MapScenePoint {
  x: number;
  y: number;
}

export interface MapLinkedEntity {
  kind: "place" | "post" | "device";
  id: string;
}

export interface MapScenePath {
  id: string;
  points: number[];
  stroke: string;
  strokeWidth: number;
  fill?: string;
  opacity: number;
  dash?: number[];
  closed?: boolean;
}

export interface MapSceneAsset extends MapScenePoint {
  id: string;
  kind: string;
  url: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  rotation: number;
  opacity: number;
  linkedEntity: MapLinkedEntity;
}

export interface MapSceneLocation extends MapScenePoint {
  id: string;
  label: string;
  imageUrl?: string;
  linkedEntity?: MapLinkedEntity;
  source: MapLocation;
}

export interface MapScenePost extends MapScenePoint {
  id: string;
  label: string;
  imageUrl?: string;
  linkedEntity: MapLinkedEntity;
  source: MapPost;
}

export interface MapScene {
  version: 1;
  width: number;
  height: number;
  bounds: MapBounds;
  background: { url: string };
  areas: MapScenePath[];
  roads: MapScenePath[];
  routes: MapScenePath[];
  assets: MapSceneAsset[];
  locations: MapSceneLocation[];
  posts: MapScenePost[];
}

export function projectMapPoint(
  bounds: MapBounds,
  point: { lat: number; lng: number },
  size: MapSceneSize = MAP_SCENE_SIZE,
): MapScenePoint {
  const lngSpan = Math.max(Number.EPSILON, bounds.east - bounds.west);
  const latSpan = Math.max(Number.EPSILON, bounds.north - bounds.south);
  return {
    x: ((point.lng - bounds.west) / lngSpan) * size.width,
    y: ((bounds.north - point.lat) / latSpan) * size.height,
  };
}

export function unprojectScenePoint(
  bounds: MapBounds,
  point: MapScenePoint,
  size: MapSceneSize = MAP_SCENE_SIZE,
): { lat: number; lng: number } {
  return {
    lat: bounds.north - (point.y / size.height) * (bounds.north - bounds.south),
    lng: bounds.west + (point.x / size.width) * (bounds.east - bounds.west),
  };
}

function pathPoints(bounds: MapBounds, list: MapLayerPoint[] = []): number[] {
  return list.flatMap((point) => {
    const lat = Number(point.lat);
    const lng = Number(point.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    const projected = projectMapPoint(bounds, { lat, lng });
    return [projected.x, projected.y];
  });
}

function parseDash(value?: string): number[] | undefined {
  if (!value) return undefined;
  const dash = value
    .split(/[ ,]+/)
    .map(Number)
    .filter((part) => Number.isFinite(part) && part > 0);
  return dash.length ? dash : undefined;
}

function roadVisual(road: MapRoad): Pick<MapScenePath, "stroke" | "strokeWidth" | "opacity"> {
  const preview = String(road.source || "").includes("preview");
  const pedestrian = road.type === "pedestrian_path";
  return {
    stroke: road.style?.color || (pedestrian ? "#b8a99a" : "rgba(43, 48, 52, 0.88)"),
    strokeWidth: Math.max(1, Number(road.style?.weight || (pedestrian ? 3 : 8))),
    opacity: preview ? 0.46 : 0.9,
  };
}

function assetFromMap(bounds: MapBounds, asset: MapAsset, index: number): MapSceneAsset | null {
  if (!asset.position) return null;
  const lat = Number(asset.position.lat);
  const lng = Number(asset.position.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const point = projectMapPoint(bounds, { lat, lng });
  const width = Math.max(8, Number(asset.size?.[0] || 48));
  const height = Math.max(8, Number(asset.size?.[1] || 48));
  const anchorX = Number.isFinite(Number(asset.anchor?.[0]))
    ? Number(asset.anchor?.[0])
    : width / 2;
  const anchorY = Number.isFinite(Number(asset.anchor?.[1]))
    ? Number(asset.anchor?.[1])
    : height / 2;
  const id = String(asset.id || `asset-${index}`);
  return {
    id,
    kind: String(asset.kind || "asset"),
    url: String(asset.url || ""),
    width,
    height,
    anchorX,
    anchorY,
    rotation: Number(asset.rotation || 0),
    opacity: Math.max(0, Math.min(1, Number(asset.opacity ?? 1))),
    x: point.x,
    y: point.y,
    linkedEntity: { kind: "device", id },
  };
}

export function buildMapScene(
  mapData: MapV2ItemsResponse | null | undefined,
  roadPreview: MapRoadNetworkPreview | null | undefined,
): MapScene {
  const bounds = mapData?.bounds || DEFAULT_BOUNDS;
  const roads = resolveRoads(mapData?.layers?.roads, roadPreview).roads;

  return {
    version: 1,
    width: MAP_SCENE_SIZE.width,
    height: MAP_SCENE_SIZE.height,
    bounds,
    background: { url: MAP_SCENE_BACKGROUND },
    areas: (mapData?.layers?.areas || [])
      .map(
        (area, index): MapScenePath => ({
          id: String(area.id || `area-${index}`),
          points: pathPoints(bounds, area.points),
          stroke: area.style?.strokeColor || area.style?.color || "#1fa7a0",
          strokeWidth: Math.max(1, Number(area.style?.weight || 2)),
          fill: area.style?.fillColor || area.style?.color || "#1fa7a0",
          opacity: Math.max(0, Math.min(1, Number(area.style?.fillOpacity ?? 0.12))),
          closed: true,
        }),
      )
      .filter((area) => area.points.length >= 6),
    roads: roads
      .filter((road) => !road.status || road.status === "active")
      .map(
        (road, index): MapScenePath => ({
          id: String(road.id || `road-${index}`),
          points: pathPoints(bounds, road.points),
          ...roadVisual(road),
          dash: parseDash(road.style?.dashArray),
        }),
      )
      .filter((road) => road.points.length >= 4),
    routes: (mapData?.layers?.routes || [])
      .map(
        (route, index): MapScenePath => ({
          id: String(route.id || `route-${index}`),
          points: pathPoints(bounds, route.points),
          stroke: route.style?.color || "#2563eb",
          strokeWidth: Math.max(1, Number(route.style?.weight || 4)),
          opacity: 0.92,
          dash: parseDash(route.style?.dashArray),
        }),
      )
      .filter((route) => route.points.length >= 4),
    assets: (mapData?.layers?.assets || [])
      .slice(0, MAX_RENDERED_ASSETS)
      .map((asset, index) => assetFromMap(bounds, asset, index))
      .filter((asset): asset is MapSceneAsset => asset !== null),
    locations: (mapData?.locations || []).slice(0, MAX_RENDERED_LOCATIONS).map((location) => {
      const placeId = location.place?.id || location.placeId;
      return {
        id: String(location.id),
        label: location.name,
        imageUrl: location.card?.imageUrl || location.icon?.url,
        ...projectMapPoint(bounds, location),
        ...(placeId ? { linkedEntity: { kind: "place" as const, id: String(placeId) } } : {}),
        source: location,
      };
    }),
    posts: (mapData?.posts || []).slice(0, MAX_RENDERED_POSTS).map((post) => ({
      id: String(post.tid),
      label: post.title || post.locationArea || "地图内容",
      imageUrl: post.imageUrl,
      ...projectMapPoint(bounds, post),
      linkedEntity: { kind: "post", id: String(post.tid) },
      source: post,
    })),
  };
}
