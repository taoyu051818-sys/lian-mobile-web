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
        <div class="profile-identity-section">
          <h3>发布身份</h3>
          ${(user.aliases || []).length ? `
            <label class="profile-identity-option">
              <input type="radio" name="profileIdentity" value="" ${!user.activeAliasId ? "checked" : ""}>
              <span>${escapeHtml(user.username)}</span>
              <span class="identity-hint">真实身份</span>
            </label>
            ${user.aliases.map((a) => `
              <label class="profile-identity-option">
                <input type="radio" name="profileIdentity" value="${escapeHtml(a.id)}" ${a.id === user.activeAliasId ? "checked" : ""}>
                <span>${escapeHtml(a.name)}</span>
                <span class="identity-hint">官方马甲</span>
              </label>
            `).join("")}
          ` : `<p class="identity-hint">暂无可用官方马甲，当前使用真实身份发布。</p>`}
        </div>
        <div class="profile-actions">
          ${user.invitePermission ? `<button type="button" data-create-invite>生成邀请码</button>` : ""}
          <button type="button" data-auth-logout>退出登录</button>
        </div>
        <p class="invite-result" id="inviteResult"></p>
      `;
      panel.addEventListener("change", async (event) => {
        if (event.target.name !== "profileIdentity") return;
        const aliasId = event.target.value;
        try {
          if (aliasId) {
            const data = await api("/api/auth/aliases/activate", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ aliasId })
            });
            state.currentUser.activeAliasId = data.activeAliasId;
          } else {
            await api("/api/auth/aliases/deactivate", { method: "POST" });
            state.currentUser.activeAliasId = null;
          }
        } catch (error) {
          alert(error.message);
          await loadProfile();
        }
      });
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
  setPublishProgress({ visible: true, label: "准备发布", percent: 3 });
  try {
    const fields = new FormData(form);
    const images = fields.getAll("image").filter((file) => file && file.size);
    fields.delete("image");
    const payload = Object.fromEntries(fields.entries());
    if (payload.occurredAt) {
      payload.content = `${payload.content || ""}\n\n时间：${formatOccurredAt(payload.occurredAt)}`.trim();
    }
    if ((payload.mapX && payload.mapY) || (payload.lat && payload.lng)) {
      payload.mapLocation = {
        x: payload.mapX ? Number(payload.mapX) : undefined,
        y: payload.mapY ? Number(payload.mapY) : undefined,
        lat: payload.lat ? Number(payload.lat) : undefined,
        lng: payload.lng ? Number(payload.lng) : undefined,
        placeName: payload.placeName || "",
        mapVersion: payload.lat && payload.lng ? "gaode_v2" : "legacy"
      };
    }
    if (images.length) {
      button.textContent = "上传图片中";
      payload.imageUrls = await uploadPostImages(images, (index, total, stage) => {
        const step = index * 2 + (stage === "compress" ? 0 : stage === "upload" ? 1 : 2);
        const percent = 5 + (step / Math.max(1, total * 2)) * 82;
        const action = stage === "compress" ? "压缩" : stage === "upload" ? "上传" : "完成";
        const label = `${action}图片 ${index + 1}/${total}`;
        button.textContent = label;
        setPublishProgress({ visible: true, label, percent });
      });
      payload.imageUrl = payload.imageUrls[0] || "";
      button.textContent = "发布中";
    }
    if (state.currentUser?.activeAliasId) {
      payload.aliasId = state.currentUser.activeAliasId;
    }
    setPublishProgress({ visible: true, label: "提交内容", percent: 90 });
    await api("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    setPublishProgress({ visible: true, label: "发布完成", percent: 100 });
    $("#publishSheet").close();
    form.reset();
    state.mapPickedPoint = null;
    updatePublishLocationNote();
    await loadFeed(true);
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
    resetPublishProgress();
    button.textContent = "发布到 LIAN";
  }
}
