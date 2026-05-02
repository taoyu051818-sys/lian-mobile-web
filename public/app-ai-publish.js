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
  window.MapV2?.startPick?.(applyMapV2LocationPick);
}

function applyMapV2LocationPick(locationDraft) {
  state.mapPickingLocation = false;
  state.mapPickedPoint = null;
  if (state.aiPublish.active) {
    state.aiPublish.locationDraft = locationDraft;
    renderAiPublishSheet();
  }
  const form = $("#publishForm");
  if (form) {
    form.elements.placeName.value = locationDraft.displayName || locationDraft.locationArea || "";
    form.elements.lat.value = locationDraft.lat ?? "";
    form.elements.lng.value = locationDraft.lng ?? "";
    form.elements.mapX.value = locationDraft.legacyPoint?.x ?? "";
    form.elements.mapY.value = locationDraft.legacyPoint?.y ?? "";
    updatePublishLocationNote(form);
  }
  updatePublishIdentityNote();
  window.MapV2?.stopPick?.();
  $("#publishSheet").showModal();
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
  updatePublishIdentityNote();
  $("#publishSheet").showModal();
}

function updatePublishIdentityNote() {
  const note = $("#publishIdentityNote");
  if (!note) return;
  const activeAlias = state.currentUser?.aliases?.find((a) => a.id === state.currentUser?.activeAliasId);
  note.textContent = activeAlias
    ? `当前发布身份：${activeAlias.name}`
    : `当前发布身份：${state.currentUser?.username || "真实身份"}`;
}

function updatePublishLocationNote(form = $("#publishForm")) {
  const note = $("#publishLocationNote");
  if (!note) return;
  const mapX = form.elements.mapX.value;
  const mapY = form.elements.mapY.value;
  const lat = form.elements.lat.value;
  const lng = form.elements.lng.value;
  const placeName = form.elements.placeName.value;
  if (lat && lng) {
    note.textContent = `已选点：${placeName || "地图位置"} (${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)})`;
    return;
  }
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
    source: lat && lng ? "map_v2" : (mapX && mapY ? "legacy_map" : (placeName ? "manual" : "legacy_map")),
    locationArea: placeName,
    displayName: placeName,
    lat: lat ? Number(lat) : null,
    lng: lng ? Number(lng) : null,
    legacyPoint: { x: mapX ? Number(mapX) : null, y: mapY ? Number(mapY) : null },
    imagePoint: { x: mapX ? Number(mapX) : null, y: mapY ? Number(mapY) : null },
    mapVersion: lat && lng ? "gaode_v2" : "legacy",
    confidence: lat && lng ? 0.72 : (placeName ? 0.65 : 0),
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
  if (!locationDraft.skipped && locationDraft.lat && locationDraft.lng) {
    metadata.lat = locationDraft.lat;
    metadata.lng = locationDraft.lng;
    metadata.mapVersion = locationDraft.mapVersion || "gaode_v2";
  }
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
    aiMode: state.aiPublish.aiMode || "",
    aliasId: state.currentUser?.activeAliasId || undefined
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
    uploadLoading: false,
    draftSaving: false,
    draftSaveStatus: "",
    draftId: ""
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
        <img src="${escapeHtml(displayImageUrl(state.aiPublish.imageUrl))}" alt="">
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
        <p class="publish-status">${
          state.aiPublish.previewLoading
            ? "AI 正在生成草稿..."
            : state.aiPublish.draftSaving
              ? "草稿自动保存中..."
              : (state.aiPublish.draftSaveStatus || "")
        }</p>
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
    renderAiPublishSheet();
    await saveAiDraftSilently();
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
  state.aiPublish.draftSaving = true;
  state.aiPublish.draftSaveStatus = "";
  renderAiPublishSheet();
  try {
    const data = await api("/api/ai/post-drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    state.aiPublish.draftId = data.draftId || "";
    state.aiPublish.draftSaveStatus = data.draftId ? "草稿已自动保存" : "";
    return data;
  } finally {
    state.aiPublish.draftSaving = false;
    renderAiPublishSheet();
  }
}

async function saveAiDraftSilently() {
  try {
    await saveAiDraft();
  } catch (error) {
    state.aiPublish.draftSaving = false;
    state.aiPublish.draftSaveStatus = `草稿自动保存失败：${error.message}`;
    renderAiPublishSheet();
  }
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
