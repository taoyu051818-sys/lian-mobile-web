import fs from "node:fs/promises";

import { canViewPost } from "./audience-service.js";
import { getCurrentUser } from "./auth-service.js";
import { loadMetadata, writeJsonFile } from "./data-store.js";
import { sendJson } from "./http-response.js";
import { locationsPath, mapV2LayersPath } from "./paths.js";
import { readJsonBody } from "./request-utils.js";

const DEFAULT_CENTER = { lat: 18.3935, lng: 110.0159 };
const MAP_V2_BOUNDS = {
  south: 18.37107,
  west: 109.98464,
  north: 18.41730,
  east: 110.04775
};

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function point(value = {}) {
  return {
    lat: numberOrNull(value.lat),
    lng: numberOrNull(value.lng)
  };
}

function compactText(value = "", maxLength = 80) {
  return String(value || "").trim().slice(0, maxLength);
}

function pointInBounds(value = {}) {
  const center = point(value);
  return center.lat !== null &&
    center.lng !== null &&
    center.lat >= MAP_V2_BOUNDS.south &&
    center.lat <= MAP_V2_BOUNDS.north &&
    center.lng >= MAP_V2_BOUNDS.west &&
    center.lng <= MAP_V2_BOUNDS.east;
}

function assertPointInBounds(value = {}, label = "point") {
  if (!pointInBounds(value)) {
    const center = point(value);
    const error = new Error(`${label} is outside Li'an map bounds: ${center.lat}, ${center.lng}`);
    error.status = 400;
    throw error;
  }
}

function normalizeSize(value, fallback = [34, 34]) {
  if (!Array.isArray(value)) return [...fallback];
  const width = Math.max(8, Math.min(180, Number(value[0] || fallback[0])));
  const height = Math.max(8, Math.min(180, Number(value[1] || fallback[1])));
  return [width, height];
}

function normalizeIcon(icon = {}) {
  return {
    url: compactText(icon.url || "", 240),
    size: normalizeSize(icon.size, [34, 34]),
    anchor: normalizeSize(icon.anchor, [17, 34]),
    className: compactText(icon.className || "", 80)
  };
}

function normalizeCard(card = {}) {
  return {
    title: compactText(card.title || "", 80),
    subtitle: compactText(card.subtitle || "", 120),
    imageUrl: compactText(card.imageUrl || "", 240),
    tag: compactText(card.tag || "", 40),
    alwaysShow: Boolean(card.alwaysShow)
  };
}

function normalizeLocation(item = {}) {
  const center = point(item);
  return {
    id: compactText(item.id, 80),
    name: compactText(item.name, 80),
    type: compactText(item.type || "place", 40),
    aliases: Array.isArray(item.aliases) ? item.aliases.map((alias) => compactText(alias, 40)).filter(Boolean).slice(0, 8) : [],
    lat: center.lat,
    lng: center.lng,
    coordSystem: item.coordSystem === "wgs84" ? "wgs84" : "gcj02",
    legacyPoint: {
      x: numberOrNull(item.legacyPoint?.x),
      y: numberOrNull(item.legacyPoint?.y)
    },
    icon: normalizeIcon(item.icon),
    card: normalizeCard(item.card),
    status: item.status === "hidden" ? "hidden" : "active"
  };
}

function normalizeStyle(style = {}, fallback = {}) {
  return {
    color: compactText(style.color || fallback.color || "#2563eb", 24),
    weight: Math.max(1, Math.min(12, Number(style.weight || fallback.weight || 3))),
    dashArray: compactText(style.dashArray || fallback.dashArray || "", 24),
    strokeColor: compactText(style.strokeColor || style.color || fallback.strokeColor || "#2563eb", 24),
    fillColor: compactText(style.fillColor || fallback.fillColor || "#2563eb", 24),
    fillOpacity: Math.max(0, Math.min(0.6, Number(style.fillOpacity ?? fallback.fillOpacity ?? 0.08)))
  };
}

function normalizeRoute(item = {}) {
  return {
    id: compactText(item.id, 80),
    name: compactText(item.name, 80),
    type: compactText(item.type || "route", 40),
    points: Array.isArray(item.points) ? item.points.map(point).filter((p) => p.lat !== null && p.lng !== null) : [],
    style: normalizeStyle(item.style, { color: "#2563eb", weight: 4 }),
    routeRef: compactText(item.routeRef || "", 80)
  };
}

function normalizeArea(item = {}) {
  return {
    id: compactText(item.id, 80),
    name: compactText(item.name, 80),
    type: compactText(item.type || "area", 40),
    points: Array.isArray(item.points) ? item.points.map(point).filter((p) => p.lat !== null && p.lng !== null) : [],
    style: normalizeStyle(item.style, { strokeColor: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.08 })
  };
}

function normalizeEntrance(item = {}) {
  const center = point(item);
  return {
    id: compactText(item.id, 80),
    name: compactText(item.name, 80),
    lat: center.lat,
    lng: center.lng,
    icon: normalizeIcon(item.icon),
    clickAction: compactText(item.clickAction || "", 120)
  };
}

function normalizeBuilding(item = {}) {
  return {
    id: compactText(item.id, 80),
    name: compactText(item.name, 80),
    type: compactText(item.type || "building", 40),
    polygon: Array.isArray(item.polygon) ? item.polygon.map(point).filter((p) => p.lat !== null && p.lng !== null) : [],
    entrances: Array.isArray(item.entrances) ? item.entrances.map(normalizeEntrance).filter((e) => e.lat !== null && e.lng !== null) : [],
    icon: normalizeIcon(item.icon),
    clickAction: compactText(item.clickAction || "open_floor_plan", 120),
    floorPlanIds: Array.isArray(item.floorPlanIds) ? item.floorPlanIds.map((id) => compactText(id, 80)).filter(Boolean).slice(0, 20) : [],
    relatedLocationIds: Array.isArray(item.relatedLocationIds) ? item.relatedLocationIds.map((id) => compactText(id, 80)).filter(Boolean).slice(0, 20) : [],
    status: item.status === "hidden" ? "hidden" : "active"
  };
}

const VALID_ENV_TYPES = new Set(["beach", "forest", "water", "grass", "sand", "rock", "other"]);

function normalizeEnvironmentElement(item = {}) {
  return {
    id: compactText(item.id, 80),
    name: compactText(item.name, 80),
    type: VALID_ENV_TYPES.has(item.type) ? item.type : "other",
    shape: item.shape === "point" ? "point" : "polygon",
    points: Array.isArray(item.points) ? item.points.map(point).filter((p) => p.lat !== null && p.lng !== null) : [],
    style: {
      fill: compactText(item.style?.fill || "#059669", 24),
      opacity: Math.max(0, Math.min(1, Number(item.style?.opacity ?? 0.5)))
    },
    renderHint: compactText(item.renderHint || "", 200)
  };
}

function normalizeBuildingGroup(item = {}) {
  return {
    id: compactText(item.id, 80),
    name: compactText(item.name, 80),
    buildingIds: Array.isArray(item.buildingIds) ? item.buildingIds.map((id) => compactText(id, 80)).filter(Boolean).slice(0, 40) : [],
    description: compactText(item.description || "", 200)
  };
}

const VALID_ASSET_KINDS = new Set(["building_icon", "environment", "poi_marker", "label", "other"]);

function normalizeAsset(item = {}) {
  const pos = point(item.position);
  return {
    id: compactText(item.id, 80),
    url: compactText(item.url || "", 500),
    kind: VALID_ASSET_KINDS.has(item.kind) ? item.kind : "other",
    position: { lat: pos.lat, lng: pos.lng },
    size: normalizeSize(item.size, [64, 64]),
    anchor: normalizeSize(item.anchor, [32, 64]),
    rotation: Math.max(-180, Math.min(180, Number(item.rotation || 0))),
    opacity: Math.max(0, Math.min(1, Number(item.opacity ?? 1))),
    zIndex: Math.max(0, Math.min(999, Math.floor(Number(item.zIndex || 40)))),
    boundObjectType: compactText(item.boundObjectType || "", 40),
    boundObjectId: compactText(item.boundObjectId || "", 80),
    clickBehavior: compactText(item.clickBehavior || "none", 40),
    alwaysShowCard: Boolean(item.alwaysShowCard),
    status: item.status === "hidden" ? "hidden" : "active"
  };
}

const VALID_ROAD_TYPES = new Set(["main_road", "pedestrian_path", "shuttle_route", "service_path"]);
const ROAD_TYPE_STYLES = {
  main_road: { color: "#6b7280", weight: 6, dashArray: "" },
  pedestrian_path: { color: "#9ca3af", weight: 3, dashArray: "6 4" },
  shuttle_route: { color: "#2563eb", weight: 4, dashArray: "" },
  service_path: { color: "#a3a3a3", weight: 2, dashArray: "4 6" }
};

function normalizeRoad(item = {}) {
  const roadType = VALID_ROAD_TYPES.has(item.type) ? item.type : "main_road";
  const defaultStyle = ROAD_TYPE_STYLES[roadType];
  return {
    id: compactText(item.id, 80),
    name: compactText(item.name, 80),
    type: roadType,
    points: Array.isArray(item.points) ? item.points.map(point).filter((p) => p.lat !== null && p.lng !== null) : [],
    segments: Array.isArray(item.segments) ? item.segments : [],
    junctionIds: Array.isArray(item.junctionIds) ? item.junctionIds.map((id) => compactText(id, 80)).filter(Boolean) : [],
    style: {
      color: compactText(item.style?.color || defaultStyle.color, 24),
      weight: Math.max(1, Math.min(12, Number(item.style?.weight || defaultStyle.weight))),
      dashArray: compactText(item.style?.dashArray || defaultStyle.dashArray, 24)
    },
    renderHint: {
      surface: compactText(item.renderHint?.surface || "", 40),
      curveStyle: compactText(item.renderHint?.curveStyle || "", 40),
      edgeStyle: compactText(item.renderHint?.edgeStyle || "", 40)
    },
    interactive: item.interactive !== false,
    status: item.status === "hidden" ? "hidden" : "active",
    source: compactText(item.source || "admin_drawn", 40),
    updatedAt: compactText(item.updatedAt || "", 40),
    noSnap: Boolean(item.noSnap),
    routeRef: compactText(item.routeRef || "", 80)
  };
}

const VALID_JUNCTION_TYPES = new Set(["endpoint", "T", "cross", "multi"]);

function normalizeJunction(item = {}) {
  const pos = point(item.position);
  return {
    id: compactText(item.id, 80),
    type: VALID_JUNCTION_TYPES.has(item.type) ? item.type : "cross",
    position: { lat: pos.lat, lng: pos.lng },
    connectedRoadIds: Array.isArray(item.connectedRoadIds) ? item.connectedRoadIds.map((id) => compactText(id, 80)).filter(Boolean).slice(0, 20) : [],
    connectionRefs: Array.isArray(item.connectionRefs) ? item.connectionRefs.map((ref) => ({
      roadId: compactText(ref.roadId, 80),
      pointIndex: Math.max(0, Math.floor(Number(ref.pointIndex) || 0))
    })).filter((ref) => ref.roadId).slice(0, 20) : [],
    status: item.status === "hidden" ? "hidden" : "active"
  };
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function loadMapV2Data() {
  const locationsRaw = await readJson(locationsPath, { version: 1, coordSystem: "gcj02", items: [] });
  const layersRaw = await readJson(mapV2LayersPath, {
    version: 1,
    coordSystem: "gcj02",
    center: DEFAULT_CENTER,
    zoom: 16,
    areas: [],
    routes: [],
    roads: [],
    junctions: [],
    buildings: [],
    environmentElements: [],
    buildingGroups: [],
    assets: []
  });
  const locations = Array.isArray(locationsRaw.items)
    ? locationsRaw.items.map(normalizeLocation).filter((item) => item.id && item.name && item.lat !== null && item.lng !== null)
    : [];
  return {
    bounds: MAP_V2_BOUNDS,
    locations: {
      version: Number(locationsRaw.version || 1),
      coordSystem: locationsRaw.coordSystem === "wgs84" ? "wgs84" : "gcj02",
      items: locations
    },
    layers: {
      version: Number(layersRaw.version || 1),
      coordSystem: layersRaw.coordSystem === "wgs84" ? "wgs84" : "gcj02",
      center: point(layersRaw.center || DEFAULT_CENTER),
      zoom: Math.max(3, Math.min(19, Number(layersRaw.zoom || 16))),
      areas: Array.isArray(layersRaw.areas) ? layersRaw.areas.map(normalizeArea).filter((item) => item.id && item.points.length >= 3) : [],
      routes: Array.isArray(layersRaw.routes) ? layersRaw.routes.map(normalizeRoute).filter((item) => item.id && item.points.length >= 2) : [],
      roads: Array.isArray(layersRaw.roads) ? layersRaw.roads.map(normalizeRoad).filter((item) => item.id && item.points.length >= 2) : [],
      junctions: Array.isArray(layersRaw.junctions) ? layersRaw.junctions.map(normalizeJunction).filter((item) => item.id && item.position.lat !== null) : [],
      buildings: Array.isArray(layersRaw.buildings) ? layersRaw.buildings.map(normalizeBuilding).filter((item) => item.id && item.polygon.length >= 3) : [],
      environmentElements: Array.isArray(layersRaw.environmentElements) ? layersRaw.environmentElements.map(normalizeEnvironmentElement).filter((item) => item.id) : [],
      buildingGroups: Array.isArray(layersRaw.buildingGroups) ? layersRaw.buildingGroups.map(normalizeBuildingGroup).filter((item) => item.id) : [],
      assets: Array.isArray(layersRaw.assets) ? layersRaw.assets.map(normalizeAsset).filter((item) => item.id && item.url) : []
    }
  };
}

function mapPostsFromMetadata(metadata = {}, locations = [], currentUser = null) {
  const byId = new Map(locations.map((item) => [item.id, item]));
  return Object.entries(metadata).map(([tid, item]) => {
    if (!canViewPost(currentUser, item, "map")) return null;
    const lat = numberOrNull(item.lat ?? item.locationDraft?.lat);
    const lng = numberOrNull(item.lng ?? item.locationDraft?.lng);
    const location = item.locationId ? byId.get(item.locationId) : null;
    const center = lat !== null && lng !== null
      ? { lat, lng }
      : (location ? { lat: location.lat, lng: location.lng } : null);
    if (!center) return null;
    return {
      tid: Number(tid),
      title: compactText(item.title || item.locationArea || location?.name || "校园记忆", 80),
      locationId: compactText(item.locationId || location?.id || "", 80),
      locationArea: compactText(item.locationArea || location?.name || "", 80),
      lat: center.lat,
      lng: center.lng,
      imageUrl: Array.isArray(item.imageUrls) ? item.imageUrls[0] || "" : "",
      contentType: compactText(item.contentType || "general", 40)
    };
  }).filter(Boolean).slice(0, 80);
}

async function handleMapV2Items(req, res) {
  const { bounds, locations, layers } = await loadMapV2Data();
  const metadata = await loadMetadata();
  const auth = await getCurrentUser(req);
  return sendJson(res, 200, {
    ok: true,
    mapVersion: "gaode_v2",
    coordSystem: "gcj02",
    bounds,
    center: layers.center.lat !== null && layers.center.lng !== null ? layers.center : DEFAULT_CENTER,
    zoom: layers.zoom,
    locations: locations.items.filter((item) => item.status === "active"),
    layers: {
      areas: layers.areas,
      routes: layers.routes,
      roads: layers.roads.filter((r) => r.status === "active"),
      junctions: layers.junctions.filter((j) => j.status === "active"),
      buildings: layers.buildings.filter((b) => b.status === "active"),
      environmentElements: layers.environmentElements,
      buildingGroups: layers.buildingGroups,
      assets: (layers.assets || []).filter((a) => a.status === "active")
    },
    posts: mapPostsFromMetadata(metadata, locations.items, auth.user)
  });
}

async function handleAdminMapV2(req, res) {
  if (req.method === "GET") {
    const data = await loadMapV2Data();
    return sendJson(res, 200, {
      ok: true,
      bounds: data.bounds,
      locations: data.locations,
      layers: data.layers
    });
  }
  if (req.method === "PUT") {
    const payload = await readJsonBody(req);
    if (payload.layers?.center) assertPointInBounds(payload.layers.center, "map center");
    const locations = {
      version: 1,
      coordSystem: "gcj02",
      items: Array.isArray(payload.locations?.items)
        ? payload.locations.items.map((item, index) => {
            assertPointInBounds(item, `locations.items[${index}]`);
            return normalizeLocation(item);
          }).filter((item) => item.id && item.name && item.lat !== null && item.lng !== null)
        : []
    };
    for (const [areaIndex, area] of (payload.layers?.areas || []).entries()) {
      for (const [pointIndex, areaPoint] of (area.points || []).entries()) {
        assertPointInBounds(areaPoint, `layers.areas[${areaIndex}].points[${pointIndex}]`);
      }
    }
    for (const [routeIndex, route] of (payload.layers?.routes || []).entries()) {
      for (const [pointIndex, routePoint] of (route.points || []).entries()) {
        assertPointInBounds(routePoint, `layers.routes[${routeIndex}].points[${pointIndex}]`);
      }
    }
    for (const [bldgIndex, bldg] of (payload.layers?.buildings || []).entries()) {
      for (const [pointIndex, bldgPoint] of (bldg.polygon || []).entries()) {
        assertPointInBounds(bldgPoint, `layers.buildings[${bldgIndex}].polygon[${pointIndex}]`);
      }
      for (const [entIndex, ent] of (bldg.entrances || []).entries()) {
        if (ent.lat != null && ent.lng != null) assertPointInBounds(ent, `layers.buildings[${bldgIndex}].entrances[${entIndex}]`);
      }
    }
    for (const [envIndex, env] of (payload.layers?.environmentElements || []).entries()) {
      for (const [pointIndex, envPoint] of (env.points || []).entries()) {
        assertPointInBounds(envPoint, `layers.environmentElements[${envIndex}].points[${pointIndex}]`);
      }
    }
    for (const [roadIndex, road] of (payload.layers?.roads || []).entries()) {
      for (const [pointIndex, roadPoint] of (road.points || []).entries()) {
        assertPointInBounds(roadPoint, `layers.roads[${roadIndex}].points[${pointIndex}]`);
      }
    }
    for (const [jxIndex, jx] of (payload.layers?.junctions || []).entries()) {
      if (jx.position) assertPointInBounds(jx.position, `layers.junctions[${jxIndex}].position`);
    }
    for (const [assetIndex, asset] of (payload.layers?.assets || []).entries()) {
      if (asset.position) assertPointInBounds(asset.position, `layers.assets[${assetIndex}].position`);
    }
    const layers = {
      version: 1,
      coordSystem: "gcj02",
      center: point(payload.layers?.center || DEFAULT_CENTER),
      zoom: Math.max(3, Math.min(19, Number(payload.layers?.zoom || 16))),
      areas: Array.isArray(payload.layers?.areas) ? payload.layers.areas.map(normalizeArea).filter((item) => item.id && item.points.length >= 3) : [],
      routes: Array.isArray(payload.layers?.routes) ? payload.layers.routes.map(normalizeRoute).filter((item) => item.id && item.points.length >= 2) : [],
      roads: Array.isArray(payload.layers?.roads) ? payload.layers.roads.map(normalizeRoad).filter((item) => item.id && item.points.length >= 2) : [],
      junctions: Array.isArray(payload.layers?.junctions) ? payload.layers.junctions.map(normalizeJunction).filter((item) => item.id && item.position.lat !== null) : [],
      buildings: Array.isArray(payload.layers?.buildings) ? payload.layers.buildings.map(normalizeBuilding).filter((item) => item.id && item.polygon.length >= 3) : [],
      environmentElements: Array.isArray(payload.layers?.environmentElements) ? payload.layers.environmentElements.map(normalizeEnvironmentElement).filter((item) => item.id) : [],
      buildingGroups: Array.isArray(payload.layers?.buildingGroups) ? payload.layers.buildingGroups.map(normalizeBuildingGroup).filter((item) => item.id) : [],
      assets: Array.isArray(payload.layers?.assets) ? payload.layers.assets.map(normalizeAsset).filter((item) => item.id && item.url) : []
    };
    await writeJsonFile(locationsPath, locations);
    await writeJsonFile(mapV2LayersPath, layers);
    return sendJson(res, 200, { ok: true, bounds: MAP_V2_BOUNDS, locations, layers });
  }
  return sendJson(res, 405, { error: "method not allowed" });
}

export { MAP_V2_BOUNDS, handleAdminMapV2, handleMapV2Items, loadMapV2Data };
