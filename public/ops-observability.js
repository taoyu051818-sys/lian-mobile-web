const observabilityPanel = document.querySelector("#observability");
const healthButton = document.querySelector("#runHealth");
const adminTokenInput = document.querySelector("#adminToken");
const rawPanel = document.querySelector("#raw");

function htmlEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function badge(ok, text) {
  const cls = ok === true ? "badge" : ok === false ? "badge bad" : "badge muted";
  return `<span class="${cls}">${htmlEscape(text)}</span>`;
}

function compactList(items = []) {
  if (!items.length) return "";
  return `<ul class="compact">${items.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>`;
}

function repoCard(title, repo = {}) {
  const dirty = Boolean(repo.dirty);
  return `
    <article class="obs-card">
      <h3>${htmlEscape(title)} ${badge(repo.ok && !dirty, dirty ? "dirty" : repo.ok ? "ok" : "error")}</h3>
      <div class="obs-kv">
        <strong>branch</strong><span>${htmlEscape(repo.branch || "unknown")}</span>
        <strong>commit</strong><span>${htmlEscape(repo.shortSha || repo.sha || "unknown")}</span>
        <strong>package</strong><span>${htmlEscape(repo.package?.name || "unknown")}@${htmlEscape(repo.package?.version || "unknown")}</span>
        <strong>verify</strong><span>${repo.package?.hasVerify ? "yes" : "no"}</span>
        <strong>path</strong><span>${htmlEscape(repo.path || "")}</span>
      </div>
      ${compactList(repo.dirtyFiles || [])}
    </article>
  `;
}

function runtimeCard(title, runtime = {}) {
  const uptime = runtime.uptimeMs ? `${Math.round(runtime.uptimeMs / 1000)}s` : runtime.activeSince || "unknown";
  return `
    <article class="obs-card">
      <h3>${htmlEscape(title)} ${badge(runtime.ok, runtime.status || "unknown")}</h3>
      <div class="obs-kv">
        <strong>manager</strong><span>${htmlEscape(runtime.manager || "unknown")}</span>
        <strong>name</strong><span>${htmlEscape(runtime.name || "unknown")}</span>
        <strong>pid</strong><span>${htmlEscape(runtime.pid || "-")}</span>
        <strong>restarts</strong><span>${htmlEscape(runtime.restarts ?? 0)}</span>
        <strong>uptime</strong><span>${htmlEscape(uptime)}</span>
        <strong>memory</strong><span>${runtime.memoryBytes ? `${Math.round(runtime.memoryBytes / 1024 / 1024)} MB` : "-"}</span>
      </div>
      ${runtime.error ? `<p class="bad">${htmlEscape(runtime.error)}</p>` : ""}
    </article>
  `;
}

function renderObservability(data = null, error = "") {
  if (!observabilityPanel) return;
  if (error) {
    observabilityPanel.innerHTML = `<p class="bad">${htmlEscape(error)}</p>`;
    return;
  }
  if (!data) {
    observabilityPanel.innerHTML = `<p class="muted">暂无运行时状态</p>`;
    return;
  }

  const summary = data.summary || {};
  observabilityPanel.innerHTML = `
    <div class="obs-card">
      <h3>总览 ${badge(Boolean(summary.ok), summary.ok ? "healthy" : "needs attention")}</h3>
      <div class="obs-kv">
        <strong>generated</strong><span>${htmlEscape(data.generatedAt || "unknown")}</span>
        <strong>backend</strong><span>${htmlEscape(summary.backendSha || "unknown")} / ${htmlEscape(summary.backendStatus || "unknown")}</span>
        <strong>frontend</strong><span>${htmlEscape(summary.frontendSha || "unknown")} / ${htmlEscape(summary.frontendStatus || "unknown")}</span>
        <strong>dirty</strong><span>backend=${summary.backendDirty ? "yes" : "no"}, frontend=${summary.frontendDirty ? "yes" : "no"}</span>
      </div>
    </div>
    <div class="obs-grid">
      ${repoCard("后端仓库", data.repositories?.backend)}
      ${repoCard("前端仓库", data.repositories?.frontend)}
      ${runtimeCard("后端运行时", data.runtimes?.backend)}
      ${runtimeCard("前端运行时", data.runtimes?.frontend)}
    </div>
  `;
}

async function refreshObservability() {
  const token = adminTokenInput?.value?.trim() || "";
  if (!token) {
    renderObservability(null, "请先输入 ADMIN_TOKEN");
    return;
  }

  renderObservability(null);
  try {
    const headers = { accept: "application/json" };
    headers.authorization = `Bearer ${token}`;
    const response = await fetch("/api/ops/observability", {
      headers,
      credentials: "include"
    });
    const data = await response.json().catch(() => ({}));
    renderObservability(response.ok ? data : null, response.ok ? "" : data.error || `运行时状态获取失败，HTTP ${response.status}`);

    if (rawPanel && response.ok) {
      const current = JSON.parse(rawPanel.textContent || "{}");
      rawPanel.textContent = JSON.stringify({ ...current, observability: data }, null, 2);
    }
  } catch (error) {
    renderObservability(null, error?.message || "运行时状态获取失败");
  }
}

healthButton?.addEventListener("click", () => {
  refreshObservability();
});
