const state = {
  tab: "推荐",
  page: 1,
  loading: false,
  preloading: false,
  hasMore: true,
  mapReady: false,
  routeFrame: null,
  routeStartedAt: 0,
  mapTransform: null,
  mapDrag: null,
  mapRouteFilter: "all",
  mapShowPlaces: true,
  mapShowPosts: true,
  readTids: new Set(JSON.parse(localStorage.getItem("lian.readTids") || "[]")),
  pullStartY: null,
  pullActive: false,
  previousView: "feed",
  feedScrollY: 0,
  masonryHeights: [0, 0]
};

const campusMap = {
  width: 1448,
  height: 1086,
  vehicle: "/assets/shuttle-cart.png",
  routes: [
    {
      id: "bf652947-de73-4181-89b6-f6fbcd98b2ef",
      title: "摆渡车线路",
      color: "#2f80ed",
      points: [
        { x: 148, y: 766 }, { x: 301, y: 677 }, { x: 487, y: 552 },
        { x: 577, y: 504 }, { x: 692, y: 576 }, { x: 770, y: 515 },
        { x: 856, y: 421 }, { x: 921, y: 284 }, { x: 965, y: 220 },
        { x: 993, y: 171 }, { x: 868, y: 126 }, { x: 819, y: 160 },
        { x: 738, y: 305 }, { x: 693, y: 374 }, { x: 471, y: 551 },
        { x: 286, y: 674 }, { x: 148, y: 766 }
      ]
    },
    {
      id: "f4806fbc-a6fb-49e1-bf46-74969baa67d9",
      title: "摆渡车线路1 v2",
      color: "#dc3b38",
      points: [
        { x: 577, y: 807 }, { x: 668, y: 737 }, { x: 727, y: 802 },
        { x: 663, y: 735 }, { x: 757, y: 637 }, { x: 824, y: 703 },
        { x: 757, y: 635 }, { x: 981, y: 407 }, { x: 994, y: 370 },
        { x: 894, y: 320 }, { x: 920, y: 285 }, { x: 958, y: 234 },
        { x: 988, y: 170 }, { x: 1095, y: 215 }, { x: 985, y: 165 },
        { x: 847, y: 431 }, { x: 755, y: 517 }, { x: 674, y: 582 },
        { x: 574, y: 662 }, { x: 639, y: 705 }, { x: 668, y: 739 },
        { x: 577, y: 808 }
      ]
    },
    {
      id: "1402831c-b64f-4f15-8109-23f2c62c8572",
      title: "摆渡车教师专路",
      color: "#59ed31",
      points: [
        { x: 869, y: 718 }, { x: 852, y: 725 }, { x: 645, y: 552 },
        { x: 696, y: 576 }, { x: 767, y: 507 }, { x: 844, y: 431 },
        { x: 843, y: 446 }, { x: 770, y: 516 }, { x: 695, y: 582 },
        { x: 649, y: 550 }, { x: 857, y: 729 }, { x: 875, y: 719 }
      ]
    }
  ]
};

const campusPlaces = [
  { label: "图书馆", x: 629, y: 325 },
  { label: "中央民族大学", x: 807, y: 325 },
  { label: "北京体育大学", x: 870, y: 246 },
  { label: "综合体育中心", x: 1000, y: 270 },
  { label: "大墩村", x: 1206, y: 337 },
  { label: "公共实验楼", x: 843, y: 431 },
  { label: "公共教学楼", x: 744, y: 491 },
  { label: "气膜馆", x: 635, y: 484 },
  { label: "滨海体育场", x: 501, y: 444 },
  { label: "中国传媒大学", x: 573, y: 567 },
  { label: "一号食堂", x: 930, y: 430 },
  { label: "生活二区", x: 869, y: 620 },
  { label: "生活一区", x: 761, y: 716 },
  { label: "学生会堂", x: 592, y: 713 },
  { label: "教师公寓", x: 927, y: 742 },
  { label: "消防站", x: 1029, y: 666 },
  { label: "劳动基地农田", x: 764, y: 910 },
  { label: "国电投", x: 1129, y: 522 },
  { label: "创新创业中心", x: 521, y: 770 },
  { label: "北京邮电大学", x: 330, y: 724 },
  { label: "电子科技大学", x: 203, y: 819 }
];

const campusMapPosts = [
  {
    tid: 100,
    title: "中传楼上看到的晚霞",
    body: "2026年4月15日 19:14",
    placeName: "中国传媒大学专享楼",
    x: 573,
    y: 548,
    imageUrl: "https://res.cloudinary.com/dhvyvfu4n/image/upload/f_auto,q_auto,c_fill,w_240,h_180/v1777446554/nodebb-frontend/mobile-web-upload/lp1l2knbyazsod3ikykj.jpg"
  }
];

const geoImagePairs = [
  { lat: 18.399433, lng: 110.013919, x: 573, y: 567 },
  { lat: 18.400032, lng: 110.016989, x: 744, y: 491 },
  { lat: 18.401458, lng: 110.018094, x: 843, y: 431 },
  { lat: 18.403036, lng: 110.014774, x: 629, y: 325 },
  { lat: 18.395955, lng: 110.016671, x: 761, y: 716 },
  { lat: 18.397625, lng: 110.018474, x: 869, y: 620 },
  { lat: 18.395424, lng: 110.01275, x: 521, y: 770 },
  { lat: 18.395598, lng: 110.009517, x: 330, y: 724 },
  { lat: 18.394325, lng: 110.007274, x: 203, y: 819 }
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fixFmtDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

async function uploadImage(file) {
  const form = new FormData();
  form.append("image", file);
  const response = await fetch("/api/upload/image", {
    method: "POST",
    body: form
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "图片上传失败");
  return data.url;
}

function renderTabs(tabs) {
  const el = $("#feedTabs");
  el.innerHTML = tabs.map((tab) => `<button class="chip ${tab === state.tab ? "is-active" : ""}" type="button" data-feed-tab="${escapeHtml(tab)}">${escapeHtml(tab)}</button>`).join("");
}

function saveReadTids() {
  localStorage.setItem("lian.readTids", JSON.stringify(Array.from(state.readTids).slice(-500)));
}

function readQuery() {
  return Array.from(state.readTids).join(",");
}

function ensureMasonryColumns(reset = false) {
  const list = $("#feedList");
  if (reset || !list.querySelector(".masonry-column")) {
    list.innerHTML = `
      <div class="masonry-column" data-column="left"></div>
      <div class="masonry-column" data-column="right"></div>
    `;
    state.masonryHeights = [0, 0];
  }
  return $$(".masonry-column", list);
}

function estimateCardHeight(item) {
  const listWidth = $("#feedList")?.clientWidth || 340;
  const columnWidth = Math.max(140, (listWidth - 10) / 2);
  const titleLines = Math.min(3, Math.max(1, Math.ceil(String(item.title || "").length / 10)));
  const summaryLines = item.summary ? Math.min(3, Math.max(1, Math.ceil(String(item.summary).length / 18))) : 0;
  const imageHeight = item.cover ? columnWidth * 1.12 : 112;
  const bodyHeight = 19 + titleLines * 20 + (summaryLines ? 8 + summaryLines * 18 : 0) + 24;
  return imageHeight + bodyHeight + 12;
}

function measureCardLater(card, columnIndex, estimatedHeight) {
  const applyActualHeight = () => {
    const actualHeight = card.offsetHeight + 11;
    if (actualHeight > 20) {
      state.masonryHeights[columnIndex] += actualHeight - estimatedHeight;
    }
  };
  const img = card.querySelector("img");
  if (img && !img.complete) {
    img.addEventListener("load", applyActualHeight, { once: true });
    img.addEventListener("error", applyActualHeight, { once: true });
  } else {
    requestAnimationFrame(applyActualHeight);
  }
}

function appendFeedItems(items) {
  const columns = ensureMasonryColumns(false);
  for (const item of items) {
    const columnIndex = state.masonryHeights[0] <= state.masonryHeights[1] ? 0 : 1;
    const target = columns[columnIndex];
    const estimatedHeight = estimateCardHeight(item);
    target.insertAdjacentHTML("beforeend", cardTemplate(item));
    state.masonryHeights[columnIndex] += estimatedHeight;
    measureCardLater(target.lastElementChild, columnIndex, estimatedHeight);
  }
}

function cardTemplate(item) {
  const thumb = item.cover
    ? `<img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.title)}" loading="lazy">`
    : `<div class="thumb-empty">${escapeHtml(item.tag || "黎安")}</div>`;
  return `
    <button class="feed-card" type="button" data-tid="${item.tid}">
      ${thumb}
      <div class="card-body">
        <h2>${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(item.summary || "")}</p>
        <div class="meta-row">
          <span>${escapeHtml(item.tag || "信息")}</span>
          <span>${escapeHtml(item.timeLabel || fixFmtDate(item.timestampISO))}</span>
        </div>
      </div>
    </button>
  `;
}

function originalLinkTemplate(post) {
  const url = post.sourceUrl || "";
  if (!url) return "";
  return `
    <a class="source-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
      跳转到原文
    </a>
  `;
}

async function loadFeed(reset = false) {
  if (state.loading || (!reset && !state.hasMore)) return;
  state.loading = true;
  state.preloading = !reset;
  try {
    if (reset) {
      state.page = 1;
      state.hasMore = true;
      ensureMasonryColumns(true);
    }
    const data = await api(`/api/feed?tab=${encodeURIComponent(state.tab)}&page=${state.page}&limit=12&read=${encodeURIComponent(readQuery())}`);
    renderTabs(data.tabs || ["推荐"]);
    if (!data.items.length && reset) {
      $("#feedList").innerHTML = `<div class="empty-state">NodeBB 没有返回帖子</div>`;
      return;
    }
    appendFeedItems(data.items);
    state.hasMore = Boolean(data.hasMore);
    state.page = data.nextPage || state.page + 1;
  } catch (error) {
    $("#feedList").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  } finally {
    state.loading = false;
    state.preloading = false;
    $("#pullIndicator").classList.remove("is-visible");
    state.pullActive = false;
  }
}

function maybePreloadFeed() {
  if (state.loading || state.preloading || !state.hasMore) return;
  const remaining = document.documentElement.scrollHeight - (window.innerHeight + window.scrollY);
  if (remaining < 1100) loadFeed(false);
}

async function openDetail(tid) {
  state.readTids.add(Number(tid));
  saveReadTids();
  state.feedScrollY = window.scrollY;
  $("#detailBody").innerHTML = `<div class="empty-state">加载中</div>`;
  switchView("detail");
  if (location.hash !== `#/post/${tid}`) history.pushState({ view: "detail", tid }, "", `#/post/${tid}`);
  window.scrollTo({ top: 0 });
  try {
    const post = await api(`/api/posts/${tid}`);
    $("#detailBody").innerHTML = `
      <section class="detail-content">
        <div class="tagline">${escapeHtml([post.tag || "信息", post.timeLabel].filter(Boolean).join(" · "))}</div>
        <h2>${escapeHtml(post.title)}</h2>
        <div class="nodebb-html">${post.contentHtml || ""}</div>
        ${originalLinkTemplate(post)}
      </section>
    `;
  } catch (error) {
    $("#detailBody").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function switchView(name) {
  if (name !== "detail") state.previousView = name;
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.dataset.view === name));
  $$(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === name));
  $(".tabbar").classList.remove("is-hidden");
  if (name === "map") initMap();
  if (name === "messages") loadMessages();
  if (name === "profile") loadProfile();
}

function backToFeed() {
  switchView(state.previousView || "feed");
  requestAnimationFrame(() => window.scrollTo({ top: state.feedScrollY || 0 }));
  if (location.hash.startsWith("#/post/")) history.pushState({ view: state.previousView || "feed" }, "", location.pathname);
}

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
    y: (rect.height - campusMap.height * scale) / 2
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
  return state.mapRouteFilter === "all" || state.mapRouteFilter === route.id;
}

function routeVehiclePhases(route) {
  return route.id === "1402831c-b64f-4f15-8109-23f2c62c8572" ? [0, 1] : [0, 1, 2];
}

function renderMapControls() {
  const controls = $("#mapFilterbar");
  if (!controls) return;
  const routeButtons = [
    { id: "all", title: "全部" },
    ...campusMap.routes.map((route) => ({ id: route.id, title: route.title }))
  ].map((item) => (
    `<button class="map-chip ${state.mapRouteFilter === item.id ? "is-active" : ""}" type="button" data-map-route="${escapeHtml(item.id)}">${escapeHtml(item.title)}</button>`
  )).join("");
  controls.innerHTML = `
    <div class="map-filter-scroll">${routeButtons}</div>
    <div class="map-filter-switches">
      <button class="map-chip ${state.mapShowPlaces ? "is-active" : ""}" type="button" data-map-toggle="places">地点</button>
      <button class="map-chip ${state.mapShowPosts ? "is-active" : ""}" type="button" data-map-toggle="posts">照片</button>
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
  postLayer.hidden = !state.mapShowPosts;
  postLayer.innerHTML = state.mapShowPosts ? campusMapPosts.map((post) => {
    const screen = screenPoint(post, fit);
    return `
      <button class="campus-post-pin" type="button" data-tid="${post.tid}" style="left:${screen.x.toFixed(1)}px;top:${screen.y.toFixed(1)}px">
        <img src="${escapeHtml(post.imageUrl)}" alt="${escapeHtml(post.title)}" loading="lazy">
        <span>${escapeHtml(post.title)}</span>
      </button>
    `;
  }).join("") : "";
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
    state.mapTransform = clampMapTransform({
      scale: state.mapTransform.scale,
      x: state.mapDrag.x + event.clientX - state.mapDrag.startX,
      y: state.mapDrag.y + event.clientY - state.mapDrag.startY
    });
    renderCampusMap();
  });

  const endDrag = (event) => {
    if (state.mapDrag?.pointerId === event.pointerId) state.mapDrag = null;
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

function fillCurrentTime() {
  const input = $("#publishForm [name='occurredAt']");
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  input.value = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${pad(now.getHours())}:${pad(now.getMinutes())}`;
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

async function loadMessages() {
  const list = $("#messageList");
  list.innerHTML = `<div class="empty-state">加载中</div>`;
  try {
    const data = await api("/api/messages");
    if (!data.items?.length) {
      list.innerHTML = `<div class="empty-state">暂无新消息</div>`;
      return;
    }
    list.innerHTML = data.items.map((item) => `
      <article class="message-item">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(fixFmtDate(item.time))}</p>
      </article>
    `).join("");
  } catch (error) {
    list.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

async function loadProfile() {
  const panel = $("#profilePanel");
  panel.innerHTML = `<div class="empty-state">加载中</div>`;
  try {
    const me = await api("/api/me");
    panel.innerHTML = `
      <h2>${escapeHtml(me.username)}</h2>
      <p>UID ${escapeHtml(me.uid)}</p>
      <p>${Number(me.topiccount || 0)} 个主题 · ${Number(me.postcount || 0)} 条发言</p>
    `;
  } catch (error) {
    panel.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

async function submitPost(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $(".primary", form);
  button.disabled = true;
  button.textContent = "发布中";
  try {
    const fields = new FormData(form);
    const image = fields.get("image");
    fields.delete("image");
    const payload = Object.fromEntries(fields.entries());
    if (payload.occurredAt) {
      payload.content = `${payload.content || ""}\n\n时间：${payload.occurredAt}`.trim();
    }
    if (payload.mapX && payload.mapY) {
      payload.mapLocation = {
        x: Number(payload.mapX),
        y: Number(payload.mapY),
        lat: payload.lat ? Number(payload.lat) : undefined,
        lng: payload.lng ? Number(payload.lng) : undefined,
        placeName: payload.placeName || ""
      };
    }
    if (image && image.size) {
      button.textContent = "上传图片中";
      payload.imageUrl = await uploadImage(image);
      button.textContent = "发布中";
    }
    await api("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    $("#publishSheet").close();
    form.reset();
    await loadFeed(true);
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "发布到 NodeBB";
  }
}

document.addEventListener("click", (event) => {
  const routeControl = event.target.closest("[data-map-route]");
  if (routeControl) {
    state.mapRouteFilter = routeControl.dataset.mapRoute;
    renderCampusMap();
    return;
  }

  const mapToggle = event.target.closest("[data-map-toggle]");
  if (mapToggle) {
    if (mapToggle.dataset.mapToggle === "places") state.mapShowPlaces = !state.mapShowPlaces;
    if (mapToggle.dataset.mapToggle === "posts") state.mapShowPosts = !state.mapShowPosts;
    renderCampusMap();
    return;
  }

  const feedTab = event.target.closest("[data-feed-tab]");
  if (feedTab) {
    state.tab = feedTab.dataset.feedTab;
    loadFeed(true);
    return;
  }

  const card = event.target.closest("[data-tid]");
  if (card) {
    openDetail(card.dataset.tid);
    return;
  }

  const tab = event.target.closest("[data-tab]");
  if (tab) {
    switchView(tab.dataset.tab);
    return;
  }

  if (event.target.closest("[data-open-publish]")) $("#publishSheet").showModal();
  if (event.target.closest("[data-use-current-time]")) {
    fillCurrentTime();
    return;
  }
  if (event.target.closest("[data-use-current-location]")) {
    fillCurrentLocation();
    return;
  }
  if (event.target.closest("[data-back-feed]")) {
    backToFeed();
    return;
  }
  if (event.target.closest("[data-close-publish]")) $("#publishSheet").close();
});

window.addEventListener("popstate", () => {
  if (location.hash.startsWith("#/post/")) return;
  if ($('[data-view="detail"]').classList.contains("is-active")) backToFeed();
});

$("#publishForm").addEventListener("submit", submitPost);

window.addEventListener("scroll", maybePreloadFeed, { passive: true });

const feedObserver = new IntersectionObserver((entries) => {
  if (entries.some((entry) => entry.isIntersecting)) maybePreloadFeed();
}, {
  root: null,
  rootMargin: "900px 0px 1200px 0px",
  threshold: 0
});

feedObserver.observe($("#feedSentinel"));

window.addEventListener("touchstart", (event) => {
  if (window.scrollY > 0) return;
  state.pullStartY = event.touches[0].clientY;
}, { passive: true });

window.addEventListener("touchmove", (event) => {
  if (state.pullStartY === null || window.scrollY > 0) return;
  const distance = event.touches[0].clientY - state.pullStartY;
  const active = distance > 58;
  state.pullActive = active;
  $("#pullIndicator").classList.toggle("is-visible", active);
}, { passive: true });

window.addEventListener("touchend", () => {
  if (state.pullActive) loadFeed(true);
  state.pullStartY = null;
  if (!state.loading) $("#pullIndicator").classList.remove("is-visible");
}, { passive: true });

loadFeed(true);
