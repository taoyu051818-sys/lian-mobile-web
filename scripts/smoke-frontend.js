import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.argv[2] || "http://localhost:4100";

let passed = 0;
let failed = 0;

function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function fail(label, reason) {
  failed += 1;
  console.log(`  ✗ ${label} — ${reason}`);
}

async function fetchUrl(url) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    return { status: res.status, text: await res.text(), ok: res.ok };
  } catch (error) {
    return { status: 0, text: "", ok: false, error: error.message };
  }
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
  try {
    execSync(`node --check "${fullPath}"`, { stdio: "pipe" });
    ok(`${file} (语法)`);
  } catch {
    fail(`${file} (语法)`, "node --check 失败");
  }
}

// --- Main ---

console.log(`\n═══ LIAN 前端冒烟测试 ═══`);
console.log(`目标: ${baseUrl}\n`);

// 1. Homepage HTML checks
console.log("▶ 首页 HTML 检查");
await checkPage(`${baseUrl}/`, "GET /", [
  ["<title> 存在", (html) => /<title>[^<]+<\/title>/.test(html)],
  ["<main class=\"app-shell\"> 存在", (html) => html.includes('class="app-shell"')],
  ["index.html 包含 map-v2.js", (html) => html.includes('src="/map-v2.js"')],
  ["index.html 包含 split scripts", (html) =>
    html.includes('src="/app-state.js"') &&
    html.includes('src="/app-utils.js"') &&
    html.includes('src="/app.js"')
  ],
]);

// 2. Static JS files — HTTP reachable
console.log("\n▶ 静态 JS 文件可达性");
const staticScripts = [
  "/map-v2.js",
  "/app-state.js",
  "/app-utils.js",
  "/app-auth-avatar.js",
  "/app-feed.js",
  "/app-legacy-map.js",
  "/app-ai-publish.js",
  "/app-messages-profile.js",
  "/app.js",
];
for (const script of staticScripts) {
  await checkEndpoint(`${baseUrl}${script}`, `GET ${script}`);
}

// 3. API endpoints
console.log("\n▶ API 端点");
await checkJsonEndpoint(`${baseUrl}/api/feed`, "GET /api/feed");
await checkJsonEndpoint(`${baseUrl}/api/map/v2/items`, "GET /api/map/v2/items");

// 4. Syntax check split frontend files
console.log("\n▶ 前端文件语法检查 (node --check)");
const frontendFiles = [
  "public/app-state.js",
  "public/app-utils.js",
  "public/app-auth-avatar.js",
  "public/app-feed.js",
  "public/app-legacy-map.js",
  "public/app-ai-publish.js",
  "public/app-messages-profile.js",
  "public/app.js",
];
for (const file of frontendFiles) {
  checkSyntax(file);
}

// 5. CSS reachable
console.log("\n▶ CSS 可达性");
await checkEndpoint(`${baseUrl}/styles.css`, "GET /styles.css");

// Summary
console.log(`\n═══ 结果：${passed} 通过，${failed} 失败 ═══\n`);
if (failed > 0) process.exit(1);
