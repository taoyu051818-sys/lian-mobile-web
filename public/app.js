const state = {
  feed: {
    tab: "此刻",
    page: 1,
    loading: false,
    preloading: false,
    hasMore: true,
    status: "idle",
    requestId: 0,
    readTids: new Set(JSON.parse(localStorage.getItem("lian.readTids") || "[]")),
    pullStartY: null,
    pullActive: false,
    scrollY: 0,
    masonryHeights: [0, 0]
  },
  map: {
    ready: false,
    routeFrame: null,
    routeStartedAt: 0,
    transform: null,
    drag: null,
    lastDragAt: 0,
    routeFilter: "all",
    routesVisible: true,
    showPlaces: true,
    showMemories: true,
    showFoodMenus: true,
    pickingLocation: false,
    pickedPoint: null
  },
  channel: {
    loading: false,
    offset: 0,
    hasMore: true,
    loadedIds: new Set()
  },
  auth: {
    mode: "login",
    currentUser: null
  },
  aiPublish: {
    active: false,
    step: "upload",
    imageUrl: "",
    aiMode: "",
    confidence: 0,
    needsHumanReview: false,
    riskFlags: [],
    metadata: {},
    locationDraft: null,
    previewLoading: false,
    uploadLoading: false
  },
  initialized: false,
  previousView: "feed",
  avatarCrop: null
};

const stateAliases = {
  tab: ["feed", "tab"],
  page: ["feed", "page"],
  loading: ["feed", "loading"],
  preloading: ["feed", "preloading"],
  hasMore: ["feed", "hasMore"],
  readTids: ["feed", "readTids"],
  pullStartY: ["feed", "pullStartY"],
  pullActive: ["feed", "pullActive"],
  feedScrollY: ["feed", "scrollY"],
  masonryHeights: ["feed", "masonryHeights"],
  mapReady: ["map", "ready"],
  routeFrame: ["map", "routeFrame"],
  routeStartedAt: ["map", "routeStartedAt"],
  mapTransform: ["map", "transform"],
  mapDrag: ["map", "drag"],
  lastMapDragAt: ["map", "lastDragAt"],
  mapRouteFilter: ["map", "routeFilter"],
  mapRoutesVisible: ["map", "routesVisible"],
  mapShowPlaces: ["map", "showPlaces"],
  mapShowMemories: ["map", "showMemories"],
  mapShowFoodMenus: ["map", "showFoodMenus"],
  mapPickingLocation: ["map", "pickingLocation"],
  mapPickedPoint: ["map", "pickedPoint"],
  channelLoading: ["channel", "loading"],
  channelOffset: ["channel", "offset"],
  channelHasMore: ["channel", "hasMore"],
  channelLoadedIds: ["channel", "loadedIds"],
  authMode: ["auth", "mode"],
  currentUser: ["auth", "currentUser"]
};

Object.defineProperties(state, Object.fromEntries(Object.entries(stateAliases).map(([key, [group, field]]) => [
  key,
  {
    get: () => state[group][field],
    set: (value) => {
      state[group][field] = value;
    }
  }
])));const MAP_INITIAL_Y_OFFSET = 32;

const campusMap = {
  width: 1448,
  height: 1086,
  vehicle: "/assets/shuttle-cart.png",
  routes: [
    {
      id: "bf652947-de73-4181-89b6-f6fbcd98b2ef",
      title: "二号线",
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
      title: "一号线",
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
      title: "教师专线",
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
    tid: 99,
    kind: "food",
    title: "贝可Bakell轻食店菜单",
    body: "大墩村民主大道四横巷11号",
    placeName: "大墩村",
    x: 1206,
    y: 337,
    imageUrl: "https://res.cloudinary.com/dhvyvfu4n/image/upload/f_auto,q_auto,c_limit,w_900/v1777366344/nodebb-frontend/menu-covers/ejqsdbg25kcruwotkeba.png"
  },
  {
    tid: 100,
    kind: "memory",
    title: "中传楼上看到的晚霞",
    body: "2026年4月15日 19:14",
    placeName: "中国传媒大学专享楼",
    x: 573,
    y: 548,
    imageUrl: "https://res.cloudinary.com/dhvyvfu4n/image/upload/f_auto,q_auto,c_fill,w_360,h_260/v1777446554/nodebb-frontend/mobile-web-upload/lp1l2knbyazsod3ikykj.jpg"
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

function ensureClientId() {
  const key = "lian.clientId";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function avatarHtml({ url = "", text = "同" } = {}) {
  const label = String(text || "同").slice(0, 2);
  return url
    ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(label)}">`
    : escapeHtml(label);
}

function fixFmtDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function fmtMinute(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (item) => String(item).padStart(2, "0");
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

async function uploadImage(file, purpose = "") {
  const form = new FormData();
  form.append("image", file, file.name || "image.jpg");
  const query = purpose ? `?purpose=${encodeURIComponent(purpose)}` : "";
  const response = await fetch(`/api/upload/image${query}`, {
    method: "POST",
    body: form
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "图片上传失败");
  return data.url;
}

function clampAvatarCrop() {
  const crop = state.avatarCrop;
  if (!crop) return;
  const frame = $("#avatarCropFrame");
  const rect = frame.getBoundingClientRect();
  const width = crop.naturalWidth * crop.scale;
  const height = crop.naturalHeight * crop.scale;
  crop.x = Math.min(0, Math.max(rect.width - width, crop.x));
  crop.y = Math.min(0, Math.max(rect.height - height, crop.y));
}

function renderAvatarCrop() {
  const crop = state.avatarCrop;
  const img = $("#avatarCropImage");
  if (!crop || !img) return;
  clampAvatarCrop();
  img.style.width = `${crop.naturalWidth}px`;
  img.style.height = `${crop.naturalHeight}px`;
  img.style.transform = `translate(${crop.x}px, ${crop.y}px) scale(${crop.scale})`;
}

function setAvatarZoom(multiplier) {
  const crop = state.avatarCrop;
  if (!crop) return;
  const frame = $("#avatarCropFrame").getBoundingClientRect();
  const centerX = frame.width / 2;
  const centerY = frame.height / 2;
  const imageCenterX = (centerX - crop.x) / crop.scale;
  const imageCenterY = (centerY - crop.y) / crop.scale;
  crop.scale = crop.minScale * Number(multiplier || 1);
  crop.x = centerX - imageCenterX * crop.scale;
  crop.y = centerY - imageCenterY * crop.scale;
  renderAvatarCrop();
}

function openAvatarCrop(file) {
  if (!file) return;
  const img = $("#avatarCropImage");
  const sheet = $("#avatarCropSheet");
  const zoom = $("#avatarZoom");
  closeAvatarCrop();
  const objectUrl = URL.createObjectURL(file);
  img.removeAttribute("style");
  img.removeAttribute("src");
  img.onload = () => {
    if (!sheet.open) sheet.showModal();
    requestAnimationFrame(() => {
      const frame = $("#avatarCropFrame").getBoundingClientRect();
      const frameSize = Math.max(1, Math.min(frame.width || 1, frame.height || 1));
      const minScale = Math.max(frameSize / img.naturalWidth, frameSize / img.naturalHeight);
      state.avatarCrop = {
        file,
        objectUrl,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        minScale,
        scale: minScale,
        x: (frameSize - img.naturalWidth * minScale) / 2,
        y: (frameSize - img.naturalHeight * minScale) / 2,
        drag: null
      };
      zoom.value = "1";
      renderAvatarCrop();
    });
  };
  img.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    alert("头像图片读取失败，请换一张图片试试");
  };
  sheet.showModal();
  img.src = objectUrl;
}

function closeAvatarCrop() {
  if (state.avatarCrop?.objectUrl) URL.revokeObjectURL(state.avatarCrop.objectUrl);
  state.avatarCrop = null;
  const img = $("#avatarCropImage");
  if (img) {
    img.removeAttribute("style");
    img.removeAttribute("src");
  }
  $("#avatarCropSheet")?.close();
}

async function croppedAvatarBlob() {
  const crop = state.avatarCrop;
  const img = $("#avatarCropImage");
  const frame = $("#avatarCropFrame").getBoundingClientRect();
  if (!crop || !img.naturalWidth) throw new Error("请先选择头像");
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    img,
    Math.max(0, -crop.x / crop.scale),
    Math.max(0, -crop.y / crop.scale),
    frame.width / crop.scale,
    frame.height / crop.scale,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("头像裁剪失败")), "image/jpeg", 0.86);
  });
}

async function confirmAvatarCrop() {
  const button = $("[data-confirm-avatar-crop]");
  button.disabled = true;
  try {
    const blob = await croppedAvatarBlob();
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    await changeAvatar(file);
    closeAvatarCrop();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
}

async function loadAuthMe() {
  const data = await api("/api/auth/me");
  state.currentUser = data.user || null;
  renderChannelIdentityOptions();
  return state.currentUser;
}

function renderChannelIdentityOptions() {
  const select = $("#channelForm [name='identityTag']");
  if (!select) return;
  const tags = state.currentUser?.identityTags?.length ? state.currentUser.identityTags : [];
  select.innerHTML = tags.length
    ? tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join("")
    : `<option value="">同学</option>`;
  select.disabled = !tags.length;
  const avatar = $("#channelComposerAvatar");
  if (avatar) avatar.innerHTML = avatarHtml({
    url: state.currentUser?.avatarUrl || "",
    text: state.currentUser?.username || "同"
  });
}

function openAuth(mode = "login") {
  state.authMode = mode;
  $$(".auth-tab").forEach((button) => button.classList.toggle("is-active", button.dataset.authMode === mode));
  $$(".auth-register-only").forEach((item) => item.classList.toggle("is-hidden", mode !== "register"));
  $$(".auth-login-only").forEach((item) => item.classList.toggle("is-hidden", mode !== "login"));
  const button = $("#authForm .primary");
  if (button) button.textContent = mode === "register" ? "注册" : "登录";
  const note = $("#authNote");
  if (note) note.textContent = mode === "register" ? "高校邮箱注册需要验证码；邀请码注册可以不填邮箱。" : "使用邮箱或昵称登录。";
  $("#authSheet").showModal();
}

function requireLoginUi() {
  if (state.currentUser) return true;
  openAuth("login");
  return false;
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

function repliesTemplate(post) {
  const replies = Array.isArray(post.replies) ? post.replies : [];
  return `
    <section class="reply-panel">
      <h3>回复</h3>
      <div class="reply-list">
        ${replies.length ? replies.map((reply) => `
          <article class="reply-item">
            <div class="reply-meta">
              <span>${escapeHtml(reply.username || "同学")}</span>
              <span>${escapeHtml(fixFmtDate(reply.timestampISO))}</span>
            </div>
            <div class="lian-html">${reply.contentHtml || ""}</div>
          </article>
        `).join("") : `<p class="reply-empty">还没有回复</p>`}
      </div>
      <form class="reply-form" data-reply-form data-tid="${escapeHtml(post.tid)}">
        <textarea name="content" rows="3" maxlength="2000" placeholder="写一条回复" required></textarea>
        <button type="submit">发送回复</button>
      </form>
    </section>
  `;
}

async function loadFeed(reset = false) {
  if (state.loading || (!reset && !state.hasMore)) return;
  const requestId = state.feed.requestId + 1;
  state.feed.requestId = requestId;
  state.feed.status = "loading";
  state.loading = true;
  state.preloading = !reset;
  try {
    if (reset) {
      state.page = 1;
      state.hasMore = true;
      ensureMasonryColumns(true);
    }
    const tab = state.tab || "此刻";
    const page = state.page;
    console.info(`[feed] start request=${requestId} tab=${tab} page=${page} reset=${reset}`);
    const data = await api(`/api/feed?tab=${encodeURIComponent(tab)}&page=${page}&limit=12&read=${encodeURIComponent(readQuery())}`);
    if (requestId !== state.feed.requestId) {
      console.info(`[feed] ignore stale request=${requestId}`);
      return;
    }
    console.info(`[feed] response request=${requestId} items=${data.items?.length || 0}`);
    renderTabs(data.tabs || ["此刻", "推荐"]);
    if (!data.items.length && reset) {
      $("#feedList").innerHTML = `<div class="empty-state">LIAN 没有返回帖子（tab=${escapeHtml(tab)}，page=${page}，items=0）</div>`;
      state.feed.status = "ready";
      return;
    }
    appendFeedItems(data.items);
    console.info(`[feed] rendered request=${requestId} cards=${$$(".feed-card").length}`);
    state.hasMore = Boolean(data.hasMore);
    state.page = data.nextPage || state.page + 1;
    state.feed.status = "ready";
  } catch (error) {
    if (requestId !== state.feed.requestId) return;
    state.feed.status = "error";
    console.error(`[feed] error request=${requestId}`, error);
    $("#feedList").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  } finally {
    if (requestId === state.feed.requestId) {
      state.loading = false;
      state.preloading = false;
      $("#pullIndicator").classList.remove("is-visible");
      state.pullActive = false;
    }
  }
}

function maybePreloadFeed() {
  if (!state.initialized) return;
  if (state.feed.status !== "ready") return;
  if (state.loading || state.preloading || !state.hasMore) return;
  const remaining = document.documentElement.scrollHeight - (window.innerHeight + window.scrollY);
  if (remaining < 1100) loadFeed(false);
}

function maybeLoadOlderMessages() {
  const messageView = $('[data-view="messages"]');
  if (!messageView?.classList.contains("is-active")) return;
  if (window.scrollY < 120) loadMessages({ older: true });
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
        <div class="lian-html">${post.contentHtml || ""}</div>
        ${originalLinkTemplate(post)}
        ${repliesTemplate(post)}
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
        <img src="${escapeHtml(post.imageUrl)}" alt="${escapeHtml(post.title)}" loading="lazy">
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

function channelItemTemplate(item) {
  const own = Boolean(
    (state.currentUser?.id && item.userId === state.currentUser.id) ||
    (state.currentUser?.nodebbUid && Number(item.nodebbUid) === Number(state.currentUser.nodebbUid)) ||
    (state.currentUser?.username && item.username && item.username === state.currentUser.username)
  );
  const name = item.username || "同学";
  const tag = item.identityTag || "";
  const avatar = avatarHtml({
    url: item.avatarUrl || "",
    text: item.avatarText || name.slice(0, 1) || "同"
  });
  const identity = tag ? `${name} · ${tag}` : name;
  return `
    <article class="message-item ${own ? "is-own" : "is-other"} ${item.type === "channel_message" ? "is-chat" : ""}" data-message-id="${escapeHtml(item.id || "")}">
      <div class="message-avatar">${avatar}</div>
      <div class="message-bubble">
        <div class="message-meta">
          <span>${escapeHtml(identity)}</span>
          <span>${escapeHtml(fmtMinute(item.timestampISO))}</span>
        </div>
        <p>${escapeHtml(item.excerpt || item.text || "")}</p>
        <footer>${Number(item.readCount || 0)} 人已读</footer>
      </div>
    </article>
  `;
}

async function markChannelRead(items) {
  if (!items.length) return;
  await api("/api/channel/read", {
    method: "POST",
    headers: { "content-type": "application/json", "x-client-id": ensureClientId() },
    body: JSON.stringify({
      readerId: ensureClientId(),
      eventIds: items.map((item) => item.id),
      tids: items.map((item) => item.tid).filter(Boolean)
    })
  });
}

function startMapLocationPick() {
  state.mapPickingLocation = true;
  $("#publishSheet").close();
  switchView("map");
  initMap();
  renderCampusMap();
}

function pickPublishMapLocation(event) {
  const point = imagePointFromClient(event.clientX, event.clientY);
  const place = nearestCampusPlace(point);
  const form = $("#publishForm");
  state.mapPickedPoint = point;
  form.elements.mapX.value = Math.round(point.x);
  form.elements.mapY.value = Math.round(point.y);
  form.elements.placeName.value = place?.label || "地图标记";
  form.elements.lat.value = "";
  form.elements.lng.value = "";
  state.mapPickingLocation = false;
  updatePublishLocationNote();
  if (state.aiPublish.active) state.aiPublish.locationDraft = buildLocationDraftFromForm(form);
  renderCampusMap();
  $("#publishSheet").showModal();
}

function updatePublishLocationNote() {
  const form = $("#publishForm");
  const note = $("#publishLocationNote");
  if (!note) return;
  const mapX = form.elements.mapX.value;
  const mapY = form.elements.mapY.value;
  const placeName = form.elements.placeName.value;
  note.textContent = mapX && mapY ? `已标记：${placeName || "地图位置"} (${mapX}, ${mapY})` : "";
}

function defaultAiLocationDraft() {
  return {
    source: "legacy_map",
    locationId: "",
    locationArea: "",
    displayName: "",
    lat: null,
    lng: null,
    legacyPoint: { x: null, y: null },
    imagePoint: { x: null, y: null },
    mapVersion: "legacy",
    confidence: 0,
    skipped: false,
    note: ""
  };
}

function skippedAiLocationDraft() {
  return {
    ...defaultAiLocationDraft(),
    source: "skipped",
    skipped: true
  };
}

function buildLocationDraftFromForm(form = $("#publishForm")) {
  if (!form) return defaultAiLocationDraft();
  const placeName = String(form.elements.placeName?.value || "").trim();
  const mapX = form.elements.mapX?.value;
  const mapY = form.elements.mapY?.value;
  const lat = form.elements.lat?.value;
  const lng = form.elements.lng?.value;
  return {
    ...defaultAiLocationDraft(),
    source: mapX && mapY ? "legacy_map" : (placeName ? "manual" : "legacy_map"),
    locationArea: placeName,
    displayName: placeName,
    lat: lat ? Number(lat) : null,
    lng: lng ? Number(lng) : null,
    legacyPoint: { x: mapX ? Number(mapX) : null, y: mapY ? Number(mapY) : null },
    imagePoint: { x: mapX ? Number(mapX) : null, y: mapY ? Number(mapY) : null },
    mapVersion: "legacy",
    confidence: placeName ? 0.65 : 0,
    skipped: false
  };
}

function aiTagsText(tags = []) {
  return Array.isArray(tags) ? tags.join(" ") : "";
}

function parseTagsText(value = "") {
  return [...new Set(String(value || "").split(/[\s,，#]+/).map((item) => item.trim()).filter(Boolean))].slice(0, 5);
}

function currentAiPublishPayload() {
  const form = $("#publishForm");
  const metadata = { ...(state.aiPublish.metadata || {}) };
  const locationDraft = state.aiPublish.locationDraft || buildLocationDraftFromForm(form);
  const locationArea = locationDraft.skipped
    ? (metadata.locationArea || "")
    : (locationDraft.locationArea || metadata.locationArea || "");
  metadata.locationId = "";
  metadata.locationArea = locationArea;
  metadata.visibility ||= "public";
  metadata.distribution = locationArea ? ["home", "map", "search", "detail"] : ["home", "search", "detail"];
  return {
    imageUrl: state.aiPublish.imageUrl,
    title: form.elements.title?.value || "",
    body: form.elements.body?.value || "",
    tags: parseTagsText(form.elements.tags?.value || ""),
    metadata,
    locationDraft,
    riskFlags: state.aiPublish.riskFlags || [],
    confidence: state.aiPublish.confidence || 0,
    needsHumanReview: Boolean(state.aiPublish.needsHumanReview),
    aiMode: state.aiPublish.aiMode || ""
  };
}

function resetAiPublish() {
  state.aiPublish = {
    active: true,
    step: "upload",
    imageUrl: "",
    aiMode: "",
    confidence: 0,
    needsHumanReview: false,
    riskFlags: [],
    metadata: {},
    locationDraft: defaultAiLocationDraft(),
    previewLoading: false,
    uploadLoading: false
  };
  state.mapPickedPoint = null;
}

function renderAiPublishSheet() {
  const form = $("#publishForm");
  if (!form || !state.aiPublish.active) return;
  const hasImage = Boolean(state.aiPublish.imageUrl);
  const locationDraft = state.aiPublish.locationDraft || defaultAiLocationDraft();
  const locationLabel = locationDraft.skipped
    ? "已跳过定位"
    : (locationDraft.displayName || locationDraft.locationArea || "未选择地点");
  form.innerHTML = `
    <header>
      <h2>AI 轻投稿</h2>
      <button class="sheet-close" type="button" data-close-publish aria-label="关闭">×</button>
    </header>
    ${!hasImage ? `
      <section class="ai-publish-upload">
        <label class="ai-upload-drop">
          <span>上传图片</span>
          <small>上传一张图片，LIAN 会帮你生成标题、正文和标签</small>
          <input id="publishImageInput" name="image" type="file" accept="image/*">
        </label>
        <p class="publish-status">${state.aiPublish.uploadLoading ? "图片上传中..." : ""}</p>
      </section>
    ` : `
      <section class="ai-publish-preview">
        <img src="${escapeHtml(state.aiPublish.imageUrl)}" alt="">
      </section>
      <section class="ai-location-step">
        <h3>这张照片在哪里？</h3>
        <div class="publish-tools">
          <button type="button" data-pick-map-location>旧地图标记</button>
          <button type="button" data-skip-ai-location>跳过定位</button>
        </div>
        <label>
          地点
          <input name="placeName" autocomplete="off" value="${escapeHtml(locationDraft.skipped ? "" : locationLabel)}" placeholder="输入地点，或用旧地图标记">
        </label>
        <input name="lat" type="hidden" value="${locationDraft.lat ?? ""}">
        <input name="lng" type="hidden" value="${locationDraft.lng ?? ""}">
        <input name="mapX" type="hidden" value="${locationDraft.legacyPoint?.x ?? ""}">
        <input name="mapY" type="hidden" value="${locationDraft.legacyPoint?.y ?? ""}">
        <p class="publish-location-note" id="publishLocationNote">${escapeHtml(locationLabel)}</p>
      </section>
      <section class="ai-draft-step">
        <h3>编辑草稿</h3>
        <p class="publish-status">${state.aiPublish.previewLoading ? "AI 正在生成草稿..." : ""}</p>
        <label>
          标题
          <input name="title" maxlength="40" required value="${escapeHtml(state.aiPublish.title || "")}">
        </label>
        <label>
          正文
          <textarea name="body" rows="6" maxlength="300" required>${escapeHtml(state.aiPublish.body || "")}</textarea>
        </label>
        <label>
          Tags
          <input name="tags" maxlength="80" value="${escapeHtml(aiTagsText(state.aiPublish.tags || []))}" placeholder="最多 5 个，用空格分隔">
        </label>
        ${state.aiPublish.riskFlags?.length ? `
          <div class="ai-risk-list">
            ${state.aiPublish.riskFlags.map((flag) => `<p>${escapeHtml(flag.message || "")}</p>`).join("")}
          </div>
        ` : ""}
      </section>
      <div class="ai-publish-actions">
        <button class="primary" type="submit" data-ai-publish>发布到 LIAN</button>
        <button type="button" data-save-ai-draft>保存草稿</button>
        <button type="button" data-regenerate-ai>重新生成</button>
        <button type="button" data-close-publish>取消</button>
      </div>
    `}
  `;
}

function applyAiPreview(data = {}) {
  const draft = data.draft || {};
  state.aiPublish.aiMode = data.mode || "";
  state.aiPublish.title = draft.title || "";
  state.aiPublish.body = draft.body || "";
  state.aiPublish.tags = Array.isArray(draft.tags) ? draft.tags : [];
  state.aiPublish.metadata = draft.metadata || {};
  state.aiPublish.riskFlags = Array.isArray(data.riskFlags) ? data.riskFlags : [];
  state.aiPublish.confidence = Number(data.confidence || 0);
  state.aiPublish.needsHumanReview = Boolean(data.needsHumanReview);
  if (!state.aiPublish.locationDraft?.locationArea && !state.aiPublish.locationDraft?.skipped) {
    state.aiPublish.locationDraft = data.locationDraft || buildLocationDraftFromForm();
  }
}

async function requestAiPreview() {
  if (!state.aiPublish.imageUrl) return;
  state.aiPublish.previewLoading = true;
  renderAiPublishSheet();
  try {
    const locationDraft = state.aiPublish.locationDraft || defaultAiLocationDraft();
    const data = await api("/api/ai/post-preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageUrl: state.aiPublish.imageUrl,
        template: "campus_moment",
        locationHint: locationDraft.locationArea || "",
        visibilityHint: "public"
      })
    });
    applyAiPreview(data);
  } catch (error) {
    alert(error.message);
  } finally {
    state.aiPublish.previewLoading = false;
    renderAiPublishSheet();
  }
}

async function startAiImageUpload(file) {
  if (!file) return;
  state.aiPublish.uploadLoading = true;
  renderAiPublishSheet();
  try {
    state.aiPublish.imageUrl = await uploadImage(file, "ai-light-publish");
    state.aiPublish.step = "compose";
    renderAiPublishSheet();
    requestAiPreview();
  } catch (error) {
    alert(error.message);
    state.aiPublish.imageUrl = "";
    renderAiPublishSheet();
  } finally {
    state.aiPublish.uploadLoading = false;
  }
}

function syncAiLocationFromInput() {
  const form = $("#publishForm");
  if (!form || !state.aiPublish.active) return;
  state.aiPublish.locationDraft = buildLocationDraftFromForm(form);
}

async function saveAiDraft() {
  const payload = currentAiPublishPayload();
  const data = await api("/api/ai/post-drafts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  alert(`草稿已保存：${data.draftId}`);
  $("#publishSheet").close();
}

async function publishAiPost() {
  const payload = currentAiPublishPayload();
  const data = await api("/api/ai/post-publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  $("#publishSheet").close();
  resetAiPublish();
  await loadFeed(true);
  if (data.tid) openDetail(data.tid);
}

async function loadMessages({ older = false } = {}) {
  if (state.channelLoading || (older && !state.channelHasMore)) return;
  state.channelLoading = true;
  const list = $("#messageList");
  if (!older) {
    state.channelOffset = 0;
    state.channelHasMore = true;
    state.channelLoadedIds = new Set();
    list.innerHTML = `<div class="empty-state">加载中</div>`;
  }
  try {
    const beforeHeight = document.documentElement.scrollHeight;
    const data = await api(`/api/channel?limit=30&offset=${older ? state.channelOffset : 0}`);
    if (!data.items?.length) {
      if (!older) list.innerHTML = `<div class="empty-state">还没有消息</div>`;
      return;
    }
    const totalReads = data.items.reduce((sum, item) => sum + Number(item.readCount || 0), 0);
    const summary = $("#channelSummary");
    if (summary && !older) summary.textContent = `${data.items.length} 条动态，累计 ${totalReads} 次已读`;
    const uniqueItems = data.items.filter((item) => !state.channelLoadedIds.has(item.id));
    uniqueItems.forEach((item) => state.channelLoadedIds.add(item.id));
    const chronological = [...uniqueItems].reverse();
    if (older) {
      list.insertAdjacentHTML("afterbegin", chronological.map(channelItemTemplate).join(""));
      const afterHeight = document.documentElement.scrollHeight;
      window.scrollBy({ top: afterHeight - beforeHeight });
    } else {
      list.innerHTML = chronological.map(channelItemTemplate).join("");
      requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
    }
    state.channelOffset = data.nextOffset || state.channelOffset + data.items.length;
    state.channelHasMore = Boolean(data.hasMore);
    await markChannelRead(uniqueItems);
  } catch (error) {
    list.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  } finally {
    state.channelLoading = false;
  }
}

async function submitChannelMessage(event) {
  event.preventDefault();
  if (!requireLoginUi()) return;
  const form = event.currentTarget;
  const input = form.elements.content;
  const content = String(input.value || "").trim();
  const identityTag = String(form.elements.identityTag?.value || "").trim();
  if (!content) return;
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    await api("/api/channel/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-client-id": ensureClientId() },
      body: JSON.stringify({ readerId: ensureClientId(), content, identityTag })
    });
    input.value = "";
    await loadMessages();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
}

async function submitReply(event) {
  const form = event.target.closest("[data-reply-form]");
  if (!form) return;
  event.preventDefault();
  if (!requireLoginUi()) return;
  const tid = form.dataset.tid;
  const content = String(form.elements.content.value || "").trim();
  if (!tid || !content) return;
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    await api(`/api/posts/${tid}/replies`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-client-id": ensureClientId() },
      body: JSON.stringify({ content })
    });
    form.reset();
    await openDetail(tid);
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
}

async function submitAuth(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector(".primary");
  const fields = Object.fromEntries(new FormData(form).entries());
  button.disabled = true;
  try {
    const endpoint = state.authMode === "register" ? "/api/auth/register" : "/api/auth/login";
    const data = await api(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fields)
    });
    state.currentUser = data.user;
    $("#authSheet").close();
    form.reset();
    await loadProfile();
  } catch (error) {
    $("#authNote").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function sendEmailCode() {
  const form = $("#authForm");
  const email = String(form.elements.email?.value || "").trim();
  const note = $("#authNote");
  const button = form.querySelector("[data-send-email-code]");
  if (!email) {
    note.textContent = "先填写高校邮箱；邀请码注册可以不填邮箱。";
    return;
  }
  button.disabled = true;
  try {
    const data = await api("/api/auth/email-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email })
    });
    note.textContent = `验证码已发送到 ${email}，10 分钟内有效。${data.institution ? `已识别：${data.institution}` : ""}`;
  } catch (error) {
    note.textContent = error.message;
  } finally {
    setTimeout(() => {
      button.disabled = false;
    }, 8000);
  }
}

async function createInviteCode() {
  try {
    const data = await api("/api/auth/invites", { method: "POST" });
    const result = $("#inviteResult");
    if (result) result.textContent = `邀请码：${data.code}`;
  } catch (error) {
    alert(error.message);
  }
}

async function logoutAuth() {
  await api("/api/auth/logout", { method: "POST" });
  state.currentUser = null;
  await loadProfile();
}

async function loadProfile() {
  const panel = $("#profilePanel");
  panel.innerHTML = `<div class="empty-state">加载中</div>`;
  try {
    const user = await loadAuthMe();
    if (user) {
      panel.innerHTML = `
        <div class="profile-card">
          <div class="profile-avatar">${avatarHtml({ url: user.avatarUrl || "", text: user.username || "同" })}</div>
          <div>
            <h2>${escapeHtml(user.username)}</h2>
            <p>${escapeHtml(user.email || "邀请码用户")}</p>
            <p>${escapeHtml(user.institution || "邀请码用户")}</p>
          </div>
        </div>
        <div class="profile-avatar-actions">
          <label class="profile-actions-button">
            更换头像
            <input id="avatarInput" type="file" accept="image/*">
          </label>
        </div>
        <p>${escapeHtml((user.tags || []).join(" · "))}</p>
        <p>状态：${escapeHtml(user.status)} · 邀请权限：${user.invitePermission ? "可用" : "不可用"}</p>
        <div class="profile-actions">
          ${user.invitePermission ? `<button type="button" data-create-invite>生成邀请码</button>` : ""}
          <button type="button" data-auth-logout>退出登录</button>
        </div>
        <p class="invite-result" id="inviteResult"></p>
      `;
      return;
    }
    const me = await api("/api/me");
    panel.innerHTML = `
      <h2>还没有登录</h2>
      <p>登录后可以发布、回复、发送频道消息。</p>
      <div class="profile-actions">
        <button type="button" data-open-auth="login">登录</button>
        <button type="button" data-open-auth="register">注册</button>
      </div>
    `;
  } catch (error) {
    panel.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

async function changeAvatar(file) {
  if (!file) return;
  const panel = $("#profilePanel");
  try {
    const avatarUrl = await uploadImage(file, "avatar");
    await api("/api/auth/avatar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ avatarUrl })
    });
    await loadProfile();
  } catch (error) {
    panel.insertAdjacentHTML("beforeend", `<p class="empty-state">${escapeHtml(error.message)}</p>`);
  }
}

async function submitPost(event) {
  event.preventDefault();
  if (!requireLoginUi()) return;
  if (state.aiPublish.active) {
    const button = event.submitter || event.currentTarget.querySelector("[data-ai-publish]");
    if (button) {
      button.disabled = true;
      button.textContent = "发布中";
    }
    try {
      syncAiLocationFromInput();
      await publishAiPost();
    } catch (error) {
      alert(error.message);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "发布到 LIAN";
      }
    }
    return;
  }
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
      payload.content = `${payload.content || ""}\n\n时间：${formatOccurredAt(payload.occurredAt)}`.trim();
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
    state.mapPickedPoint = null;
    updatePublishLocationNote();
    await loadFeed(true);
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "发布到 LIAN";
  }
}

document.addEventListener("click", (event) => {
  const routeControl = event.target.closest("[data-map-route]");
  if (routeControl) {
    if (routeControl.dataset.mapRoute === "all") {
      state.mapRoutesVisible = !(state.mapRoutesVisible && state.mapRouteFilter === "all");
      state.mapRouteFilter = "all";
    } else {
      state.mapRoutesVisible = true;
      state.mapRouteFilter = routeControl.dataset.mapRoute;
    }
    renderCampusMap();
    return;
  }

  const mapToggle = event.target.closest("[data-map-toggle]");
  if (mapToggle) {
    if (mapToggle.dataset.mapToggle === "places") state.mapShowPlaces = !state.mapShowPlaces;
    if (mapToggle.dataset.mapToggle === "memories") state.mapShowMemories = !state.mapShowMemories;
    if (mapToggle.dataset.mapToggle === "foodMenus") state.mapShowFoodMenus = !state.mapShowFoodMenus;
    renderCampusMap();
    return;
  }

  const mapStage = event.target.closest("#campusMapStage");
  if (mapStage && state.mapPickingLocation && !event.target.closest("[data-tid], .map-filterbar")) {
    if (Date.now() - state.lastMapDragAt < 220) return;
    pickPublishMapLocation(event);
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
    if (card.closest("#messageList")) return;
    openDetail(card.dataset.tid);
    return;
  }

  const tab = event.target.closest("[data-tab]");
  if (tab) {
    switchView(tab.dataset.tab);
    return;
  }

  const authOpen = event.target.closest("[data-open-auth]");
  if (authOpen) {
    openAuth(authOpen.dataset.openAuth || "login");
    return;
  }

  const authMode = event.target.closest("[data-auth-mode]");
  if (authMode) {
    openAuth(authMode.dataset.authMode);
    return;
  }

  if (event.target.closest("[data-create-invite]")) {
    createInviteCode();
    return;
  }

  if (event.target.closest("[data-send-email-code]")) {
    sendEmailCode();
    return;
  }

  if (event.target.closest("[data-auth-logout]")) {
    logoutAuth();
    return;
  }

  if (event.target.closest("[data-open-publish]")) {
    if (!requireLoginUi()) return;
    resetAiPublish();
    renderAiPublishSheet();
    $("#publishSheet").showModal();
    return;
  }
  if (event.target.closest("[data-pick-time]")) {
    pickTime();
    return;
  }
  if (event.target.closest("[data-use-current-location]")) {
    fillCurrentLocation();
    return;
  }
  if (event.target.closest("[data-pick-map-location]")) {
    if (state.aiPublish.active) syncAiLocationFromInput();
    startMapLocationPick();
    return;
  }
  if (event.target.closest("[data-skip-ai-location]")) {
    state.aiPublish.locationDraft = skippedAiLocationDraft();
    renderAiPublishSheet();
    return;
  }
  if (event.target.closest("[data-save-ai-draft]")) {
    syncAiLocationFromInput();
    saveAiDraft().catch((error) => alert(error.message));
    return;
  }
  if (event.target.closest("[data-regenerate-ai]")) {
    syncAiLocationFromInput();
    requestAiPreview();
    return;
  }
  if (event.target.closest("[data-back-feed]")) {
    backToFeed();
    return;
  }
  if (event.target.closest("[data-close-publish]")) $("#publishSheet").close();
  if (event.target.closest("[data-close-auth]")) $("#authSheet").close();
  if (event.target.closest("[data-close-avatar-crop]")) closeAvatarCrop();
  if (event.target.closest("[data-confirm-avatar-crop]")) confirmAvatarCrop();
});

window.addEventListener("popstate", () => {
  if (location.hash.startsWith("#/post/")) return;
  if ($('[data-view="detail"]').classList.contains("is-active")) backToFeed();
});

$("#publishForm").addEventListener("submit", submitPost);
$("#channelForm")?.addEventListener("submit", submitChannelMessage);
$("#authForm")?.addEventListener("submit", submitAuth);
document.addEventListener("submit", submitReply);
document.addEventListener("change", (event) => {
  if (event.target?.id === "avatarInput") openAvatarCrop(event.target.files?.[0]);
  if (event.target?.id === "publishImageInput") startAiImageUpload(event.target.files?.[0]);
  if (event.target?.name === "placeName" && state.aiPublish.active) syncAiLocationFromInput();
});
document.addEventListener("input", (event) => {
  if (event.target?.name === "placeName" && state.aiPublish.active) syncAiLocationFromInput();
});

$("#avatarZoom")?.addEventListener("input", (event) => setAvatarZoom(event.target.value));
$("#avatarCropFrame")?.addEventListener("pointerdown", (event) => {
  const crop = state.avatarCrop;
  if (!crop) return;
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
  crop.drag = { startX: event.clientX, startY: event.clientY, x: crop.x, y: crop.y };
});
$("#avatarCropFrame")?.addEventListener("pointermove", (event) => {
  const crop = state.avatarCrop;
  if (!crop?.drag) return;
  crop.x = crop.drag.x + event.clientX - crop.drag.startX;
  crop.y = crop.drag.y + event.clientY - crop.drag.startY;
  renderAvatarCrop();
});
$("#avatarCropFrame")?.addEventListener("pointerup", (event) => {
  if (state.avatarCrop) state.avatarCrop.drag = null;
  event.currentTarget.releasePointerCapture(event.pointerId);
});
$("#avatarCropFrame")?.addEventListener("pointercancel", () => {
  if (state.avatarCrop) state.avatarCrop.drag = null;
});

window.addEventListener("scroll", maybePreloadFeed, { passive: true });
window.addEventListener("scroll", maybeLoadOlderMessages, { passive: true });

const feedObserver = new IntersectionObserver((entries) => {
  if (entries.some((entry) => entry.isIntersecting)) maybePreloadFeed();
}, {
  root: null,
  rootMargin: "900px 0px 1200px 0px",
  threshold: 0
});

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

async function initApp() {
  renderTabs(["此刻", "推荐"]);
  ensureMasonryColumns(true);
  await loadFeed(true);
  state.initialized = true;
  feedObserver.observe($("#feedSentinel"));
  maybePreloadFeed();
  loadAuthMe().catch((error) => console.warn("[auth] me failed", error));
}

initApp();
