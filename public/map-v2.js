(function () {
  const GAODE_TILE_URL = "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";
  const LIAN_API_BASE = (typeof window !== "undefined" && window.LIAN_API_BASE_URL) || "";
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
      .replace(/"/g, "&quot;");
  }

  async function api(path, options = {}) {
    const url = path.startsWith("/") ? `${LIAN_API_BASE}${path}` : path;
    const response = await fetch(url, {
      credentials: "include",
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  function displayImageUrl(url = "") {
    const value = String(url || "");
    if (/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(value)) {
      return `${LIAN_API_BASE}/api/image-proxy?url=${encodeURIComponent(value)}`;
    }
    return value;
  }

  function colorFor(type = "") {
    return TYPE_COLORS[type] || "#2563eb";
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
        html: `<img class="map-v2-place-asset" src="${escapeHtml(displayImageUrl(icon.url))}" alt="">`
      });
    }
    return L.divIcon({
      className: "map-v2-place-icon",
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -30],
      html: `
        <div class="map-v2-place-glyph" style="--marker-color:${escapeHtml(colorFor(item.type))}">
          <svg viewBox="0 0 24 24" aria-hidden="true">${iconSvg(item.type)}</svg>
        </div>
      `
    });
  }

  function postIcon(post) {
    const image = post.imageUrl ? `<img src="${escapeHtml(displayImageUrl(post.imageUrl))}" alt="">` : "";
    return L.divIcon({
      className: "map-v2-post-icon",
      iconSize: [132, 118],
      iconAnchor: [66, 124],
      popupAnchor: [0, -118],
      html: `
        <button class="map-v2-post-card" type="button" data-map-v2-tid="${escapeHtml(post.tid)}">
          ${image}
          <span>${escapeHtml(post.title || post.locationArea || "LIAN")}</span>
        </button>
      `
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
      html: `
        <button class="map-v2-location-card" type="button" data-map-v2-location-id="${escapeHtml(item.id)}" title="${escapeHtml(item.name)}">
          ${image ? `<img src="${escapeHtml(displayImageUrl(image))}" alt="${escapeHtml(item.name)}">` : ""}
        </button>
      `
    });
  }

  function assetIcon(asset) {
    const baseSize = Array.isArray(asset.size) ? asset.size : [64, 64];
    const baseAnchor = Array.isArray(asset.anchor) ? asset.anchor : [baseSize[0] / 2, baseSize[1]];
    const shouldScaleWithZoom = asset.kind === "building_icon" || asset.scaleWithZoom === true;
    const maxZoom = state.map?.getMaxZoom?.() || 16;
    const currentZoom = state.map?.getZoom?.() || maxZoom;
    const zoomScale = shouldScaleWithZoom ? Math.pow(2, currentZoom - maxZoom) : 1;
    const size = baseSize.map((value) => Math.max(1, Math.round(Number(value || 0) * zoomScale)));
    const anchor = baseAnchor.map((value) => Math.round(Number(value || 0) * zoomScale));
    const rotation = Number(asset.rotation || 0);
    const opacity = Math.max(0, Math.min(1, Number(asset.opacity ?? 1)));
    return L.divIcon({
      className: `map-v2-asset-icon map-v2-asset-${escapeHtml(asset.kind || "other")}`,
      iconSize: size,
      iconAnchor: anchor,
      popupAnchor: [0, -Math.round(size[1] * 0.65)],
      html: `
        <img
          class="map-v2-asset-image"
          src="${escapeHtml(displayImageUrl(asset.url))}"
          alt=""
          style="opacity:${opacity};transform:rotate(${rotation}deg)"
        >
      `
    });
  }

  function popupHtml(item) {
    return `
      <div class="map-v2-popup">
        <strong>${escapeHtml(item.name || item.title || "Location")}</strong>
        <p>${escapeHtml(item.type || item.locationArea || "LIAN map item")}</p>
        ${item.tid ? `<button type="button" data-map-v2-popup-tid="${escapeHtml(item.tid)}">Open post</button>` : ""}
      </div>
    `;
  }

  // Road network preview
  const ROAD_PREVIEW = {
    data: null,
    canvas: null,
    ctx: null,
    tx: 442,
    ty: -184,
    scale: 1,
    rotation: 0,
    opacity: 0.7
  };

  function renderRoadPreview() {
    const { canvas, ctx, data } = ROAD_PREVIEW;
    if (!canvas || !ctx || !data || !state.map) return;

    const map = state.map;
    const bounds = map.getBounds();
    const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());
    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;

    canvas.style.left = topLeft.x + 'px';
    canvas.style.top = topLeft.y + 'px';
    canvas.width = size.x * dpr;
    canvas.height = size.y * dpr;
    canvas.style.width = size.x + 'px';
    canvas.style.height = size.y + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);

    const zoom = map.getZoom();
    const center = map.getCenter();
    const cosLat = Math.cos(center.lat * Math.PI / 180);

    function project(lat, lng) {
      const xMeters = (lng - 110.015821) * 111320 * cosLat;
      const yMeters = (lat - 18.393453) * 111320;
      const px = xMeters * ROAD_PREVIEW.scale + ROAD_PREVIEW.tx;
      const py = yMeters * ROAD_PREVIEW.scale + ROAD_PREVIEW.ty;
      const lng2 = px / (111320 * cosLat) + 110.015821;
      const lat2 = py / 111320 + 18.393453;
      const ppt = map.latLngToLayerPoint([lat2, lng2]);
      return { x: ppt.x - topLeft.x, y: ppt.y - topLeft.y };
    }

    ctx.globalAlpha = ROAD_PREVIEW.opacity;
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const lane of data.lanes) {
      if (!lane.points || lane.points.length < 2) continue;
      ctx.beginPath();
      const p0 = project(lane.points[0][0], lane.points[0][1]);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < lane.points.length; i++) {
        const p = project(lane.points[i][0], lane.points[i][1]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function initLayerGroups() {
    if (state.layers) Object.values(state.layers).forEach((layer) => layer.remove());
    state.layers = {
      areas: L.layerGroup().addTo(state.map),
      routes: L.layerGroup().addTo(state.map),
      assets: L.layerGroup().addTo(state.map),
      locations: L.layerGroup().addTo(state.map),
      posts: L.layerGroup().addTo(state.map),
      pick: L.layerGroup().addTo(state.map)
    };
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
    renderRoutes(state.data.layers?.routes || []);
    renderAssets(state.data.layers?.assets || []);
    renderLocations(state.data.locations || []);
    renderPosts(state.data.posts || []);
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
      state.map.on("click", handleMapClick);
      state.map.on("popupopen", bindPopupActions);
      state.map.on("zoomend", () => renderAssets(state.data?.layers?.assets || []));

      // Road network canvas overlay
      const pane = state.map.getPane('overlayPane');
      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '350';
      pane.appendChild(canvas);
      ROAD_PREVIEW.canvas = canvas;
      ROAD_PREVIEW.ctx = canvas.getContext('2d');
      state.map.on('moveend zoomend move', renderRoadPreview);

      // Load road network data
      fetch('/assets/road-network-preview.json')
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data && data.lanes) { ROAD_PREVIEW.data = data; renderRoadPreview(); } })
        .catch(() => {});
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

  function nearestLocation(latlng) {
    const items = state.data?.locations || [];
    let best = null;
    let bestDistance = Infinity;
    for (const item of items) {
      const distance = state.map.distance(latlng, [item.lat, item.lng]);
      if (distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }
    return bestDistance <= 120 ? best : null;
  }

  function locationDraftFrom({ latlng, location = null, note = "" }) {
    const name = location?.name || "Map pick";
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
        html: "<span></span>"
      })
    }).addTo(state.layers.pick).bindTooltip(draft.displayName || "Map pick", { permanent: false });
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
    const pickLayer = L.layerGroup().addTo(miniMap);
    miniMap.on("click", (event) => {
      const location = nearestLocation(event.latlng);
      const draft = locationDraftFrom({ latlng: event.latlng, location });
      pickLayer.clearLayers();
      L.marker([draft.lat, draft.lng], {
        icon: L.divIcon({
          className: "map-v2-picked-icon",
          iconSize: [28, 28],
          iconAnchor: [14, 28],
          html: "<span></span>"
        })
      }).addTo(pickLayer).bindTooltip(draft.displayName || "Map pick", { permanent: false });
      if (typeof callback === "function") callback(draft);
    });
    setTimeout(() => miniMap.invalidateSize(), 80);
    container._miniMap = miniMap;
  }

  window.MapV2 = {
    init,
    loadData,
    reload: reloadEditor,
    startPick,
    startPickInContainer,
    stopPick,
    setMode
  };
})();
