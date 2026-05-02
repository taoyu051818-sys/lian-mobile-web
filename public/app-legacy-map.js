function closeRoute(points) {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first.x === last.x && first.y === last.y) return points;
  return [...points, first];
}

function routeMetrics(points) {
  const closed = closeRoute(points);
  const segments = [];
  let total = 0;
  for (let index = 0; index < closed.length - 1; index += 1) {
    const start = closed[index];
    const end = closed[index + 1];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    segments.push({ start, end, length, from: total });
    total += length;
  }
  return { points: closed, segments, total };
}

function clampMapTransform(transform) {
  const stage = $("#campusMapStage");
  const rect = stage.getBoundingClientRect();
  const scaledWidth = campusMap.width * transform.scale;
  const scaledHeight = campusMap.height * transform.scale;
  const minX = Math.min(0, rect.width - scaledWidth);
  const minY = Math.min(0, rect.height - scaledHeight);
  const maxX = scaledWidth > rect.width ? 0 : (rect.width - scaledWidth) / 2;
  const maxY = scaledHeight > rect.height ? 0 : (rect.height - scaledHeight) / 2;
  return {
    width: rect.width,
    height: rect.height,
    scale: transform.scale,
    x: scaledWidth > rect.width ? Math.min(maxX, Math.max(minX, transform.x)) : maxX,
    y: scaledHeight > rect.height ? Math.min(maxY, Math.max(minY, transform.y)) : maxY
  };
}

function defaultMapTransform() {
  const stage = $("#campusMapStage");
  const rect = stage.getBoundingClientRect();
  const scale = mapScaleBounds().min * 1.12;
  return clampMapTransform({
    scale,
    x: (rect.width - campusMap.width * scale) / 2,
    y: (rect.height - campusMap.height * scale) / 2 + MAP_INITIAL_Y_OFFSET
  });
}

function mapScaleBounds() {
  const stage = $("#campusMapStage");
  const rect = stage.getBoundingClientRect();
  const min = Math.max(rect.width / campusMap.width, rect.height / campusMap.height);
  return { min, max: min * 2.4 };
}

function mapFit() {
  if (!state.mapTransform) state.mapTransform = defaultMapTransform();
  const stage = $("#campusMapStage");
  const rect = stage.getBoundingClientRect();
  return {
    ...state.mapTransform,
    width: rect.width,
    height: rect.height
  };
}

function screenPoint(point, fit) {
  return {
    x: fit.x + point.x * fit.scale,
    y: fit.y + point.y * fit.scale
  };
}

function imagePointFromClient(clientX, clientY) {
  const stage = $("#campusMapStage");
  const rect = stage.getBoundingClientRect();
  const fit = mapFit();
  return {
    x: Math.max(0, Math.min(campusMap.width, (clientX - rect.left - fit.x) / fit.scale)),
    y: Math.max(0, Math.min(campusMap.height, (clientY - rect.top - fit.y) / fit.scale))
  };
}

function pointOnRoute(route, distance) {
  const metrics = route.metrics;
  if (!metrics.total) return { ...metrics.points[0], angle: 0 };
  const target = ((distance % metrics.total) + metrics.total) % metrics.total;
  const segment = metrics.segments.find((item) => target >= item.from && target <= item.from + item.length) || metrics.segments[0];
  const progress = segment.length ? (target - segment.from) / segment.length : 0;
  const x = segment.start.x + (segment.end.x - segment.start.x) * progress;
  const y = segment.start.y + (segment.end.y - segment.start.y) * progress;
  return {
    x,
    y,
    angle: Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x) * 180 / Math.PI
  };
}

function routeVisible(route) {
  return state.mapRoutesVisible && (state.mapRouteFilter === "all" || state.mapRouteFilter === route.id);
}

function routeVehiclePhases(route) {
  return route.id === "1402831c-b64f-4f15-8109-23f2c62c8572" ? [0, 1] : [0, 1, 2];
}

function renderMapControls() {
  const controls = $("#mapFilterbar");
  if (!controls) return;
  const routeButtons = [
    { id: "all", title: "摆渡车线路" },
    ...campusMap.routes.map((route) => ({ id: route.id, title: route.title }))
  ].map((item) => (
    `<button class="map-chip ${state.mapRoutesVisible && state.mapRouteFilter === item.id ? "is-active" : ""}" type="button" data-map-route="${escapeHtml(item.id)}">${escapeHtml(item.title)}</button>`
  )).join("");
  controls.innerHTML = `
    ${state.mapPickingLocation ? `<div class="map-pick-hint">点一下地图，作为这条信息的位置</div>` : ""}
      <div class="map-filter-scroll">${routeButtons}</div>
      <div class="map-filter-switches">
        <button class="map-chip ${state.mapShowPlaces ? "is-active" : ""}" type="button" data-map-toggle="places">地标名称</button>
        <button class="map-chip ${state.mapShowMemories ? "is-active" : ""}" type="button" data-map-toggle="memories">黎安记忆</button>
        <button class="map-chip ${state.mapShowFoodMenus ? "is-active" : ""}" type="button" data-map-toggle="foodMenus">美食菜单</button>
      </div>
    `;
  }

function renderCampusMap() {
  const image = $("#campusMapImage");
  const layer = $("#campusRouteLayer");
  const labelLayer = $("#campusLabelLayer");
  const postLayer = $("#campusPostLayer");
  const fit = mapFit();
  image.style.width = `${campusMap.width}px`;
  image.style.height = `${campusMap.height}px`;
  image.style.transform = `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`;
  layer.setAttribute("viewBox", `0 0 ${fit.width} ${fit.height}`);
  layer.innerHTML = campusMap.routes.filter(routeVisible).map((route, index) => {
    route.metrics = routeMetrics(route.points);
    const path = route.metrics.points.map((point, pointIndex) => {
      const screen = screenPoint(point, fit);
      return `${pointIndex ? "L" : "M"} ${screen.x.toFixed(1)} ${screen.y.toFixed(1)}`;
    }).join(" ");
    const phases = routeVehiclePhases(route);
    const vehicles = phases.map((phase) => {
      const start = pointOnRoute(route, route.metrics.total * phase / phases.length);
      const screen = screenPoint(start, fit);
      return `<image class="route-vehicle" data-route-id="${route.id}" data-route-phase="${phase}" data-route-count="${phases.length}" href="${campusMap.vehicle}" x="${screen.x - 18}" y="${screen.y - 16}" width="36" height="28"></image>`;
    }).join("");
    return `
      <path class="route-glow" d="${path}" stroke="${route.color}"></path>
      <path class="route-line" d="${path}" stroke="${route.color}"></path>
      ${vehicles}
    `;
  }).join("");
  labelLayer.hidden = !state.mapShowPlaces;
  labelLayer.innerHTML = state.mapShowPlaces ? campusPlaces.map((place) => {
    const screen = screenPoint(place, fit);
    return `<span class="campus-place-label" style="left:${screen.x.toFixed(1)}px;top:${screen.y.toFixed(1)}px">${escapeHtml(place.label)}</span>`;
  }).join("") : "";
  const visiblePosts = campusMapPosts.filter((post) => (
    (post.kind === "food" && state.mapShowFoodMenus) ||
    (post.kind !== "food" && state.mapShowMemories)
  ));
  postLayer.hidden = !visiblePosts.length && !state.mapPickingLocation;
  postLayer.innerHTML = visiblePosts.length ? visiblePosts.map((post) => {
    const screen = screenPoint(post, fit);
    return `
      <button class="campus-post-pin" type="button" data-tid="${post.tid}" style="left:${screen.x.toFixed(1)}px;top:${screen.y.toFixed(1)}px">
        <img src="${escapeHtml(displayImageUrl(post.imageUrl))}" alt="${escapeHtml(post.title)}" loading="lazy">
        <span>${escapeHtml(post.title)}</span>
      </button>
    `;
    }).join("") : "";
  if (state.mapPickingLocation && state.mapPickedPoint) {
    const point = screenPoint(state.mapPickedPoint, fit);
    postLayer.insertAdjacentHTML("beforeend", `
      <div class="campus-picked-pin" style="left:${point.x.toFixed(1)}px;top:${point.y.toFixed(1)}px">
        选定位置
      </div>
    `);
  }
  renderMapControls();
}

function animateCampusMap(now) {
  const fit = mapFit();
  if (!state.routeStartedAt) state.routeStartedAt = now;
  $$(".route-vehicle").forEach((vehicle) => {
    const route = campusMap.routes.find((item) => item.id === vehicle.dataset.routeId);
    if (!route?.metrics?.total) return;
    const speed = route.metrics.total / 24000;
    const phase = Number(vehicle.dataset.routePhase || 0) / Number(vehicle.dataset.routeCount || 3);
    const position = pointOnRoute(route, (now - state.routeStartedAt) * speed + route.metrics.total * phase);
    const screen = screenPoint(position, fit);
    const width = 36;
    const height = 28;
    const facingLeft = Math.cos(position.angle * Math.PI / 180) < 0;
    vehicle.setAttribute("x", (screen.x - width / 2).toFixed(1));
    vehicle.setAttribute("y", (screen.y - height / 2).toFixed(1));
    vehicle.setAttribute("transform", facingLeft ? `translate(${(screen.x * 2).toFixed(1)} 0) scale(-1 1)` : "");
  });
  state.routeFrame = requestAnimationFrame(animateCampusMap);
}

function bindCampusMapDrag() {
  const stage = $("#campusMapStage");
  stage.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".map-filterbar, .campus-post-pin")) return;
    if (event.button !== undefined && event.button !== 0) return;
    stage.setPointerCapture(event.pointerId);
    const transform = mapFit();
    state.mapDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: transform.x,
      y: transform.y
    };
  });

  stage.addEventListener("pointermove", (event) => {
    if (!state.mapDrag || state.mapDrag.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (Math.hypot(event.clientX - state.mapDrag.startX, event.clientY - state.mapDrag.startY) > 4) {
      state.mapDrag.moved = true;
    }
    state.mapTransform = clampMapTransform({
      scale: state.mapTransform.scale,
      x: state.mapDrag.x + event.clientX - state.mapDrag.startX,
      y: state.mapDrag.y + event.clientY - state.mapDrag.startY
    });
    renderCampusMap();
  });

  const endDrag = (event) => {
    if (state.mapDrag?.pointerId === event.pointerId) {
      if (state.mapDrag.moved) state.lastMapDragAt = Date.now();
      state.mapDrag = null;
    }
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  stage.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = stage.getBoundingClientRect();
    const before = mapFit();
    const bounds = mapScaleBounds();
    const nextScale = Math.min(bounds.max, Math.max(bounds.min, before.scale * (event.deltaY > 0 ? 0.9 : 1.1)));
    const imageX = (event.clientX - rect.left - before.x) / before.scale;
    const imageY = (event.clientY - rect.top - before.y) / before.scale;
    state.mapTransform = clampMapTransform({
      scale: nextScale,
      x: event.clientX - rect.left - imageX * nextScale,
      y: event.clientY - rect.top - imageY * nextScale
    });
    renderCampusMap();
  }, { passive: false });
}

function nearestCampusPlace(point) {
  return campusPlaces
    .map((place) => ({ ...place, distance: Math.hypot(place.x - point.x, place.y - point.y) }))
    .sort((a, b) => a.distance - b.distance)[0];
}

function geoToImagePoint(lat, lng) {
  const ranked = geoImagePairs
    .map((point) => {
      const distance = Math.hypot((lat - point.lat) * 100000, (lng - point.lng) * 100000);
      return { ...point, weight: 1 / Math.max(distance * distance, 0.0001) };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
  const total = ranked.reduce((sum, point) => sum + point.weight, 0);
  return {
    x: ranked.reduce((sum, point) => sum + point.x * point.weight, 0) / total,
    y: ranked.reduce((sum, point) => sum + point.y * point.weight, 0) / total
  };
}

function formatOccurredAt(value = "") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (item) => String(item).padStart(2, "0");
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pickTime() {
  const input = $("#publishForm [name='occurredAt']");
  const picker = document.createElement("input");
  picker.type = "datetime-local";
  picker.className = "native-time-picker";
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  picker.value = now.toISOString().slice(0, 16);
  picker.addEventListener("change", () => {
    input.value = formatOccurredAt(picker.value);
    picker.remove();
  }, { once: true });
  document.body.appendChild(picker);
  if (typeof picker.showPicker === "function") picker.showPicker();
  else picker.click();
  setTimeout(() => picker.remove(), 60_000);
}

function fillCurrentLocation() {
  if (!navigator.geolocation) {
    alert("当前浏览器不支持定位");
    return;
  }
  navigator.geolocation.getCurrentPosition((position) => {
    const form = $("#publishForm");
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const imagePoint = geoToImagePoint(lat, lng);
    const place = nearestCampusPlace(imagePoint);
    form.elements.lat.value = lat.toFixed(6);
    form.elements.lng.value = lng.toFixed(6);
    form.elements.mapX.value = Math.round(imagePoint.x);
    form.elements.mapY.value = Math.round(imagePoint.y);
    if (!form.elements.placeName.value) form.elements.placeName.value = place?.label || "";
    updatePublishLocationNote();
  }, (error) => {
    alert(error.message || "无法获取当前位置");
  }, {
    enableHighAccuracy: true,
    timeout: 8000,
    maximumAge: 60000
  });
}

function initMap() {
  if (state.mapReady) {
    renderCampusMap();
    return;
  }
  state.mapReady = true;
  state.mapTransform = defaultMapTransform();
  renderCampusMap();
  bindCampusMapDrag();
  window.addEventListener("resize", () => {
    state.mapTransform = clampMapTransform(state.mapTransform || defaultMapTransform());
    renderCampusMap();
  });
  state.routeFrame = requestAnimationFrame(animateCampusMap);
}
