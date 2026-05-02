(function () {
  const GAODE_TILE_URL = "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";
  const DEFAULT_CENTER = [18.3935, 110.0159];
  const BOUNDS = {
    south: 18.373050,
    west: 109.995380,
    north: 18.413856,
    east: 110.036262
  };

  const state = {
    map: null,
    mode: "browse",
    data: null,
    draftPoints: [],
    layers: {},
    grassOverlay: null,
    tileLayer: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);

  function escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function inBounds(point) {
    return point.lat >= BOUNDS.south &&
      point.lat <= BOUNDS.north &&
      point.lng >= BOUNDS.west &&
      point.lng <= BOUNDS.east;
  }

  function setStatus(message, isError = false) {
    const el = $("#editorStatus");
    if (!el) return;
    el.textContent = message || "";
    el.style.color = isError ? "#dc2626" : "#256c45";
  }

  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: "include", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  function iconHtml(item = {}) {
    const url = item.icon?.url || "";
    if (url) return `<img src="${escapeHtml(url)}" alt="">`;
    return `<span>${escapeHtml((item.name || "?").slice(0, 1))}</span>`;
  }

  function locationIcon(item = {}) {
    const size = Array.isArray(item.icon?.size) ? item.icon.size : [34, 34];
    const anchor = Array.isArray(item.icon?.anchor) ? item.icon.anchor : [size[0] / 2, size[1]];
    return L.divIcon({
      className: "editor-location-marker",
      iconSize: size,
      iconAnchor: anchor,
      html: `<div class="editor-location-icon">${iconHtml(item)}</div>`
    });
  }

  function cardIcon(item = {}) {
    const card = item.card || {};
    const image = card.imageUrl || item.icon?.url || "";
    return L.divIcon({
      className: "editor-card-marker",
      iconSize: [170, 66],
      iconAnchor: [85, 78],
      html: `
        <div class="editor-card">
          ${image ? `<img src="${escapeHtml(image)}" alt="">` : "<span></span>"}
          <span>
            <strong>${escapeHtml(card.title || item.name || "")}</strong>
            <small>${escapeHtml(card.subtitle || card.tag || item.type || "")}</small>
          </span>
        </div>
      `
    });
  }

  function parseJson(selector, fallback) {
    try {
      return JSON.parse($(selector).value || "");
    } catch {
      return fallback;
    }
  }

  function renderData() {
    Object.values(state.layers).forEach((layer) => layer.remove());
    state.layers = {
      bounds: L.rectangle([[BOUNDS.south, BOUNDS.west], [BOUNDS.north, BOUNDS.east]], {
        color: "#dc2626",
        weight: 2,
        fill: false,
        dashArray: "8 6"
      }).addTo(state.map),
      areas: L.layerGroup().addTo(state.map),
      routes: L.layerGroup().addTo(state.map),
      locations: L.layerGroup().addTo(state.map),
      draft: L.layerGroup().addTo(state.map)
    };
    const locations = parseJson("#locationsJson", { items: [] });
    const layers = parseJson("#layersJson", { areas: [], routes: [] });
    for (const area of layers.areas || []) {
      L.polygon((area.points || []).map((p) => [p.lat, p.lng]), {
        color: area.style?.strokeColor || area.style?.color || "#2563eb",
        fillColor: area.style?.fillColor || "#2563eb",
        fillOpacity: Number(area.style?.fillOpacity ?? 0.08),
        weight: 2
      }).bindTooltip(area.name || area.id || "area").addTo(state.layers.areas);
    }
    for (const route of layers.routes || []) {
      L.polyline((route.points || []).map((p) => [p.lat, p.lng]), {
        color: route.style?.color || "#2563eb",
        weight: Number(route.style?.weight || 4),
        dashArray: route.style?.dashArray || ""
      }).bindTooltip(route.name || route.id || "route").addTo(state.layers.routes);
    }
    for (const item of locations.items || []) {
      if (!Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lng))) continue;
      L.marker([item.lat, item.lng], {
        icon: locationIcon(item),
        draggable: true
      }).on("dragend", (event) => {
        const next = event.target.getLatLng();
        if (!inBounds(next)) {
          setStatus(`${item.name || item.id} 超出试验区范围`, true);
          event.target.setLatLng([item.lat, item.lng]);
          return;
        }
        item.lat = Number(next.lat.toFixed(7));
        item.lng = Number(next.lng.toFixed(7));
        $("#locationsJson").value = JSON.stringify(locations, null, 2);
        setStatus("地点坐标已更新，保存前请检查 JSON。");
      }).bindPopup(`${escapeHtml(item.name || item.id || "location")}<br>${item.lat}, ${item.lng}`).addTo(state.layers.locations);
      if (item.card?.alwaysShow) {
        L.marker([item.lat, item.lng], { icon: cardIcon(item) }).addTo(state.layers.locations);
      }
    }
  }

  function renderDraft() {
    state.layers.draft.clearLayers();
    for (const point of state.draftPoints) {
      L.circleMarker([point.lat, point.lng], {
        radius: 5,
        color: "#dc2626",
        fillColor: "#dc2626",
        fillOpacity: 0.9
      }).addTo(state.layers.draft);
    }
    if (state.mode === "area" && state.draftPoints.length >= 2) {
      L.polygon(state.draftPoints.map((p) => [p.lat, p.lng]), {
        color: "#dc2626",
        fillColor: "#dc2626",
        fillOpacity: 0.08
      }).addTo(state.layers.draft);
    }
    if (state.mode === "route" && state.draftPoints.length >= 2) {
      L.polyline(state.draftPoints.map((p) => [p.lat, p.lng]), {
        color: "#dc2626",
        weight: 4,
        dashArray: "8 6"
      }).addTo(state.layers.draft);
    }
  }

  function setMode(mode) {
    state.mode = mode;
    state.draftPoints = [];
    document.querySelectorAll("[data-editor-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.editorMode === mode);
    });
    renderDraft();
    setStatus(mode === "browse" ? "浏览模式" : "点击地图采点。");
  }

  async function loadData() {
    const data = await api("/api/admin/map-v2");
    state.data = data;
    $("#locationsJson").value = JSON.stringify(data.locations || { version: 1, coordSystem: "gcj02", items: [] }, null, 2);
    $("#layersJson").value = JSON.stringify(data.layers || { version: 1, coordSystem: "gcj02", center: { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] }, zoom: 16, areas: [], routes: [] }, null, 2);
    renderData();
    setStatus("已加载后端 Map v2 数据。");
  }

  function buildDraftItem() {
    const id = $("#draftId").value.trim() || `map-item-${Date.now()}`;
    const name = $("#draftName").value.trim() || id;
    const type = $("#draftType").value.trim() || state.mode;
    const iconUrl = $("#draftIconUrl").value.trim();
    const alwaysShow = $("#draftAlwaysShow").value === "true";
    const subtitle = $("#draftSubtitle").value.trim();
    if (state.mode === "location") {
      if (state.draftPoints.length !== 1) throw new Error("地点模式需要点击 1 个点。");
      const point = state.draftPoints[0];
      return {
        target: "locations",
        value: {
          id,
          name,
          type,
          aliases: [],
          lat: point.lat,
          lng: point.lng,
          coordSystem: "gcj02",
          legacyPoint: { x: null, y: null },
          icon: { url: iconUrl, size: [34, 34], anchor: [17, 34] },
          card: { title: name, subtitle, imageUrl: iconUrl, tag: type, alwaysShow },
          status: "active"
        }
      };
    }
    if (state.mode === "area") {
      if (state.draftPoints.length < 3) throw new Error("区域模式至少需要 3 个点。");
      return {
        target: "areas",
        value: {
          id,
          name,
          type,
          points: state.draftPoints,
          style: { strokeColor: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.08 }
        }
      };
    }
    if (state.mode === "route") {
      if (state.draftPoints.length < 2) throw new Error("路线模式至少需要 2 个点。");
      return {
        target: "routes",
        value: {
          id,
          name,
          type,
          points: state.draftPoints,
          style: { color: "#2563eb", weight: 4, dashArray: "" }
        }
      };
    }
    throw new Error("请选择放地点、画区域或画路线。");
  }

  function commitDraft() {
    try {
      const draft = buildDraftItem();
      if (draft.target === "locations") {
        const locations = parseJson("#locationsJson", { version: 1, coordSystem: "gcj02", items: [] });
        locations.items = (locations.items || []).filter((item) => item.id !== draft.value.id);
        locations.items.push(draft.value);
        $("#locationsJson").value = JSON.stringify(locations, null, 2);
      } else {
        const layers = parseJson("#layersJson", { version: 1, coordSystem: "gcj02", areas: [], routes: [] });
        layers[draft.target] = (layers[draft.target] || []).filter((item) => item.id !== draft.value.id);
        layers[draft.target].push(draft.value);
        $("#layersJson").value = JSON.stringify(layers, null, 2);
      }
      state.draftPoints = [];
      renderData();
      renderDraft();
      setStatus("已写入 JSON，确认后点击保存到后端。");
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  async function saveData() {
    try {
      const token = $("#adminToken").value.trim() || localStorage.getItem("lian.adminToken") || "";
      if (token) localStorage.setItem("lian.adminToken", token);
      const locations = JSON.parse($("#locationsJson").value || "{}");
      const layers = JSON.parse($("#layersJson").value || "{}");
      await api("/api/admin/map-v2", {
        method: "PUT",
        headers: { "content-type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ locations, layers })
      });
      await loadData();
      setStatus("已保存到后端。");
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  function initMap() {
    state.map = L.map("mapEditorStage", {
      center: DEFAULT_CENTER,
      zoom: 16,
      maxBounds: [[BOUNDS.south, BOUNDS.west], [BOUNDS.north, BOUNDS.east]],
      maxBoundsViscosity: 1,
      worldCopyJump: false
    });
    state.grassOverlay = L.imageOverlay("/assets/campus-grass.png", [[BOUNDS.south, BOUNDS.west], [BOUNDS.north, BOUNDS.east]], {
      interactive: false,
      zIndex: 0
    }).addTo(state.map);
    state.tileLayer = L.tileLayer(GAODE_TILE_URL, {
      subdomains: ["1", "2", "3", "4"],
      maxZoom: 19,
      minZoom: 3,
      opacity: 0.35,
      attribution: "&copy; Gaode Map"
    }).addTo(state.map);
    state.map.on("click", (event) => {
      if (state.mode === "browse") return;
      if (!inBounds(event.latlng)) {
        setStatus("采点超出试验区范围。", true);
        return;
      }
      if (state.mode === "location") state.draftPoints = [];
      state.draftPoints.push({
        lat: Number(event.latlng.lat.toFixed(7)),
        lng: Number(event.latlng.lng.toFixed(7))
      });
      renderDraft();
      setStatus(`已采点 ${state.draftPoints.length} 个。`);
    });
  }

  document.addEventListener("click", (event) => {
    const mode = event.target.closest("[data-editor-mode]");
    if (mode) return setMode(mode.dataset.editorMode);
    if (event.target.closest("[data-reload]")) return loadData();
    if (event.target.closest("[data-commit-draft]")) return commitDraft();
    if (event.target.closest("[data-clear-draft]")) {
      state.draftPoints = [];
      renderDraft();
      return setStatus("采点已清空。");
    }
    if (event.target.closest("[data-save]")) return saveData();
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("#locationsJson, #layersJson")) renderData();
  });

  function setLayerVisible(name, visible) {
    const layer = state.layers[name];
    if (!layer) return;
    if (visible) {
      if (!state.map.hasLayer(layer)) layer.addTo(state.map);
    } else {
      if (state.map.hasLayer(layer)) layer.remove();
    }
  }

  document.addEventListener("change", (event) => {
    const toggle = event.target.closest("[data-layer]");
    if (toggle) {
      const name = toggle.dataset.layer;
      if (name === "grass" && state.grassOverlay) {
        if (toggle.checked) {
          if (!state.map.hasLayer(state.grassOverlay)) state.grassOverlay.addTo(state.map);
        } else {
          if (state.map.hasLayer(state.grassOverlay)) state.grassOverlay.remove();
        }
      } else if (name === "tiles" && state.tileLayer) {
        if (toggle.checked) {
          if (!state.map.hasLayer(state.tileLayer)) state.tileLayer.addTo(state.map);
        } else {
          if (state.map.hasLayer(state.tileLayer)) state.tileLayer.remove();
        }
      } else {
        setLayerVisible(name, toggle.checked);
      }
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "grassOpacity" && state.grassOverlay) {
      state.grassOverlay.setOpacity(Number(event.target.value) / 100);
    }
    if (event.target.id === "tilesOpacity" && state.tileLayer) {
      state.tileLayer.setOpacity(Number(event.target.value) / 100);
    }
  });

  $("#adminToken").value = localStorage.getItem("lian.adminToken") || "";
  initMap();
  loadData().catch((error) => setStatus(error.message, true));
})();
