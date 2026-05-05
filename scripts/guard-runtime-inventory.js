#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const selfPath = "scripts/guard-runtime-inventory.js";

const requiredFiles = [
  ".github/pull_request_template.md",
  "ops/runtime-inventory.schema.json"
];

const opsInventoryFiles = [
  "ops/runtime-inventory.schema.json",
  "ops/runtime-inventory.example.json",
  "ops/runtime-inventory.md",
  "docs/ops/runtime-inventory.md"
];

const runtimeSensitiveFiles = [
  "package.json",
  "index.html",
  "public/index.html",
  "vite.config.ts",
  "scripts/serve-frontend-static-rehearsal.js",
  "scripts/smoke-frontend.js",
  "scripts/validate-project-structure.js"
];

const runtimeSensitivePrefixes = [
  ".github/workflows/",
  "ops/",
  "docs/ops/"
];

const forbiddenSnippets = [
  ["pm2 restart", "lian-mobile-web"].join(" "),
  ["systemctl restart", "lian-mobile-web"].join(" "),
  ["lian-mobile-web", ".service"].join(""),
  ["/path/to", "lian-platform-server"].join("/")
];

const textExtensions = new Set([
  ".js",
  ".ts",
  ".vue",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".html",
  ".css",
  ".txt"
]);

let passed = 0;
let failed = 0;
let noted = 0;

function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function note(label) {
  noted += 1;
  console.log(`  ℹ ${label}`);
}

function fail(label, reason) {
  failed += 1;
  console.log(`  ✗ ${label} — ${reason}`);
}

function repoPath(file) {
  return path.join(rootDir, file);
}

function exists(file) {
  return fs.existsSync(repoPath(file));
}

function readText(file) {
  return fs.readFileSync(repoPath(file), "utf8");
}

function git(args) {
  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
}

function changedFiles() {
  const baseRef = process.env.LIAN_GUARD_BASE_REF || process.env.GITHUB_BASE_REF || "";
  const headRef = process.env.LIAN_GUARD_HEAD_REF || "HEAD";

  try {
    if (baseRef) {
      const remoteBase = baseRef.startsWith("origin/") ? baseRef : `origin/${baseRef}`;
      const mergeBase = git(["merge-base", remoteBase, headRef]);
      return git(["diff", "--name-only", mergeBase, headRef]).split("\n").filter(Boolean);
    }
  } catch {
    note("remote base ref unavailable; using last commit for diff guard");
  }

  try {
    return git(["diff", "--name-only", "HEAD~1", "HEAD"]).split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function isRuntimeSensitive(file) {
  return runtimeSensitiveFiles.includes(file) || runtimeSensitivePrefixes.some((prefix) => file.startsWith(prefix));
}

function isOpsInventory(file) {
  return opsInventoryFiles.includes(file);
}

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist"].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

function checkRequiredFiles() {
  for (const file of requiredFiles) {
    if (exists(file)) ok(`${file} exists`);
    else fail(`${file} exists`, "runtime governance file is missing");
  }
}

function checkSchemaShape() {
  const file = "ops/runtime-inventory.schema.json";
  if (!exists(file)) return;
  try {
    const schema = JSON.parse(readText(file));
    if (schema.title && schema.required?.includes("runtimes")) ok("runtime inventory schema shape");
    else fail("runtime inventory schema shape", "schema must define title and require runtimes");
  } catch (error) {
    fail("runtime inventory schema JSON", error.message);
  }
}

function checkForbiddenSnippets() {
  let found = false;
  for (const file of walkFiles(rootDir)) {
    const rel = path.relative(rootDir, file).replaceAll(path.sep, "/");
    if (rel === selfPath) continue;
    if (!textExtensions.has(path.extname(file))) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const snippet of forbiddenSnippets) {
      if (text.includes(snippet)) {
        found = true;
        fail(`forbidden runtime alias in ${rel}`, `remove guessed command/name: ${snippet}`);
      }
    }
  }
  if (!found) ok("no forbidden runtime aliases found");
}

function checkDiffGuard() {
  const files = changedFiles();
  if (!files.length) {
    note("no changed files detected for runtime inventory diff guard");
    return;
  }
  const sensitive = files.filter(isRuntimeSensitive);
  if (!sensitive.length) {
    ok("runtime inventory diff guard: no runtime-sensitive files changed");
    return;
  }
  if (files.some(isOpsInventory)) {
    ok("runtime inventory diff guard: runtime-sensitive change includes ops inventory update");
    return;
  }
  fail(
    "runtime inventory diff guard",
    `runtime-sensitive files changed without ops inventory update: ${sensitive.join(", ")}`
  );
}

console.log("\n═══ LIAN runtime inventory guard ═══\n");
checkRequiredFiles();
checkSchemaShape();
checkForbiddenSnippets();
checkDiffGuard();

console.log(`\n═══ Result: ${passed} passed, ${failed} failed${noted ? `, ${noted} noted` : ""} ═══\n`);
if (failed > 0) process.exit(1);
