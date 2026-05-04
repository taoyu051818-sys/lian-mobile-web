const tokenInput = document.querySelector("#adminToken");
const publicBaseInput = document.querySelector("#publicBase");
const runButton = document.querySelector("#runHealth");
const summary = document.querySelector("#summary");
const checks = document.querySelector("#checks");
const raw = document.querySelector("#raw");

const TOKEN_KEY = "lian.ops.adminToken";
const BASE_KEY = "lian.ops.publicBase";

tokenInput.value = localStorage.getItem(TOKEN_KEY) || "";
publicBaseInput.value = localStorage.getItem(BASE_KEY) || publicBaseInput.value;

function setSummary(text, ok = null) {
  summary.textContent = text;
  summary.className = `status ${ok === true ? "ok" : ok === false ? "bad" : "muted"}`;
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

async function runHealthCheck() {
  const token = tokenInput.value.trim();
  const publicBase = publicBaseInput.value.trim() || "https://lian.nat100.top";
  if (!token) {
    setSummary("请先输入 ADMIN_TOKEN", false);
    tokenInput.focus();
    return;
  }

  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(BASE_KEY, publicBase);
  runButton.disabled = true;
  setSummary("检查中...", null);
  raw.textContent = "{}";
  renderChecks([]);

  try {
    const response = await fetch(`/api/ops/health?publicBase=${encodeURIComponent(publicBase)}`, {
      headers: {
        authorization: `Bearer ${token}`,
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
      setSummary(data.ok ? "健康检查通过：公网/API/地图/图片直链正常" : "健康检查未通过，请查看检查项", Boolean(data.ok));
    }
  } catch (error) {
    setSummary(error?.message || "检查失败", false);
  } finally {
    runButton.disabled = false;
  }
}

runButton.addEventListener("click", runHealthCheck);
