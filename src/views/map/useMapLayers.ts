import { type ComputedRef, type Ref, computed, watch } from "vue";
import { resolveRoads } from "../../map/roads";
import { renderRoads } from "../../map/useMapRoads";
import { locationIcon, postIcon, assetIcon } from "../../map/mapIcons";
import {
  type LeafletLayerGroupLike,
  type LeafletMapLike,
  getLeaflet,
  tryGetLeaflet,
} from "../../platform/leaflet";
import type {
  MapAsset,
  MapLayerPoint,
  MapLocation,
  MapPost,
  MapV2ItemsResponse,
  MapRoadNetworkPreview,
  MapRoute,
} from "../../types/map";

export type LayerKey = "areas" | "roadsCasing" | "roads" | "routes" | "assets" | "locations" | "posts";

const MAX_RENDERED_LOCATIONS = 120;
const MAX_RENDERED_POSTS = 60;
const MAX_RENDERED_ASSETS = 120;

function latLng(item: { lat?: number; lng?: number }): [number, number] | null {
  const lat = Number(item.lat);
  const lng = Number(item.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

function points(list: MapLayerPoint[] = []): [number, number][] {
  return list
    .map((point): [number, number] => [Number(point.lat), Number(point.lng)])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

export function useMapLayers(
  map: Ref<LeafletMapLike | null>,
  mapData: ComputedRef<MapV2ItemsResponse | null>,
  roadPreview: ComputedRef<MapRoadNetworkPreview | null>,
  visibleLayers: ComputedRef<Record<string, boolean>>,
  onPlaceSelect: (place: MapLocation | MapPost) => void,
) {
  let layers: Record<LayerKey, LeafletLayerGroupLike> | null = null;

  const locations = computed(() => mapData.value?.locations || []);
  const posts = computed(() => mapData.value?.posts || []);
  const areas = computed(() => mapData.value?.layers?.areas || []);
  const officialRoads = computed(() => mapData.value?.layers?.roads || []);
  const resolvedRoads = computed(() => resolveRoads(officialRoads.value, roadPreview.value));
  const roads = computed(() => resolvedRoads.value.roads);
  const routes = computed(() => mapData.value?.layers?.routes || []);
  const assets = computed(() => mapData.value?.layers?.assets || []);
  const renderedLocations = computed(() => locations.value.slice(0, MAX_RENDERED_LOCATIONS));
  const renderedPosts = computed(() => posts.value.slice(0, MAX_RENDERED_POSTS));
  const renderedAssets = computed(() => assets.value.slice(0, MAX_RENDERED_ASSETS));

  function setLayers(record: Record<LayerKey, LeafletLayerGroupLike>) {
    layers = record;
  }

  function clearLayers() {
    if (!layers) return;
    Object.values(layers).forEach((layer) => layer.clearLayers());
  }

  function renderAreas() {
    if (!layers) return;
    areas.value.forEach((area) => {
      const areaPoints = points(area.points);
      if (areaPoints.length < 3) return;
      getLeaflet().polygon(areaPoints, {
        color: area.style?.strokeColor || area.style?.color || "#1fa7a0",
        weight: 2,
        fillColor: area.style?.fillColor || area.style?.color || "#1fa7a0",
        fillOpacity: Number(area.style?.fillOpacity ?? 0.1),
        className: "vue-map-area",
      }).addTo(layers!.areas);
    });
  }

  function renderRoutes() {
    if (!layers) return;
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
      }).addTo(layers!.routes);
    });
  }

  function renderAssets() {
    if (!layers) return;
    renderedAssets.value.forEach((asset) => {
      if (!asset.url || !asset.position) return;
      const position = latLng(asset.position);
      if (!position) return;
      getLeaflet().marker(position, {
        icon: assetIcon(asset),
        interactive: false,
        keyboard: false,
        zIndexOffset: Number(asset.zIndex || 20),
      }).addTo(layers!.assets);
    });
  }

  function renderMarkers() {
    if (!layers) return;
    renderedLocations.value.forEach((location) => {
      const position = latLng(location);
      if (!position) return;
      const m = getLeaflet().marker(position, { icon: locationIcon(location), title: location.name, zIndexOffset: 80, interactive: true, keyboard: true });
      m.on("click", () => onPlaceSelect(location));
      m.bindTooltip(location.name, { sticky: true }).addTo(layers!.locations);
    });
    renderedPosts.value.forEach((post) => {
      const position = latLng(post);
      if (!position) return;
      const m = getLeaflet().marker(position, { icon: postIcon(post), title: post.title || post.locationArea || "", zIndexOffset: 120, interactive: true, keyboard: true });
      m.on("click", () => onPlaceSelect(post));
      m.bindTooltip(post.title || post.locationArea || "地图内容", { sticky: true }).addTo(layers!.posts);
    });
  }

  function renderMap() {
    const currentMap = map.value;
    if (!currentMap || !layers || !tryGetLeaflet()) return;
    clearLayers();
    renderAreas();
    renderRoads(currentMap, layers, roads.value);
    renderRoutes();
    renderAssets();
    renderMarkers();
  }

  // Layer visibility toggling
  watch(visibleLayers, (vis) => {
    if (!layers) return;
    const mapEl = map.value as (LeafletMapLike & { hasLayer(l: unknown): boolean; removeLayer(l: unknown): LeafletMapLike }) | null;
    if (!mapEl) return;
    const toggle = (layer: LeafletLayerGroupLike, key: string) => {
      const visible = vis[key] !== false;
      const has = mapEl.hasLayer(layer);
      if (visible && !has) layer.addTo(mapEl);
      else if (!visible && has) mapEl.removeLayer(layer);
    };
    toggle(layers.locations, "locations");
    toggle(layers.posts, "posts");
  }, { deep: true });

  return {
    layers,
    setLayers,
    renderMap,
    clearLayers,
  };
}
