import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "index.html",
  "src/main.ts",
  "src/App.vue",
  "src/styles/main.css",
  "src/styles/lian-tokens.css",
  "src/vite-env.d.ts",
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
  "vite.config.ts",
  "tsconfig.json",
  "docs/design/LIAN-Campus-UI-UX-Guidelines-V0.1.md",
  "docs/architecture/0001-vue3-vite-typescript-ui-entry.md",
  "scripts/guard-unsafe-dom-sinks.js",
  "scripts/guard-public-runtime-exposure.js",
  "scripts/test-guard-public-runtime-exposure.js",
  "package.json",
  "README.md"
];

const jsonFiles = [
  "package.json",
  "tsconfig.json"
];

const frontendJsFiles = [
  "scripts/guard-unsafe-dom-sinks.js",
  "scripts/guard-public-runtime-exposure.js",
  "scripts/test-guard-public-runtime-exposure.js"
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
    console.log(`  ℹ public/ 目录包含 ${entries.length} 个条目`);
  } catch {
    fail("public/ 目录", "目录不存在");
  }
}

async function checkSrcDir() {
  const srcDir = path.join(rootDir, "src");
  try {
    const entries = await fs.readdir(srcDir);
    console.log(`  ℹ src/ 目录包含 ${entries.length} 个条目`);
  } catch {
    fail("src/ 目录", "目录不存在");
  }
}

console.log("\n═══ LIAN frontend repo structure check ═══\n");

console.log("▶ Frontend required files");
for (const file of requiredFiles) {
  await checkFileExists(file);
}

console.log("\n▶ JSON config check");
for (const file of jsonFiles) {
  await checkJsonValid(file);
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
await checkSrcDir();

console.log(`\n═══ Result: ${passed} passed, ${failed} failed ═══\n`);

if (failed > 0) process.exit(1);
