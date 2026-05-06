(function () {
  const GAODE_TILE_URL = "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";
  const LIAN_API_BASE = (typeof window !== "undefined" && window.LIAN_API_BASE_URL) || "";
  const LIAN_IMAGE_PROXY_BASE = (() => {
    const configured = (typeof window !== "undefined" && window.LIAN_IMAGE_PROXY_BASE_URL) || "";
    if (configured) return configured.replace(/\/$/, "");
    try {
      const url = new URL(LIAN_API_BASE || window.location.origin, window.location.origin);
      url.port = "4101";
      url.pathname = "";
      url.search = "";
      url.hash = "";
      return url.toString().replace(/\/$/, "");
    } catch {
      return "";
    }
  })();

  const TYPE_COLORS = {
    campus: "#2563eb",
    study: "#2563eb",
    transport: "#7c3aed",
    village: "#059669",
    food: "#f59e0b",
    sports: "#ef4444",
    life: "#059669",
    post: "#111827"
  };

  const ROAD_RENDER_STYLES = {
    main_road: {
      color: "#9ca3af",
      casing: "#f8fafc",
      weight: 7,
      casingExtra: 5,
      opacity: 0.96,
      minZoom: 15,
      dashArray: ""
    },
    pedestrian_path: {
      color: "#c4b5a5",
      casing: "#fffaf0",
      weight: 3,
      casingExtra: 3,
      opacity: 0.9,
      minZoom: 16,
      dashArray: "6 4"
    },
    shuttle_route: {
      color: "#2563eb",
      casing: "#dbeafe",
      weight: 4,
      casingExtra: 4,
      opacity: 0.92,
      minZoom: 15,
      dashArray: ""
    },
    service_path: {
      color: "#d4d4d4",
      casing: "#fafafa",
      weight: 2,
      casingExtra: 3,
      opacity: 0.82,
      minZoom: 16,
      dashArray: "4 6"
    },
    default: {
      color: "#a3a3a3",
      casing: "#f8fafc",
      weight: 4,
      casingExtra: 4,
      opacity: 0.9,
      minZoom: 15,
      dashArray: ""
    }
  };

  const SCALED_ICON_SELECTOR = "[data-map-v2-scaled-icon]";

  const state = {
    map: null,
    data: null,
    layers: null,
    mode: "browse",
    pickCallback: null,
    pickedMarker: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);

  function escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  async function api(path, options = {}) {
    const url = path.startsWith("/") ? `${LIAN_API_BASE}${path}` : path;
    const response = await fetch(url, {
      credentials: "include",
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `请求失败（状态码 ${response.status}）`);
    return data;
  }

  function displayImageUrl(url = "") {
    return String(url || "");
  }

  function colorFor(type = "") {
    return TYPE_COLORS[type] || "#2563eb";
  }

  function iconScaleForZoom(map = state.map, zoom = map?.getZoom?.()) {
    if (!map) return 1;
    const maxZoom = map.getMaxZoom?.() || Number(zoom) || 16;
    const nextZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : maxZoom;
    return Math.pow(2, nextZoom - maxZoom);
  }

  function scaledIconHtml(html, anchor = [0, 0]) {
    const x = Number(anchor?.[0] ?? 0);
    const y = Number(anchor?.[1] ?? 0);
    return `
      <div
        class="map-v2-scaled-icon-inner"
        data-map-v2-scaled-icon
        style="width:100%;height:100%;transform-origin:${escapeHtml(x)}px ${escapeHtml(y)}px;will-change:transform"
      >${html}</div>
    `;
  }

  function applyMapIconScale(map = state.map, zoom = map?.getZoom?.()) {
    const pane = map?.getPane?.("markerPane");
    if (!pane) return;
    const scale = iconScaleForZoom(map, zoom);
    pane.querySelectorAll(SCALED_ICON_SELECTOR).forEach((element) => {
      element.style.transform = `scale(${scale})`;
    });
  }

  function bindMapIconScale(map) {
    if (!map || map._mapV2IconScaleBound) return;
    const update = () => applyMapIconScale(map);
    map.on("zoom zoomend viewreset moveend", update);
    if (map.options.zoomAnimation && L.Browser.any3d) {
      map.on("zoomanim", (event) => applyMapIconScale(map, event.zoom));
    }
    map._mapV2IconScaleBound = true;
  }

  function iconSvg(type = "") {
    if (type === "food") return '<path d="M4 3v8a4 4 0 0 0 8 0V3"/><path d="M4 7h8"/><path d="M18 3v18"/><path d="M15 3h6"/>';
    if (type === "transport") return '<path d="M8 6h8"/><path d="M6 10h12"/><path d="M6 14h12"/><path d="M8 18h.01"/><path d="M16 18h.01"/><rect x="5" y="4" width="14" height="16" rx="2"/>';
    if (type === "sports") return '<circle cx="12" cy="12" r="9"/><path d="M4.8 8.4c4.6 2 9.8 2 14.4 0"/><path d="M4.8 15.6c4.6-2 9.8-2 14.4 0"/>';
    if (type === "village" || type === "life") return '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>';
    return '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>';
  }

  function placeIcon(item) {
    const icon = item.icon || {};
    const size = Array.isArray(icon.size) ? icon.size : [34, 34];
    const anchor = Array.isArray(icon.anchor) ? icon.anchor : [size[0] / 2, size[1]];
    if (icon.url) {
      return L.divIcon({
        className: `map-v2-place-icon ${escapeHtml(icon.className || "")}`.trim(),
        iconSize: size,
        iconAnchor: anchor,
        popupAnchor: [0, -Math.round(size[1] * 0.85)],
        html: scaledIconHtml(`<img class="map-v2-place-asset" src="${escapeHtml(displayImageUrl(icon.url))}" alt="">`, anchor)
      });
    }
    return L.divIcon({
      className: "map-v2-place-icon",
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -30],
      html: scaledIconHtml(`
        <div class="map-v2-place-glyph" style="--marker-color:${escapeHtml(colorFor(item.type))}">
          <svg viewBox="0 0 24 24" aria-hidden="true">${iconSvg(item.type)}</svg>
        </div>
      `, [17, 34])
    });
  }

  function postIcon(post) {
    const image = post.imageUrl ? `<img src="${escapeHtml(displayImageUrl(post.imageUrl))}" alt="">` : "";
    return L.divIcon({
      className: "map-v2-post-icon",
      iconSize: [132, 118],
      iconAnchor: [66, 124],
      popupAnchor: [0, -118],
      html: scaledIconHtml(`
        <button class="map-v2-post-card" type="button" data-map-v2-tid="${escapeHtml(post.tid)}">
          ${image}
          <span>${escapeHtml(post.title || post.locationArea || "LIAN")}</span>
        </button>
      `, [66, 124])
    });
  }

  function placeCardIcon(item) {
    const card = item.card || {};
    const image = card.imageUrl || item.icon?.url || "";
    return L.divIcon({
      className: "map-v2-location-card-icon",
      iconSize: [160, 50],
      iconAnchor: [80, 50],
      popupAnchor: [0, -50],
      html: scaledIconHtml(`
        <button class="map-v2-location-card" type="button" data-map-v2-location-id="${escapeHtml(item.id)}" title="${escapeHtml(item.name)}">
          ${image ? `<img src="${escapeHtml(displayImageUrl(image))}" alt="${escapeHtml(item.name)}">` : ""}
        </button>
      `, [80, 50])
    });
  }

  function assetIcon(asset) {
    const size = Array.isArray(asset.size) ? asset.size : [64, 64];
    const anchor = Array.isArray(asset.anchor) ? asset.anchor : [size[0] / 2, size[1]];
    const rotation = Number(asset.rotation || 0);
    const opacity = Math.max(0, Math.min(1, Number(asset.opacity ?? 1)));
    return L.divIcon({
      className: `map-v2-asset-icon map-v2-asset-${escapeHtml(asset.kind || "other")}`,
      iconSize: size,
      iconAnchor: anchor,
      popupAnchor: [0, -Math.round(size[1] * 0.65)],
      html: scaledIconHtml(`
        <img
          class="map-v2-asset-image"
          src="${escapeHtml(displayImageUrl(asset.url))}"
          alt=""
          style="opacity:${opacity};transform:rotate(${rotation}deg)"
        >
      `, anchor)
    });
  }

  function popupHtml(item) {
    return `
      <div class="map-v2-popup">
        <strong>${escapeHtml(item.name || item.title || "地点")}</strong>
        <p>${escapeHtml(item.type || item.locationArea || "LIAN 地图条目")}</p>
        ${item.tid ? `<button type="button" data-map-v2-popup-tid="${escapeHtml(item.tid)}">查看帖子</button>` : ""}
      </div>
    `;
  }

  function initLayerGroups() {
    if (state.layers) Object.values(state.layers).forEach((layer) => layer.remove());
    state.layers = {
      areas: L.layerGroup().addTo(state.map),
      roadsCasing: L.layerGroup().addTo(state.map),
      roads: L.layerGroup().addTo(state.map),
      routes: L.layerGroup().addTo(state.map),
      assets: L.layerGroup().addTo(state.map),
      locations: L.layerGroup().addTo(state.map),
      posts: L.layerGroup().addTo(state.map),
      pick: L.layerGroup().addTo(state.map)
    };
  }

  function roadStyleFor(road = {}) {
    const base = ROAD_RENDER_STYLES[road.type] || ROAD_RENDER_STYLES.default;
    const authoredStyle = road.style || {};
    const authoredWeight = Number(authoredStyle.weight || 0);
    return {
      ...base,
      color: authoredStyle.color || base.color,
      weight: authoredWeight > 0 ? authoredWeight : base.weight,
      dashArray: authoredStyle.dashArray ?? base.dashArray
    };
  }

  function roadPoints(road = {}) {
    return (road.points || [])
      .map((point) => [Number(point.lat), Number(point.lng)])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  }

  function renderAreas(areas = []) {
    state.layers.areas.clearLayers();
    for (const area of areas) {
      L.polygon(area.points.map((p) => [p.lat, p.lng]), {
        color: area.style?.strokeColor || area.style?.color || "#2563eb",
        weight: 2,
        fillColor: area.style?.fillColor || "#2563eb",
        fillOpacity: Number(area.style?.fillOpacity ?? 0.08),
        className: "map-v2-area"
      }).bindTooltip(area.name, { sticky: true }).addTo(state.layers.areas);
    }
  }

  function renderRoads(roads = []) {
    state.layers.roadsCasing.clearLayers();
    state.layers.roads.clearLayers();
    const zoom = state.map?.getZoom?.() || 16;
    for (const road of roads) {
      if (road.status && road.status !== "active") continue;
      const style = roadStyleFor(road);
      if (zoom < style.minZoom) continue;
      const points = roadPoints(road);
      if (points.length < 2) continue;

      L.polyline(points, {
        color: style.casing,
        weight: style.weight + style.casingExtra,
        opacity: 0.96,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
        bubblingMouseEvents: false,
        className: `map-v2-road-casing map-v2-road-casing-${escapeHtml(road.type || "default")}`
      }).addTo(state.layers.roadsCasing);

      const inner = L.polyline(points, {
        color: style.color,
        weight: style.weight,
        dashArray: style.dashArray || "",
        opacity: style.opacity,
        lineCap: "round",
        lineJoin: "round",
        interactive: road.interactive !== false,
        bubblingMouseEvents: false,
        className: `map-v2-road map-v2-road-${escapeHtml(road.type || "default")}`
      });
      if (road.interactive !== false) {
        inner.bindTooltip(road.name || "道路", { sticky: true });
      }
      inner.addTo(state.layers.roads);
    }
  }

  function renderRoutes(routes = []) {
    state.layers.routes.clearLayers();
    for (const route of routes) {
      L.polyline(route.points.map((p) => [p.lat, p.lng]), {
        color: route.style?.color || "#2563eb",
        weight: Number(route.style?.weight || 4),
        dashArray: route.style?.dashArray || "",
        opacity: 0.92,
        className: "map-v2-route"
      }).bindTooltip(route.name, { sticky: true }).addTo(state.layers.routes);
    }
  }

  function renderAssets(assets = []) {
    state.layers.assets.clearLayers();
    for (const asset of assets) {
      if (!asset.url || !asset.position?.lat || !asset.position?.lng) continue;
      const interactive = asset.clickBehavior && asset.clickBehavior !== "none";
      const marker = L.marker([asset.position.lat, asset.position.lng], {
        icon: assetIcon(asset),
        interactive,
        keyboard: interactive,
        zIndexOffset: Number(asset.zIndex || 40)
      });
      if (interactive) marker.bindPopup(popupHtml({ name: asset.id, type: asset.kind }));
      marker.addTo(state.layers.assets);
    }
  }

  function renderLocations(locations = []) {
    state.layers.locations.clearLayers();
    for (const item of locations) {
      if (item.card?.alwaysShow && (item.card?.imageUrl || item.icon?.url)) {
        L.marker([item.lat, item.lng], {
          icon: placeCardIcon(item),
          interactive: true,
          title: item.name
        }).bindPopup(popupHtml(item)).addTo(state.layers.locations);
      } else {
        const marker = L.marker([item.lat, item.lng], {
          icon: placeIcon(item),
          title: item.name
        }).bindPopup(popupHtml(item));
        marker.on("click", () => {
          if (state.mode === "pick") selectLocation(item);
        });
        marker.addTo(state.layers.locations);
      }
    }
  }

  function renderPosts(posts = []) {
    state.layers.posts.clearLayers();
    for (const post of posts) {
      L.marker([post.lat, post.lng], {
        icon: postIcon(post),
        title: post.title || post.locationArea || ""
      }).bindPopup(popupHtml(post)).addTo(state.layers.posts);
    }
  }

  function renderAll() {
    if (!state.map || !state.data) return;
    renderAreas(state.data.layers?.areas || []);
    renderRoads(state.data.layers?.roads || []);
    renderRoutes(state.data.layers?.routes || []);
    renderAssets(state.data.layers?.assets || []);
    renderLocations(state.data.locations || []);
    renderPosts(state.data.posts || []);
    applyMapIconScale();
  }

  async function loadData() {
    state.data = await api("/api/map/v2/items");
    return state.data;
  }

  async function init() {
    const el = $("#mapV2Stage");
    if (!el || !window.L) return;
    const data = state.data || await loadData();
    if (!state.map) {
      const bounds = data.bounds || { south: 18.37107, west: 109.98464, north: 18.41730, east: 110.04775 };
      state.map = L.map(el, {
        center: [data.center?.lat || 18.3935, data.center?.lng || 110.0159],
        zoom: data.zoom || 16,
        minZoom: 15,
        maxZoom: 16,
        maxBounds: [[bounds.south, bounds.west], [bounds.north, bounds.east]],
        maxBoundsViscosity: 1,
        zoomControl: true,
        attributionControl: false
      });
      L.imageOverlay("/assets/campus-base-map.png", [[bounds.south, bounds.west], [bounds.north, bounds.east]], {
        interactive: false,
        zIndex: 0
      }).addTo(state.map);
      L.tileLayer(GAODE_TILE_URL, {
        subdomains: ["1", "2", "3", "4"],
        maxZoom: 19,
        minZoom: 3,
        opacity: 0,
        attribution: "&copy; Gaode Map"
      }).addTo(state.map);
      initLayerGroups();
      bindMapIconScale(state.map);
      state.map.on("click", handleMapClick);
      state.map.on("popupopen", bindPopupActions);
      state.map.on("zoomend", () => renderRoads(state.data?.layers?.roads || []));
    }
    renderAll();
    setTimeout(() => state.map.invalidateSize(), 50);
  }

  function bindPopupActions(event) {
    const root = event.popup.getElement();
    const button = root?.querySelector("[data-map-v2-popup-tid]");
    if (button) {
      button.addEventListener("click", () => window.openDetail?.(button.dataset.mapV2PopupTid));
    }
  }

  function handleMapClick(event) {
    if (state.mode !== "pick") return;
    selectPoint(event.latlng);
  }

  function nearestLocation(latlng, mapInstance = state.map) {
    const items = state.data?.locations || [];
    let best = null;
    let bestDistance = Infinity;
    if (!mapInstance?.distance) return null;
    for (const item of items) {
      const distance = mapInstance.distance(latlng, [item.lat, item.lng]);
      if (distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }
    return bestDistance <= 120 ? best : null;
  }

  function locationDraftFrom({ latlng, location = null, note = "" }) {
    const name = location?.name || "地图选点";
    return {
      source: "map_v2",
      locationId: location?.id || "",
      locationArea: location?.name || "",
      displayName: name,
      lat: Number(latlng.lat.toFixed(7)),
      lng: Number(latlng.lng.toFixed(7)),
      legacyPoint: { x: null, y: null },
      imagePoint: { x: null, y: null },
      mapVersion: "gaode_v2",
      confidence: location ? 0.86 : 0.72,
      skipped: false,
      note
    };
  }

  function selectLocation(location) {
    selectPoint({ lat: location.lat, lng: location.lng }, location);
  }

  function selectPoint(latlng, explicitLocation = null) {
    const location = explicitLocation || nearestLocation(latlng);
    const draft = locationDraftFrom({ latlng, location });
    state.layers.pick.clearLayers();
    state.pickedMarker = L.marker([draft.lat, draft.lng], {
      icon: L.divIcon({
        className: "map-v2-picked-icon",
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        html: scaledIconHtml("<span></span>", [14, 28])
      })
    }).addTo(state.layers.pick).bindTooltip(draft.displayName || "地图选点", { permanent: false });
    applyMapIconScale();
    state.pickCallback?.(draft);
  }

  function setMode(mode = "browse") {
    state.mode = mode === "pick" ? "pick" : "browse";
    document.body.classList.toggle("is-map-v2-picking", state.mode === "pick");
    document.querySelectorAll("[data-map-v2-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mapV2Mode === state.mode);
    });
  }

  function startPick(callback) {
    state.pickCallback = typeof callback === "function" ? callback : null;
    setMode("pick");
    init();
  }

  function stopPick() {
    state.pickCallback = null;
    setMode("browse");
  }

  async function reloadEditor() {
    state.data = null;
    await loadData();
    renderAll();
  }

  function invalidateSize() {
    if (!state.map) return;
    state.map.invalidateSize();
    renderRoads(state.data?.layers?.roads || []);
    applyMapIconScale();
  }

  document.addEventListener("click", (event) => {
    const mode = event.target.closest("[data-map-v2-mode]");
    if (mode) {
      setMode(mode.dataset.mapV2Mode);
      return;
    }
    const post = event.target.closest("[data-map-v2-tid]");
    if (post) window.openDetail?.(post.dataset.mapV2Tid);
  });

  async function startPickInContainer(container, callback) {
    if (!container || !window.L) return;
    const data = state.data || await loadData();
    const bounds = data.bounds || { south: 18.37107, west: 109.98464, north: 18.41730, east: 110.04775 };
    const miniMap = L.map(container, {
      center: [data.center?.lat || 18.3935, data.center?.lng || 110.0159],
      zoom: data.zoom || 16,
      minZoom: 15,
      maxZoom: 16,
      maxBounds: [[bounds.south, bounds.west], [bounds.north, bounds.east]],
      maxBoundsViscosity: 1,
      zoomControl: false,
      attributionControl: false
    });
    L.imageOverlay("/assets/campus-base-map.png", [[bounds.south, bounds.west], [bounds.north, bounds.east]], {
      interactive: false,
      zIndex: 0
    }).addTo(miniMap);
    L.tileLayer(GAODE_TILE_URL, {
      subdomains: ["1", "2", "3", "4"],
      maxZoom: 19,
      minZoom: 3,
      opacity: 0
    }).addTo(miniMap);
    bindMapIconScale(miniMap);
    const pickLayer = L.layerGroup().addTo(miniMap);
    miniMap.on("click", (event) => {
      const location = nearestLocation(event.latlng, miniMap);
      const draft = locationDraftFrom({ latlng: event.latlng, location });
      pickLayer.clearLayers();
      L.marker([draft.lat, draft.lng], {
        icon: L.divIcon({
          className: "map-v2-picked-icon",
          iconSize: [28, 28],
          iconAnchor: [14, 28],
          html: scaledIconHtml("<span></span>", [14, 28])
        })
      }).addTo(pickLayer).bindTooltip(draft.displayName || "地图选点", { permanent: false });
      applyMapIconScale(miniMap);
      if (typeof callback === "function") callback(draft);
    });
    setTimeout(() => {
      miniMap.invalidateSize();
      applyMapIconScale(miniMap);
    }, 80);
    container._miniMap = miniMap;
  }

  window.MapV2 = {
    init,
    loadData,
    reload: reloadEditor,
    invalidateSize,
    startPick,
    startPickInContainer,
    stopPick,
    setMode
  };
})();
