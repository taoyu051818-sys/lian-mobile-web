const tokenInput = document.querySelector("#adminToken");
const publicBaseInput = document.querySelector("#publicBase");
const runButton = document.querySelector("#runHealth");
const actionButtons = [...document.querySelectorAll("[data-action]")];
const summary = document.querySelector("#summary");
const actionStatus = document.querySelector("#actionStatus");
const checks = document.querySelector("#checks");
const raw = document.querySelector("#raw");

const TOKEN_KEY = "lian.ops.adminToken";
const BASE_KEY = "lian.ops.publicBase";

localStorage.removeItem(TOKEN_KEY);
tokenInput.value = sessionStorage.getItem(TOKEN_KEY) || "";
publicBaseInput.value = localStorage.getItem(BASE_KEY) || publicBaseInput.value;

function authToken() {
  return tokenInput.value.trim();
}

function saveInputs() {
  sessionStorage.setItem(TOKEN_KEY, authToken());
  localStorage.setItem(BASE_KEY, publicBaseInput.value.trim() || "https://lian.nat100.top");
}

function setSummary(text, ok = null) {
  summary.textContent = text;
  summary.className = `status ${ok === true ? "ok" : ok === false ? "bad" : "muted"}`;
}

function setActionStatus(text, ok = null) {
  actionStatus.textContent = text;
  actionStatus.className = `status ${ok === true ? "ok" : ok === false ? "bad" : "muted"}`;
}

function setBusy(isBusy) {
  runButton.disabled = isBusy;
  actionButtons.forEach((button) => {
    button.disabled = isBusy;
  });
}

function renderChecks(items = []) {
  checks.innerHTML = items.map((item) => {
    const ok = item.ok && (!item.status || (item.status >= 200 && item.status < 300));
    const details = Object.entries(item)
      .filter(([key]) => !["name", "ok"].includes(key))
      .map(([key, value]) => `<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(formatValue(value))}</div>`)
      .join("");
    return `<article class="check"><h3 class="${ok ? "ok" : "bad"}">${escapeHtml(item.name || "check")} ${ok ? "✓" : "✗"}</h3>${details}</article>`;
  }).join("") || "<p class=\"muted\">暂无检查结果</p>";
}

function formatValue(value) {
  if (Array.isArray(value)) return value.join("\n");
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value ?? "");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function requireToken() {
  if (authToken()) return true;
  setSummary("请先输入 ADMIN_TOKEN", false);
  setActionStatus("请先输入 ADMIN_TOKEN", false);
  tokenInput.focus();
  return false;
}

async function runHealthCheck() {
  const publicBase = publicBaseInput.value.trim() || "https://lian.nat100.top";
  if (!requireToken()) return;

  saveInputs();
  setBusy(true);
  setSummary("检查中...", null);
  raw.textContent = "{}";
  renderChecks([]);

  try {
    const response = await fetch(`/api/ops/health?publicBase=${encodeURIComponent(publicBase)}`, {
      headers: {
        authorization: `Bearer ${authToken()}`,
        accept: "application/json"
      },
      credentials: "include"
    });
    const data = await response.json().catch(() => ({}));
    raw.textContent = JSON.stringify(data, null, 2);
    renderChecks(data.checks || []);
    if (!response.ok) {
      setSummary(data.error || `检查失败，HTTP ${response.status}`, false);
    } else {
      setSummary(data.ok ? "健康检查通过：单公网入口、Ops、API、地图正常" : "健康检查未通过，请查看检查项", Boolean(data.ok));
    }
  } catch (error) {
    setSummary(error?.message || "检查失败", false);
  } finally {
    setBusy(false);
  }
}

async function runOpsAction(action) {
  if (!requireToken()) return;
  const label = document.querySelector(`[data-action="${action}"]`)?.textContent?.trim() || action;
  if (!confirm(`确认执行：${label}？`)) return;

  saveInputs();
  setBusy(true);
  setActionStatus(`${label} 已提交，等待后台执行...`, null);

  try {
    const response = await fetch(`/api/ops/action?action=${encodeURIComponent(action)}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${authToken()}`,
        accept: "application/json"
      },
      credentials: "include"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      setActionStatus(data.error || `${label} 触发失败，HTTP ${response.status}`, false);
      raw.textContent = JSON.stringify(data, null, 2);
      return;
    }
    setActionStatus(`${label} 已触发。日志：${data.logPath || "见 /tmp/lian-ops-*.log"}。稍等几秒后运行健康检查。`, true);
    raw.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    setActionStatus(error?.message || `${label} 触发失败`, false);
  } finally {
    setBusy(false);
  }
}

runButton.addEventListener("click", runHealthCheck);
actionButtons.forEach((button) => {
  button.addEventListener("click", () => runOpsAction(button.dataset.action));
});
