import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.argv[2] || "http://localhost:4100";

let passed = 0;
let failed = 0;
let skipped = 0;

const expectedScriptOrder = [
  "/map-v2.js",
  "/app-state.js",
  "/app-utils.js",
  "/app-auth-avatar.js",
  "/app-feed.js",
  "/app-legacy-map.js",
  "/app-ai-publish.js",
  "/publish-page.js",
  "/app-messages-profile.js",
  "/reply-form-click-guard.js",
  "/explore-preload.js",
  "/app.js"
];

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
    return { status: res.status, text: await res.text(), ok: res.ok };
  } catch (error) {
    return { status: 0, text: "", ok: false, error: error.message };
  }
}

function extractLocalScripts(html) {
  return Array.from(html.matchAll(/<script\s+[^>]*src="([^"]+)"[^>]*><\/script>/g))
    .map((match) => match[1])
    .filter((src) => src.startsWith("/"));
}

function hasScriptsInOrder(html, expectedScripts) {
  const actual = extractLocalScripts(html);
  let cursor = 0;
  for (const script of actual) {
    if (script === expectedScripts[cursor]) cursor += 1;
  }
  return cursor === expectedScripts.length;
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

async function checkJsonEndpoint(url, label) {
  const result = await fetchUrl(url);
  if (!result.ok) {
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

function checkSyntax(file) {
  const fullPath = path.join(rootDir, file);
  // Primary: in-process syntax check via vm module (no subprocess needed)
  try {
    const code = fs.readFileSync(fullPath, "utf8");
    vm.compileFunction(code, [], { filename: fullPath });
    ok(`${file} (语法)`);
    return;
  } catch (error) {
    // If vm check finds a real syntax error, report it
    if (error instanceof SyntaxError) {
      fail(`${file} (语法)`, error.message);
      return;
    }
    // vm check failed for non-syntax reasons (e.g., file read error), try execSync fallback
  }
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

function runNodeSyntaxCheck(filePath) {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(output || `node --check failed for ${filePath}`);
  }
}

// Probe server connectivity
async function serverReachable() {
  const result = await fetchUrl(baseUrl);
  return result.ok || result.status > 0;
}

// --- Main ---

console.log(`\n═══ LIAN 前端冒烟测试 ═══`);
console.log(`目标: ${baseUrl}\n`);

const serverUp = await serverReachable();
if (!serverUp) {
  console.log(`  ⚠ 服务器不可达 (${baseUrl})，跳过 HTTP 检查，仅运行语法检查。\n`);
}

// 1. Homepage HTML checks
if (serverUp) {
  console.log("▶ 首页 HTML 检查");
  await checkPage(`${baseUrl}/`, "GET /", [
    ["<title> 存在", (html) => /<title>[^<]+<\/title>/.test(html)],
    ["<main class=\"app-shell\"> 存在", (html) => html.includes('class="app-shell"')],
    ["index.html 包含 map-v2.js", (html) => html.includes('src="/map-v2.js"')],
    ["index.html 包含 split scripts", (html) => expectedScriptOrder.every((script) => html.includes(`src="${script}"`))],
    ["index.html 保持 split script 加载顺序", (html) => hasScriptsInOrder(html, expectedScriptOrder)],
  ]);
} else {
  skip("首页 HTML 检查", "服务器不可达");
}

// 2. Static JS files — HTTP reachable
if (serverUp) {
  console.log("\n▶ 静态 JS 文件可达性");
  for (const script of expectedScriptOrder) {
    await checkEndpoint(`${baseUrl}${script}`, `GET ${script}`);
  }
} else {
  skip("静态 JS 文件可达性", "服务器不可达");
}

// 3. API endpoints
if (serverUp) {
  console.log("\n▶ API 端点");
  await checkJsonEndpoint(`${baseUrl}/api/feed`, "GET /api/feed");
  await checkJsonEndpoint(`${baseUrl}/api/map/v2/items`, "GET /api/map/v2/items");
} else {
  skip("API 端点", "服务器不可达");
}

// 4. Syntax check split frontend files (always runs — no server needed)
console.log("\n▶ 前端文件语法检查 (node --check)");
const frontendFiles = [
  "public/map-v2.js",
  "public/app-state.js",
  "public/app-utils.js",
  "public/app-auth-avatar.js",
  "public/app-feed.js",
  "public/app-legacy-map.js",
  "public/app-ai-publish.js",
  "public/publish-page.js",
  "public/app-messages-profile.js",
  "public/reply-form-click-guard.js",
  "public/explore-preload.js",
  "public/app.js",
];
for (const file of frontendFiles) {
  checkSyntax(file);
}

// 5. Shared frontend helper contract (always runs — no server needed)
console.log("\n▶ 前端公共 helper 约束");
checkFileContains("public/app-utils.js", "public/app-utils.js 公共 helper", [
  ["api 默认带 credentials", (text) => text.includes('credentials: "include"')],
  ["uploadImage 使用统一 credentials 策略", (text) => text.includes("withDefaultCredentials({") && text.includes("/api/upload/image")],
  ["公共 helper 显式暴露到 window", (text) => text.includes("Object.assign(window") && text.includes("api,") && text.includes("displayImageUrl,")],
]);
checkFileContains("public/explore-preload.js", "public/explore-preload.js 公共 helper", [
  ["使用共享 api helper", (text) => text.includes("window.api")],
  ["使用共享图片 URL helper", (text) => text.includes("window.displayImageUrl")],
  ["不复制 image proxy base 逻辑", (text) => !text.includes("LIAN_IMAGE_PROXY_BASE")],
]);

// 6. CSS reachable
if (serverUp) {
  console.log("\n▶ CSS 可达性");
  await checkEndpoint(`${baseUrl}/styles.css`, "GET /styles.css");
} else {
  skip("CSS 可达性", "服务器不可达");
}

// Summary
console.log(`\n═══ 结果：${passed} 通过，${failed} 失败${skipped ? `，${skipped} 跳过` : ""} ═══\n`);
if (failed > 0) process.exit(1);
