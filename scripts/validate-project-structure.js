import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "server.js",
  "src/server/api-router.js",
  "src/server/post-service.js",
  "src/server/nodebb-client.js",
  "src/server/feed-service.js",
  "src/server/auth-service.js",
  "src/server/config.js",
  "src/server/data-store.js",
  "src/server/content-utils.js",
  "src/server/cache.js",
  "src/server/paths.js",
  "public/app.js",
  "public/index.html",
  "public/styles.css",
  "data/feed-rules.json",
  "data/post-metadata.json",
  "package.json",
  "CLAUDE.md"
];

const jsonFiles = [
  "data/feed-rules.json",
  "data/post-metadata.json"
];

const jsFilesToSyntaxCheck = [
  "server.js",
  "src/server/api-router.js",
  "src/server/post-service.js",
  "src/server/nodebb-client.js",
  "src/server/feed-service.js",
  "src/server/auth-service.js",
  "src/server/auth-routes.js",
  "src/server/ai-post-preview.js",
  "src/server/ai-light-publish.js",
  "src/server/channel-service.js",
  "src/server/admin-routes.js",
  "src/server/config.js",
  "src/server/data-store.js",
  "src/server/content-utils.js",
  "src/server/image-proxy.js",
  "src/server/upload.js",
  "src/server/cache.js",
  "src/server/paths.js",
  "src/server/http-response.js",
  "src/server/request-utils.js",
  "src/server/static-data.js",
  "src/server/static-server.js",
  "src/server/setup-page.js"
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
    ok(`${file} (JSON 合法)`);
  } catch (error) {
    fail(`${file} (JSON)`, error.message);
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

async function checkDataDir() {
  const dataDir = path.join(rootDir, "data");
  try {
    const entries = await fs.readdir(dataDir);
    const jsonCount = entries.filter((e) => e.endsWith(".json")).length;
    console.log(`  ℹ data/ 目录包含 ${entries.length} 个文件，其中 ${jsonCount} 个 JSON 文件`);
  } catch {
    fail("data/ 目录", "目录不存在");
  }
}

async function checkDocsDir() {
  const docsDir = path.join(rootDir, "docs", "agent");
  try {
    await fs.access(docsDir);
    const entries = await fs.readdir(docsDir);
    console.log(`  ℹ docs/agent/ 目录包含 ${entries.length} 个条目`);
  } catch {
    fail("docs/agent/ 目录", "目录不存在");
  }
}

// Main
console.log("\n═══ LIAN 项目结构校验 ═══\n");

console.log("▶ 关键文件检查");
for (const file of requiredFiles) {
  await checkFileExists(file);
}

console.log("\n▶ JSON 数据文件校验");
for (const file of jsonFiles) {
  await checkJsonValid(file);
}

console.log("\n▶ JS 语法检查 (node --check)");
for (const file of jsFilesToSyntaxCheck) {
  checkSyntax(file);
}

console.log("\n▶ 目录结构");
await checkDataDir();
await checkDocsDir();

console.log(`\n═══ 结果：${passed} 通过，${failed} 失败 ═══\n`);

if (failed > 0) {
  process.exit(1);
}
