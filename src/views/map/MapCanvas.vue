<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import {
  type LeafletImageOverlayLike,
  type LeafletMapLike,
  type LeafletZoomControlLike,
  LeafletUnavailableError,
  getLeaflet,
  isLeafletAvailable,
  tryGetLeaflet,
} from "../../platform/leaflet";
import type {
  MapBounds,
  MapLocation,
  MapPost,
  MapV2ItemsResponse,
  MapRoadNetworkPreview,
} from "../../types/map";
import { useMapLayers } from "./useMapLayers";

const GAODE_TILE_URL = "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";
const DEFAULT_BOUNDS: MapBounds = { south: 18.37107, west: 109.98464, north: 18.41730, east: 110.04775 };
const SCALED_ICON_SELECTOR = "[data-vue-map-scaled-icon]";
const ICON_BASE_ZOOM = 16;

const props = defineProps<{
  mapData: MapV2ItemsResponse | null;
  roadPreview: MapRoadNetworkPreview | null;
  loading: boolean;
  visibleLayers?: Record<string, boolean>;
}>();

const emit = defineEmits<{
  "load-error": [message: string];
  "place-select": [place: MapLocation | MapPost];
}>();

const stageEl = ref<HTMLElement | null>(null);
const map = shallowRef<LeafletMapLike | null>(null);
let baseOverlay: LeafletImageOverlayLike | null = null;
let zoomControl: LeafletZoomControlLike | null = null;
const iconScaleBoundMaps = new WeakSet<LeafletMapLike>();

const visibleLayersComputed = computed(() => props.visibleLayers || {});
const bounds = computed(() => props.mapData?.bounds || DEFAULT_BOUNDS);

const { setLayers, renderMap } = useMapLayers(
  map,
  computed(() => props.mapData),
  computed(() => props.roadPreview),
  visibleLayersComputed,
  (place) => emit("place-select", place),
);

function mapBounds(): [number, number][] {
  return [[bounds.value.south, bounds.value.west], [bounds.value.north, bounds.value.east]];
}

function iconScaleForZoom(target: LeafletMapLike | null = map.value, zoom = target?.getZoom?.()) {
  if (!target) return 1;
  const nextZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : ICON_BASE_ZOOM;
  return Math.pow(2, nextZoom - ICON_BASE_ZOOM);
}

function applyMapIconScale(target: LeafletMapLike | null = map.value, zoom = target?.getZoom?.()) {
  const markerPane = target?.getPane("markerPane");
  if (!markerPane) return;
  const scale = iconScaleForZoom(target, zoom);
  markerPane.querySelectorAll<HTMLElement>(SCALED_ICON_SELECTOR).forEach((element) => {
    element.style.transition = "transform 150ms ease-out";
    element.style.transform = `scale(${scale})`;
  });
}

function applyMapIconCounterScale(target: LeafletMapLike, zoom: number) {
  const markerPane = target.getPane("markerPane");
  if (!markerPane) return;
  const counterScale = 1 / iconScaleForZoom(target, zoom);
  markerPane.querySelectorAll<HTMLElement>(SCALED_ICON_SELECTOR).forEach((element) => {
    element.style.transition = "none";
    element.style.transform = `scale(${counterScale})`;
  });
}

function bindMapIconScale(target: LeafletMapLike) {
  if (iconScaleBoundMaps.has(target)) return;
  target.on("zoom", (...args: unknown[]) => {
    const event = args[0];
    const zoom = (event && typeof event === "object" && "zoom" in event) ? Number((event as { zoom?: unknown }).zoom) : target.getZoom();
    applyMapIconCounterScale(target, Number.isFinite(zoom) ? zoom : target.getZoom());
  });
  target.on("zoomend viewreset moveend", (...args: unknown[]) => {
    const event = args[0];
    const zoom = (event && typeof event === "object" && "zoom" in event) ? Number((event as { zoom?: unknown }).zoom) : target.getZoom();
    applyMapIconScale(target, Number.isFinite(zoom) ? zoom : target.getZoom());
  });
  iconScaleBoundMaps.add(target);
}

function attachZoomControl(mapInstance: LeafletMapLike) {
  const L = getLeaflet();
  zoomControl = L.control.zoom({ position: "topright" }).addTo(mapInstance);
}

function detachZoomControl() {
  if (zoomControl && "remove" in zoomControl && typeof (zoomControl as { remove(): void }).remove === "function") {
    (zoomControl as { remove(): void }).remove();
  }
  zoomControl = null;
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
    applyMapIconScale();
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
  setLayers({
    areas: L.layerGroup().addTo(newMap),
    roadsCasing: L.layerGroup().addTo(newMap),
    roads: L.layerGroup().addTo(newMap),
    routes: L.layerGroup().addTo(newMap),
    assets: L.layerGroup().addTo(newMap),
    locations: L.layerGroup().addTo(newMap),
    posts: L.layerGroup().addTo(newMap),
  });
  bindMapIconScale(newMap);
  attachZoomControl(newMap);
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
  detachZoomControl();
  map.value?.remove();
  map.value = null;
  baseOverlay = null;
});

defineExpose({ map });
</script>

<template>
  <div ref="stageEl" class="map-canvas" :class="{ 'is-loading': loading }"></div>
</template>

<style scoped>
.map-canvas {
  width: 100%;
  min-height: inherit;
  height: 100vh;
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
