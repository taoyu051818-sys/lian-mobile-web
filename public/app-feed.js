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
    state.feed.revealIndex = 0;
  }
  return $$(".masonry-column", list);
}

function estimateCardHeight(item) {
  const listWidth = $("#feedList")?.clientWidth || 340;
  const columnWidth = Math.max(140, (listWidth - 12) / 2);
  const imageHeight = item.cover ? columnWidth * 1.32 : Math.max(160, columnWidth * 1.05);
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
  const thumb = item.cover
    ? `<img src="${escapeHtml(displayImageUrl(item.cover))}" alt="${escapeHtml(item.title)}" loading="lazy">`
    : `<div class="thumb-empty">${escapeHtml(item.tag || "黎安")}</div>`;
  const authorName = item.author || "同学";
  const authorAvatar = avatarHtml({
    url: item.authorAvatarUrl || "",
    text: item.authorAvatarText || authorName || "同"
  });
  const timeLabel = item.timeLabel || fixFmtDate(item.timestampISO);
  return `
    <button class="feed-card" type="button" data-tid="${item.tid}" style="--reveal-delay:${revealDelay}ms">
      <div class="card-media">
        ${thumb}
        <div class="card-glass">
          <h2 class="card-title">${escapeHtml(item.title)}</h2>
          <div class="card-meta">
            <div class="card-author">
              <span class="card-avatar">${authorAvatar}</span>
              <span class="card-name">${escapeHtml(authorName)}</span>
            </div>
            <span class="card-time">${escapeHtml(timeLabel)}</span>
          </div>
        </div>
      </div>
    </button>
  `;
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
  image.alt = alt || "image";
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
    renderTabs(data.tabs || ["此刻", "精选"]);
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
    const { images, strippedHtml } = extractPostImages(post.contentHtml || "", post.cover || "");
    const gallery = galleryTemplate(images, post.title || "");
    const authorName = post.author || "同学";
    const authorAvatar = avatarHtml({
      url: post.authorAvatarUrl || "",
      text: post.authorAvatarText || authorName || "同"
    });
    const timeLabel = post.timeLabel || fixFmtDate(post.timestampISO);
    const identityTag = post.authorIdentityTag
      ? `<span class="detail-author-tag">${escapeHtml(post.authorIdentityTag)}</span>`
      : "";
    const bodyHtml = strippedHtml
      ? `<div class="detail-body lian-html">${strippedHtml}</div>`
      : "";
    $("#detailBody").innerHTML = `
      ${gallery}
      <section class="detail-content">
        <div class="detail-meta-card">
          <div class="detail-author-row">
            <div class="detail-author-avatar">${authorAvatar}</div>
            <div class="detail-author-info">
              <div class="detail-author-name">${escapeHtml(authorName)}</div>
              ${identityTag}
            </div>
            <div class="detail-time">${escapeHtml(timeLabel)}</div>
          </div>
          <h2>${escapeHtml(post.title)}</h2>
        </div>
        ${bodyHtml}
        ${originalLinkTemplate(post)}
        ${repliesTemplate(post)}
      </section>
    `;
    setupDetailGallery($("#detailBody"));
  } catch (error) {
    $("#detailBody").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

window.openDetail = openDetail;

function switchView(name) {
  if (name !== "detail") state.previousView = name;
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.dataset.view === name));
  $$(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === name));
  $(".tabbar").classList.remove("is-hidden");
  if (name === "map") window.MapV2?.init?.();
  if (name === "messages") loadMessages();
  if (name === "profile") loadProfile();
}

function backToFeed() {
  switchView(state.previousView || "feed");
  requestAnimationFrame(() => window.scrollTo({ top: state.feedScrollY || 0 }));
  if (location.hash.startsWith("#/post/")) history.pushState({ view: state.previousView || "feed" }, "", location.pathname);
}
