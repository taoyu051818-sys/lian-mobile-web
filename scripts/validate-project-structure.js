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

const forbiddenPaths = [
  "server.js",
  "src/server",
  "scripts/test-routes.js",
  "scripts/prepare-backend-repo-export.js",
  "test/audience-regression.test.mjs",
  "test/remote-auth-regression.test.mjs",
  "test/security-regression.test.mjs"
];

const jsFilesToSyntaxCheck = [
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
  "scripts/serve-frontend-static-rehearsal.js"
];

let passed = 0;
let failed = 0;

function ok(label) {
  passed += 1;
  console.log(`  ok ${label}`);
}

function fail(label, reason) {
  failed += 1;
  console.log(`  fail ${label} - ${reason}`);
}

async function checkFileExists(file) {
  const fullPath = path.join(rootDir, file);
  try {
    await fs.access(fullPath);
    ok(file);
  } catch {
    fail(file, "file does not exist");
  }
}

async function checkPathAbsent(file) {
  const fullPath = path.join(rootDir, file);
  try {
    await fs.access(fullPath);
    fail(file, "backend-owned path still exists");
  } catch {
    ok(`${file} absent`);
  }
}

function checkSyntax(file) {
  const fullPath = path.join(rootDir, file);
  try {
    execSync(`node --check "${fullPath}"`, { stdio: "pipe" });
    ok(`${file} syntax`);
  } catch {
    fail(`${file} syntax`, "node --check failed");
  }
}

console.log("\nLIAN frontend-only project structure check\n");

console.log("Required frontend files");
for (const file of requiredFiles) {
  await checkFileExists(file);
}

console.log("\nForbidden backend-owned paths");
for (const file of forbiddenPaths) {
  await checkPathAbsent(file);
}

console.log("\nJavaScript syntax check");
for (const file of jsFilesToSyntaxCheck) {
  checkSyntax(file);
}

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
