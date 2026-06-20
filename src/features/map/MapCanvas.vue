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
import type { MapViewportQuery } from "../../types/map";
import type {
  MapBounds,
  MapLocation,
  MapPost,
  MapV2ItemsResponse,
  MapRoadNetworkPreview,
} from "../../types/map";
import { DEFAULT_MAP_VIEWPORT_POLICY, type MapViewportPolicy } from "../../types/map-policy";
import { useMapLayers } from "./useMapLayers";
import { createMapIconScale } from "./useMapIconScale";

const GAODE_TILE_URL =
  "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";
const DEFAULT_BOUNDS: MapBounds = {
  south: 18.37107,
  west: 109.98464,
  north: 18.4173,
  east: 110.04775,
};

const props = defineProps<{
  mapData: MapV2ItemsResponse | null;
  roadPreview: MapRoadNetworkPreview | null;
  loading: boolean;
  visibleLayers?: Record<string, boolean>;
  /**
   * Optional viewport policy (PRD V0.1 §7.2.3). When omitted, falls back to
   * the legacy minZoom=15/maxZoom=17 hardcoded values plus mapData.bounds.
   * Backend can override this via `/api/map/policy` once it ships.
   */
  viewportPolicy?: MapViewportPolicy;
}>();

const emit = defineEmits<{
  "load-error": [message: string];
  "place-select": [place: MapLocation | MapPost];
  "viewport-change": [viewport: MapViewportQuery];
  /**
   * Long-press / contextmenu on the underlying tile layer (mw#943).
   *
   * Fires `(latlng)` after a 600ms hold without significant movement, OR
   * immediately on a desktop right-click (contextmenu). Used by picker mode
   * in `MapLeafletView` to drop a free pin at an arbitrary coordinate.
   *
   * Outside picker mode the parent ignores this — the regular browse UX
   * never wired a "long-press anywhere" gesture, so this is purely additive.
   */
  "map-longpress": [latlng: { lat: number; lng: number }];
}>();

const LONGPRESS_HOLD_MS = 600;
const LONGPRESS_MOVE_TOLERANCE_PX = 10;

const stageEl = ref<HTMLElement | null>(null);
const map = shallowRef<LeafletMapLike | null>(null);
let baseOverlay: LeafletImageOverlayLike | null = null;
let zoomControl: LeafletZoomControlLike | null = null;
let initSizeTimer: ReturnType<typeof setTimeout> | null = null;
let scheduledRenderFrame: number | null = null;
let clearLongpressTimer: (() => void) | null = null;

const visibleLayersComputed = computed(() => props.visibleLayers || {});
const bounds = computed(() => props.mapData?.bounds || DEFAULT_BOUNDS);

const { setLayers, renderMap } = useMapLayers(
  map,
  computed(() => props.mapData),
  computed(() => props.roadPreview),
  visibleLayersComputed,
  (place) => emit("place-select", place),
);

const { applyMapIconScale, bindMapIconScale } = createMapIconScale(() => map.value);

function mapBounds(): [number, number][] {
  return [
    [bounds.value.south, bounds.value.west],
    [bounds.value.north, bounds.value.east],
  ];
}

function emitViewportChange(mapInstance: LeafletMapLike) {
  const nextBounds = mapInstance.getBounds();
  emit("viewport-change", {
    bounds: {
      south: nextBounds.getSouth(),
      west: nextBounds.getWest(),
      north: nextBounds.getNorth(),
      east: nextBounds.getEast(),
    },
    zoom: mapInstance.getZoom(),
  });
}

function attachZoomControl(mapInstance: LeafletMapLike) {
  const L = getLeaflet();
  zoomControl = L.control.zoom({ position: "topright" }).addTo(mapInstance);
}

function detachZoomControl() {
  if (
    zoomControl &&
    "remove" in zoomControl &&
    typeof (zoomControl as { remove(): void }).remove === "function"
  ) {
    (zoomControl as { remove(): void }).remove();
  }
  zoomControl = null;
}

function clearInitSizeTimer() {
  if (initSizeTimer !== null) {
    clearTimeout(initSizeTimer);
    initSizeTimer = null;
  }
}

function clearScheduledRenderFrame() {
  if (scheduledRenderFrame !== null) {
    cancelAnimationFrame(scheduledRenderFrame);
    scheduledRenderFrame = null;
  }
}

function scheduleRenderMap() {
  if (scheduledRenderFrame !== null) return;
  scheduledRenderFrame = requestAnimationFrame(() => {
    scheduledRenderFrame = null;
    renderMap();
    applyMapIconScale();
  });
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
  // Prefer the dataset bounds for the image overlay, but let an explicit
  // viewport policy (admin-tunable) widen/narrow the user-navigable area.
  const policy = props.viewportPolicy ?? DEFAULT_MAP_VIEWPORT_POLICY;
  const policyBounds: [number, number][] = [
    [policy.campusBounds.south, policy.campusBounds.west],
    [policy.campusBounds.north, policy.campusBounds.east],
  ];
  const newMap = L.map(stageEl.value, {
    center: [center.lat, center.lng],
    zoom: props.mapData?.zoom || 16,
    minZoom: policy.minZoom,
    maxZoom: policy.maxZoom,
    // Prefer the dataset bounds when present (campus-tight); otherwise fall
    // back to the policy bounds.
    maxBounds: props.mapData?.bounds ? nextBounds : policyBounds,
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
  newMap.on("zoomend resize", scheduleRenderMap);
  newMap.on("moveend zoomend", () => emitViewportChange(newMap));
  attachLongpressHandlers(newMap);
  map.value = newMap;
  clearInitSizeTimer();
  initSizeTimer = setTimeout(() => {
    initSizeTimer = null;
    map.value?.invalidateSize();
    applyMapIconScale();
    if (map.value) emitViewportChange(map.value);
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

/**
 * Long-press / contextmenu wiring (mw#943).
 *
 * Two paths into the same emit:
 *   1. Desktop right-click → Leaflet's `contextmenu` event fires immediately
 *      with a `latlng` payload. No timer needed.
 *   2. Touch/mouse hold → `mousedown` starts a 600ms countdown, `mousemove`
 *      cancels if the cursor drifts more than 10px (prevents pan gestures
 *      from accidentally dropping pins), `mouseup`/`mouseout` cancels.
 *
 * Both run on the Leaflet map instance, which already deduplicates touch
 * vs mouse events on touch devices, so we don't need to wire native
 * touchstart/touchmove ourselves.
 *
 * Pinch-zoom is blocked globally (PR #941 — useDisableGestureZoom), so the
 * "long-press during pinch" edge case isn't reachable here.
 */
type LongpressLatLng = { lat: number; lng: number };
type LongpressLeafletEvent = {
  latlng?: { lat: number; lng: number };
  containerPoint?: { x: number; y: number };
  originalEvent?: { preventDefault?: () => void };
};

function attachLongpressHandlers(mapInstance: LeafletMapLike) {
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let startPoint: { x: number; y: number } | null = null;

  function clearTimer() {
    if (holdTimer !== null) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    startPoint = null;
  }

  function emitLongpress(latlng: LongpressLatLng | undefined) {
    if (!latlng) return;
    if (!Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng)) return;
    emit("map-longpress", { lat: latlng.lat, lng: latlng.lng });
  }

  // Cast to a relaxed event shape — the platform/leaflet adapter only types
  // the canonical events used by the legacy browse path, but Leaflet runtime
  // accepts arbitrary string event names.
  const m = mapInstance as unknown as {
    on(event: string, handler: (event: LongpressLeafletEvent) => void): void;
  };

  m.on("contextmenu", (event) => {
    // Desktop right-click. Suppress the browser's native menu so the user
    // sees only the picker overlay reaction.
    event.originalEvent?.preventDefault?.();
    clearTimer();
    emitLongpress(event.latlng);
  });

  m.on("mousedown", (event) => {
    clearTimer();
    if (!event.containerPoint) return;
    startPoint = { x: event.containerPoint.x, y: event.containerPoint.y };
    const target = event.latlng;
    holdTimer = setTimeout(() => {
      holdTimer = null;
      emitLongpress(target);
    }, LONGPRESS_HOLD_MS);
  });

  m.on("mousemove", (event) => {
    if (!holdTimer || !startPoint || !event.containerPoint) return;
    const dx = event.containerPoint.x - startPoint.x;
    const dy = event.containerPoint.y - startPoint.y;
    if (Math.hypot(dx, dy) > LONGPRESS_MOVE_TOLERANCE_PX) clearTimer();
  });

  m.on("mouseup", clearTimer);
  m.on("mouseout", clearTimer);
  // Pan / zoom should never count as a long-press regardless of timer state.
  m.on("dragstart", clearTimer);
  m.on("zoomstart", clearTimer);
  clearLongpressTimer?.();
  clearLongpressTimer = clearTimer;
}

watch(
  () => props.mapData,
  (next) => {
    if (next) void refreshMap();
  },
);

watch(
  () => props.roadPreview,
  () => {
    if (map.value) renderMap();
  },
);

onBeforeUnmount(() => {
  clearInitSizeTimer();
  clearScheduledRenderFrame();
  clearLongpressTimer?.();
  clearLongpressTimer = null;
  detachZoomControl();
  map.value?.remove();
  map.value = null;
  baseOverlay = null;
});

defineExpose({ map });
</script>

<template>
  <div
    ref="stageEl"
    class="map-canvas"
    :class="{ 'is-loading': loading }"
    role="application"
    aria-label="校园地图"
    :aria-busy="loading"
  ></div>
</template>

<style scoped>
@import "./map-canvas.css";

.map-canvas {
  width: 100%;
  min-height: inherit;
  height: 100vh;
  background: rgba(247, 244, 236, 0.72);
}

.map-canvas.is-loading {
  filter: saturate(0.9) blur(0.5px);
}
</style>
