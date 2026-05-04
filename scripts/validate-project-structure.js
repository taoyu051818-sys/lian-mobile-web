import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "public/index.html",
  "public/styles.css",
  "public/glass-ui.css",
  "public/app.js",
  "public/app-state.js",
  "public/app-utils.js",
  "public/app-auth-avatar.js",
  "public/app-feed.js",
  "public/app-legacy-map.js",
  "public/app-ai-publish.js",
  "public/publish-page.js",
  "public/app-messages-profile.js",
  "public/map-v2.js",
  "public/reply-form-click-guard.js",
  "public/explore-preload.js",
  "scripts/smoke-frontend.js",
  "scripts/serve-frontend-static-rehearsal.js",
  "package.json",
  "README.md"
];

const frontendJsFiles = [
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
  "scripts/smoke-frontend.js",
  "scripts/serve-frontend-static-rehearsal.js"
];

const backendOnlyPaths = [
  "server.js",
  "src/server",
  "scripts/test-routes.js",
  "scripts/prepare-backend-repo-export.js",
  "test/audience-regression.test.mjs"
];

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

async function checkFileExists(file) {
  const fullPath = path.join(rootDir, file);
  try {
    await fs.access(fullPath);
    ok(file);
  } catch {
    fail(file, "文件不存在");
  }
}

async function checkPathExcluded(file) {
  const fullPath = path.join(rootDir, file);
  try {
    await fs.access(fullPath);
    fail(file, "backend-only 路径仍存在于 frontend repo");
  } catch {
    ok(`${file} excluded`);
  }
}

function checkSyntax(file) {
  const fullPath = path.join(rootDir, file);
  try {
    execSync(`node --check "${fullPath}"`, { stdio: "pipe" });
    ok(`${file} (语法正确)`);
  } catch {
    fail(`${file} (语法检查)`, "node --check 失败");
  }
}

async function checkPublicDir() {
  const publicDir = path.join(rootDir, "public");
  try {
    const entries = await fs.readdir(publicDir);
    console.log(`  ℹ public/ 目录包含 ${entries.length} 个条目`);
  } catch {
    fail("public/ 目录", "目录不存在");
  }
}

console.log("\n═══ LIAN frontend repo structure check ═══\n");

console.log("▶ Frontend required files");
for (const file of requiredFiles) {
  await checkFileExists(file);
}

console.log("\n▶ Frontend JS syntax check");
for (const file of frontendJsFiles) {
  checkSyntax(file);
}

console.log("\n▶ Backend-only exclusions");
for (const file of backendOnlyPaths) {
  await checkPathExcluded(file);
}

console.log("\n▶ Directory structure");
await checkPublicDir();

console.log(`\n═══ Result: ${passed} passed, ${failed} failed ═══\n`);

if (failed > 0) process.exit(1);
