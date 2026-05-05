import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.argv[2] || "http://localhost:4100";
const requireApiSmoke = ["1", "true", "yes"].includes(String(process.env.LIAN_SMOKE_REQUIRE_API || "").trim().toLowerCase());

let passed = 0;
let failed = 0;
let skipped = 0;

function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function fail(label, reason) {
  failed += 1;
  console.log(`  ✗ ${label} — ${reason}`);
}

function skip(label, reason) {
  skipped += 1;
  console.log(`  ○ ${label} (跳过: ${reason})`);
}

async function fetchUrl(url) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    return { status: res.status, text: await res.text(), ok: res.ok, headers: res.headers };
  } catch (error) {
    return { status: 0, text: "", ok: false, error: error.message };
  }
}

function extractLocalAssets(html) {
  const scripts = Array.from(html.matchAll(/<script\s+[^>]*src="([^"]+)"[^>]*><\/script>/g))
    .map((match) => match[1])
    .filter((src) => src.startsWith("/"));
  const styles = Array.from(html.matchAll(/<link\s+[^>]*href="([^"]+)"[^>]*>/g))
    .map((match) => match[1])
    .filter((href) => href.startsWith("/"));
  return [...scripts, ...styles];
}

async function checkPage(url, label, validators) {
  const result = await fetchUrl(url);
  if (!result.ok) {
    fail(label, `HTTP ${result.status}${result.error ? ` — ${result.error}` : ""}`);
    return null;
  }
  let allPassed = true;
  for (const [checkName, checkFn] of validators) {
    if (!checkFn(result.text)) {
      fail(`${label} → ${checkName}`, "校验失败");
      allPassed = false;
    }
  }
  if (allPassed) ok(label);
  return result;
}

async function checkEndpoint(url, label) {
  const result = await fetchUrl(url);
  if (result.ok) {
    ok(label);
  } else {
    fail(label, `HTTP ${result.status}${result.error ? ` — ${result.error}` : ""}`);
  }
  return result;
}

function shouldSkipUnavailableApi(result) {
  if (requireApiSmoke) return false;
  return result.status === 0 || result.status === 502 || result.status === 503 || result.status === 504;
}

async function checkJsonEndpoint(url, label, { optionalWhenUnavailable = false } = {}) {
  const result = await fetchUrl(url);
  if (!result.ok) {
    if (optionalWhenUnavailable && shouldSkipUnavailableApi(result)) {
      skip(label, `backend unavailable${result.status ? `, HTTP ${result.status}` : ""}${result.error ? ` — ${result.error}` : ""}`);
      return result;
    }
    fail(label, `HTTP ${result.status}${result.error ? ` — ${result.error}` : ""}`);
    return null;
  }
  try {
    JSON.parse(result.text);
    ok(`${label} (JSON 合法)`);
  } catch {
    fail(`${label}`, "JSON 解析失败");
    return null;
  }
  return result;
}

function runNodeSyntaxCheck(filePath) {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });

  if (result.error) throw result.error;

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(output || `node --check failed for ${filePath}`);
  }
}

function checkSyntax(file) {
  const fullPath = path.join(rootDir, file);
  try {
    runNodeSyntaxCheck(fullPath);
    ok(`${file} (语法)`);
  } catch (error) {
    fail(`${file} (语法)`, error.message || "node --check 失败");
  }
}

function checkFileContains(file, label, validators) {
  const fullPath = path.join(rootDir, file);
  let text = "";
  try {
    text = fs.readFileSync(fullPath, "utf8");
  } catch (error) {
    fail(label, error.message || "文件读取失败");
    return;
  }
  let allPassed = true;
  for (const [checkName, checkFn] of validators) {
    if (!checkFn(text)) {
      fail(`${label} → ${checkName}`, "校验失败");
      allPassed = false;
    }
  }
  if (allPassed) ok(label);
}

async function serverReachable() {
  const result = await fetchUrl(baseUrl);
  return result.ok || result.status > 0;
}

console.log(`\n═══ LIAN Vue 前端冒烟测试 ═══`);
console.log(`目标: ${baseUrl}`);
if (!requireApiSmoke) {
  console.log("API 端点: backend unavailable 时跳过；设置 LIAN_SMOKE_REQUIRE_API=1 可强制校验");
}
console.log("");

const serverUp = await serverReachable();
if (!serverUp) {
  console.log(`  ⚠ 服务器不可达 (${baseUrl})，跳过 HTTP 检查，仅运行静态检查。\n`);
}

let homepage = null;
if (serverUp) {
  console.log("▶ Vue 首页 HTML 检查");
  homepage = await checkPage(`${baseUrl}/`, "GET /", [
    ["<title> 存在", (html) => /<title>[^<]+<\/title>/.test(html)],
    ["Vue root 存在", (html) => html.includes('id="vue-root"')],
    ["Vite module asset 存在", (html) => /<script[^>]+type="module"[^>]+src="\/assets\//.test(html)],
    ["runtime config 已注入", (html) => html.includes("window.LIAN_STATIC_REHEARSAL")],
    ["不再加载 legacy app-feed.js", (html) => !html.includes('src="/app-feed.js"')],
  ]);
} else {
  skip("Vue 首页 HTML 检查", "服务器不可达");
}

if (serverUp && homepage) {
  console.log("\n▶ Vue build assets 可达性");
  const assets = extractLocalAssets(homepage.text);
  if (!assets.length) {
    fail("Vue build assets", "首页没有本地 script/link asset");
  } else {
    for (const asset of assets) {
      await checkEndpoint(`${baseUrl}${asset}`, `GET ${asset}`);
    }
  }
} else if (!serverUp) {
  skip("Vue build assets 可达性", "服务器不可达");
}

if (serverUp) {
  console.log("\n▶ API 代理端点");
  await checkJsonEndpoint(`${baseUrl}/api/feed`, "GET /api/feed", { optionalWhenUnavailable: true });
  await checkJsonEndpoint(`${baseUrl}/api/map/v2/items`, "GET /api/map/v2/items", { optionalWhenUnavailable: true });
} else {
  skip("API 代理端点", "服务器不可达");
}

console.log("\n▶ Node 脚本语法检查");
for (const file of [
  "scripts/smoke-frontend.js",
  "scripts/serve-frontend-static-rehearsal.js",
]) {
  checkSyntax(file);
}

console.log("\n▶ Vue 迁移边界检查");
checkFileContains("src/App.vue", "src/App.vue", [
  ["使用 AppViewHost", (text) => text.includes("AppViewHost")],
]);
checkFileContains("src/views/FeedView.vue", "src/views/FeedView.vue", [
  ["使用 feed composable", (text) => text.includes("useFeedItems")],
  ["声明 Vue API Preview", (text) => text.includes("Vue API Preview")],
]);
checkFileContains("src/views/feed/useFeedItems.ts", "src/views/feed/useFeedItems.ts", [
  ["调用 /api/feed", (text) => text.includes("/api/feed")],
  ["使用 include credentials", (text) => text.includes('credentials: "include"')],
]);

console.log(`\n═══ 结果：${passed} 通过，${failed} 失败${skipped ? `，${skipped} 跳过` : ""} ═══\n`);
if (failed > 0) process.exit(1);
