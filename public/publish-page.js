function publishPageOpen() {
  state.publish.active = true;
  state.publish.step = "imageSelect";
  state.publish.imageUrls = [];
  state.publish.localImageUrls = [];
  state.publish.selectedFiles = [];
  state.publish.uploadPromise = null;
  state.publish.uploadProgress = {};
  state.publish.locationDraft = null;
  state.publish.title = "";
  state.publish.body = "";
  state.publish.tags = [];
  state.publish.metadata = {};
  state.publish.audience = null;
  state.publish.userEditedAudience = false;
  state.publish.riskFlags = [];
  state.publish.confidence = 0;
  state.publish.needsHumanReview = false;
  state.publish.aiMode = "";
  state.publish.previewLoading = false;
  state.publish.uploadLoading = false;
  state.publish.draftSaving = false;
  state.publish.draftSaveStatus = "";
  state.publish.draftId = "";
  switchView("publish");
  publishPageRender();
}

function publishPageBack() {
  if (state.publish.step === "imageSelect") {
    state.publish.active = false;
    switchView("feed");
    return;
  }
  if (state.publish.step === "locationPick") {
    state.publish.step = "imageSelect";
    publishPageRender();
    return;
  }
  if (state.publish.step === "draftReview") {
    state.publish.step = "locationPick";
    publishPageRender();
    return;
  }
}

function publishPageRender() {
  const content = $("#publishPageContent");
  const label = $("#publishStepLabel");
  if (!content) return;
  const step = state.publish.step;
  if (label) {
    label.textContent = step === "imageSelect" ? "1/3 选择图片"
      : step === "locationPick" ? "2/3 选择地点"
      : "3/3 编辑发布";
  }
  if (step === "imageSelect") {
    publishPageRenderImageSelect(content);
  } else if (step === "locationPick") {
    publishPageRenderLocationPick(content);
  } else if (step === "draftReview") {
    publishPageRenderDraftReview(content);
  }
}

function publishPageRenderImageSelect(container) {
  const hasImages = state.publish.selectedFiles.length > 0 || state.publish.imageUrls.length > 0;
  const thumbUrls = state.publish.localImageUrls.length > 0 ? state.publish.localImageUrls : state.publish.imageUrls;
  container.innerHTML = `
    <div class="publish-page-section">
      ${!hasImages ? `
        <label class="publish-upload-zone">
          <h3>选择图片</h3>
          <p>选择图片，LIAN 会帮你生成内容</p>
          <input id="publishPageImageInput" type="file" accept="image/*" multiple style="display:none">
        </label>
      ` : `
        <div class="publish-image-grid">
          ${thumbUrls.map((url, i) => `
            <div class="publish-image-thumb">
              <img src="${escapeHtml(state.publish.imageUrls[i] ? displayImageUrl(state.publish.imageUrls[i]) : url)}" alt="">
              <button type="button" data-publish-remove-image="${i}" class="publish-image-remove" aria-label="移除">×</button>
            </div>
          `).join("")}
        </div>
        <label class="publish-upload-zone" style="padding:16px">
          <p>+ 继续添加</p>
          <input id="publishPageImageInput" type="file" accept="image/*" multiple style="display:none">
        </label>
      `}
      ${state.publish.uploadLoading ? '<p class="publish-status">图片上传中，可先选择地点...</p>' : ""}
    </div>
  `;
}

function publishPageRenderLocationPick(container) {
  const draft = state.publish.locationDraft;
  const locationLabel = draft?.skipped
    ? "已跳过定位"
    : (draft?.displayName || draft?.locationArea || "未选择地点");
  const uploadedCount = state.publish.imageUrls.filter(Boolean).length;
  const totalCount = state.publish.selectedFiles.length;
  const uploadDone = !state.publish.uploadLoading && uploadedCount >= totalCount;
  container.innerHTML = `
    <div class="publish-page-section">
      <h3>这些照片在哪里？</h3>
      ${!uploadDone ? `<p class="publish-status">图片上传中 (${uploadedCount}/${totalCount})，可先选择地点</p>` : ""}
      <div class="publish-location-embed" id="publishMapEmbed"></div>
      <label>
        地点
        <input id="publishLocationInput" autocomplete="off" value="${escapeHtml(draft?.skipped ? "" : locationLabel)}" placeholder="输入地点，或在地图上选择">
      </label>
      <div class="publish-actions">
        <button type="button" data-publish-skip-location>跳过定位</button>
        <button class="primary" type="button" data-publish-confirm-location>下一步</button>
      </div>
    </div>
  `;
  publishPageInitMapPick();
}

function publishPageRenderDraftReview(container) {
  const p = state.publish;
  const locationDraft = p.locationDraft;
  const locationLabel = locationDraft?.skipped
    ? "已跳过定位"
    : (locationDraft?.displayName || locationDraft?.locationArea || "未选择地点");
  const audienceOptions = [
    { value: "public", label: "公开" },
    { value: "campus", label: "校园" },
    { value: "school", label: "本校" },
    { value: "private", label: "仅自己" }
  ];
  const currentAudience = p.audience || p.metadata?.visibility || "public";
  container.innerHTML = `
    <div class="publish-page-section">
      <p class="publish-status">${
        p.previewLoading ? "AI 正在生成草稿..."
        : p.draftSaving ? "草稿自动保存中..."
        : (p.draftSaveStatus || "")
      }</p>
      <label>
        标题
        <input id="publishTitleInput" maxlength="40" required value="${escapeHtml(p.title || "")}">
      </label>
      <label>
        正文
        <textarea id="publishBodyInput" rows="6" maxlength="300" required>${escapeHtml(p.body || "")}</textarea>
      </label>
      <label>
        标签
        <input id="publishTagsInput" maxlength="80" value="${escapeHtml((p.tags || []).join(" "))}" placeholder="最多 5 个，用空格分隔">
      </label>
      <p>地点：${escapeHtml(locationLabel)}</p>
      <h4>可见范围</h4>
      <div class="publish-audience-picker">
        ${audienceOptions.map((opt) => `
          <button type="button" class="publish-audience-option${currentAudience === opt.value ? " is-active" : ""}" data-publish-audience="${opt.value}">${opt.label}</button>
        `).join("")}
      </div>
      ${p.riskFlags?.length ? `
        <div class="ai-risk-list">
          ${p.riskFlags.map((flag) => `<p>${escapeHtml(flag.message || "")}</p>`).join("")}
        </div>
      ` : ""}
    </div>
    <div class="publish-actions">
      <button type="button" data-publish-save-draft>保存草稿</button>
      <button class="primary" type="button" data-publish-submit>发布到 LIAN</button>
      <button type="button" data-publish-regenerate>重新生成</button>
    </div>
  `;
}

function publishPageConfirmImages() {
  if (!state.publish.selectedFiles.length) return;
  state.publish.step = "locationPick";
  publishPageRender();
}

async function publishPageSkipLocation() {
  state.publish.locationDraft = {
    source: "skipped",
    locationId: "",
    locationArea: "",
    displayName: "",
    lat: null,
    lng: null,
    legacyPoint: { x: null, y: null },
    imagePoint: { x: null, y: null },
    mapVersion: "legacy",
    confidence: 0,
    skipped: true,
    note: ""
  };
  if (state.publish.uploadPromise) await state.publish.uploadPromise;
  state.publish.imageUrls = state.publish.imageUrls.filter(Boolean);
  if (!state.publish.imageUrls.length) {
    state.publish.step = "imageSelect";
    publishPageRender();
    return;
  }
  state.publish.step = "draftReview";
  publishPageRender();
  publishPageRequestPreview();
}

async function publishPageConfirmLocation() {
  const input = $("#publishLocationInput");
  const placeName = input ? input.value.trim() : "";
  if (!state.publish.locationDraft || state.publish.locationDraft.skipped) {
    state.publish.locationDraft = {
      source: placeName ? "manual" : "legacy_map",
      locationId: "",
      locationArea: placeName,
      displayName: placeName,
      lat: null,
      lng: null,
      legacyPoint: { x: null, y: null },
      imagePoint: { x: null, y: null },
      mapVersion: "legacy",
      confidence: placeName ? 0.65 : 0,
      skipped: false,
      note: ""
    };
  }
  if (state.publish.uploadPromise) await state.publish.uploadPromise;
  state.publish.imageUrls = state.publish.imageUrls.filter(Boolean);
  if (!state.publish.imageUrls.length) {
    state.publish.step = "imageSelect";
    publishPageRender();
    return;
  }
  state.publish.step = "draftReview";
  publishPageRender();
  publishPageRequestPreview();
}

function publishPageInitMapPick() {
  const embed = $("#publishMapEmbed");
  if (!embed || !window.MapV2) return;
  if (typeof window.MapV2.startPickInContainer === "function") {
    window.MapV2.startPickInContainer(embed, (draft) => {
      state.publish.locationDraft = draft;
      const input = $("#publishLocationInput");
      if (input) input.value = draft.displayName || draft.locationArea || "";
    });
  }
}

async function publishPageHandleImageSelect(files) {
  if (!files?.length) return;
  for (const file of files) {
    state.publish.selectedFiles.push(file);
    state.publish.localImageUrls.push(URL.createObjectURL(file));
  }
  state.publish.uploadLoading = true;
  state.publish.step = "locationPick";
  publishPageRender();
  state.publish.uploadPromise = (async () => {
    try {
      for (let i = state.publish.imageUrls.length; i < state.publish.selectedFiles.length; i++) {
        try {
          const compressed = await compressImageForUpload(state.publish.selectedFiles[i]);
          const url = await uploadImage(compressed, "publish-v2");
          state.publish.imageUrls[i] = url;
        } catch (err) {
          console.warn("image upload failed:", err.message);
        }
      }
      state.publish.imageUrls = state.publish.imageUrls.filter(Boolean);
    } catch (error) {
      alert(error.message);
    } finally {
      state.publish.uploadLoading = false;
      publishPageRender();
    }
  })();
}

function publishPageRemoveImage(index) {
  if (state.publish.localImageUrls[index]) {
    URL.revokeObjectURL(state.publish.localImageUrls[index]);
  }
  state.publish.localImageUrls.splice(index, 1);
  state.publish.selectedFiles.splice(index, 1);
  state.publish.imageUrls.splice(index, 1);
  if (!state.publish.selectedFiles.length) {
    state.publish.step = "imageSelect";
  }
  publishPageRender();
}

async function publishPageRequestPreview() {
  if (!state.publish.imageUrls.length) return;
  state.publish.previewLoading = true;
  publishPageRender();
  try {
    const locationDraft = state.publish.locationDraft;
    const data = await api("/api/ai/post-preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageUrl: state.publish.imageUrls[0],
        imageUrls: state.publish.imageUrls,
        template: "campus_moment",
        locationHint: locationDraft?.locationArea || "",
        visibilityHint: state.publish.metadata?.visibility || "public"
      })
    });
    publishPageApplyPreview(data);
    publishPageRender();
    publishPageSaveDraftSilently();
  } catch (error) {
    alert(error.message);
  } finally {
    state.publish.previewLoading = false;
    publishPageRender();
  }
}

function publishPageApplyPreview(data) {
  const draft = data.draft || {};
  state.publish.aiMode = data.mode || "";
  if (!state.publish.title) state.publish.title = draft.title || "";
  if (!state.publish.body) state.publish.body = draft.body || "";
  if (!state.publish.tags?.length) state.publish.tags = Array.isArray(draft.tags) ? draft.tags : [];
  state.publish.metadata = draft.metadata || {};
  state.publish.riskFlags = Array.isArray(data.riskFlags) ? data.riskFlags : [];
  state.publish.confidence = Number(data.confidence || 0);
  state.publish.needsHumanReview = Boolean(data.needsHumanReview);
  if (!state.publish.userEditedAudience && draft.metadata?.visibility) {
    state.publish.audience = draft.metadata.visibility;
  }
  if (!state.publish.locationDraft?.locationArea && !state.publish.locationDraft?.skipped) {
    state.publish.locationDraft = data.locationDraft || state.publish.locationDraft;
  }
}

function publishPageSyncFromInputs() {
  const title = $("#publishTitleInput");
  const body = $("#publishBodyInput");
  const tags = $("#publishTagsInput");
  if (title) state.publish.title = title.value;
  if (body) state.publish.body = body.value;
  if (tags) state.publish.tags = [...new Set(String(tags.value || "").split(/[\s,，#]+/).map((t) => t.trim()).filter(Boolean))].slice(0, 5);
}

function publishPageBuildPayload() {
  publishPageSyncFromInputs();
  const p = state.publish;
  const metadata = { ...(p.metadata || {}) };
  const locationDraft = p.locationDraft;
  metadata.locationArea = locationDraft?.skipped ? "" : (locationDraft?.locationArea || metadata.locationArea || "");
  metadata.visibility = p.metadata?.visibility || "public";
  if (p.audience) metadata.visibility = p.audience;
  metadata.distribution = metadata.locationArea ? ["home", "map", "search", "detail"] : ["home", "search", "detail"];
  return {
    imageUrl: p.imageUrls[0] || "",
    imageUrls: p.imageUrls,
    title: p.title,
    body: p.body,
    tags: p.tags,
    metadata,
    locationDraft,
    riskFlags: p.riskFlags,
    confidence: p.confidence,
    needsHumanReview: p.needsHumanReview,
    aiMode: p.aiMode,
    aliasId: state.currentUser?.activeAliasId || undefined
  };
}

async function publishPageSaveDraft() {
  publishPageSyncFromInputs();
  state.publish.draftSaving = true;
  state.publish.draftSaveStatus = "";
  publishPageRender();
  try {
    const payload = publishPageBuildPayload();
    const data = await api("/api/ai/post-drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    state.publish.draftId = data.draftId || "";
    state.publish.draftSaveStatus = data.draftId ? "草稿已保存" : "";
  } catch (error) {
    state.publish.draftSaveStatus = "";
  } finally {
    state.publish.draftSaving = false;
    publishPageRender();
  }
}

async function publishPageSaveDraftSilently() {
  try {
    await publishPageSaveDraft();
  } catch {
    state.publish.draftSaving = false;
    state.publish.draftSaveStatus = "";
  }
}

async function publishPagePublish() {
  publishPageSyncFromInputs();
  const payload = publishPageBuildPayload();
  try {
    const data = await api("/api/ai/post-publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    state.publish.active = false;
    switchView("feed");
    await loadFeed(true);
    if (data.tid) openDetail(data.tid);
  } catch (error) {
    alert(error.message);
  }
}

async function publishPageRegenerate() {
  state.publish.title = "";
  state.publish.body = "";
  state.publish.tags = [];
  state.publish.userEditedAudience = false;
  await publishPageRequestPreview();
}

function publishPageSetAudience(value) {
  state.publish.audience = value;
  state.publish.userEditedAudience = true;
  if (state.publish.metadata) state.publish.metadata.visibility = value;
  publishPageRender();
}

window.publishPageOpen = publishPageOpen;
window.publishPageBack = publishPageBack;
window.publishPageConfirmImages = publishPageConfirmImages;
window.publishPageSkipLocation = publishPageSkipLocation;
window.publishPageConfirmLocation = publishPageConfirmLocation;
window.publishPageHandleImageSelect = publishPageHandleImageSelect;
window.publishPageRemoveImage = publishPageRemoveImage;
window.publishPageSaveDraft = publishPageSaveDraft;
window.publishPagePublish = publishPagePublish;
window.publishPageRegenerate = publishPageRegenerate;
window.publishPageSetAudience = publishPageSetAudience;
