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
  const user = state.currentUser;
  const tags = user?.identityTags?.length ? user.identityTags : [];
  select.innerHTML = tags.length
    ? tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join("")
    : `<option value="">同学</option>`;
  select.disabled = !tags.length;
  const activeAlias = user?.activeAliasId
    ? (user.aliases || []).find((a) => a.id === user.activeAliasId)
    : null;
  const displayName = activeAlias?.name || user?.username || "同";
  const displayAvatar = activeAlias?.avatarUrl || user?.avatarUrl || "";
  const avatar = $("#channelComposerAvatar");
  if (avatar) avatar.innerHTML = avatarHtml({ url: displayAvatar, text: displayName });
  const nameLabel = $("#channelComposerName");
  if (nameLabel) nameLabel.textContent = displayName;
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
