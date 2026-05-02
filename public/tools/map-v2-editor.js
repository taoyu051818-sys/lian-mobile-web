(function () {
  const GAODE_TILE_URL = "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";
  const NODEBB_URL = (window.LIAN_NODEBB_URL || "http://149.104.21.74:4567").replace(/\/$/, "");
  const DEFAULT_CENTER = [18.3935, 110.0159];
  const BOUNDS = {
    south: 18.3700734,
    west: 109.9940365,
    north: 18.4149043,
    east: 110.0503482
  };
  // BOUNDS object properties are mutated by the adjustment panel

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
    mode: "browse",
    data: null,
    posts: [],
    draftPoints: [],
    layers: {},
    grassOverlay: null,
    tileLayer: null,
    selectedId: null,
    cropPoints: [],
    cropRect: null,
    baseImage: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);

  function escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function displayImageUrl(url = "") {
    const value = String(url || "");
    if (/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(value)) {
      return `/api/image-proxy?url=${encodeURIComponent(value)}`;
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

  function getToken() {
    return $("#adminToken")?.value?.trim() || localStorage.getItem("lian.adminToken") || "";
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = getToken();
    if (token) headers["x-admin-token"] = token;
    const response = await fetch(path, { credentials: "include", ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
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
      iconSize: [156, 68],
      iconAnchor: [78, 74],
      popupAnchor: [0, -70],
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
      iconSize: [168, 76],
      iconAnchor: [84, 88],
      popupAnchor: [0, -76],
      html: `
        <button class="map-v2-location-card" type="button" data-map-v2-location-id="${escapeHtml(item.id)}">
          ${image ? `<img src="${escapeHtml(displayImageUrl(image))}" alt="">` : ""}
          <span>
            <strong>${escapeHtml(card.title || item.name)}</strong>
            <small>${escapeHtml(card.subtitle || card.tag || item.type || "")}</small>
          </span>
        </button>
      `
    });
  }

  function popupHtml(item) {
    const parts = [
      `<div class="map-v2-popup">`,
      `<strong>${escapeHtml(item.name || item.title || "Location")}</strong>`,
      `<p>${escapeHtml(item.type || item.locationArea || "LIAN map item")}</p>`,
    ];
    if (item.tid) parts.push(`<button type="button" data-map-v2-popup-tid="${escapeHtml(item.tid)}">Open post</button>`);
    parts.push(`</div>`);
    return parts.join("");
  }

  function parseJson(selector, fallback) {
    try {
      return JSON.parse($(selector).value || "");
    } catch {
      return fallback;
    }
  }

  function clearSelection() {
    state.selectedId = null;
    state.selectedTarget = null;
    $("#selectionInfo").classList.remove("active");
    $("#draftId").value = "";
    $("#draftName").value = "";
    $("#draftType").value = "";
    $("#draftIconUrl").value = "";
    $("#draftAlwaysShow").value = "false";
    $("#draftSubtitle").value = "";
  }

  function selectItem(item, target = "locations") {
    state.selectedId = item.id || null;
    state.selectedTarget = target;
    $("#draftId").value = item.id || "";
    $("#draftName").value = item.name || "";
    $("#draftType").value = item.type || "";
    $("#draftIconUrl").value = item.icon?.url || "";
    $("#draftAlwaysShow").value = item.card?.alwaysShow ? "true" : "false";
    $("#draftSubtitle").value = item.card?.subtitle || item.card?.tag || "";
    // Show selection panel
    const panel = $("#selectionInfo");
    panel.classList.add("active");
    $("#selName").textContent = item.name || item.id || "—";
    const meta = [];
    if (item.type) meta.push(item.type);
    if (item.lat) meta.push(`${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`);
    if (target === "areas") meta.push(`${(item.points || []).length} 点`);
    if (target === "routes") meta.push(`${(item.points || []).length} 点`);
    $("#selMeta").textContent = meta.join(" · ");
    setStatus(`已选中: ${item.name || item.id}`);
  }

  function deleteSelected() {
    const id = state.selectedId;
    const target = state.selectedTarget;
    if (!id) return setStatus("请先选中一个元素。", true);
    if (!confirm(`确定删除 "${id}"？`)) return;
    if (target === "locations") {
      const locations = parseJson("#locationsJson", { version: 1, coordSystem: "gcj02", items: [] });
      locations.items = (locations.items || []).filter((item) => item.id !== id);
      $("#locationsJson").value = JSON.stringify(locations, null, 2);
    } else {
      const layers = parseJson("#layersJson", { version: 1, coordSystem: "gcj02", areas: [], routes: [] });
      layers[target] = (layers[target] || []).filter((item) => item.id !== id);
      $("#layersJson").value = JSON.stringify(layers, null, 2);
    }
    clearSelection();
    renderData();
    setStatus(`已删除 ${id}，点击"保存到后端"提交。`);
  }

  function renderPosts() {
    if (state.layers.posts) state.layers.posts.clearLayers();
    for (const post of state.posts) {
      const marker = L.marker([post.lat, post.lng], {
        icon: postIcon(post),
        title: post.title || post.locationArea || ""
      }).bindPopup(popupHtml(post));
      marker.addTo(state.layers.posts);
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
      posts: L.layerGroup().addTo(state.map),
      draft: L.layerGroup().addTo(state.map)
    };
    const locations = parseJson("#locationsJson", { items: [] });
    const layers = parseJson("#layersJson", { areas: [], routes: [] });
    for (const area of layers.areas || []) {
      const poly = L.polygon((area.points || []).map((p) => [p.lat, p.lng]), {
        color: area.style?.strokeColor || area.style?.color || "#2563eb",
        fillColor: area.style?.fillColor || "#2563eb",
        fillOpacity: Number(area.style?.fillOpacity ?? 0.08),
        weight: 2
      }).bindTooltip(area.name || area.id || "area");
      poly.on("click", () => selectItem(area, "areas"));
      poly.addTo(state.layers.areas);
    }
    for (const route of layers.routes || []) {
      const line = L.polyline((route.points || []).map((p) => [p.lat, p.lng]), {
        color: route.style?.color || "#2563eb",
        weight: Number(route.style?.weight || 4),
        dashArray: route.style?.dashArray || ""
      }).bindTooltip(route.name || route.id || "route");
      line.on("click", () => selectItem(route, "routes"));
      line.addTo(state.layers.routes);
    }
    for (const item of locations.items || []) {
      if (!Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lng))) continue;
      const marker = L.marker([item.lat, item.lng], {
        icon: placeIcon(item),
        draggable: true,
        title: item.name
      });
      marker.bindPopup(popupHtml(item));
      marker.on("click", () => selectItem(item));
      marker.on("dragend", (event) => {
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
      });
      marker.addTo(state.layers.locations);
      if (item.card?.alwaysShow) {
        L.marker([item.lat, item.lng], {
          icon: placeCardIcon(item),
          interactive: true,
          title: item.name
        }).bindPopup(popupHtml(item)).addTo(state.layers.locations);
      }
    }
    renderPosts();
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
    state.cropPoints = [];
    if (state.cropRect) { state.cropRect.remove(); state.cropRect = null; }
    showCropUI(false);
    clearSelection();
    document.querySelectorAll("[data-editor-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.editorMode === mode);
    });
    renderDraft();
    if (mode === "crop") {
      setStatus("截取模式：点击地图两个角点选择区域。");
    } else if (mode === "browse") {
      setStatus("浏览模式");
    } else {
      setStatus("点击地图采点。");
    }
  }

  async function loadData() {
    const data = await api("/api/admin/map-v2");
    state.data = data;
    $("#locationsJson").value = JSON.stringify(data.locations || { version: 1, coordSystem: "gcj02", items: [] }, null, 2);
    $("#layersJson").value = JSON.stringify(data.layers || { version: 1, coordSystem: "gcj02", center: { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] }, zoom: 16, areas: [], routes: [] }, null, 2);
    // Use center/zoom from layers data if available
    const layers = data.layers || {};
    if (layers.center && Number.isFinite(layers.center.lat)) {
      state.map.setView([layers.center.lat, layers.center.lng], layers.zoom || 16);
    }
    // Fetch posts from public API
    try {
      const publicData = await api("/api/map/v2/items");
      state.posts = publicData.posts || [];
    } catch {
      state.posts = [];
    }
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
      minZoom: 14,
      maxZoom: 19,
      maxBounds: [[BOUNDS.south, BOUNDS.west], [BOUNDS.north, BOUNDS.east]],
      maxBoundsViscosity: 1,
      worldCopyJump: false,
      attributionControl: false
    });
    state.grassOverlay = L.imageOverlay("/assets/campus-base-map.png", [[BOUNDS.south, BOUNDS.west], [BOUNDS.north, BOUNDS.east]], {
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
      if (state.mode === "crop") {
        state.cropPoints.push(event.latlng);
        if (state.cropPoints.length === 1) {
          setStatus("点击第二个角点完成截取区域。");
        }
        if (state.cropPoints.length >= 2) {
          if (state.cropRect) state.cropRect.remove();
          const b = state.cropPoints;
          const south = Math.min(b[0].lat, b[1].lat);
          const north = Math.max(b[0].lat, b[1].lat);
          const west = Math.min(b[0].lng, b[1].lng);
          const east = Math.max(b[0].lng, b[1].lng);
          state.cropRect = L.rectangle([[south, west], [north, east]], {
            color: "#059669", weight: 2, fillOpacity: 0.15, dashArray: "6 4"
          }).addTo(state.map);
          const p1 = geoToPixel(south, west);
          const p2 = geoToPixel(north, east);
          const pw = Math.abs(p2.x - p1.x);
          const ph = Math.abs(p2.y - p1.y);
          $("#cropRect").textContent = `像素: ${Math.round(pw)} x ${Math.round(ph)} | SW ${south.toFixed(5)}, ${west.toFixed(5)} → NE ${north.toFixed(5)}, ${east.toFixed(5)}`;
          showCropUI(true);
          setStatus("点击[保存截取]下载裁剪图片。");
          state.cropPoints = [];
        }
        return;
      }
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
    state.map.on("popupopen", (event) => {
      const el = event.popup.getElement();
      const btn = el?.querySelector("[data-map-v2-popup-tid]");
      if (btn) {
        btn.addEventListener("click", () => {
          window.open(`${NODEBB_URL}/topic/${btn.dataset.mapV2PopupTid}`, "_blank");
        });
      }
    });
    // Safety net: snap back if map drifts out of bounds
    state.map.on("moveend", () => {
      const c = state.map.getCenter();
      const b = BOUNDS;
      const pad = 0.001;
      let lat = c.lat, lng = c.lng;
      if (lat < b.south + pad) lat = b.south + pad;
      if (lat > b.north - pad) lat = b.north - pad;
      if (lng < b.west + pad) lng = b.west + pad;
      if (lng > b.east - pad) lng = b.east - pad;
      if (lat !== c.lat || lng !== c.lng) state.map.setView([lat, lng]);
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
    if (event.target.closest("[data-delete-selected]")) return deleteSelected();
    const postBtn = event.target.closest("[data-map-v2-tid]");
    if (postBtn) {
      const tid = postBtn.dataset.mapV2Tid;
      window.open(`${NODEBB_URL}/topic/${tid}`, "_blank");
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("#locationsJson, #layersJson")) renderData();
  });

  // --- Bounds adjustment ---
  function getBoundsInputs() {
    return {
      south: Number($("#boundS").value),
      north: Number($("#boundN").value),
      west: Number($("#boundW").value),
      east: Number($("#boundE").value)
    };
  }

  function setBoundsInputs(b) {
    $("#boundS").value = b.south.toFixed(7);
    $("#boundN").value = b.north.toFixed(7);
    $("#boundW").value = b.west.toFixed(7);
    $("#boundE").value = b.east.toFixed(7);
  }

  function applyBounds() {
    const b = getBoundsInputs();
    if (state.grassOverlay) {
      state.grassOverlay.setBounds([[b.south, b.west], [b.north, b.east]]);
    }
    if (state.layers.bounds) {
      state.layers.bounds.setBounds([[b.south, b.west], [b.north, b.east]]);
    }
    BOUNDS.south = b.south;
    BOUNDS.north = b.north;
    BOUNDS.west = b.west;
    BOUNDS.east = b.east;
    state.map.setMaxBounds([[b.south, b.west], [b.north, b.east]]);
    setStatus(`底图已更新: SW ${b.south.toFixed(5)} / ${b.west.toFixed(5)} → NE ${b.north.toFixed(5)} / ${b.east.toFixed(5)}`);
  }

  function nudgeBounds(dir) {
    const step = Number($("#nudgeStep").value);
    const b = getBoundsInputs();
    if (dir === "up") { b.north += step; b.south += step; }
    if (dir === "down") { b.north -= step; b.south -= step; }
    if (dir === "left") { b.west -= step; b.east -= step; }
    if (dir === "right") { b.west += step; b.east += step; }
    if (dir === "wider") { b.west -= step; b.east += step; }
    if (dir === "narrower") { b.west += step; b.east -= step; }
    if (dir === "taller") { b.south -= step; b.north += step; }
    if (dir === "shorter") { b.south += step; b.north -= step; }
    setBoundsInputs(b);
    applyBounds();
  }

  document.addEventListener("click", (event) => {
    const nudge = event.target.closest("[data-nudge]");
    if (nudge) return nudgeBounds(nudge.dataset.nudge);
    if (event.target.closest("[data-apply-bounds]")) return applyBounds();
    if (event.target.closest("[data-copy-bounds]")) {
      const b = getBoundsInputs();
      const text = `south: ${b.south.toFixed(7)}\nnorth: ${b.north.toFixed(7)}\nwest: ${b.west.toFixed(7)}\neast: ${b.east.toFixed(7)}`;
      navigator.clipboard.writeText(text).then(() => setStatus("已复制边界到剪贴板。"));
    }
    if (event.target.closest("[data-crop-save]")) return saveCrop();
    if (event.target.closest("[data-crop-cancel]")) return cancelCrop();
  });

  // --- Crop feature ---
  function geoToPixel(lat, lng) {
    const b = BOUNDS;
    const img = state.baseImage;
    if (!img) return null;
    const x = (lng - b.west) / (b.east - b.west) * img.width;
    const y = (b.north - lat) / (b.north - b.south) * img.height;
    return { x, y };
  }

  function showCropUI(show) {
    const info = $("#cropInfo");
    const saveBtn = $("[data-crop-save]");
    const cancelBtn = $("[data-crop-cancel]");
    if (info) info.style.display = show ? "block" : "none";
    if (saveBtn) saveBtn.style.display = show ? "inline-block" : "none";
    if (cancelBtn) cancelBtn.style.display = show ? "inline-block" : "none";
  }

  function cancelCrop() {
    state.cropPoints = [];
    if (state.cropRect) { state.cropRect.remove(); state.cropRect = null; }
    showCropUI(false);
    setMode("browse");
  }

  function saveCrop() {
    if (state.cropPoints.length < 2 || !state.baseImage) return;
    const p1 = geoToPixel(state.cropPoints[0].lat, state.cropPoints[0].lng);
    const p2 = geoToPixel(state.cropPoints[1].lat, state.cropPoints[1].lng);
    if (!p1 || !p2) return;

    const x = Math.max(0, Math.min(p1.x, p2.x));
    const y = Math.max(0, Math.min(p1.y, p2.y));
    const w = Math.min(state.baseImage.width - x, Math.abs(p2.x - p1.x));
    const h = Math.min(state.baseImage.height - y, Math.abs(p2.y - p1.y));
    if (w < 10 || h < 10) return setStatus("截取区域太小。", true);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(state.baseImage, Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, 0, Math.round(w), Math.round(h));

    // Compute new bounds for the cropped area
    const newWest = BOUNDS.west + (x / state.baseImage.width) * (BOUNDS.east - BOUNDS.west);
    const newEast = BOUNDS.west + ((x + w) / state.baseImage.width) * (BOUNDS.east - BOUNDS.west);
    const newNorth = BOUNDS.north - (y / state.baseImage.height) * (BOUNDS.north - BOUNDS.south);
    const newSouth = BOUNDS.north - ((y + h) / state.baseImage.height) * (BOUNDS.north - BOUNDS.south);

    // Download cropped image
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "campus-base-map-cropped.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");

    setStatus(`截取完成: ${Math.round(w)}x${Math.round(h)}px | bounds: S${newSouth.toFixed(7)} N${newNorth.toFixed(7)} W${newWest.toFixed(7)} E${newEast.toFixed(7)}`);
    cancelCrop();
  }

  // Load base image for crop
  const _img = new Image();
  _img.onload = () => { state.baseImage = _img; };
  _img.src = "/assets/campus-base-map.png";

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

  const tokenInput = $("#adminToken");
  if (!tokenInput.value) {
    tokenInput.value = localStorage.getItem("lian.adminToken") || "";
  }
  initMap();
  loadData().catch((error) => setStatus(error.message, true));
})();
