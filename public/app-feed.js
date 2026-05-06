// Actor/source DTO mapper for legacy public feed rendering.
// Server #57 exposes canonical actor/source fields for feed, detail, and replies.
// Keep legacy flat fields only as compatibility fallback during the migration window.
function isPlainRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function textField(value, fallback = "") {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text || fallback;
  }
  return fallback;
}

function recordText(record, keys, fallback = "") {
  if (!isPlainRecord(record)) return fallback;
  for (const key of keys) {
    const text = textField(record[key], "");
    if (text) return text;
  }
  return fallback;
}

function mediaUrlField(value) {
  if (typeof value === "string") return value.trim();
  if (isPlainRecord(value)) return recordText(value, ["url", "src"], "");
  return "";
}

function normalizeFeedTab(tab) {
  if (typeof tab === "string" || typeof tab === "number") {
    const label = textField(tab, "");
    return { id: label, label };
  }
  if (!isPlainRecord(tab)) return { id: "", label: "" };
  const label = textField(tab.label, "");
  const id = textField(tab.id, "") || textField(tab.key, "") || textField(tab.value, label);
  return { id, label: label || id };
}

function legacyActorRecord(entity) {
  return isPlainRecord(entity?.author) ? entity.author : null;
}

function normalizeDisplayActor(entity) {
  const actor = isPlainRecord(entity?.actor) ? entity.actor : null;
  const legacyAuthor = legacyActorRecord(entity);
  const flatAuthor = textField(entity?.author, "");
  const displayName = textField(actor?.displayName, "")
    || recordText(legacyAuthor, ["displayName"], "")
    || flatAuthor
    || textField(entity?.username, "")
    || "同学";
  const avatarUrl = mediaUrlField(actor?.avatarUrl)
    || mediaUrlField(legacyAuthor?.avatarUrl)
    || textField(entity?.authorAvatarUrl || entity?.avatarUrl, "");
  const avatarText = textField(actor?.avatarText, "")
    || recordText(legacyAuthor, ["avatarText"], "")
    || textField(entity?.authorAvatarText || entity?.avatarText, displayName || "同");
  const identityTag = textField(actor?.identityTag, "")
    || recordText(legacyAuthor, ["identityTag"], "")
    || textField(entity?.authorIdentityTag || entity?.identityTag, "");
  return { displayName, avatarUrl, avatarText, identityTag };
}

function renderTabs(tabs) {
  const el = $("#feedTabs");
  const currentTab = normalizeFeedTab(state.tab || "此刻");
  el.innerHTML = tabs.map((tab) => {
    const item = normalizeFeedTab(tab);
    if (!item.id || !item.label) return "";
    const active = item.id === currentTab.id || item.label === currentTab.label;
    return `<button class="chip ${active ? "is-active" : ""}" type="button" data-feed-tab="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`;
  }).join("");
}

function saveReadHistory() {
  localStorage.setItem("lian.readHistory", JSON.stringify(state.feed.readHistory.slice(-500)));
}

function readQuery() {
  return state.feed.readHistory.map((e) => e.tid).join(",");
}

function ensureMasonryColumns(reset = false) {
  const list = $("#feedList");
  if (reset || !list.querySelector(".masonry-column")) {
    list.innerHTML = `
      <div class="masonry-column" data-column="left"></div>
      <div class="masonry-column" data-column="right"></div>
    `;
    state.masonryHeights = [0, 0];
    state.feed.revealIndex = 0;
  }
  return $$(".masonry-column", list);
}

function estimateCardHeight(item) {
  const listWidth = $("#feedList")?.clientWidth || 340;
  const columnWidth = Math.max(140, (listWidth - 12) / 2);
  const cover = mediaUrlField(item.cover || item.coverUrl || item.imageUrl);
  const imageHeight = cover ? columnWidth * 1.32 : Math.max(160, columnWidth * 1.05);
  return imageHeight + 12;
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
  let revealIndex = state.feed.revealIndex || 0;
  for (const item of items) {
    const columnIndex = state.masonryHeights[0] <= state.masonryHeights[1] ? 0 : 1;
    const target = columns[columnIndex];
    const estimatedHeight = estimateCardHeight(item);
    target.insertAdjacentHTML("beforeend", cardTemplate(item, revealIndex));
    revealIndex += 1;
    state.masonryHeights[columnIndex] += estimatedHeight;
    measureCardLater(target.lastElementChild, columnIndex, estimatedHeight);
  }
  state.feed.revealIndex = revealIndex;
}

function cardTemplate(item, revealIndex = 0) {
  const revealDelay = Math.min(12, Math.max(0, Number(revealIndex) || 0)) * 40;
  const likedTids = readLikedTids();
  const title = textField(item.title, "未命名内容");
  const tag = textField(item.primaryTag || item.tag, "黎安");
  const cover = mediaUrlField(item.cover || item.coverUrl || item.imageUrl);
  const thumb = cover
    ? `<img src="${escapeHtml(displayImageUrl(cover))}" alt="${escapeHtml(title)}" loading="lazy">`
    : `<div class="thumb-empty">${escapeHtml(tag)}</div>`;
  const actor = normalizeDisplayActor(item);
  const authorAvatar = avatarHtml({
    url: actor.avatarUrl,
    text: actor.avatarText || actor.displayName || "同"
  });
  const likeCount = Math.max(0, Number(item.likeCount || 0));
  const isLiked = likedTids.has(String(item.tid));
  const likedClass = isLiked ? " is-liked" : "";
  const heart = isLiked ? "♥" : "♡";
  return `
    <article class="feed-card" role="button" tabindex="0" data-tid="${escapeHtml(String(item.tid))}" style="--reveal-delay:${revealDelay}ms">
      <div class="card-media">
        ${thumb}
        <div class="card-glass">
          <h2 class="card-title">${escapeHtml(title)}</h2>
          <div class="card-meta">
            <div class="card-author">
              <span class="card-avatar">${authorAvatar}</span>
              <span class="card-name">${escapeHtml(actor.displayName)}</span>
            </div>
            <button class="card-like${likedClass}" type="button" data-like-tid="${escapeHtml(String(item.tid))}" aria-label="点赞">
              <span class="card-like-icon" data-like-icon aria-hidden="true">${heart}</span>
              <span data-like-count>${likeCount}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function readLikedTids() {
  try {
    return new Set(JSON.parse(localStorage.getItem("lian.likedTids") || "[]").map(String));
  } catch {
    return new Set();
  }
}

function saveLikedTids(tids) {
  localStorage.setItem("lian.likedTids", JSON.stringify(Array.from(tids).slice(-1000)));
}

function setLikeButtonState(button, liked, likeCount) {
  const countEl = button.querySelector("[data-like-count]");
  const iconEl = button.querySelector("[data-like-icon]");
  button.classList.toggle("is-liked", Boolean(liked));
  if (iconEl) iconEl.textContent = liked ? "♥" : "♡";
  if (countEl) countEl.textContent = String(Math.max(0, Number(likeCount || 0)));
}

async function togglePostLike(button) {
  const tid = button?.dataset?.likeTid;
  if (!tid) return;
  if (!requireLoginUi()) return;
  const likedTids = readLikedTids();
  const previousLiked = button.classList.contains("is-liked");
  const previousCount = Math.max(0, Number(button.querySelector("[data-like-count]")?.textContent || 0));
  const nextLiked = !previousLiked;
  const nextCount = Math.max(0, previousCount + (nextLiked ? 1 : -1));
  button.disabled = true;
  setLikeButtonState(button, nextLiked, nextCount);
  if (nextLiked) likedTids.add(String(tid));
  else likedTids.delete(String(tid));
  saveLikedTids(likedTids);
  try {
    const data = await api(`/api/posts/${tid}/like`, {
      method: "POST",
      body: JSON.stringify({ liked: nextLiked })
    });
    setLikeButtonState(button, Boolean(data.liked), data.likeCount);
    const syncedLiked = readLikedTids();
    if (data.liked) syncedLiked.add(String(tid));
    else syncedLiked.delete(String(tid));
    saveLikedTids(syncedLiked);
  } catch (error) {
    setLikeButtonState(button, previousLiked, previousCount);
    const restored = readLikedTids();
    if (previousLiked) restored.add(String(tid));
    else restored.delete(String(tid));
    saveLikedTids(restored);
    alert(error.message);
  } finally {
    button.disabled = false;
  }
}

async function togglePostSave(button) {
  const tid = button?.dataset?.saveTid;
  if (!tid) return;
  if (!requireLoginUi()) return;
  const previousSaved = button.classList.contains("is-saved");
  const nextSaved = !previousSaved;
  button.disabled = true;
  button.classList.toggle("is-saved", nextSaved);
  const icon = button.querySelector("[data-save-icon]");
  if (icon) icon.textContent = nextSaved ? "★" : "☆";
  try {
    const data = await api(`/api/posts/${tid}/save`, {
      method: "POST",
      body: JSON.stringify({ saved: nextSaved })
    });
    button.classList.toggle("is-saved", Boolean(data.saved));
    if (icon) icon.textContent = data.saved ? "★" : "☆";
  } catch (error) {
    button.classList.toggle("is-saved", previousSaved);
    if (icon) icon.textContent = previousSaved ? "★" : "☆";
    alert(error.message);
  } finally {
    button.disabled = false;
  }
}

const reportCategories = [
  { value: "privacy", label: "隐私问题" },
  { value: "false_info", label: "虚假信息" },
  { value: "abuse", label: "违规内容" },
  { value: "wrong_location", label: "位置错误" },
  { value: "expired", label: "过期内容" },
  { value: "other", label: "其他" }
];

async function handleReportPost(tid) {
  if (!requireLoginUi()) return;
  const reason = prompt(
    "请选择举报原因（输入数字）：\n" +
    reportCategories.map((c, i) => `${i + 1}. ${c.label}`).join("\n"),
    ""
  );
  if (!reason) return;
  const index = Number(reason) - 1;
  const category = reportCategories[index] || reportCategories[reportCategories.length - 1];
  try {
    await api(`/api/posts/${tid}/report`, {
      method: "POST",
      body: JSON.stringify({ reason: category.label, category: category.value })
    });
    alert("举报已提交，感谢反馈。");
  } catch (error) {
    alert(error.message);
  }
}

function extractPostImages(contentHtml = "", fallbackUrl = "") {
  const container = document.createElement("div");
  container.innerHTML = String(contentHtml || "");
  const urls = Array.from(container.querySelectorAll("img"))
    .map((img) => img.getAttribute("src"))
    .filter(Boolean);
  container.querySelectorAll("img").forEach((img) => img.remove());
  const unique = Array.from(new Set(urls));
  if (!unique.length && fallbackUrl) unique.push(fallbackUrl);
  return { images: unique, strippedHtml: container.innerHTML.trim() };
}

function galleryTemplate(images = [], title = "") {
  if (!images.length) return "";
  const safeTitle = escapeHtml(title || "图片");
  const dots = images.length > 1
    ? `<div class="detail-gallery-dots" data-gallery-dots>
        ${images.map((_, index) => `
          <button class="detail-dot ${index === 0 ? "is-active" : ""}" type="button" data-gallery-dot="${index}" aria-label="图片 ${index + 1}"></button>
        `).join("")}
      </div>`
    : "";
  return `
    <div class="detail-hero">
      <section class="detail-gallery" data-gallery>
        ${images.map((url, index) => `
          <figure class="detail-gallery-item">
          <img src="${escapeHtml(displayImageUrl(url))}" alt="${safeTitle}" loading="lazy" data-zoom-image="${escapeHtml(displayImageUrl(url))}" data-gallery-index="${index}">
          </figure>
        `).join("")}
      </section>
      ${dots}
    </div>
  `;
}

function setupDetailGallery(root) {
  const gallery = root?.querySelector("[data-gallery]");
  const dots = root ? Array.from(root.querySelectorAll("[data-gallery-dot]")) : [];
  if (!gallery || !dots.length) return;
  let ticking = false;
  const update = () => {
    const index = Math.round(gallery.scrollLeft / Math.max(1, gallery.clientWidth));
    dots.forEach((dot, dotIndex) => dot.classList.toggle("is-active", dotIndex === index));
  };
  gallery.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  }, { passive: true });
  update();
}

function ensureImageLightbox() {
  let lightbox = $("#imageLightbox");
  if (lightbox) return lightbox;
  lightbox = document.createElement("div");
  lightbox.id = "imageLightbox";
  lightbox.className = "image-lightbox";
  lightbox.innerHTML = `
    <div class="image-lightbox-backdrop" data-close-lightbox></div>
    <img class="image-lightbox-image" alt="">
    <button class="image-lightbox-close" type="button" data-close-lightbox aria-label="关闭">×</button>
  `;
  document.body.appendChild(lightbox);
  return lightbox;
}

function openImageLightbox(src = "", alt = "") {
  if (!src) return;
  const lightbox = ensureImageLightbox();
  const image = lightbox.querySelector(".image-lightbox-image");
  image.src = src;
  image.alt = alt || "图片";
  lightbox.classList.add("is-visible");
  requestAnimationFrame(() => lightbox.classList.add("is-active"));
}

function closeImageLightbox() {
  const lightbox = $("#imageLightbox");
  if (!lightbox) return;
  lightbox.classList.remove("is-active");
  setTimeout(() => {
    lightbox.classList.remove("is-visible");
    const image = lightbox.querySelector(".image-lightbox-image");
    if (image) image.src = "";
  }, 220);
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

function detailStatusTemplate(message = "加载中") {
  return `
    <article class="detail-page-shell detail-page-status">
      <header class="detail-fixed-header detail-fixed-header-minimal">
        <button class="back-button" type="button" data-back-feed aria-label="返回">‹</button>
        <h1>${escapeHtml(message)}</h1>
      </header>
      <main class="detail-scroll-body">
        <div class="empty-state">${escapeHtml(message)}</div>
      </main>
    </article>
  `;
}

function detailBottomActionsTemplate(post) {
  const tid = escapeHtml(String(post.tid));
  return `
    <footer class="detail-bottom-actions" aria-label="帖子操作">
      <button class="detail-action-btn${post.liked ? " is-liked" : ""}" type="button" data-like-tid="${tid}" aria-label="喜欢">
        <span data-like-icon>${post.liked ? "♥" : "♡"}</span>
        <span>喜欢</span>
        <span data-like-count>${Math.max(0, Number(post.likeCount || 0))}</span>
      </button>
      <button class="detail-action-btn${post.bookmarked ? " is-saved" : ""}" type="button" data-save-tid="${tid}" aria-label="收藏">
        <span data-save-icon>${post.bookmarked ? "★" : "☆"}</span>
        <span>收藏</span>
      </button>
      <button class="detail-action-btn detail-action-report" type="button" data-report-tid="${tid}" aria-label="举报">
        <span>⚠</span>
        <span>举报</span>
      </button>
      <button class="detail-action-btn detail-action-reply" type="button" data-focus-reply aria-label="回复">
        <span>↩</span>
        <span>回复</span>
      </button>
    </footer>
  `;
}

function repliesTemplate(post) {
  const replies = Array.isArray(post.replies) ? post.replies : [];
  return `
    <section class="reply-panel" data-reply-panel>
      <div class="reply-panel-header">
        <h3>回复</h3>
        <span>${replies.length ? `${replies.length} 条` : "暂无"}</span>
      </div>
      <div class="reply-list">
        ${replies.length ? replies.map((reply) => {
          const actor = normalizeDisplayActor(reply);
          return `
          <article class="reply-item">
            <div class="reply-meta">
              <span>${escapeHtml(actor.displayName)}</span>
              <span>${escapeHtml(fixFmtDate(reply.timestampISO))}</span>
            </div>
            <div class="lian-html">${reply.contentHtml || ""}</div>
          </article>
        `;
        }).join("") : `<p class="reply-empty">还没有回复，来写第一条。</p>`}
      </div>
      <form class="reply-form" data-reply-form data-tid="${escapeHtml(String(post.tid))}">
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
    renderTabs(data.tabs || ["此刻", "精选"]);
    if (!data.items.length && reset) {
      $("#feedList").innerHTML = `<div class="empty-state">暂时没有内容</div>`;
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

async function openDetail(tid, options = {}) {
  const { refresh = false, preserveScroll = false, skipHistory = false } = options;
  const tidNum = Number(tid);
  const now = new Date().toISOString();
  const readHistory = state.feed.readHistory;
  const existing = readHistory.findIndex((e) => e.tid === tidNum);
  if (existing >= 0) readHistory.splice(existing, 1);
  readHistory.push({ tid: tidNum, lastViewedAt: now });
  saveReadHistory();
  const detailView = $('[data-view="detail"]');
  const alreadyInDetail = detailView?.classList.contains("is-active");
  if (!refresh && !alreadyInDetail) state.feedScrollY = window.scrollY;
  $("#detailBody").innerHTML = detailStatusTemplate("加载中");
  switchView("detail", { scroll: false });
  if (!skipHistory && location.hash !== `#/post/${tid}`) history.pushState({ view: "detail", tid }, "", `#/post/${tid}`);
  if (!preserveScroll) window.scrollTo({ top: 0 });
  try {
    const post = await api(`/api/posts/${tid}`);
    // Sync localStorage liked state with backend
    const likedTids = readLikedTids();
    if (post.liked) likedTids.add(String(tid));
    else likedTids.delete(String(tid));
    saveLikedTids(likedTids);
    const { images, strippedHtml } = extractPostImages(post.contentHtml || "", mediaUrlField(post.cover || ""));
    const title = textField(post.title, "帖子详情");
    const gallery = galleryTemplate(images, title);
    const actor = normalizeDisplayActor(post);
    const authorAvatar = avatarHtml({
      url: actor.avatarUrl,
      text: actor.avatarText || actor.displayName || "同"
    });
    const timeLabel = textField(post.timeLabel, "") || fixFmtDate(post.timestampISO);
    const identityTag = actor.identityTag
      ? `<span class="detail-author-tag">${escapeHtml(actor.identityTag)}</span>`
      : "";
    const bodyHtml = strippedHtml
      ? `<div class="detail-body lian-html">${strippedHtml}</div>`
      : "";
    $("#detailBody").innerHTML = `
      <article class="detail-page-shell">
        <header class="detail-fixed-header">
          <button class="back-button" type="button" data-back-feed aria-label="返回">‹</button>
          <div class="detail-fixed-avatar">${authorAvatar}</div>
          <div class="detail-fixed-meta">
            <div class="detail-fixed-row">
              <strong>${escapeHtml(actor.displayName)}</strong>
              <time>${escapeHtml(timeLabel)}</time>
            </div>
            ${identityTag}
          </div>
          <h1>${escapeHtml(title)}</h1>
        </header>
        <main class="detail-scroll-body">
          ${gallery}
          <section class="detail-content">
            ${bodyHtml || `<div class="detail-body detail-body-empty">暂无正文</div>`}
            ${originalLinkTemplate(post)}
            ${repliesTemplate(post)}
          </section>
        </main>
        ${detailBottomActionsTemplate(post)}
      </article>
    `;
    setupDetailGallery($("#detailBody"));
  } catch (error) {
    $("#detailBody").innerHTML = detailStatusTemplate(error.message || "详情加载失败");
  }
}

window.openDetail = openDetail;

function scrollToViewStart(name, options = {}) {
  if (options.scroll === false) return;
  const behavior = options.behavior || "auto";
  requestAnimationFrame(() => {
    if (name === "messages") {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
      return;
    }
    window.scrollTo({ top: 0, behavior });
  });
}

function switchView(name, options = {}) {
  if (name !== "detail") state.previousView = name;
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.dataset.view === name));
  $$(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === name));
  $(".tabbar").classList.remove("is-hidden");
  if (name === "map") window.MapV2?.init?.();
  if (name === "messages") switchMessageTab("channel");
  if (name === "profile") loadProfile();
  scrollToViewStart(name, options);
}

function backToFeed() {
  switchView(state.previousView || "feed", { scroll: false });
  requestAnimationFrame(() => window.scrollTo({ top: state.feedScrollY || 0 }));
  if (location.hash.startsWith("#/post/")) history.pushState({ view: state.previousView || "feed" }, "", location.pathname);
}
