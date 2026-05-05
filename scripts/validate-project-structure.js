import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "index.html",
  "src/main.ts",
  "src/App.vue",
  "src/app/AppViewHost.vue",
  "src/styles/main.css",
  "src/vite-env.d.ts",
  "src/views/FeedView.vue",
  "src/views/feed/useFeedItems.ts",
  "src/ui/index.ts",
  "src/ui/primitives.css",
  "src/ui/BottomTabBar.vue",
  "src/ui/GlassPanel.vue",
  "src/ui/IdentityBadge.vue",
  "src/ui/InlineError.vue",
  "src/ui/LianButton.vue",
  "src/ui/LocationChip.vue",
  "src/ui/Sheet.vue",
  "src/ui/TagChip.vue",
  "src/ui/Toast.vue",
  "src/ui/TopBar.vue",
  "src/ui/TrustBadge.vue",
  "src/ui/TypeChip.vue",
  "src/ui/feedback/ToastHost.vue",
  "src/ui/feedback/toast-state.ts",
  "src/ui/feedback/useToast.ts",
  "public/lian-tokens.css",
  "public/styles.css",
  "public/glass-ui.css",
  "vite.config.ts",
  "tsconfig.json",
  "docs/design/LIAN-Campus-UI-UX-Guidelines-V0.1.md",
  "docs/architecture/0001-vue3-vite-typescript-ui-entry.md",
  "scripts/smoke-frontend.js",
  "scripts/serve-frontend-static-rehearsal.js",
  "package.json",
  "README.md"
];

const jsonFiles = [
  "package.json",
  "tsconfig.json"
];

const nodeScriptFiles = [
  "scripts/smoke-frontend.js",
  "scripts/serve-frontend-static-rehearsal.js",
  "scripts/validate-project-structure.js",
  "scripts/check-encoding-contamination.js"
];

const backendOnlyPaths = [
  "server.js",
  "src/server",
  "scripts/test-routes.js",
  "scripts/prepare-backend-repo-export.js",
  "test/audience-regression.test.mjs"
];

const legacyAppFiles = [
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
  "public/app.js"
];

let passed = 0;
let failed = 0;
let noted = 0;

function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function note(label, detail) {
  noted += 1;
  console.log(`  ℹ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, reason) {
  failed += 1;
  console.log(`  ✗ ${label} — ${reason}`);
}

async function pathExists(file) {
  const fullPath = path.join(rootDir, file);
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

async function checkFileExists(file) {
  if (await pathExists(file)) {
    ok(file);
  } else {
    fail(file, "文件不存在");
  }
}

async function checkJsonValid(file) {
  const fullPath = path.join(rootDir, file);
  try {
    const raw = await fs.readFile(fullPath, "utf8");
    JSON.parse(raw);
    ok(`${file} (JSON valid)`);
  } catch (error) {
    fail(`${file} (JSON)`, error.message);
  }
}

async function checkPathExcluded(file) {
  if (await pathExists(file)) {
    fail(file, "backend-only 路径仍存在于 frontend repo");
  } else {
    ok(`${file} excluded`);
  }
}

async function checkLegacyFileOptional(file) {
  if (await pathExists(file)) {
    note(file, "legacy compatibility asset present; no longer required by Vue-first CI");
  } else {
    ok(`${file} not required`);
  }
}

function checkSyntax(file) {
  const fullPath = path.join(rootDir, file);
  try {
    execFileSync(process.execPath, ["--check", fullPath], { stdio: "pipe" });
    ok(`${file} (语法正确)`);
  } catch {
    fail(`${file} (语法检查)`, "node --check 失败");
  }
}

async function checkPublicDir() {
  const publicDir = path.join(rootDir, "public");
  try {
    const entries = await fs.readdir(publicDir);
    note("public/ 目录", `包含 ${entries.length} 个条目；legacy JS 仅作为兼容资产存在`);
  } catch {
    fail("public/ 目录", "目录不存在");
  }
}

async function checkSrcDir() {
  const srcDir = path.join(rootDir, "src");
  try {
    const entries = await fs.readdir(srcDir);
    note("src/ 目录", `包含 ${entries.length} 个条目`);
  } catch {
    fail("src/ 目录", "目录不存在");
  }
}

console.log("\n═══ LIAN Vue-first frontend repo structure check ═══\n");

console.log("▶ Vue/Vite required files");
for (const file of requiredFiles) {
  await checkFileExists(file);
}

console.log("\n▶ JSON config check");
for (const file of jsonFiles) {
  await checkJsonValid(file);
}

console.log("\n▶ Node script syntax check");
for (const file of nodeScriptFiles) {
  checkSyntax(file);
}

console.log("\n▶ Legacy JS compatibility assets are optional");
for (const file of legacyAppFiles) {
  await checkLegacyFileOptional(file);
}

console.log("\n▶ Backend-only exclusions");
for (const file of backendOnlyPaths) {
  await checkPathExcluded(file);
}

console.log("\n▶ Directory structure");
await checkPublicDir();
await checkSrcDir();

console.log(`\n═══ Result: ${passed} passed, ${failed} failed${noted ? `, ${noted} noted` : ""} ═══\n`);

if (failed > 0) process.exit(1);
