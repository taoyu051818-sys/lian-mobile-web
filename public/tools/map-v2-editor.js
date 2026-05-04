(function () {
  const GAODE_TILE_URL = "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";
  const NODEBB_URL = (window.LIAN_NODEBB_URL || "http://149.104.21.74:4567").replace(/\/$/, "");
  const LIAN_API_BASE = (typeof window !== "undefined" && window.LIAN_API_BASE_URL) || "";
  const DEFAULT_CENTER = [18.3935, 110.0159];
  const BOUNDS = {
    south: 18.37107,
    west: 109.98464,
    north: 18.41730,
    east: 110.04775
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
    building: "#7c3aed",
    environment: "#059669",
    entrance: "#f59e0b",
    icon: "#f59e0b",
    post: "#111827"
  };

  const DEFAULT_LAYERS_FALLBACK = {
    version: 1, coordSystem: "gcj02",
    center: { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] }, zoom: 16,
    areas: [], routes: [], roads: [], junctions: [], buildings: [], environmentElements: [], buildingGroups: [], assets: []
  };

  const ROAD_TYPE_STYLES = {
    main_road: { color: "#6b7280", weight: 6, dashArray: "" },
    pedestrian_path: { color: "#9ca3af", weight: 3, dashArray: "6 4" },
    shuttle_route: { color: "#2563eb", weight: 4, dashArray: "" },
    service_path: { color: "#a3a3a3", weight: 2, dashArray: "4 6" }
  };

  const state = {
    map: null,
    mode: "browse",
    drawSubType: "area",
    pointSubType: "location",
    roadSubType: "main_road",
    data: null,
    posts: [],
    draftPoints: [],
    layers: {},
    grassOverlay: null,
    tileLayer: null,
    selectedId: null,
    selectedTarget: null,
    selectedCollection: null,
    vertexMarkers: null,
    cropPoints: [],
    cropRect: null,
    baseImage: null,
    roadDrawing: false,
    roadPreviewLine: null,
    showSmoothCurves: false,
    assetUrl: "",
    assetKind: "building_icon",
    assetAspectRatio: 1,
    assetLastSize: { width: 64, height: 64 },
    assetSizeSyncing: false,
    placingAsset: false,
    roadPreview: null,
    previewCanvas: null,
    previewCtx: null,
    previewData: null,
    previewOpacity: 0.7,
    previewLineWidth: 1.5,
    previewShowLanes: true,
    previewShowRoads: false,
    previewShowJunctions: false,
    previewTx: 0,
    previewTy: 0,
    previewScale: 1,
    previewRotation: 0,
    previewDragging: false,
    previewDragStart: null,
    previewAlignMode: false
  };

  const $ = (selector, root = document) => root.querySelector(selector);

  function escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function simplifyPoints(points, tolerance) {
    if (points.length <= 2) return points;
    let maxDist = 0;
    let maxIdx = 0;
    const first = points[0];
    const last = points[points.length - 1];
    for (let i = 1; i < points.length - 1; i++) {
      const d = perpendicularDistance(points[i], first, last);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }
    if (maxDist > tolerance) {
      const left = simplifyPoints(points.slice(0, maxIdx + 1), tolerance);
      const right = simplifyPoints(points.slice(maxIdx), tolerance);
      return left.slice(0, -1).concat(right);
    }
    return [first, last];
  }

  function perpendicularDistance(pt, lineStart, lineEnd) {
    const dx = lineEnd.lat - lineStart.lat;
    const dy = lineEnd.lng - lineStart.lng;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(pt.lat - lineStart.lat, pt.lng - lineStart.lng);
    let t = ((pt.lat - lineStart.lat) * dx + (pt.lng - lineStart.lng) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(pt.lat - (lineStart.lat + t * dx), pt.lng - (lineStart.lng + t * dy));
  }

  // --- Junction geometry utilities ---
  const SNAP_DISTANCE_METERS = 5;
  const JUNCTION_MERGE_METERS = 1;

  function haversineDist(a, b) {
    const metersPerDeg = 111320;
    const dLat = (a.lat - b.lat) * metersPerDeg;
    const dLng = (a.lng - b.lng) * metersPerDeg * Math.cos(a.lat * Math.PI / 180);
    return Math.hypot(dLat, dLng);
  }

  function segmentIntersection(p1, p2, p3, p4) {
    const d1x = p2.lat - p1.lat, d1y = p2.lng - p1.lng;
    const d2x = p4.lat - p3.lat, d2y = p4.lng - p3.lng;
    const denom = d1x * d2y - d1y * d2x;
    if (Math.abs(denom) < 1e-12) return null;
    const dx = p3.lat - p1.lat, dy = p3.lng - p1.lng;
    const t = (dx * d2y - dy * d2x) / denom;
    const u = (dx * d1y - dy * d1x) / denom;
    if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
    return { lat: p1.lat + t * d1x, lng: p1.lng + t * d1y, t: Math.max(0, Math.min(1, t)), u: Math.max(0, Math.min(1, u)) };
  }

  function closestPointOnSegment(p, a, b) {
    const dx = b.lat - a.lat, dy = b.lng - a.lng;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { lat: a.lat, lng: a.lng, distance: haversineDist(p, a), t: 0 };
    let t = ((p.lat - a.lat) * dx + (p.lng - a.lng) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const proj = { lat: a.lat + t * dx, lng: a.lng + t * dy };
    return { lat: proj.lat, lng: proj.lng, distance: haversineDist(p, proj), t };
  }

  function findSnapTarget(p, roadPoints) {
    let best = null;
    for (let i = 0; i < roadPoints.length; i++) {
      const d = haversineDist(p, roadPoints[i]);
      if (d < SNAP_DISTANCE_METERS && (!best || d < best.distance)) {
        best = { lat: roadPoints[i].lat, lng: roadPoints[i].lng, pointIndex: i, segIndex: -1, distance: d };
      }
    }
    for (let i = 0; i < roadPoints.length - 1; i++) {
      const cp = closestPointOnSegment(p, roadPoints[i], roadPoints[i + 1]);
      if (cp.distance < SNAP_DISTANCE_METERS && (!best || cp.distance < best.distance)) {
        if (cp.t > 0.01 && cp.t < 0.99) {
          best = { lat: cp.lat, lng: cp.lng, pointIndex: -1, segIndex: i, distance: cp.distance };
        }
      }
    }
    return best;
  }

  function insertPointIntoRoad(road, pt, segIndex) {
    road.points.splice(segIndex + 1, 0, { lat: Number(pt.lat.toFixed(7)), lng: Number(pt.lng.toFixed(7)) });
    return segIndex + 1;
  }

  function generateJunctionId(position) {
    const lat = position.lat.toFixed(5).replace(".", "");
    const lng = position.lng.toFixed(5).replace(".", "");
    return `junction-${lat}-${lng}-${Date.now().toString(36)}`;
  }

  function classifyJunction(roadCount) {
    if (roadCount <= 1) return "endpoint";
    if (roadCount <= 3) return "T";
    return "cross";
  }

  // --- Curve smoothing and classification ---

  function smoothPolylineChaikin(points, iterations = 2) {
    if (points.length < 3) return points.map((p) => [p.lat, p.lng]);
    let result = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const isJunctionA = i === 0 || i === points.length - 2;
      if (isJunctionA) result.push([a.lat, a.lng]);
      result.push([a.lat * 0.75 + b.lat * 0.25, a.lng * 0.75 + b.lng * 0.25]);
      result.push([a.lat * 0.25 + b.lat * 0.75, a.lng * 0.25 + b.lng * 0.75]);
    }
    result.push([points[points.length - 1].lat, points[points.length - 1].lng]);
    for (let iter = 1; iter < iterations; iter++) {
      const next = [];
      for (let i = 0; i < result.length - 1; i++) {
        const a = result[i], b = result[i + 1];
        const isFirst = i === 0, isLast = i === result.length - 2;
        if (isFirst) next.push(a);
        next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
        next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
        if (isLast) next.push(b);
      }
      result = next;
    }
    return result;
  }

  function calculateBendAngles(points) {
    const angles = [];
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1], cur = points[i], next = points[i + 1];
      const dLat1 = cur.lat - prev.lat, dLng1 = cur.lng - prev.lng;
      const dLat2 = next.lat - cur.lat, dLng2 = next.lng - cur.lng;
      const len1 = Math.hypot(dLat1, dLng1), len2 = Math.hypot(dLat2, dLng2);
      if (len1 < 1e-10 || len2 < 1e-10) continue;
      const dot = (dLat1 * dLat2 + dLng1 * dLng2) / (len1 * len2);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
      const deflection = 180 - angle;
      angles.push({ index: i, angle, deflection });
    }
    return angles;
  }

  const SHARP_BEND_THRESHOLD = 30;

  function classifyRoadCurvature(points) {
    if (points.length < 3) return "";
    const bends = calculateBendAngles(points);
    if (bends.length === 0) return "";
    let sharpCount = 0;
    for (const b of bends) {
      if (b.deflection > SHARP_BEND_THRESHOLD) sharpCount++;
    }
    const ratio = sharpCount / bends.length;
    return ratio > 0.3 ? "corner" : "smooth";
  }

  function autoClassifyCurves() {
    const layers = parseJson("#layersJson", DEFAULT_LAYERS_FALLBACK);
    const roads = layers.roads || [];
    let updated = 0;
    for (const road of roads) {
      if (road.status === "hidden") continue;
      if ((road.points || []).length < 3) continue;
      if (road.renderHint && road.renderHint.curveStyle) continue;
      const style = classifyRoadCurvature(road.points);
      if (!style) continue;
      road.renderHint = road.renderHint || {};
      road.renderHint.curveStyle = style;
      updated++;
    }
    $("#layersJson").value = JSON.stringify(layers, null, 2);
    renderData();
    setStatus(`Curve classification complete: ${updated} roads updated with curveHint.`);
  }

  // --- Junction detection pipeline ---
  function upsertJunction(position, roadA, idxA, roadB, idxB, junctions) {
    for (const jx of junctions) {
      if (haversineDist(position, jx.position) < JUNCTION_MERGE_METERS) {
        if (!jx.connectedRoadIds.includes(roadA.id)) {
          jx.connectedRoadIds.push(roadA.id);
          jx.connectionRefs.push({ roadId: roadA.id, pointIndex: idxA });
        }
        if (!jx.connectedRoadIds.includes(roadB.id)) {
          jx.connectedRoadIds.push(roadB.id);
          jx.connectionRefs.push({ roadId: roadB.id, pointIndex: idxB });
        }
        jx.type = classifyJunction(jx.connectedRoadIds.length);
        return jx;
      }
    }
    const jx = {
      id: generateJunctionId(position),
      type: classifyJunction(2),
      position: { lat: Number(position.lat.toFixed(7)), lng: Number(position.lng.toFixed(7)) },
      connectedRoadIds: [roadA.id, roadB.id],
      connectionRefs: [
        { roadId: roadA.id, pointIndex: idxA },
        { roadId: roadB.id, pointIndex: idxB }
      ],
      status: "active"
    };
    junctions.push(jx);
    return jx;
  }

  function detectJunctions(roads, existingJunctions) {
    const junctions = existingJunctions.map((j) => ({
      ...j,
      connectedRoadIds: [...j.connectedRoadIds],
      connectionRefs: j.connectionRefs.map((r) => ({ ...r }))
    }));
    const modifiedRoadIds = new Set();
    const activeRoads = roads.filter((r) => r.status !== "hidden" && !r.noSnap && r.points.length >= 2);

    // Phase A: endpoint-to-endpoint snap
    for (let i = 0; i < activeRoads.length; i++) {
      for (let j = i + 1; j < activeRoads.length; j++) {
        const a = activeRoads[i], b = activeRoads[j];
        const ends = [
          [0, 0, a.points[0], b.points[0]],
          [0, b.points.length - 1, a.points[0], b.points[b.points.length - 1]],
          [a.points.length - 1, 0, a.points[a.points.length - 1], b.points[0]],
          [a.points.length - 1, b.points.length - 1, a.points[a.points.length - 1], b.points[b.points.length - 1]]
        ];
        for (const [ai, bi, pa, pb] of ends) {
          const d = haversineDist(pa, pb);
          if (d > 0.1 && d < SNAP_DISTANCE_METERS) {
            const mid = { lat: (pa.lat + pb.lat) / 2, lng: (pa.lng + pb.lng) / 2 };
            a.points[ai] = { lat: Number(mid.lat.toFixed(7)), lng: Number(mid.lng.toFixed(7)) };
            b.points[bi] = { lat: Number(mid.lat.toFixed(7)), lng: Number(mid.lng.toFixed(7)) };
            upsertJunction(mid, a, ai, b, bi, junctions);
            modifiedRoadIds.add(a.id);
            modifiedRoadIds.add(b.id);
          }
        }
      }
    }

    // Phase B: endpoint-to-segment snap
    for (const road of activeRoads) {
      for (const endIdx of [0, road.points.length - 1]) {
        const ep = road.points[endIdx];
        for (const other of activeRoads) {
          if (other.id === road.id) continue;
          if (other.noSnap) continue;
          const snap = findSnapTarget(ep, other.points);
          if (snap && snap.segIndex >= 0 && snap.distance > 0.1) {
            const insertIdx = insertPointIntoRoad(other, snap, snap.segIndex);
            road.points[endIdx] = { lat: Number(snap.lat.toFixed(7)), lng: Number(snap.lng.toFixed(7)) };
            upsertJunction(snap, road, endIdx, other, insertIdx, junctions);
            modifiedRoadIds.add(road.id);
            modifiedRoadIds.add(other.id);
          }
        }
      }
    }

    // Phase C: segment-segment crossings
    for (let i = 0; i < activeRoads.length; i++) {
      for (let j = i + 1; j < activeRoads.length; j++) {
        const a = activeRoads[i], b = activeRoads[j];
        const intersections = [];
        for (let ai = 0; ai < a.points.length - 1; ai++) {
          for (let bi = 0; bi < b.points.length - 1; bi++) {
            const cross = segmentIntersection(a.points[ai], a.points[ai + 1], b.points[bi], b.points[bi + 1]);
            if (!cross) continue;
            const pt = { lat: cross.lat, lng: cross.lng };
            const nearA = haversineDist(pt, a.points[ai]) < 1 || haversineDist(pt, a.points[ai + 1]) < 1;
            const nearB = haversineDist(pt, b.points[bi]) < 1 || haversineDist(pt, b.points[bi + 1]) < 1;
            if (!nearA && !nearB) {
              intersections.push({ pt, ai, bi });
            }
          }
        }
        intersections.sort((x, y) => y.ai - x.ai || y.bi - x.bi);
        for (const { pt, ai, bi } of intersections) {
          const idxA = insertPointIntoRoad(a, pt, ai);
          const idxB = insertPointIntoRoad(b, pt, bi);
          upsertJunction(pt, a, idxA, b, idxB, junctions);
          modifiedRoadIds.add(a.id);
          modifiedRoadIds.add(b.id);
        }
      }
    }

    // Update junctionIds on modified roads
    for (const road of roads) {
      if (!modifiedRoadIds.has(road.id)) continue;
      road.junctionIds = junctions
        .filter((jx) => jx.connectedRoadIds.includes(road.id))
        .map((jx) => jx.id);
    }

    return { junctions, modifiedRoadIds: [...modifiedRoadIds] };
  }

  function recalculateSegments(road, junctions) {
    const refs = [];
    for (const jx of junctions) {
      const ref = jx.connectionRefs.find((r) => r.roadId === road.id);
      if (ref) refs.push({ junctionId: jx.id, pointIndex: ref.pointIndex });
    }
    refs.sort((a, b) => a.pointIndex - b.pointIndex);
    road.segments = [];
    let prev = 0;
    let prevJunctionId = null;
    for (const ref of refs) {
      if (ref.pointIndex > prev) {
        road.segments.push({
          id: `${road.id}-seg${road.segments.length}`,
          roadId: road.id,
          fromJunctionId: prevJunctionId,
          toJunctionId: ref.junctionId,
          pointRange: [prev, ref.pointIndex],
          type: road.type
        });
      }
      prev = ref.pointIndex;
      prevJunctionId = ref.junctionId;
    }
    if (prev < road.points.length - 1) {
      road.segments.push({
        id: `${road.id}-seg${road.segments.length}`,
        roadId: road.id,
        fromJunctionId: prevJunctionId,
        toJunctionId: null,
        pointRange: [prev, road.points.length - 1],
        type: road.type
      });
    }
  }

  function runJunctionDetection() {
    const layers = parseJson("#layersJson", DEFAULT_LAYERS_FALLBACK);
    const roads = layers.roads || [];
    const existing = layers.junctions || [];
    const { junctions, modifiedRoadIds } = detectJunctions(roads, existing);
    for (const road of roads) {
      recalculateSegments(road, junctions);
    }
    layers.junctions = junctions;
    $("#layersJson").value = JSON.stringify(layers, null, 2);
    renderData();
    setStatus(`Junction detection complete: ${junctions.length} junctions, ${modifiedRoadIds.length} roads affected.`);
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

  function positiveNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function selectedAssetFrom(layers) {
    if (state.selectedTarget !== "assets" || !state.selectedId) return null;
    return (layers.assets || []).find((item) => item.id === state.selectedId) || null;
  }

  function summarizeSave(locations, layers) {
    const parts = [
      `Locations: ${(locations.items || []).length}`,
      `Areas: ${(layers.areas || []).length}`,
      `Routes: ${(layers.routes || []).length}`,
      `Roads: ${(layers.roads || []).length}`,
      `Junctions: ${(layers.junctions || []).length}`,
      `Buildings: ${(layers.buildings || []).length}`,
      `Assets: ${(layers.assets || []).length}`
    ];
    const asset = selectedAssetFrom(layers);
    if (asset) {
      const size = Array.isArray(asset.size) ? asset.size : [64, 64];
      const anchor = Array.isArray(asset.anchor) ? asset.anchor : [size[0] / 2, size[1]];
      parts.push(
        "",
        `Selected asset: ${asset.id}`,
        `Kind: ${asset.kind || "other"}`,
        `Status: ${asset.status || "active"}`,
        `Size: ${size[0]} x ${size[1]}`,
        `Anchor: ${anchor[0]} x ${anchor[1]}`,
        `Position: ${asset.position?.lat ?? ""}, ${asset.position?.lng ?? ""}`
      );
    }
    return parts.join("\n");
  }

  function syncAssetSizeRatio(changedId) {
    if (state.assetSizeSyncing) return;
    if (state.selectedTarget !== "assets") return;
    const widthInput = $("#propAssetWidth");
    const heightInput = $("#propAssetHeight");
    if (!widthInput || !heightInput) return;

    const ratio = positiveNumber(state.assetAspectRatio, 1);
    const previous = state.assetLastSize || { width: 64, height: 64 };
    const next = {
      width: positiveNumber(widthInput.value, previous.width || 64),
      height: positiveNumber(heightInput.value, previous.height || 64)
    };

    if (changedId === "propAssetWidth") {
      next.height = Math.max(1, Math.round(next.width / ratio));
    } else if (changedId === "propAssetHeight") {
      next.width = Math.max(1, Math.round(next.height * ratio));
    } else {
      return;
    }

    const scaleX = previous.width ? next.width / previous.width : 1;
    const scaleY = previous.height ? next.height / previous.height : 1;
    const anchorX = $("#propAssetAnchorX");
    const anchorY = $("#propAssetAnchorY");

    state.assetSizeSyncing = true;
    widthInput.value = String(next.width);
    heightInput.value = String(next.height);
    if (anchorX) anchorX.value = String(Math.round(positiveNumber(anchorX.value, previous.width / 2) * scaleX));
    if (anchorY) anchorY.value = String(Math.round(positiveNumber(anchorY.value, previous.height) * scaleY));
    state.assetLastSize = next;
    state.assetSizeSyncing = false;
  }

  function getToken() {
    return $("#adminToken")?.value?.trim() || localStorage.getItem("lian.adminToken") || "";
  }

  async function api(path, options = {}) {
    const url = path.startsWith("/") ? `${LIAN_API_BASE}${path}` : path;
    const headers = { ...(options.headers || {}) };
    const token = getToken();
    if (token) headers["x-admin-token"] = token;
    const response = await fetch(url, { credentials: "include", ...options, headers });
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

  function assetIcon(asset) {
    const size = Array.isArray(asset.size) ? asset.size : [64, 64];
    const anchor = Array.isArray(asset.anchor) ? asset.anchor : [size[0] / 2, size[1]];
    const rotation = Number(asset.rotation || 0);
    const opacity = Math.max(0, Math.min(1, Number(asset.opacity ?? 1)));
    const statusClass = asset.status === "hidden" ? " is-hidden" : "";
    return L.divIcon({
      className: `map-v2-asset-icon map-v2-asset-${escapeHtml(asset.kind || "other")}${statusClass}`,
      iconSize: size,
      iconAnchor: anchor,
      popupAnchor: [0, -Math.round(size[1] * 0.65)],
      html: `
        <img
          class="map-v2-asset-image"
          src="${escapeHtml(displayImageUrl(asset.url))}"
          style="opacity:${opacity};transform:rotate(${rotation}deg)"
          alt=""
        >
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
    state.selectedCollection = null;
    $("#selectionInfo").classList.remove("active");
    $("#draftId").value = "";
    $("#draftName").value = "";
    $("#draftType").value = "";
    showPropertyPanel(null);
    removeVertexMarkers();
  }

  function showPropertyPanel(type) {
    document.querySelectorAll(".prop-section").forEach((el) => {
      el.classList.toggle("active", el.dataset.for === type);
    });
  }

  function removeVertexMarkers() {
    if (state.vertexMarkers) {
      state.vertexMarkers.remove();
      state.vertexMarkers = null;
    }
  }

  function showVertexMarkers(points, onUpdate) {
    removeVertexMarkers();
    if (!points || points.length < 2) return;
    state.vertexMarkers = L.layerGroup().addTo(state.map);
    for (let i = 0; i < points.length; i++) {
      const marker = L.circleMarker([points[i].lat, points[i].lng], {
        radius: 6,
        color: "#2563eb",
        fillColor: "#fff",
        fillOpacity: 1,
        weight: 2,
        draggable: true
      });
      const idx = i;
      marker.on("mousedown", () => {
        state.map.dragging.disable();
        const onMove = (e) => marker.setLatLng(e.latlng);
        const onUp = (e) => {
          state.map.off("mousemove", onMove);
          state.map.off("mouseup", onUp);
          state.map.dragging.enable();
          const ll = e.latlng || marker.getLatLng();
          if (!inBounds(ll)) {
            setStatus("顶点超出范围", true);
            marker.setLatLng([points[idx].lat, points[idx].lng]);
            return;
          }
          points[idx].lat = Number(ll.lat.toFixed(7));
          points[idx].lng = Number(ll.lng.toFixed(7));
          marker.setLatLng([points[idx].lat, points[idx].lng]);
          if (onUpdate) onUpdate();
        };
        state.map.on("mousemove", onMove);
        state.map.on("mouseup", onUp);
      });
      marker.addTo(state.vertexMarkers);
    }
  }

  function selectItem(item, target = "locations") {
    state.selectedId = item.id || null;
    state.selectedTarget = target;
    state.selectedCollection = target;
    $("#draftId").value = item.id || "";
    $("#draftName").value = item.name || "";
    $("#draftType").value = item.type || "";

    // Show correct property panel
    let panelType = target === "locations" ? "location" : target;
    if (target === "buildings") panelType = "building";
    if (target === "environmentElements") panelType = "environment";
    if (target === "roads") panelType = "road";
    if (target === "junctions") panelType = "junction";
    if (target === "assets") panelType = "asset";
    showPropertyPanel(panelType);

    // Populate type-specific fields
    if (target === "locations") {
      $("#propIconUrl").value = item.icon?.url || "";
      $("#propAlwaysShow").value = item.card?.alwaysShow ? "true" : "false";
      $("#propSubtitle").value = item.card?.subtitle || item.card?.tag || "";
    } else if (target === "buildings") {
      $("#propBldgIconUrl").value = item.icon?.url || "";
      $("#propClickAction").value = item.clickAction || "open_floor_plan";
      $("#propFloorPlanIds").value = (item.floorPlanIds || []).join(", ");
      $("#propRelatedLocationIds").value = (item.relatedLocationIds || []).join(", ");
      $("#propBldgStatus").value = item.status || "active";
      $("#propEntrances").value = JSON.stringify(item.entrances || [], null, 2);
    } else if (target === "environmentElements") {
      $("#propEnvType").value = item.type || "other";
      $("#propEnvShape").value = item.shape || "polygon";
      $("#propEnvFill").value = item.style?.fill || "#059669";
      $("#propEnvOpacity").value = item.style?.opacity ?? 0.5;
      $("#propRenderHint").value = item.renderHint || "";
    } else if (target === "areas") {
      $("#propStrokeColor").value = item.style?.strokeColor || item.style?.color || "#2563eb";
      $("#propFillColor").value = item.style?.fillColor || "#2563eb";
      $("#propWeight").value = item.style?.weight || 3;
      $("#propAreaFillOpacity").value = item.style?.fillOpacity ?? 0.08;
    } else if (target === "routes") {
      $("#propRouteColor").value = item.style?.color || "#2563eb";
      $("#propRouteWeight").value = item.style?.weight || 4;
      $("#propDashArray").value = item.style?.dashArray || "";
    } else if (target === "roads") {
      $("#propRoadType").value = item.type || "main_road";
      $("#propRoadColor").value = item.style?.color || "#6b7280";
      $("#propRoadWeight").value = item.style?.weight || 6;
      $("#propRoadDashArray").value = item.style?.dashArray || "";
      $("#propRoadSurface").value = item.renderHint?.surface || "";
      $("#propRoadCurveStyle").value = item.renderHint?.curveStyle || "";
      $("#propRoadStatus").value = item.status || "active";
      $("#propRoadPointCount").textContent = (item.points || []).length;
      if ($("#propRoadNoSnap")) $("#propRoadNoSnap").value = item.noSnap ? "true" : "false";
      if ($("#propRoadCurveHint")) $("#propRoadCurveHint").textContent = item.renderHint?.curveStyle || "-";
      if ($("#propRoadRouteRef")) $("#propRoadRouteRef").value = item.routeRef || "";
      const routeRefRow = $("#propRoadRouteRef")?.closest("label");
      if (routeRefRow) routeRefRow.style.display = item.type === "shuttle_route" ? "" : "none";
    } else if (target === "junctions") {
      if ($("#propJxType")) $("#propJxType").value = item.type || "cross";
      if ($("#propJxStatus")) $("#propJxStatus").value = item.status || "active";
      if ($("#propJxRoadCount")) $("#propJxRoadCount").textContent = (item.connectedRoadIds || []).length;
      if ($("#propJxLat")) $("#propJxLat").textContent = item.position?.lat?.toFixed(7) || "";
      if ($("#propJxLng")) $("#propJxLng").textContent = item.position?.lng?.toFixed(7) || "";
      if ($("#propJxRoads")) $("#propJxRoads").value = (item.connectionRefs || []).map((r) => `${r.roadId} [${r.pointIndex}]`).join("\n");
      } else if (target === "assets") {
        const assetSize = item.size || [64, 64];
        const assetWidth = positiveNumber(assetSize[0], 64);
        const assetHeight = positiveNumber(assetSize[1], 64);
        state.assetAspectRatio = assetWidth / assetHeight;
        state.assetLastSize = { width: assetWidth, height: assetHeight };
        if ($("#propAssetUrl")) $("#propAssetUrl").value = item.url || "";
        if ($("#propAssetKind")) $("#propAssetKind").value = item.kind || "other";
        if ($("#propAssetWidth")) $("#propAssetWidth").value = assetWidth;
        if ($("#propAssetHeight")) $("#propAssetHeight").value = assetHeight;
      if ($("#propAssetAnchorX")) $("#propAssetAnchorX").value = (item.anchor || [32, 64])[0];
      if ($("#propAssetAnchorY")) $("#propAssetAnchorY").value = (item.anchor || [32, 64])[1];
      if ($("#propAssetRotation")) $("#propAssetRotation").value = item.rotation || 0;
      if ($("#propAssetOpacity")) $("#propAssetOpacity").value = item.opacity ?? 1;
      if ($("#propAssetClickBehavior")) $("#propAssetClickBehavior").value = item.clickBehavior || "none";
      if ($("#propAssetBoundType")) $("#propAssetBoundType").value = item.boundObjectType || "";
      if ($("#propAssetBoundId")) $("#propAssetBoundId").value = item.boundObjectId || "";
      if ($("#propAssetStatus")) $("#propAssetStatus").value = item.status || "active";
    }

    // Show vertex markers for polygon types and roads
    if (target === "areas" || target === "buildings" || target === "environmentElements" || target === "roads") {
      const pts = item.points || item.polygon;
      if (pts) showVertexMarkers(pts, () => {
        const layers = parseJson("#layersJson", DEFAULT_LAYERS_FALLBACK);
        const arr = layers[target] || [];
        const idx = arr.findIndex((e) => e.id === item.id);
        if (idx >= 0) {
          if (target === "buildings") arr[idx].polygon = pts;
          else arr[idx].points = pts;
          $("#layersJson").value = JSON.stringify(layers, null, 2);
          renderData();
        }
      });
    }

    // Show selection panel
    const panel = $("#selectionInfo");
    panel.classList.add("active");
    $("#selName").textContent = item.name || item.id || "-";
    const meta = [];
    if (item.type) meta.push(item.type);
    if (item.lat) meta.push(`${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`);
    if (target === "areas" || target === "environmentElements") meta.push(`${(item.points || []).length} points`);
    if (target === "routes") meta.push(`${(item.points || []).length} points`);
    if (target === "roads") meta.push(`${(item.points || []).length} points / ${item.type}`);
    if (target === "junctions") meta.push(`${item.type} / ${(item.connectedRoadIds || []).length} roads`);
    if (target === "assets") meta.push(`${item.kind} / ${item.clickBehavior || "none"}`);
    if (target === "buildings") meta.push(`${(item.polygon || []).length} vertices, ${(item.entrances || []).length} entrances`);
    $("#selMeta").textContent = meta.join(" / ");
    setStatus(`Selected: ${item.name || item.id}`);
  }

  function deleteSelected() {
    const id = state.selectedId;
    const target = state.selectedTarget;
    if (!id) return setStatus("Select an item first.", true);
    if (!confirm(`Delete "${id}"?`)) return;
    if (target === "locations") {
      const locations = parseJson("#locationsJson", { version: 1, coordSystem: "gcj02", items: [] });
      locations.items = (locations.items || []).filter((item) => item.id !== id);
      $("#locationsJson").value = JSON.stringify(locations, null, 2);
    } else {
      const layers = parseJson("#layersJson", DEFAULT_LAYERS_FALLBACK);
      layers[target] = (layers[target] || []).filter((item) => item.id !== id);
      if (target === "junctions") {
        for (const road of layers.roads || []) {
          road.junctionIds = (road.junctionIds || []).filter((jid) => jid !== id);
          road.segments = (road.segments || []).filter((s) => s.fromJunctionId !== id && s.toJunctionId !== id);
        }
      }
      $("#layersJson").value = JSON.stringify(layers, null, 2);
    }
    clearSelection();
    renderData();
    setStatus(`Deleted ${id}. Click save to submit changes.`);
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
      roads: L.layerGroup().addTo(state.map),
      junctions: L.layerGroup().addTo(state.map),
      buildings: L.layerGroup().addTo(state.map),
      environmentElements: L.layerGroup().addTo(state.map),
      locations: L.layerGroup().addTo(state.map),
      posts: L.layerGroup().addTo(state.map),
      assets: L.layerGroup().addTo(state.map),
      draft: L.layerGroup().addTo(state.map),
      roadPreview: state.roadPreview || L.layerGroup().addTo(state.map)
    };
    const locations = parseJson("#locationsJson", { items: [] });
    const layers = parseJson("#layersJson", DEFAULT_LAYERS_FALLBACK);
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
    const allRoads = layers.roads || [];
    for (const road of allRoads) {
      const roadStyle = {
        color: road.style?.color || "#6b7280",
        weight: Number(road.style?.weight || 6),
        dashArray: road.style?.dashArray || ""
      };
      let points = road.points || [];
      if (road.type === "shuttle_route" && road.routeRef) {
        const refRoad = allRoads.find((r) => r.id === road.routeRef && r.id !== road.id);
        if (refRoad && refRoad.points && refRoad.points.length >= 2) points = refRoad.points;
      }
      if (points.length < 2) continue;
      const line = L.polyline(points.map((p) => [p.lat, p.lng]), roadStyle)
        .bindTooltip(`${road.name || road.id} (${road.type})`);
      line.on("click", () => selectItem(road, "roads"));
      line.addTo(state.layers.roads);
      if (state.showSmoothCurves && points.length >= 3) {
        const smoothPts = smoothPolylineChaikin(points, 2);
        L.polyline(smoothPts, {
          color: roadStyle.color,
          weight: roadStyle.weight,
          opacity: 0.4,
          dashArray: "4 3",
          interactive: false
        }).addTo(state.layers.roads);
      }
    }
    for (const jx of layers.junctions || []) {
      if (!Number.isFinite(jx.position?.lat) || !Number.isFinite(jx.position?.lng)) continue;
      const jxType = jx.type || "cross";
      let color = "#ef4444", size = 14, shape = "square";
      if (jxType === "endpoint") { color = "#f59e0b"; size = 12; shape = "circle"; }
      else if (jxType === "T") { color = "#3b82f6"; size = 14; shape = "diamond"; }
      const border = `2px solid ${color}`;
      const borderRadius = shape === "circle" ? "50%" : shape === "diamond" ? "3px" : "2px";
      const transform = shape === "diamond" ? "rotate(45deg)" : "";
      const marker = L.marker([jx.position.lat, jx.position.lng], {
        icon: L.divIcon({
          className: "map-v2-junction-icon",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          html: `<div style="width:${size}px;height:${size}px;background:#fff;border:${border};border-radius:${borderRadius};transform:${transform};box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`
        })
      }).bindTooltip(`${jx.id} (${jxType}) / ${(jx.connectedRoadIds || []).length} roads`);
      marker.on("click", () => selectItem(jx, "junctions"));
      marker.addTo(state.layers.junctions);
    }
    for (const bldg of layers.buildings || []) {
      const poly = L.polygon((bldg.polygon || []).map((p) => [p.lat, p.lng]), {
        color: "#7c3aed",
        fillColor: "#7c3aed",
        fillOpacity: 0.12,
        weight: 2
      }).bindTooltip(bldg.name || bldg.id || "building");
      poly.on("click", () => selectItem(bldg, "buildings"));
      poly.addTo(state.layers.buildings);
      for (const ent of bldg.entrances || []) {
        if (!Number.isFinite(ent.lat) || !Number.isFinite(ent.lng)) continue;
        L.circleMarker([ent.lat, ent.lng], {
          radius: 5,
          color: "#f59e0b",
          fillColor: "#f59e0b",
          fillOpacity: 0.9
        }).bindTooltip(ent.name || "entrance").addTo(state.layers.buildings);
      }
    }
    for (const env of layers.environmentElements || []) {
      if (env.shape === "point" && env.points?.length >= 1) {
        L.circleMarker([env.points[0].lat, env.points[0].lng], {
          radius: 7,
          color: env.style?.fill || "#059669",
          fillColor: env.style?.fill || "#059669",
          fillOpacity: Number(env.style?.opacity ?? 0.5)
        }).bindTooltip(env.name || env.id).on("click", () => selectItem(env, "environmentElements")).addTo(state.layers.environmentElements);
      } else if ((env.points || []).length >= 3) {
        L.polygon(env.points.map((p) => [p.lat, p.lng]), {
          color: env.style?.fill || "#059669",
          fillColor: env.style?.fill || "#059669",
          fillOpacity: Number(env.style?.opacity ?? 0.5),
          weight: 1
        }).bindTooltip(env.name || env.id).on("click", () => selectItem(env, "environmentElements")).addTo(state.layers.environmentElements);
      }
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
          setStatus(`${item.name || item.id} is outside bounds.`, true);
          event.target.setLatLng([item.lat, item.lng]);
          return;
        }
        item.lat = Number(next.lat.toFixed(7));
        item.lng = Number(next.lng.toFixed(7));
        $("#locationsJson").value = JSON.stringify(locations, null, 2);
        setStatus("Location coordinates updated. Review JSON before saving.");
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
    for (const asset of layers.assets || []) {
      if (!Number.isFinite(asset.position?.lat) || !Number.isFinite(asset.position?.lng)) continue;
      if (!asset.url) continue;
      const marker = L.marker([asset.position.lat, asset.position.lng], {
        icon: assetIcon(asset),
        draggable: true,
        zIndexOffset: asset.zIndex || 0
      });
      marker.bindTooltip(`${asset.id} (${asset.kind}${asset.status === "hidden" ? ", hidden" : ", active"})`);
      marker.on("click", () => selectItem(asset, "assets"));
      marker.on("dragend", (event) => {
        const next = event.target.getLatLng();
        if (!inBounds(next)) {
          setStatus(`${asset.id} is outside bounds.`, true);
          event.target.setLatLng([asset.position.lat, asset.position.lng]);
          return;
        }
        const layers = parseJson("#layersJson", DEFAULT_LAYERS_FALLBACK);
        const arr = layers.assets || [];
        const idx = arr.findIndex((a) => a.id === asset.id);
        if (idx >= 0) {
          arr[idx].position = { lat: Number(next.lat.toFixed(7)), lng: Number(next.lng.toFixed(7)) };
          $("#layersJson").value = JSON.stringify(layers, null, 2);
          setStatus("Asset position updated.");
        }
      });
      marker.addTo(state.layers.assets);
    }
    renderPosts();
    renderBuildingGroupsList();
  }

  function renderDraft() {
    if (!state.layers.draft) return;
    state.layers.draft.clearLayers();
    for (const pt of state.draftPoints) {
      L.circleMarker([pt.lat, pt.lng], {
        radius: 5,
        color: "#dc2626",
        fillColor: "#dc2626",
        fillOpacity: 0.9
      }).addTo(state.layers.draft);
    }
    if (state.mode === "polygon" && state.draftPoints.length >= 2) {
      const subType = state.drawSubType;
      let color = "#dc2626";
      if (subType === "building") color = "#7c3aed";
      if (subType === "environment") color = "#059669";
      L.polygon(state.draftPoints.map((p) => [p.lat, p.lng]), {
        color,
        fillColor: color,
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
    if (state.mode === "road" && state.draftPoints.length >= 2) {
      const style = ROAD_TYPE_STYLES[state.roadSubType] || ROAD_TYPE_STYLES.main_road;
      L.polyline(state.draftPoints.map((p) => [p.lat, p.lng]), {
        color: style.color,
        weight: style.weight,
        dashArray: style.dashArray || "8 6"
      }).addTo(state.layers.draft);
    }
  }

  function setMode(mode) {
    state.mode = mode;
    state.draftPoints = [];
    state.cropPoints = [];
    state.roadDrawing = false;
    if (state.roadPreviewLine) { state.roadPreviewLine.remove(); state.roadPreviewLine = null; }
    if (state.cropRect) { state.cropRect.remove(); state.cropRect = null; }
    showCropUI(false);
    clearSelection();
    document.querySelectorAll("[data-editor-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.editorMode === mode);
    });
    // Show/hide sub-selectors
    const pointSub = $("#pointSubType");
    const polySub = $("#polygonSubType");
    const roadSub = $("#roadSubType");
    if (pointSub) pointSub.style.display = mode === "point" ? "flex" : "none";
    if (polySub) polySub.style.display = mode === "polygon" ? "flex" : "none";
    if (roadSub) roadSub.style.display = mode === "road" ? "flex" : "none";
    const placeSub = $("#placeSubType");
    if (placeSub) placeSub.style.display = mode === "place" ? "flex" : "none";
    // Toggle road draw cursor
    const stage = $("#mapEditorStage");
    if (stage) stage.classList.toggle("road-draw-mode", mode === "road");
    if (stage) stage.classList.toggle("place-mode", mode === "place");
    renderDraft();
    if (mode === "crop") {
      setStatus("Crop mode: click two map corners.");
    } else if (mode === "browse") {
      setStatus("Browse mode.");
    } else if (mode === "select") {
      setStatus("Select mode: click map objects to edit.");
    } else if (mode === "point") {
      setStatus(`Point mode (${state.pointSubType}): click map to place a point.`);
    } else if (mode === "polygon") {
      setStatus(`Polygon mode (${state.drawSubType}): click map to draw polygon.`);
    } else if (mode === "road") {
      setStatus(`Road mode (${state.roadSubType}): drag to draw road.`);
    } else if (mode === "place") {
      setStatus(`Asset mode (${state.assetKind}): click map to place asset.`);
    } else {
      setStatus("Click map to pick a point.");
    }
  }

  async function loadData() {
    const data = await api("/api/admin/map-v2");
    state.data = data;
    $("#locationsJson").value = JSON.stringify(data.locations || { version: 1, coordSystem: "gcj02", items: [] }, null, 2);
    $("#layersJson").value = JSON.stringify(data.layers || DEFAULT_LAYERS_FALLBACK, null, 2);
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
    setStatus("Loaded backend Map v2 data.");
  }

  function buildDraftItem() {
    const id = $("#draftId").value.trim() || `map-item-${Date.now()}`;
    const name = $("#draftName").value.trim() || id;
    const type = $("#draftType").value.trim();

    if (state.mode === "point") {
      if (state.draftPoints.length !== 1) throw new Error("Point mode needs exactly 1 point.");
      const pt = state.draftPoints[0];
      const sub = state.pointSubType;

      if (sub === "location") {
        const iconUrl = $("#propIconUrl")?.value?.trim() || "";
        const alwaysShow = $("#propAlwaysShow")?.value === "true";
        const subtitle = $("#propSubtitle")?.value?.trim() || "";
        return {
          target: "locations",
          value: {
            id, name, type: type || "place",
            aliases: [], lat: pt.lat, lng: pt.lng, coordSystem: "gcj02",
            legacyPoint: { x: null, y: null },
            icon: { url: iconUrl, size: [34, 34], anchor: [17, 34] },
            card: { title: name, subtitle, imageUrl: iconUrl, tag: type || "place", alwaysShow },
            status: "active"
          }
        };
      }
      if (sub === "entrance") {
        return {
          target: "buildings_entrance",
          value: {
            id, name, lat: pt.lat, lng: pt.lng,
            icon: { url: "", size: [20, 20], anchor: [10, 10], className: "" },
            clickAction: ""
          }
        };
      }
      if (sub === "icon") {
        return {
          target: "locations",
          value: {
            id, name, type: type || "icon",
            aliases: [], lat: pt.lat, lng: pt.lng, coordSystem: "gcj02",
            legacyPoint: { x: null, y: null },
            icon: { url: "", size: [34, 34], anchor: [17, 34] },
            card: { title: name, subtitle: "", imageUrl: "", tag: "icon", alwaysShow: false },
            status: "active"
          }
        };
      }
    }

    if (state.mode === "polygon") {
      if (state.draftPoints.length < 3) throw new Error("Polygon mode needs at least 3 points.");
      const sub = state.drawSubType;

      if (sub === "area") {
        return {
          target: "areas",
          value: {
            id, name, type: type || "area",
            points: state.draftPoints,
            style: { strokeColor: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.08 }
          }
        };
      }
      if (sub === "building") {
        return {
          target: "buildings",
          value: {
            id, name, type: type || "building",
            polygon: state.draftPoints,
            entrances: [],
            icon: { url: "", size: [34, 34], anchor: [17, 34], className: "" },
            clickAction: "open_floor_plan",
            floorPlanIds: [], relatedLocationIds: [],
            status: "active"
          }
        };
      }
      if (sub === "environment") {
        const fill = $("#propEnvFill")?.value || "#059669";
        const opacity = Number($("#propEnvOpacity")?.value ?? 0.5);
        const envType = $("#propEnvType")?.value || "other";
        const renderHint = $("#propRenderHint")?.value || "";
        return {
          target: "environmentElements",
          value: {
            id, name, type: envType, shape: "polygon",
            points: state.draftPoints,
            style: { fill, opacity },
            renderHint
          }
        };
      }
    }

    if (state.mode === "route") {
      if (state.draftPoints.length < 2) throw new Error("Route mode needs at least 2 points.");
      return {
        target: "routes",
        value: {
          id, name, type: type || "route",
          points: state.draftPoints,
          style: { color: "#2563eb", weight: 4, dashArray: "" }
        }
      };
    }
    if (state.mode === "road") {
      if (state.draftPoints.length < 2) throw new Error("Road mode needs at least 2 points.");
      const roadType = state.roadSubType;
      const defaultStyle = ROAD_TYPE_STYLES[roadType] || ROAD_TYPE_STYLES.main_road;
      return {
        target: "roads",
        value: {
          id, name, type: roadType,
          points: state.draftPoints,
          segments: [],
          junctionIds: [],
          style: {
            color: $("#propRoadColor")?.value?.trim() || defaultStyle.color,
            weight: Number($("#propRoadWeight")?.value || defaultStyle.weight),
            dashArray: $("#propRoadDashArray")?.value?.trim() || defaultStyle.dashArray
          },
          renderHint: {
            surface: $("#propRoadSurface")?.value || "",
            curveStyle: $("#propRoadCurveStyle")?.value || "",
            edgeStyle: ""
          },
          interactive: true,
          status: "active",
          source: "admin_drawn",
          updatedAt: new Date().toISOString()
        }
      };
    }
    throw new Error("Current mode does not support writing to JSON.");
  }

  function commitDraft() {
    try {
      const draft = buildDraftItem();
      if (draft.target === "locations") {
        const locations = parseJson("#locationsJson", { version: 1, coordSystem: "gcj02", items: [] });
        locations.items = (locations.items || []).filter((item) => item.id !== draft.value.id);
        locations.items.push(draft.value);
        $("#locationsJson").value = JSON.stringify(locations, null, 2);
      } else if (draft.target === "buildings_entrance") {
        // Attach entrance to the currently selected building
        const bldgId = state.selectedId;
        if (!bldgId || state.selectedTarget !== "buildings") throw new Error("Select a building before adding an entrance.");
        const layers = parseJson("#layersJson", DEFAULT_LAYERS_FALLBACK);
        const bldg = (layers.buildings || []).find((b) => b.id === bldgId);
        if (!bldg) throw new Error(`Building "${bldgId}" not found.`);
        bldg.entrances = bldg.entrances || [];
        bldg.entrances = bldg.entrances.filter((e) => e.id !== draft.value.id);
        bldg.entrances.push(draft.value);
        $("#layersJson").value = JSON.stringify(layers, null, 2);
      } else {
        const layers = parseJson("#layersJson", DEFAULT_LAYERS_FALLBACK);
        layers[draft.target] = (layers[draft.target] || []).filter((item) => item.id !== draft.value.id);
        layers[draft.target].push(draft.value);
        $("#layersJson").value = JSON.stringify(layers, null, 2);
      }
      state.draftPoints = [];
      renderData();
      renderDraft();
      if (draft.target === "roads") {
        runJunctionDetection();
      }
      setStatus("Written to JSON. Review and click save to submit.");
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
      const summary = summarizeSave(locations, layers);
      await loadData();
      setStatus("Saved to backend.");
      window.alert(`Map v2 saved.\n\n${summary}`);
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  async function setSelectedAssetUserVisibility(status) {
    if (state.selectedTarget !== "assets" || !state.selectedId) {
      return setStatus("Select an asset first.", true);
    }
    const layers = parseJson("#layersJson", DEFAULT_LAYERS_FALLBACK);
    const asset = (layers.assets || []).find((item) => item.id === state.selectedId);
    if (!asset) return setStatus(`Asset ${state.selectedId} not found.`, true);
    asset.status = status;
    asset.kind = asset.kind || "building_icon";
    asset.clickBehavior = asset.clickBehavior || "none";
    asset.opacity = Number.isFinite(Number(asset.opacity)) ? Number(asset.opacity) : 1;
    asset.zIndex = Number.isFinite(Number(asset.zIndex)) ? Number(asset.zIndex) : 40;
    $("#layersJson").value = JSON.stringify(layers, null, 2);
    if ($("#propAssetStatus")) $("#propAssetStatus").value = status;
    renderData();
    await saveData();
    setStatus(status === "active" ? `Asset ${asset.id} published to user side.` : `Asset ${asset.id} hidden from user side.`);
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
    // Road drawing engine: mousedown -> start, mousemove -> record, mouseup -> finish
    state.map.on("mousedown", (event) => {
      if (state.mode !== "road") return;
      if (!inBounds(event.latlng)) return;
      state.roadDrawing = true;
      state.draftPoints = [{
        lat: Number(event.latlng.lat.toFixed(7)),
        lng: Number(event.latlng.lng.toFixed(7))
      }];
      state.map.dragging.disable();
      if (state.roadPreviewLine) state.roadPreviewLine.remove();
      state.roadPreviewLine = L.polyline([event.latlng], {
        color: ROAD_TYPE_STYLES[state.roadSubType]?.color || "#6b7280",
        weight: ROAD_TYPE_STYLES[state.roadSubType]?.weight || 6,
        dashArray: "8 6",
        opacity: 0.7,
        className: "road-draw-preview"
      }).addTo(state.map);
      setStatus("Drag to draw road network.");
    });
    state.map.on("mousemove", (event) => {
      if (!state.roadDrawing || state.mode !== "road") return;
      const pt = { lat: Number(event.latlng.lat.toFixed(7)), lng: Number(event.latlng.lng.toFixed(7)) };
      const last = state.draftPoints[state.draftPoints.length - 1];
      const dist = Math.hypot(pt.lat - last.lat, pt.lng - last.lng);
      if (dist > 0.00005) {
        state.draftPoints.push(pt);
        if (state.roadPreviewLine) state.roadPreviewLine.addLatLng(event.latlng);
      }
    });
    state.map.on("mouseup", () => {
      if (!state.roadDrawing || state.mode !== "road") return;
      state.roadDrawing = false;
      state.map.dragging.enable();
      if (state.roadPreviewLine) { state.roadPreviewLine.remove(); state.roadPreviewLine = null; }
      if (state.draftPoints.length < 2) {
        state.draftPoints = [];
        setStatus("Road network needs at least 2 points.", true);
        return;
      }
      // Simplify points (tolerance ~2m in lat/lng degrees)
      state.draftPoints = simplifyPoints(state.draftPoints, 0.00002);
      renderDraft();
      setStatus(`Road drawing complete: ${state.draftPoints.length} points. Click write JSON and save.`);
    });

    state.map.on("click", (event) => {
      if (state.mode === "browse") return;
      if (state.mode === "road") return;
      if (state.mode === "crop") {
        state.cropPoints.push(event.latlng);
        if (state.cropPoints.length === 1) {
          setStatus("Click the second corner to finish crop area.");
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
          $("#cropRect").textContent = `像素: ${Math.round(pw)} x ${Math.round(ph)} | SW ${south.toFixed(5)}, ${west.toFixed(5)} -> NE ${north.toFixed(5)}, ${east.toFixed(5)}`;
          showCropUI(true);
          setStatus("Click save crop to download cropped image.");
          state.cropPoints = [];
        }
        return;
      }
      if (!inBounds(event.latlng)) {
        setStatus("Picked point is outside bounds.", true);
        return;
      }
      if (state.mode === "select") return;
      if (state.mode === "place") {
        const url = state.assetUrl;
        if (!url) { setStatus("Enter or upload an asset URL first.", true); return; }
        const id = `asset-${Date.now().toString(36)}`;
        const pt = { lat: Number(event.latlng.lat.toFixed(7)), lng: Number(event.latlng.lng.toFixed(7)) };
        const layers = parseJson("#layersJson", DEFAULT_LAYERS_FALLBACK);
        layers.assets = layers.assets || [];
        layers.assets.push({
          id, url, kind: state.assetKind,
          position: pt, size: [64, 64], anchor: [32, 64],
          rotation: 0, opacity: 1, zIndex: 40,
          boundObjectType: "", boundObjectId: "",
          clickBehavior: "none", alwaysShowCard: false, status: "active"
        });
        $("#layersJson").value = JSON.stringify(layers, null, 2);
        renderData();
        setStatus(`Asset ${id} placed. Drag to adjust position.`);
        return;
      }
      if (state.mode === "point") state.draftPoints = [];
      state.draftPoints.push({
        lat: Number(event.latlng.lat.toFixed(7)),
        lng: Number(event.latlng.lng.toFixed(7))
      });
      renderDraft();
      setStatus(`Picked ${state.draftPoints.length} points.`);
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

    // --- Road preview drag alignment (toggle align mode) ---
    state.map.getContainer().addEventListener('mousedown', (event) => {
      if (!state.previewAlignMode) return;
      if (!state.previewData || !state.previewCanvas) return;
      state.previewDragging = true;
      state.previewDragStart = { x: event.clientX, y: event.clientY, tx: state.previewTx, ty: state.previewTy };
      state.map.dragging.disable();
      state.map.getContainer().style.cursor = 'grabbing';
      if (state.previewCanvas) state.previewCanvas.style.cursor = 'grabbing';
      event.preventDefault();
    });

    window.addEventListener('mousemove', (event) => {
      if (!state.previewDragging || !state.previewDragStart) return;
      const zoom = state.map.getZoom();
      const center = state.map.getCenter();
      const cosLat = Math.cos(center.lat * Math.PI / 180);
      const mPerPx = 1 / (Math.pow(2, zoom) * 256 / 360 * 111320 * cosLat);
      const dxPx = event.clientX - state.previewDragStart.x;
      const dyPx = event.clientY - state.previewDragStart.y;
      state.previewTx = state.previewDragStart.tx + dxPx * mPerPx;
      state.previewTy = state.previewDragStart.ty - dyPx * mPerPx;
      const $tx = $("#previewTx"), $ty = $("#previewTy");
      if ($tx) $tx.value = state.previewTx.toFixed(4);
      if ($ty) $ty.value = state.previewTy.toFixed(4);
      renderPreviewCanvas();
      setStatus(`对齐偏移: X ${state.previewTx.toFixed(4)}m, Y ${state.previewTy.toFixed(4)}m`);
    });

    window.addEventListener('mouseup', () => {
      if (state.previewDragging) {
        state.previewDragging = false;
        state.previewDragStart = null;
        state.map.dragging.enable();
        updateAlignCursor();
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
      return setStatus("Draft points cleared.");
    }
    if (event.target.closest("[data-save]")) return saveData();
    if (event.target.closest("[data-delete-selected]")) return deleteSelected();
    if (event.target.closest("[data-publish-selected-asset]")) return setSelectedAssetUserVisibility("active");
    if (event.target.closest("[data-hide-selected-asset]")) return setSelectedAssetUserVisibility("hidden");
    const postBtn = event.target.closest("[data-map-v2-tid]");
    if (postBtn) {
      const tid = postBtn.dataset.mapV2Tid;
      window.open(`${NODEBB_URL}/topic/${tid}`, "_blank");
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("#locationsJson, #layersJson")) renderData();
  });

  // Property panel input -> JSON sync
  function syncPropertyToJSON() {
    const id = state.selectedId;
    const target = state.selectedCollection;
    if (!id || !target) return;
    if (target === "locations") {
      const locations = parseJson("#locationsJson", { version: 1, coordSystem: "gcj02", items: [] });
      const item = (locations.items || []).find((i) => i.id === id);
      if (!item) return;
      item.name = $("#draftName").value;
      item.type = $("#draftType").value;
      item.icon = item.icon || {};
      item.icon.url = $("#propIconUrl")?.value?.trim() || "";
      item.card = item.card || {};
      item.card.alwaysShow = $("#propAlwaysShow")?.value === "true";
      item.card.subtitle = $("#propSubtitle")?.value?.trim() || "";
      $("#locationsJson").value = JSON.stringify(locations, null, 2);
    } else {
      const layers = parseJson("#layersJson", DEFAULT_LAYERS_FALLBACK);
      const arr = layers[target] || [];
      const item = arr.find((i) => i.id === id);
      if (!item) return;
      item.name = $("#draftName").value;
      item.type = $("#draftType").value;
      if (target === "buildings") {
        item.icon = item.icon || {};
        item.icon.url = $("#propBldgIconUrl")?.value?.trim() || "";
        item.clickAction = $("#propClickAction")?.value || "open_floor_plan";
        item.floorPlanIds = ($("#propFloorPlanIds")?.value || "").split(",").map((s) => s.trim()).filter(Boolean);
        item.relatedLocationIds = ($("#propRelatedLocationIds")?.value || "").split(",").map((s) => s.trim()).filter(Boolean);
        item.status = $("#propBldgStatus")?.value || "active";
      } else if (target === "environmentElements") {
        item.type = $("#propEnvType")?.value || "other";
        item.shape = $("#propEnvShape")?.value || "polygon";
        item.style = item.style || {};
        item.style.fill = $("#propEnvFill")?.value || "#059669";
        item.style.opacity = Number($("#propEnvOpacity")?.value ?? 0.5);
        item.renderHint = $("#propRenderHint")?.value || "";
      } else if (target === "areas") {
        item.style = item.style || {};
        item.style.strokeColor = $("#propStrokeColor")?.value || "#2563eb";
        item.style.color = item.style.strokeColor;
        item.style.fillColor = $("#propFillColor")?.value || "#2563eb";
        item.style.weight = Number($("#propWeight")?.value || 3);
        item.style.fillOpacity = Number($("#propAreaFillOpacity")?.value ?? 0.08);
      } else if (target === "routes") {
        item.style = item.style || {};
        item.style.color = $("#propRouteColor")?.value || "#2563eb";
        item.style.weight = Number($("#propRouteWeight")?.value || 4);
        item.style.dashArray = $("#propDashArray")?.value || "";
      } else if (target === "roads") {
        const roadType = $("#propRoadType")?.value || "main_road";
        item.type = roadType;
        item.style = item.style || {};
        item.style.color = $("#propRoadColor")?.value || "#6b7280";
        item.style.weight = Number($("#propRoadWeight")?.value || 6);
        item.style.dashArray = $("#propRoadDashArray")?.value || "";
        item.renderHint = item.renderHint || {};
        item.renderHint.surface = $("#propRoadSurface")?.value || "";
        item.renderHint.curveStyle = $("#propRoadCurveStyle")?.value || "";
        item.status = $("#propRoadStatus")?.value || "active";
        item.noSnap = $("#propRoadNoSnap")?.value === "true";
        item.routeRef = roadType === "shuttle_route" ? ($("#propRoadRouteRef")?.value?.trim() || "") : "";
      } else if (target === "assets") {
        item.url = $("#propAssetUrl")?.value?.trim() || "";
        item.kind = $("#propAssetKind")?.value || "other";
        const assetWidth = positiveNumber($("#propAssetWidth")?.value, 64);
        const assetHeight = positiveNumber($("#propAssetHeight")?.value, 64);
        item.size = [assetWidth, assetHeight];
        item.anchor = [Number($("#propAssetAnchorX")?.value || Math.round(assetWidth / 2)), Number($("#propAssetAnchorY")?.value || assetHeight)];
        item.rotation = Number($("#propAssetRotation")?.value || 0);
        item.opacity = Number($("#propAssetOpacity")?.value ?? 1);
        item.clickBehavior = $("#propAssetClickBehavior")?.value || "none";
        item.boundObjectType = $("#propAssetBoundType")?.value?.trim() || "";
        item.boundObjectId = $("#propAssetBoundId")?.value?.trim() || "";
        item.status = $("#propAssetStatus")?.value || "active";
        state.assetAspectRatio = assetWidth / assetHeight;
        state.assetLastSize = { width: assetWidth, height: assetHeight };
      }
      $("#layersJson").value = JSON.stringify(layers, null, 2);
    }
    renderData();
  }

  document.addEventListener("change", (event) => {
    if (event.target.id === "propAssetWidth" || event.target.id === "propAssetHeight") {
      syncAssetSizeRatio(event.target.id);
    }
    if (event.target.closest(".prop-section")) syncPropertyToJSON();
  });
  document.addEventListener("input", (event) => {
    if (event.target.closest(".prop-section") && !event.target.matches("#locationsJson, #layersJson")) {
      if (event.target.id === "propAssetWidth" || event.target.id === "propAssetHeight") {
        syncAssetSizeRatio(event.target.id);
      }
      clearTimeout(state._propSyncTimer);
      state._propSyncTimer = setTimeout(syncPropertyToJSON, 300);
    }
  });

  // Sub-type selectors
  document.addEventListener("change", (event) => {
    if (event.target.id === "pointDrawType") {
      state.pointSubType = event.target.value;
      setStatus(`Point mode (${state.pointSubType}): click map to place a point.`);
    }
    if (event.target.id === "polygonDrawType") {
      state.drawSubType = event.target.value;
      setStatus(`Polygon mode (${state.drawSubType}): click map to draw polygon.`);
    }
    if (event.target.id === "roadDrawType") {
      state.roadSubType = event.target.value;
      const style = ROAD_TYPE_STYLES[state.roadSubType] || ROAD_TYPE_STYLES.main_road;
      if ($("#propRoadColor")) $("#propRoadColor").value = style.color;
      if ($("#propRoadWeight")) $("#propRoadWeight").value = style.weight;
      if ($("#propRoadDashArray")) $("#propRoadDashArray").value = style.dashArray;
      setStatus(`Road mode (${state.roadSubType}): drag to draw road.`);
    }
    if (event.target.id === "assetDrawKind") {
      state.assetKind = event.target.value;
      setStatus(`Asset mode (${state.assetKind}): click map to place asset.`);
    }
    if (event.target.id === "assetDrawUrl") {
      state.assetUrl = event.target.value.trim();
    }
    // Road type change in property panel
    if (event.target.id === "propRoadType") {
      const newType = event.target.value;
      const style = ROAD_TYPE_STYLES[newType] || ROAD_TYPE_STYLES.main_road;
      if ($("#propRoadColor")) $("#propRoadColor").value = style.color;
      if ($("#propRoadWeight")) $("#propRoadWeight").value = style.weight;
      if ($("#propRoadDashArray")) $("#propRoadDashArray").value = style.dashArray;
      syncPropertyToJSON();
    }
  });

  // Detect junctions button
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-detect-junctions]")) runJunctionDetection();
    if (event.target.closest("[data-auto-classify-curves]")) autoClassifyCurves();
    if (event.target.closest("[data-toggle-smooth]")) {
      state.showSmoothCurves = !state.showSmoothCurves;
      const btn = event.target.closest("[data-toggle-smooth]");
      if (btn) btn.classList.toggle("is-active", state.showSmoothCurves);
      renderData();
      setStatus(state.showSmoothCurves ? "Curve smoothing preview enabled." : "Curve smoothing preview disabled.");
    }
    if (event.target.closest("[data-upload-asset]")) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        setStatus("Uploading...");
        try {
          const form = new FormData();
          form.append("image", file);
          const token = getToken();
          const headers = {};
          if (token) headers["x-admin-token"] = token;
          const resp = await fetch(`${LIAN_API_BASE}/api/upload/image`, { method: "POST", body: form, credentials: "include", headers });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok || !data.url) throw new Error(data.error || `Upload failed HTTP ${resp.status}`);
          state.assetUrl = data.url;
          if ($("#assetDrawUrl")) $("#assetDrawUrl").value = data.url;
          setStatus(`Upload succeeded: ${data.url}`);
        } catch (err) {
          setStatus(err.message, true);
        }
      };
      input.click();
    }
  });

  // Export render spec
  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-export-spec]")) return;
    const locations = parseJson("#locationsJson", { items: [] });
    const layers = parseJson("#layersJson", DEFAULT_LAYERS_FALLBACK);
    const spec = {
      version: "map-v2.1-render-spec",
      exportedAt: new Date().toISOString(),
      bounds: { southWest: { lat: BOUNDS.south, lng: BOUNDS.west }, northEast: { lat: BOUNDS.north, lng: BOUNDS.east } },
      center: layers.center || { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] },
      zoom: layers.zoom || 16,
      locations: (locations.items || []).filter((i) => i.status === "active"),
      roads: (layers.roads || []).map((r) => ({ ...r, curveHint: r.renderHint?.curveStyle || "", routeRef: r.routeRef || "" })),
      junctions: layers.junctions || [],
      buildings: layers.buildings || [],
      environmentElements: layers.environmentElements || [],
      buildingGroups: layers.buildingGroups || [],
      assets: layers.assets || [],
      areas: layers.areas || [],
      routes: layers.routes || []
    };
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "map-v2-render-spec.json";
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Render spec exported.");
  });

  // --- Road network preview ---
  function previewToLatLng(x, y) {
    const PREVIEW_PROJ_LAT0 = 18.393453;
    const PREVIEW_PROJ_LON0 = 110.015821;
    const latRad = PREVIEW_PROJ_LAT0 * Math.PI / 180;
    const mPerDegLat = 111320;
    const mPerDegLng = mPerDegLat * Math.cos(latRad);
    return [PREVIEW_PROJ_LAT0 + y / mPerDegLat, PREVIEW_PROJ_LON0 + x / mPerDegLng];
  }

  function latLngToPreviewXy(lat, lng) {
    const PREVIEW_PROJ_LAT0 = 18.393453;
    const PREVIEW_PROJ_LON0 = 110.015821;
    const latRad = PREVIEW_PROJ_LAT0 * Math.PI / 180;
    const mPerDegLat = 111320;
    const mPerDegLng = mPerDegLat * Math.cos(latRad);
    return [(lng - PREVIEW_PROJ_LON0) * mPerDegLng, (lat - PREVIEW_PROJ_LAT0) * mPerDegLat];
  }

  function renderPreviewCanvas() {
    const canvas = state.previewCanvas;
    const ctx = state.previewCtx;
    const data = state.previewData;
    if (!canvas || !ctx || !data) return;

    const map = state.map;
    const bounds = map.getBounds();
    const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());
    const size = map.getSize();

    canvas.style.left = topLeft.x + 'px';
    canvas.style.top = topLeft.y + 'px';
    canvas.width = size.x * (window.devicePixelRatio || 1);
    canvas.height = size.y * (window.devicePixelRatio || 1);
    canvas.style.width = size.x + 'px';
    canvas.style.height = size.y + 'px';
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);

    ctx.clearRect(0, 0, size.x, size.y);

    const zoom = map.getZoom();
    const center = map.getCenter();
    const centerPt = map.latLngToLayerPoint(center);
    const scale = Math.pow(2, zoom) * 256 / 360;
    const scaleRad = Math.pow(2, zoom) * 256 / (2 * Math.PI);

    const txMeters = state.previewTx;
    const tyMeters = state.previewTy;
    const scl = state.previewScale;
    const rot = state.previewRotation * Math.PI / 180;

    function project(lat, lng) {
      const xMeters = (lng - 110.015821) * 111320 * Math.cos(18.393453 * Math.PI / 180);
      const yMeters = (lat - 18.393453) * 111320;
      let px = xMeters * scl + txMeters;
      let py = yMeters * scl + tyMeters;
      if (rot !== 0) {
        const cosR = Math.cos(rot), sinR = Math.sin(rot);
        const rpx = px * cosR - py * sinR;
        const rpy = px * sinR + py * cosR;
        px = rpx; py = rpy;
      }
      const lng2 = px / (111320 * Math.cos(18.393453 * Math.PI / 180)) + 110.015821;
      const lat2 = py / 111320 + 18.393453;
      const ppt = map.latLngToLayerPoint([lat2, lng2]);
      return { x: ppt.x - topLeft.x, y: ppt.y - topLeft.y };
    }

    const lw = state.previewLineWidth;
    const cosLat = Math.cos(center.lat * Math.PI / 180);
    const pxPerMeter = Math.pow(2, zoom) * 256 / 360 * 111320 * cosLat;

    function drawPolyline(points, style) {
      if (points.length < 2) return;
      ctx.beginPath();
      const p0 = project(points[0][0], points[0][1]);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < points.length; i++) {
        const p = project(points[i][0], points[i][1]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // --- Roads: body + border ---
    if (state.previewShowRoads && data.roads) {
      ctx.globalAlpha = state.previewOpacity;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const road of data.roads) {
        if (!road.points || road.points.length < 2) continue;
        const roadWidthM = (road.width_m || 3.2) * (road.lane_count || 2);
        const roadPx = Math.max(3, roadWidthM * pxPerMeter * state.previewScale);

        // Road body (asphalt gray)
        ctx.strokeStyle = '#8a8a8a';
        ctx.lineWidth = roadPx;
        drawPolyline(road.points);

        // Road border (darker edge)
        ctx.strokeStyle = '#555';
        ctx.lineWidth = roadPx + 2;
        ctx.globalCompositeOperation = 'destination-over';
        drawPolyline(road.points);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    // --- Lanes ---
    if (state.previewShowLanes && data.lanes) {
      ctx.globalAlpha = state.previewOpacity;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#888';
      ctx.lineWidth = Math.max(1, lw);
      for (const lane of data.lanes) {
        if (!lane.points || lane.points.length < 2) continue;
        drawPolyline(lane.points);
      }
    }

    // --- Junctions ---
    if (state.previewShowJunctions && data.junctions) {
      ctx.globalAlpha = state.previewOpacity;
      for (const jx of data.junctions) {
        if (!jx.position) continue;
        const p = project(jx.position.lat, jx.position.lng);
        const r = Math.max(4, 8 * state.previewScale);
        // Junction fill (same as road color)
        ctx.fillStyle = '#8a8a8a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        // Junction border
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  }

  function initPreviewCanvasLayer() {
    if (state.previewCanvas) return;
    const pane = state.map.getPane('overlayPane');
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '450';
    pane.appendChild(canvas);
    state.previewCanvas = canvas;
    state.previewCtx = canvas.getContext('2d');
    state.roadPreview = { remove() { canvas.remove(); state.previewCanvas = null; state.previewCtx = null; } };
    state.map.on('moveend zoomend', renderPreviewCanvas);
    state.map.on('move', renderPreviewCanvas);
  }

  function syncPreviewInputs() {
    const $tx = $("#previewTx"), $ty = $("#previewTy");
    const $sc = $("#previewScale"), $rot = $("#previewRot");
    if ($tx) $tx.value = state.previewTx;
    if ($ty) $ty.value = state.previewTy;
    if ($sc) $sc.value = state.previewScale;
    if ($rot) $rot.value = state.previewRotation;
    renderPreviewCanvas();
  }

  function syncPreviewFromInputs() {
    state.previewTx = Number($("#previewTx")?.value || 0);
    state.previewTy = Number($("#previewTy")?.value || 0);
    state.previewScale = Number($("#previewScale")?.value || 1);
    state.previewRotation = Number($("#previewRot")?.value || 0);
    renderPreviewCanvas();
  }

  const $opacity = $("#previewOpacity");
  if ($opacity) $opacity.addEventListener("input", () => {
    state.previewOpacity = Number($opacity.value) / 100;
    renderPreviewCanvas();
  });

  const $lw = $("#previewLineWidth");
  if ($lw) $lw.addEventListener("input", () => {
    state.previewLineWidth = Number($lw.value);
    renderPreviewCanvas();
  });

  const $showLanes = $("#previewShowLanes");
  if ($showLanes) $showLanes.addEventListener("change", () => {
    state.previewShowLanes = $showLanes.checked;
    renderPreviewCanvas();
  });

  const $showRoads = $("#previewShowRoads");
  if ($showRoads) $showRoads.addEventListener("change", () => {
    state.previewShowRoads = $showRoads.checked;
    renderPreviewCanvas();
  });

  const $showJx = $("#previewShowJunctions");
  if ($showJx) $showJx.addEventListener("change", () => {
    state.previewShowJunctions = $showJx.checked;
    renderPreviewCanvas();
  });

  ["previewTx", "previewTy", "previewScale", "previewRot"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", syncPreviewFromInputs);
  });

  function updateAlignCursor() {
    const container = state.map?.getContainer();
    if (!container) return;
    if (state.previewAlignMode) {
      container.style.cursor = 'grab';
      if (state.previewCanvas) state.previewCanvas.style.cursor = 'grab';
    } else {
      container.style.cursor = '';
      if (state.previewCanvas) state.previewCanvas.style.cursor = '';
    }
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-toggle-align-mode]")) {
      if (!state.previewData) { setStatus("Load road preview first.", true); return; }
      state.previewAlignMode = !state.previewAlignMode;
      const btn = event.target.closest("[data-toggle-align-mode]");
      if (btn) btn.classList.toggle("is-active", state.previewAlignMode);
      updateAlignCursor();
      setStatus(state.previewAlignMode ? "Align mode: drag map to move road preview." : "Align mode exited.");
    }
    if (event.target.closest("[data-reset-preview-transform]")) {
      state.previewTx = 0;
      state.previewTy = 0;
      state.previewScale = 1;
      state.previewRotation = 0;
      syncPreviewInputs();
      setStatus("Preview transform reset.");
    }
    if (event.target.closest("[data-export-preview]")) {
      const out = {
        source: 'road_network_mapWITH',
        transform: { translateX: state.previewTx, translateY: state.previewTy, scale: state.previewScale, rotation: state.previewRotation },
        generatedAt: new Date().toISOString(),
        warning: 'This is preview alignment data, not official map data.',
        laneCount: state.previewData?.lanes?.length || 0,
        roadCount: state.previewData?.roads?.length || 0,
        junctionCount: state.previewData?.junctions?.length || 0
      };
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'map-v2-road-network-alignment.json';
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Alignment parameters exported.');
    }
    if (event.target.closest("[data-clear-preview]")) {
      state.previewData = null;
      state.previewAlignMode = false;
      const alignBtn = document.querySelector("[data-toggle-align-mode]");
      if (alignBtn) alignBtn.classList.remove("is-active");
      updateAlignCursor();
      if (state.roadPreview) { state.roadPreview.remove(); state.roadPreview = null; }
      renderPreviewCanvas();
      setStatus('Road preview cleared.');
    }
    if (event.target.closest("[data-load-preview]")) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (!data.lanes || !data.roads) throw new Error('Missing lanes or roads fields');
          state.previewData = data;
          state.previewTx = data.transform?.translateX || 0;
          state.previewTy = data.transform?.translateY || 0;
          state.previewScale = data.transform?.scale || 1;
          state.previewRotation = data.transform?.rotation || 0;
          initPreviewCanvasLayer();
          syncPreviewInputs();
          setStatus(`Road preview loaded: ${data.lanes.length} lanes, ${data.roads.length} roads, ${data.junctions?.length || 0} junctions.`);
        } catch (err) {
          setStatus('Load failed: ' + err.message, true);
        }
      };
      input.click();
    }
  });

  // Building groups panel
  function renderBuildingGroupsList() {
    const container = $("#buildingGroupsList");
    if (!container) return;
    const layers = parseJson("#layersJson", DEFAULT_LAYERS_FALLBACK);
    const groups = layers.buildingGroups || [];
    if (groups.length === 0) {
      container.innerHTML = '<p style="font-size:11px;color:var(--muted)">No building groups</p>';
      return;
    }
    container.innerHTML = groups.map((g) => `
      <div class="group-item" data-group-id="${escapeHtml(g.id)}">
        <span class="group-name">${escapeHtml(g.name || g.id)}</span>
        <span class="group-count">${(g.buildingIds || []).length} buildings</span>
        <button type="button" class="danger" data-delete-group="${escapeHtml(g.id)}">Delete</button>
      </div>
    `).join("");
  }

  document.addEventListener("click", (event) => {
    const delBtn = event.target.closest("[data-delete-group]");
    if (delBtn) {
      const gid = delBtn.dataset.deleteGroup;
      if (!confirm(`Delete building group "${gid}"?`)) return;
      const layers = parseJson("#layersJson", DEFAULT_LAYERS_FALLBACK);
      layers.buildingGroups = (layers.buildingGroups || []).filter((g) => g.id !== gid);
      $("#layersJson").value = JSON.stringify(layers, null, 2);
      renderData();
      return;
    }
    if (event.target.closest("[data-add-building-group]")) {
      const groupId = prompt("Building group ID:");
      if (!groupId) return;
      const groupName = prompt("Building group name:") || groupId;
      const layers = parseJson("#layersJson", DEFAULT_LAYERS_FALLBACK);
      layers.buildingGroups = layers.buildingGroups || [];
      if (layers.buildingGroups.find((g) => g.id === groupId)) {
        setStatus(`Building group "${groupId}" already exists.`, true);
        return;
      }
      layers.buildingGroups.push({ id: groupId, name: groupName, buildingIds: [], description: "" });
      $("#layersJson").value = JSON.stringify(layers, null, 2);
      renderData();
      setStatus(`Added building group "${groupId}".`);
    }
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
    setStatus(`底图已更新: SW ${b.south.toFixed(5)} / ${b.west.toFixed(5)} -> NE ${b.north.toFixed(5)} / ${b.east.toFixed(5)}`);
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

  // Auto-load road network preview
  (async () => {
    try {
      const resp = await fetch('/assets/road-network-preview.json');
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data.lanes || !data.roads) return;
      state.previewData = data;
      state.previewTx = 442;
      state.previewTy = -184;
      state.previewScale = 1;
      state.previewRotation = 0;
      initPreviewCanvasLayer();
      syncPreviewInputs();
      renderPreviewCanvas();
      setStatus(`路网预览已加载: ${data.lanes.length} 车道, ${data.roads.length} 道路, ${data.junctions?.length || 0} 路口 (偏移 X438 Y-190)`);
    } catch {}
  })();
})();
