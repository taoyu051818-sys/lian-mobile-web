<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { resolveRoads } from "../../map/roads";
import {
  type LeafletDivIconLike,
  type LeafletImageOverlayLike,
  type LeafletLayerGroupLike,
  type LeafletMapLike,
  LeafletUnavailableError,
  getLeaflet,
  isLeafletAvailable,
  tryGetLeaflet,
} from "../../platform/leaflet";
import type {
  MapAsset,
  MapBounds,
  MapLayerPoint,
  MapLocation,
  MapPost,
  MapRoad,
  MapRoadNetworkPreview,
  MapRoute,
  MapV2ItemsResponse,
} from "../../types/map";
import MapLayerControls from "./MapLayerControls.vue";

type LayerKey = "areas" | "roadsCasing" | "roads" | "routes" | "assets" | "locations" | "posts";
type RoadVisualStyle = {
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

const GAODE_TILE_URL = "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";
const DEFAULT_BOUNDS: MapBounds = { south: 18.37107, west: 109.98464, north: 18.41730, east: 110.04775 };
const SCALED_ICON_SELECTOR = "[data-vue-map-scaled-icon]";
const ICON_BASE_ZOOM = 16;
const MAX_RENDERED_LOCATIONS = 120;
const MAX_RENDERED_POSTS = 60;
const MAX_RENDERED_ASSETS = 120;
const ROAD_STYLE: Record<string, RoadVisualStyle> = {
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

const props = defineProps<{
  mapData: MapV2ItemsResponse | null;
  roadPreview: MapRoadNetworkPreview | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  "load-error": [message: string];
}>();

const stageEl = ref<HTMLElement | null>(null);
const map = shallowRef<LeafletMapLike | null>(null);
const iconScaleBoundMaps = new WeakSet<LeafletMapLike>();

let layers: Record<LayerKey, LeafletLayerGroupLike> | null = null;
let baseOverlay: LeafletImageOverlayLike | null = null;

const bounds = computed(() => props.mapData?.bounds || DEFAULT_BOUNDS);
const locations = computed(() => props.mapData?.locations || []);
const posts = computed(() => props.mapData?.posts || []);
const areas = computed(() => props.mapData?.layers?.areas || []);
const officialRoads = computed(() => props.mapData?.layers?.roads || []);
const resolvedRoads = computed(() => resolveRoads(officialRoads.value, props.roadPreview));
const roads = computed(() => resolvedRoads.value.roads);
const routes = computed(() => props.mapData?.layers?.routes || []);
const assets = computed(() => props.mapData?.layers?.assets || []);
const renderedLocations = computed(() => locations.value.slice(0, MAX_RENDERED_LOCATIONS));
const renderedPosts = computed(() => posts.value.slice(0, MAX_RENDERED_POSTS));
const renderedAssets = computed(() => assets.value.slice(0, MAX_RENDERED_ASSETS));

function mapBounds(): [number, number][] {
  return [[bounds.value.south, bounds.value.west], [bounds.value.north, bounds.value.east]];
}

function points(list: MapLayerPoint[] = []): [number, number][] {
  return list
    .map((point): [number, number] => [Number(point.lat), Number(point.lng)])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

function latLng(item: { lat?: number; lng?: number }): [number, number] | null {
  const lat = Number(item.lat);
  const lng = Number(item.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function roadStyle(road: MapRoad): RoadVisualStyle {
  const base = ROAD_STYLE[road.type || ""] || ROAD_STYLE.default;
  const weight = Number(road.style?.weight || 0);
  return {
    ...base,
    weight: weight > 0 ? weight : base.weight,
  };
}

function roadZoomScale(zoom: number) {
  if (zoom <= 15) return 0.82;
  if (zoom >= 17) return 1.18;
  return 1;
}

function isPreviewRoad(road: MapRoad) {
  return String(road.source || "").includes("preview") || String(road.id || "").startsWith("preview:");
}

function iconScaleForZoom(target: LeafletMapLike | null = map.value, zoom = target?.getZoom?.()) {
  if (!target) return 1;
  const nextZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : ICON_BASE_ZOOM;
  return Math.pow(2, nextZoom - ICON_BASE_ZOOM);
}

function scaledIconHtml(html: string, anchor: [number, number]) {
  const x = Number(anchor[0] ?? 0);
  const y = Number(anchor[1] ?? 0);
  return `
    <span
      class="vue-map-scaled-icon-inner"
      data-vue-map-scaled-icon
      style="width:100%;height:100%;transform-origin:${escapeHtml(String(x))}px ${escapeHtml(String(y))}px;will-change:transform"
    >${html}</span>
  `;
}

function zoomFromEvent(event: unknown): number | undefined {
  if (!event || typeof event !== "object" || !("zoom" in event)) return undefined;
  const zoom = Number((event as { zoom?: unknown }).zoom);
  return Number.isFinite(zoom) ? zoom : undefined;
}

function applyMapIconScale(target: LeafletMapLike | null = map.value, zoom = target?.getZoom?.()) {
  const markerPane = target?.getPane("markerPane");
  if (!markerPane) return;
  const scale = iconScaleForZoom(target, zoom);
  markerPane.querySelectorAll<HTMLElement>(SCALED_ICON_SELECTOR).forEach((element) => {
    element.style.transform = `scale(${scale})`;
  });
}

function bindMapIconScale(target: LeafletMapLike) {
  if (iconScaleBoundMaps.has(target)) return;
  const update = (...args: unknown[]) => applyMapIconScale(target, zoomFromEvent(args[0]) ?? target.getZoom());
  target.on("zoom zoomend viewreset moveend", update);
  iconScaleBoundMaps.add(target);
}

function htmlIcon(className: string, html: string, size: [number, number], anchor: [number, number]): LeafletDivIconLike {
  return getLeaflet().divIcon({
    className,
    html: scaledIconHtml(html, anchor),
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: [0, -Math.round(size[1] * 0.72)],
  });
}

function locationIcon(location: MapLocation) {
  const image = location.card?.imageUrl || location.icon?.url;
  if (image) {
    return htmlIcon(
      "vue-map-marker vue-map-marker--place-card",
      `<span class="vue-map-location-card"><img src="${escapeHtml(image)}" alt=""><span class="vue-map-sr-only">${escapeHtml(location.name)}</span></span>`,
      [142, 48],
      [71, 48],
    );
  }
  return htmlIcon(
    "vue-map-marker vue-map-marker--location",
    `<span class="vue-map-location-pin"><strong>${escapeHtml(location.name.slice(0, 2))}</strong></span>`,
    [46, 54],
    [23, 54],
  );
}

function postIcon(post: MapPost) {
  const image = post.imageUrl ? `<img src="${escapeHtml(post.imageUrl)}" alt="">` : "<strong>帖</strong>";
  return htmlIcon(
    "vue-map-marker vue-map-marker--post",
    `<span class="vue-map-post-card">${image}<span>${escapeHtml(post.title || post.locationArea || "地图内容")}</span></span>`,
    [72, 78],
    [36, 78],
  );
}

function assetIcon(asset: MapAsset) {
  const size: [number, number] = Array.isArray(asset.size) ? [Number(asset.size[0] ?? 64), Number(asset.size[1] ?? 64)] : [64, 64];
  const anchor: [number, number] = Array.isArray(asset.anchor) ? [Number(asset.anchor[0] ?? size[0] / 2), Number(asset.anchor[1] ?? size[1])] : [size[0] / 2, size[1]];
  const opacity = Math.max(0, Math.min(1, Number(asset.opacity ?? 1)));
  const rotation = Number(asset.rotation || 0);
  return htmlIcon(
    `vue-map-asset vue-map-asset--${escapeHtml(asset.kind || "other")}`,
    `<img src="${escapeHtml(asset.url || "")}" alt="" style="opacity:${opacity};transform:rotate(${rotation}deg)">`,
    size,
    anchor,
  );
}

function clearLayers() {
  const lyrs = layers;
  if (!lyrs) return;
  Object.values(lyrs).forEach((layer) => layer.clearLayers());
}

function renderAreas() {
  const lyrs = layers;
  if (!lyrs) return;
  areas.value.forEach((area) => {
    const areaPoints = points(area.points);
    if (areaPoints.length < 3) return;
    getLeaflet().polygon(areaPoints, {
      color: area.style?.strokeColor || area.style?.color || "#1fa7a0",
      weight: 2,
      fillColor: area.style?.fillColor || area.style?.color || "#1fa7a0",
      fillOpacity: Number(area.style?.fillOpacity ?? 0.1),
      className: "vue-map-area",
    }).addTo(lyrs.areas);
  });
}

function renderDualLaneRoad(road: MapRoad, roadPoints: [number, number][], style: RoadVisualStyle, zoom: number) {
  const lyrs = layers;
  if (!lyrs) return;
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
  }).addTo(lyrs.roadsCasing);

  getLeaflet().polyline(roadPoints, {
    ...baseOptions,
    color: style.edge,
    weight: weight + style.edgeExtra * scale,
    opacity: Math.min(0.95, 0.86 * sourceOpacity),
    className: `vue-map-road-edge vue-map-road-edge--${classSuffix}`,
  }).addTo(lyrs.roadsCasing);

  getLeaflet().polyline(roadPoints, {
    ...baseOptions,
    color: style.asphalt,
    weight,
    opacity,
    className: `vue-map-road-asphalt vue-map-road-asphalt--${classSuffix}`,
  }).addTo(lyrs.roads);

  getLeaflet().polyline(roadPoints, {
    ...baseOptions,
    color: "rgba(255, 255, 255, 0.12)",
    weight: Math.max(1.2, weight * 0.42),
    opacity: 0.34 * sourceOpacity,
    className: `vue-map-road-asphalt-highlight vue-map-road-asphalt-highlight--${classSuffix}`,
  }).addTo(lyrs.roads);

  if (style.centerlineWeight > 0 && style.centerline !== "transparent") {
    getLeaflet().polyline(roadPoints, {
      ...baseOptions,
      color: style.centerline,
      weight: Math.max(1, style.centerlineWeight * scale * sourceWeight),
      dashArray: style.centerlineDashArray,
      opacity: style.centerlineOpacity * sourceOpacity,
      lineCap: "butt",
      className: `vue-map-road-centerline vue-map-road-centerline--${classSuffix}`,
    }).addTo(lyrs.roads);
  }
}

function renderRoads() {
  const lyrs = layers;
  const currentMap = map.value;
  if (!currentMap || !lyrs) return;
  const zoom = currentMap.getZoom?.() || 16;
  roads.value.forEach((road) => {
    if (road.status && road.status !== "active") return;
    const style = roadStyle(road);
    if (!style.drivable || zoom < style.minZoom) return;
    const roadPoints = points(road.points);
    if (roadPoints.length < 2) return;
    renderDualLaneRoad(road, roadPoints, style, zoom);
  });
}

function renderRoutes() {
  const lyrs = layers;
  if (!lyrs) return;
  (routes.value as MapRoute[]).forEach((route) => {
    const routePoints = points(route.points);
    if (routePoints.length < 2) return;
    getLeaflet().polyline(routePoints, {
      color: route.style?.color || "#2563eb",
      weight: Number(route.style?.weight || 4),
      dashArray: route.style?.dashArray || "",
      opacity: 0.92,
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
      className: "vue-map-route",
    }).addTo(lyrs.routes);
  });
}

function renderAssets() {
  const lyrs = layers;
  if (!lyrs) return;
  renderedAssets.value.forEach((asset) => {
    if (!asset.url || !asset.position) return;
    const position = latLng(asset.position);
    if (!position) return;
    getLeaflet().marker(position, {
      icon: assetIcon(asset),
      interactive: false,
      keyboard: false,
      zIndexOffset: Number(asset.zIndex || 20),
    }).addTo(lyrs.assets);
  });
}

function renderMarkers() {
  const lyrs = layers;
  if (!lyrs) return;
  renderedLocations.value.forEach((location) => {
    const position = latLng(location);
    if (!position) return;
    getLeaflet().marker(position, { icon: locationIcon(location), title: location.name, zIndexOffset: 80, interactive: true, keyboard: true })
      .bindTooltip(location.name, { sticky: true })
      .addTo(lyrs.locations);
  });
  renderedPosts.value.forEach((post) => {
    const position = latLng(post);
    if (!position) return;
    getLeaflet().marker(position, { icon: postIcon(post), title: post.title || post.locationArea || "", zIndexOffset: 120, interactive: true, keyboard: true })
      .bindTooltip(post.title || post.locationArea || "地图内容", { sticky: true })
      .addTo(lyrs.posts);
  });
}

function renderMap() {
  const currentMap = map.value;
  if (!currentMap || !layers || !tryGetLeaflet()) return;
  clearLayers();
  renderAreas();
  renderRoads();
  renderRoutes();
  renderAssets();
  renderMarkers();
  applyMapIconScale();
}

function initMap() {
  const L = tryGetLeaflet();
  if (!stageEl.value || !L) return;
  const nextBounds = mapBounds();
  const currentMap = map.value;
  if (currentMap) {
    baseOverlay?.setBounds(nextBounds);
    currentMap.invalidateSize();
    renderMap();
    return;
  }
  const center = props.mapData?.center || { lat: 18.3935, lng: 110.0159 };
  const newMap = L.map(stageEl.value, {
    center: [center.lat, center.lng],
    zoom: props.mapData?.zoom || 16,
    minZoom: 15,
    maxZoom: 17,
    maxBounds: nextBounds,
    maxBoundsViscosity: 1,
    zoomControl: false,
    attributionControl: false,
  });
  L.tileLayer(GAODE_TILE_URL, {
    subdomains: ["1", "2", "3", "4"],
    maxZoom: 19,
    minZoom: 3,
    opacity: 0,
    attribution: "&copy; Gaode Map",
  }).addTo(newMap);
  baseOverlay = L.imageOverlay("/assets/campus-base-map.png", nextBounds, {
    interactive: false,
    opacity: 0.94,
    zIndex: 10,
  }).addTo(newMap);
  layers = {
    areas: L.layerGroup().addTo(newMap),
    roadsCasing: L.layerGroup().addTo(newMap),
    roads: L.layerGroup().addTo(newMap),
    routes: L.layerGroup().addTo(newMap),
    assets: L.layerGroup().addTo(newMap),
    locations: L.layerGroup().addTo(newMap),
    posts: L.layerGroup().addTo(newMap),
  };
  bindMapIconScale(newMap);
  newMap.on("zoomend resize", renderMap);
  map.value = newMap;
  setTimeout(() => {
    map.value?.invalidateSize();
    applyMapIconScale();
  }, 80);
  renderMap();
}

async function refreshMap() {
  await nextTick();
  if (!isLeafletAvailable()) {
    emit("load-error", new LeafletUnavailableError().message);
    return;
  }
  initMap();
}

watch(() => props.mapData, (next) => {
  if (next) void refreshMap();
});

onBeforeUnmount(() => {
  map.value?.remove();
  map.value = null;
  layers = null;
  baseOverlay = null;
});

defineExpose({ map });
</script>

<template>
  <div ref="stageEl" class="map-canvas" :class="{ 'is-loading': loading }"></div>
  <MapLayerControls :map="map" />
</template>

<style scoped>
.map-canvas {
  width: 100%;
  min-height: inherit;
  height: calc(100vh - 92px - env(safe-area-inset-bottom));
  background: rgba(247, 244, 236, 0.72);
}

.map-canvas.is-loading {
  filter: saturate(0.9) blur(0.5px);
}

:deep(.leaflet-container) {
  width: 100%;
  height: 100%;
  min-height: inherit;
  font-family: inherit;
  background: rgba(247, 244, 236, 0.72);
}

:deep(.leaflet-control-zoom) {
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-chip);
  box-shadow: var(--shadow-soft);
}

:deep(.leaflet-control-zoom a) {
  border: 0;
  color: var(--lian-ink);
  font-weight: 900;
}

:deep(.vue-map-marker),
:deep(.vue-map-asset) {
  background: transparent;
  border: 0;
}

:deep(.vue-map-marker) {
  cursor: pointer;
}

:deep(.vue-map-asset) {
  pointer-events: none;
}

:deep(.vue-map-road-shadow),
:deep(.vue-map-road-edge),
:deep(.vue-map-road-asphalt),
:deep(.vue-map-road-asphalt-highlight),
:deep(.vue-map-road-centerline) {
  vector-effect: non-scaling-stroke;
}

:deep(.vue-map-road-centerline) {
  stroke-linecap: butt;
}

:deep(.vue-map-scaled-icon-inner) {
  display: block;
}

:deep(.vue-map-location-pin) {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-orb);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow-soft);
  color: var(--lian-ink);
}

:deep(.vue-map-location-card) {
  display: block;
  overflow: hidden;
  width: 100%;
  height: 100%;
  border: 1px solid var(--glass-border);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: var(--shadow-soft);
}

:deep(.vue-map-location-card img),
:deep(.vue-map-post-card img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

:deep(.vue-map-post-card) {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  width: 100%;
  height: 100%;
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  background: rgba(31, 41, 51, 0.86);
  box-shadow: var(--shadow-soft);
  color: #fff;
  font-size: 11px;
  font-weight: 900;
}

:deep(.vue-map-post-card > span) {
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: 5px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}

:deep(.vue-map-asset img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

:deep(.vue-map-sr-only) {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  padding: 0;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
