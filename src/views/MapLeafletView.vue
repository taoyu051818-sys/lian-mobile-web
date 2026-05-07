<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { fetchMapV2Items } from "../api/map";
import { GlassPanel, InlineError, LianButton, LocationChip, TrustBadge } from "../ui";
import type { MapAsset, MapBounds, MapLayerPoint, MapLocation, MapPost, MapRoad, MapRoute, MapV2ItemsResponse } from "../types/map";
import {
  type LeafletDivIconLike,
  type LeafletImageOverlayLike,
  type LeafletLayerGroupLike,
  type LeafletLike,
  type LeafletMapLike,
  type LeafletMarkerLike,
  LeafletUnavailableError,
  getLeaflet,
  isLeafletAvailable,
  tryGetLeaflet,
} from "../platform/leaflet";

type ActiveTarget = { kind: "location"; item: MapLocation } | { kind: "post"; item: MapPost };
type LayerKey = "areas" | "roadsCasing" | "roads" | "routes" | "assets" | "locations" | "posts";

const GAODE_TILE_URL = "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";
const DEFAULT_BOUNDS: MapBounds = { south: 18.37107, west: 109.98464, north: 18.41730, east: 110.04775 };
const ROAD_STYLE: Record<string, { color: string; casing: string; weight: number; casingExtra: number; opacity: number; minZoom: number; dashArray: string }> = {
  main_road: { color: "#9ca3af", casing: "#f8fafc", weight: 7, casingExtra: 5, opacity: 0.96, minZoom: 15, dashArray: "" },
  pedestrian_path: { color: "#c4b5a5", casing: "#fffaf0", weight: 3, casingExtra: 3, opacity: 0.9, minZoom: 16, dashArray: "6 4" },
  shuttle_route: { color: "#2563eb", casing: "#dbeafe", weight: 4, casingExtra: 4, opacity: 0.92, minZoom: 15, dashArray: "" },
  service_path: { color: "#d4d4d4", casing: "#fafafa", weight: 2, casingExtra: 3, opacity: 0.82, minZoom: 16, dashArray: "4 6" },
  default: { color: "#a3a3a3", casing: "#f8fafc", weight: 4, casingExtra: 4, opacity: 0.9, minZoom: 15, dashArray: "" },
};

const stageEl = ref<HTMLElement | null>(null);
const mapData = ref<MapV2ItemsResponse | null>(null);
const loading = ref(false);
const errorMessage = ref("");
const activeFilter = ref<"all" | "locations" | "posts">("all");
const activeTarget = ref<ActiveTarget | null>(null);

let map: LeafletMapLike | null = null;
let layers: Record<LayerKey, LeafletLayerGroupLike> | null = null;
let baseOverlay: LeafletImageOverlayLike | null = null;

const bounds = computed(() => mapData.value?.bounds || DEFAULT_BOUNDS);
const locations = computed(() => mapData.value?.locations || []);
const posts = computed(() => mapData.value?.posts || []);
const areas = computed(() => mapData.value?.layers?.areas || []);
const roads = computed(() => mapData.value?.layers?.roads || []);
const routes = computed(() => mapData.value?.layers?.routes || []);
const assets = computed(() => mapData.value?.layers?.assets || []);
const visibleLocations = computed(() => activeFilter.value === "posts" ? [] : locations.value);
const visiblePosts = computed(() => activeFilter.value === "locations" ? [] : posts.value);

const stats = computed(() => [
  `${locations.value.length} 地点`,
  `${posts.value.length} 内容`,
  `${roads.value.length} 路段`,
]);

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

function roadStyle(road: MapRoad) {
  const base = ROAD_STYLE[road.type || ""] || ROAD_STYLE.default;
  const weight = Number(road.style?.weight || 0);
  return {
    ...base,
    color: road.style?.color || base.color,
    weight: weight > 0 ? weight : base.weight,
    dashArray: road.style?.dashArray ?? base.dashArray,
  };
}

function isActiveLocation(location: MapLocation) {
  return activeTarget.value?.kind === "location" && activeTarget.value.item.id === location.id;
}

function isActivePost(post: MapPost) {
  return activeTarget.value?.kind === "post" && String(activeTarget.value.item.tid) === String(post.tid);
}

function htmlIcon(className: string, html: string, size: [number, number], anchor: [number, number]): LeafletDivIconLike {
  return getLeaflet().divIcon({
    className,
    html,
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: [0, -Math.round(size[1] * 0.72)],
  });
}

function locationIcon(location: MapLocation) {
  const image = location.card?.imageUrl || location.icon?.url;
  const active = isActiveLocation(location) ? " is-active" : "";
  if (image) {
    return htmlIcon(
      `vue-map-marker vue-map-marker--place-card${active}`,
      `<button type="button"><img src="${escapeHtml(image)}" alt=""><span>${escapeHtml(location.name)}</span></button>`,
      [142, 48],
      [71, 48],
    );
  }
  return htmlIcon(
    `vue-map-marker vue-map-marker--location${active}`,
    `<button type="button"><strong>${escapeHtml(location.name.slice(0, 2))}</strong></button>`,
    [46, 54],
    [23, 54],
  );
}

function postIcon(post: MapPost) {
  const active = isActivePost(post) ? " is-active" : "";
  const image = post.imageUrl ? `<img src="${escapeHtml(post.imageUrl)}" alt="">` : "<strong>帖</strong>";
  return htmlIcon(
    `vue-map-marker vue-map-marker--post${active}`,
    `<button type="button">${image}<span>${escapeHtml(post.title || post.locationArea || "地图内容")}</span></button>`,
    [72, 78],
    [36, 78],
  );
}

function assetIcon(asset: MapAsset) {
  const size: [number, number] = Array.isArray(asset.size) ? [asset.size[0] ?? 64, asset.size[1] ?? 64] : [64, 64];
  const anchor: [number, number] = Array.isArray(asset.anchor) ? [asset.anchor[0] ?? size[0] / 2, asset.anchor[1] ?? size[1]] : [size[0] / 2, size[1]];
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
    }).bindTooltip(area.name, { sticky: true }).addTo(lyrs.areas);
  });
}

function renderRoads() {
  const lyrs = layers;
  if (!map || !lyrs) return;
  const zoom = map.getZoom?.() || 16;
  roads.value.forEach((road) => {
    if (road.status && road.status !== "active") return;
    const style = roadStyle(road);
    if (zoom < style.minZoom) return;
    const roadPoints = points(road.points);
    if (roadPoints.length < 2) return;
    getLeaflet().polyline(roadPoints, {
      color: style.casing,
      weight: style.weight + style.casingExtra,
      opacity: 0.96,
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
      className: "vue-map-road-casing",
    }).addTo(lyrs.roadsCasing);
    const roadLine = getLeaflet().polyline(roadPoints, {
      color: style.color,
      weight: style.weight,
      dashArray: style.dashArray,
      opacity: style.opacity,
      lineCap: "round",
      lineJoin: "round",
      interactive: road.interactive !== false,
      className: `vue-map-road vue-map-road--${escapeHtml(road.type || "default")}`,
    });
    if (road.interactive !== false) roadLine.bindTooltip(road.name || "道路", { sticky: true });
    roadLine.addTo(lyrs.roads);
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
      className: "vue-map-route",
    }).bindTooltip(route.name || route.title || "路线", { sticky: true }).addTo(lyrs.routes);
  });
}

function renderAssets() {
  const lyrs = layers;
  if (!lyrs) return;
  assets.value.forEach((asset) => {
    if (!asset.url || !asset.position) return;
    const position = latLng(asset.position);
    if (!position) return;
    getLeaflet().marker(position, {
      icon: assetIcon(asset),
      interactive: Boolean(asset.clickBehavior && asset.clickBehavior !== "none"),
      keyboard: false,
      zIndexOffset: Number(asset.zIndex || 20),
    }).addTo(lyrs.assets);
  });
}

function renderMarkers() {
  const lyrs = layers;
  if (!lyrs) return;
  visibleLocations.value.forEach((location) => {
    const position = latLng(location);
    if (!position) return;
    getLeaflet().marker(position, { icon: locationIcon(location), title: location.name, zIndexOffset: 80 })
      .on("click", () => selectLocation(location, true))
      .addTo(lyrs.locations);
  });
  visiblePosts.value.forEach((post) => {
    const position = latLng(post);
    if (!position) return;
    getLeaflet().marker(position, { icon: postIcon(post), title: post.title || post.locationArea || "", zIndexOffset: 120 })
      .on("click", () => selectPost(post, true))
      .addTo(lyrs.posts);
  });
}

function renderMap() {
  if (!map || !layers || !tryGetLeaflet()) return;
  clearLayers();
  renderAreas();
  renderRoads();
  renderRoutes();
  renderAssets();
  renderMarkers();
}

function initMap() {
  const L = tryGetLeaflet();
  if (!stageEl.value || !L) return;
  const nextBounds = mapBounds();
  if (map) {
    baseOverlay?.setBounds(nextBounds);
    map.invalidateSize();
    renderMap();
    return;
  }
  const center = mapData.value?.center || { lat: 18.3935, lng: 110.0159 };
  map = L.map(stageEl.value, {
    center: [center.lat, center.lng],
    zoom: mapData.value?.zoom || 16,
    minZoom: 15,
    maxZoom: 17,
    maxBounds: nextBounds,
    maxBoundsViscosity: 1,
    zoomControl: false,
    attributionControl: false,
  });
  L.control.zoom({ position: "topright" }).addTo(map);
  L.tileLayer(GAODE_TILE_URL, {
    subdomains: ["1", "2", "3", "4"],
    maxZoom: 19,
    minZoom: 3,
    opacity: 0.18,
    attribution: "&copy; Gaode Map",
  }).addTo(map);
  baseOverlay = L.imageOverlay("/assets/campus-base-map.png", nextBounds, {
    interactive: false,
    opacity: 0.94,
    zIndex: 10,
  }).addTo(map);
  layers = {
    areas: L.layerGroup().addTo(map),
    roadsCasing: L.layerGroup().addTo(map),
    roads: L.layerGroup().addTo(map),
    routes: L.layerGroup().addTo(map),
    assets: L.layerGroup().addTo(map),
    locations: L.layerGroup().addTo(map),
    posts: L.layerGroup().addTo(map),
  };
  map.on("zoomend resize", renderMap);
  setTimeout(() => map?.invalidateSize(), 80);
  renderMap();
}

async function refreshMap() {
  await nextTick();
  if (!isLeafletAvailable()) {
    errorMessage.value = new LeafletUnavailableError().message;
    return;
  }
  initMap();
}

async function loadMap() {
  loading.value = true;
  errorMessage.value = "";
  try {
    mapData.value = await fetchMapV2Items();
    if (!activeTarget.value && locations.value[0]) {
      activeTarget.value = { kind: "location", item: locations.value[0] };
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "地图数据暂时没加载出来，可以稍后再试。";
  } finally {
    loading.value = false;
    await refreshMap();
  }
}

function selectLocation(location: MapLocation, fromMarker = false) {
  activeTarget.value = { kind: "location", item: location };
  if (!fromMarker) map?.panTo([location.lat, location.lng], { animate: true });
  renderMap();
}

function selectPost(post: MapPost, fromMarker = false) {
  activeTarget.value = { kind: "post", item: post };
  if (!fromMarker) map?.panTo([post.lat, post.lng], { animate: true });
  renderMap();
}

function selectNearestPost(location: MapLocation) {
  const nearby = posts.value
    .map((post) => ({ post, distance: Math.hypot((post.lat - location.lat) * 100000, (post.lng - location.lng) * 100000) }))
    .sort((a, b) => a.distance - b.distance)[0]?.post;
  if (nearby) selectPost(nearby);
}

watch(activeFilter, renderMap);

onMounted(() => {
  void loadMap();
});

onBeforeUnmount(() => {
  map?.remove();
  map = null;
  layers = null;
  baseOverlay = null;
});
</script>

<template>
  <section class="map-view" aria-label="探索">
    <GlassPanel class="map-view__card">
      <header class="map-view__hero">
        <div>
          <LocationChip>LIAN Campus Map</LocationChip>
          <h2>探索校园正在发生什么</h2>
          <p>接入高德 Leaflet 底图，叠加 Map V2 的地点、道路、资产和内容。</p>
        </div>
        <div class="map-view__stats" aria-label="地图统计">
          <span v-for="item in stats" :key="item">{{ item }}</span>
        </div>
      </header>

      <div class="map-view__toolbar" aria-label="地图筛选">
        <button type="button" :class="{ 'is-active': activeFilter === 'all' }" @click="activeFilter = 'all'">全部</button>
        <button type="button" :class="{ 'is-active': activeFilter === 'locations' }" @click="activeFilter = 'locations'">地点</button>
        <button type="button" :class="{ 'is-active': activeFilter === 'posts' }" @click="activeFilter = 'posts'">内容</button>
        <LianButton size="sm" variant="ghost" :loading="loading" @click="loadMap">刷新</LianButton>
      </div>

      <InlineError v-if="errorMessage">
        {{ errorMessage }}
        <button type="button" @click="loadMap">重新加载</button>
      </InlineError>

      <section class="map-view__stage-wrap" aria-label="校园地图">
        <div ref="stageEl" class="map-view__leaflet" :class="{ 'is-loading': loading }"></div>
        <div v-if="loading" class="map-view__map-state" role="status">正在加载校园地图…</div>
        <div class="map-view__legend" aria-label="地图图例">
          <span><i class="is-road"></i>道路</span>
          <span><i class="is-place"></i>地点</span>
          <span><i class="is-post"></i>内容</span>
        </div>
      </section>

      <section v-if="activeTarget" class="map-view__detail" aria-label="选中地点或内容">
        <template v-if="activeTarget.kind === 'location'">
          <div>
            <LocationChip>{{ activeTarget.item.name }}</LocationChip>
            <h3>{{ activeTarget.item.name }}</h3>
            <p>{{ activeTarget.item.type || activeTarget.item.place?.type || '校园地点' }}</p>
          </div>
          <div class="map-view__actions">
            <TrustBadge :tone="activeTarget.item.place?.status === 'pending' ? 'pending' : 'confirmed'">
              {{ activeTarget.item.place?.status || '地点' }}
            </TrustBadge>
            <LianButton size="sm" variant="ghost" @click="selectNearestPost(activeTarget.item)">附近内容</LianButton>
          </div>
        </template>
        <template v-else>
          <div>
            <LocationChip>{{ activeTarget.item.locationArea || '地图内容' }}</LocationChip>
            <h3>{{ activeTarget.item.title || '未命名内容' }}</h3>
            <p>{{ activeTarget.item.locationArea || '地点未知' }}</p>
          </div>
          <TrustBadge tone="confirmed">地图内容</TrustBadge>
        </template>
      </section>

      <section class="map-view__places" aria-label="地点入口">
        <article v-for="location in locations.slice(0, 12)" :key="location.id" class="map-view__place" @click="selectLocation(location)">
          <LocationChip>{{ location.name }}</LocationChip>
          <TrustBadge tone="confirmed">{{ location.type || location.place?.type || '地点' }}</TrustBadge>
        </article>
      </section>
    </GlassPanel>
  </section>
</template>

<style scoped>
.map-view,
.map-view__card,
.map-view__places {
  display: grid;
  gap: var(--space-4);
}

.map-view__hero,
.map-view__toolbar,
.map-view__detail,
.map-view__place,
.map-view__actions,
.map-view__stats,
.map-view__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.map-view h2,
.map-view h3,
.map-view p {
  margin: 0;
}

.map-view__hero p,
.map-view__detail p {
  color: var(--lian-muted);
  line-height: 1.6;
}

.map-view__hero h2 {
  margin-top: var(--space-2);
  font-size: clamp(22px, 5vw, 34px);
  line-height: 1.08;
}

.map-view__stats span,
.map-view__legend span {
  padding: 6px 9px;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.68);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
}

.map-view__toolbar {
  justify-content: flex-start;
}

.map-view__toolbar button {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.54);
  color: var(--lian-muted);
  font-weight: 850;
}

.map-view__toolbar button.is-active {
  background: var(--lian-ink);
  color: #fff;
}

.map-view__stage-wrap {
  position: relative;
  overflow: hidden;
  min-height: 420px;
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.42);
}

.map-view__leaflet {
  width: 100%;
  min-height: 420px;
  height: min(68vh, 640px);
  background: rgba(247, 244, 236, 0.72);
}

.map-view__leaflet.is-loading {
  filter: saturate(0.9) blur(0.5px);
}

.map-view__map-state {
  position: absolute;
  inset: 0;
  z-index: 700;
  display: grid;
  place-items: center;
  color: var(--lian-muted);
  background: rgba(247, 244, 236, 0.58);
  backdrop-filter: blur(8px);
}

.map-view__legend {
  position: absolute;
  left: var(--space-3);
  right: var(--space-3);
  bottom: var(--space-3);
  z-index: 650;
  justify-content: flex-start;
  pointer-events: none;
}

.map-view__legend i {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 999px;
  vertical-align: -1px;
}

.map-view__legend .is-road { background: #9ca3af; }
.map-view__legend .is-place { background: #1fa7a0; }
.map-view__legend .is-post { background: #111827; }

.map-view__detail,
.map-view__place {
  padding: var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.52);
}

.map-view__detail {
  align-items: flex-start;
}

.map-view__detail > div {
  display: grid;
  gap: var(--space-2);
}

.map-view__actions {
  justify-content: flex-start;
}

.map-view__place {
  cursor: pointer;
}

.inline-error button {
  min-height: 32px;
  margin-left: var(--space-2);
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: currentColor;
  font-weight: 900;
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

:deep(.vue-map-marker button) {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-soft);
  cursor: pointer;
}

:deep(.vue-map-marker--location button) {
  border-radius: var(--radius-orb);
  background: rgba(255, 255, 255, 0.9);
  color: var(--lian-ink);
}

:deep(.vue-map-marker--place-card button) {
  grid-template-columns: 40px 1fr;
  gap: 8px;
  overflow: hidden;
  padding: 4px 10px 4px 4px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--lian-ink);
  font-size: 12px;
  font-weight: 900;
}

:deep(.vue-map-marker--place-card img),
:deep(.vue-map-marker--post img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

:deep(.vue-map-marker--post button) {
  overflow: hidden;
  border-radius: 20px;
  background: rgba(31, 41, 51, 0.86);
  color: #fff;
  font-size: 11px;
  font-weight: 900;
}

:deep(.vue-map-marker--post span) {
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: 5px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}

:deep(.vue-map-marker.is-active button) {
  outline: 3px solid rgba(31, 167, 160, 0.38);
  transform: translateY(-4px);
}

:deep(.vue-map-asset img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

@media (max-width: 640px) {
  .map-view__stage-wrap,
  .map-view__leaflet {
    min-height: 340px;
  }

  .map-view__leaflet {
    height: 58vh;
  }
}
</style>
