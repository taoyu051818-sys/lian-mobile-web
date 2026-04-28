const state = {
  tab: "推荐",
  page: 1,
  loading: false,
  preloading: false,
  hasMore: true,
  mapReady: false,
  readTids: new Set(JSON.parse(localStorage.getItem("lian.readTids") || "[]")),
  pullStartY: null,
  pullActive: false,
  previousView: "feed",
  feedScrollY: 0,
  masonryHeights: [0, 0]
};

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
      公众号原文
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

async function initMap() {
  if (state.mapReady) return;
  state.mapReady = true;
  const data = await api("/api/map/items");
  const map = L.map("map", { zoomControl: false });
  const sw = [data.bounds.southWest.lat, data.bounds.southWest.lng];
  const ne = [data.bounds.northEast.lat, data.bounds.northEast.lng];
  map.fitBounds([sw, ne]);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);
  data.items.forEach((item) => {
    L.marker([item.lat, item.lng]).addTo(map).bindPopup(`<strong>${escapeHtml(item.title)}</strong>`);
  });
  $("#placeList").innerHTML = data.items.map((item) => `
    <article class="place-item">
      <h3>${escapeHtml(item.title)}</h3>
      <p>${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}</p>
    </article>
  `).join("");
  setTimeout(() => map.invalidateSize(), 80);
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
