import fs from "node:fs/promises";

import { loadMetadata, writeJsonFile } from "./data-store.js";
import { sendJson } from "./http-response.js";
import { locationsPath, mapV2LayersPath } from "./paths.js";
import { readJsonBody } from "./request-utils.js";

const DEFAULT_CENTER = { lat: 18.3935, lng: 110.0159 };
const MAP_V2_BOUNDS = {
  south: 18.373050,
  west: 109.995380,
  north: 18.413856,
  east: 110.036262
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
    style: normalizeStyle(item.style, { color: "#2563eb", weight: 4 })
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
    routes: []
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
      routes: Array.isArray(layersRaw.routes) ? layersRaw.routes.map(normalizeRoute).filter((item) => item.id && item.points.length >= 2) : []
    }
  };
}

function mapPostsFromMetadata(metadata = {}, locations = []) {
  const byId = new Map(locations.map((item) => [item.id, item]));
  return Object.entries(metadata).map(([tid, item]) => {
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

async function handleMapV2Items(_req, res) {
  const { bounds, locations, layers } = await loadMapV2Data();
  const metadata = await loadMetadata();
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
      routes: layers.routes
    },
    posts: mapPostsFromMetadata(metadata, locations.items)
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
    const layers = {
      version: 1,
      coordSystem: "gcj02",
      center: point(payload.layers?.center || DEFAULT_CENTER),
      zoom: Math.max(3, Math.min(19, Number(payload.layers?.zoom || 16))),
      areas: Array.isArray(payload.layers?.areas) ? payload.layers.areas.map(normalizeArea).filter((item) => item.id && item.points.length >= 3) : [],
      routes: Array.isArray(payload.layers?.routes) ? payload.layers.routes.map(normalizeRoute).filter((item) => item.id && item.points.length >= 2) : []
    };
    await writeJsonFile(locationsPath, locations);
    await writeJsonFile(mapV2LayersPath, layers);
    return sendJson(res, 200, { ok: true, bounds: MAP_V2_BOUNDS, locations, layers });
  }
  return sendJson(res, 405, { error: "method not allowed" });
}

export { MAP_V2_BOUNDS, handleAdminMapV2, handleMapV2Items, loadMapV2Data };
