#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetArg = process.argv[2] || "outputs/lian-platform-server-export";
const targetDir = path.resolve(process.cwd(), targetArg);

const COPY_ENTRIES = [
  "server.js",
  "src",
  "data",
  "scripts",
  "test",
  "docs",
  "outputs",
  "package.json",
  "package-lock.json",
  ".env.example",
  ".gitignore",
  "CLAUDE.md",
  "README.md"
];

const FRONTEND_ONLY_PATHS = new Set([
  "public",
  "scripts/smoke-frontend.js"
]);

const SECRET_FILE_PATTERNS = [
  /^\.env$/,
  /^\.env\.(?!example$).+/,
  /(^|\/)auth-users\.json$/,
  /(^|\/)sessions\.json$/,
  /(^|\/)email-codes\.json$/,
  /(^|\/)user-cache\.json$/
];

const GENERATED_RUNTIME_PATTERNS = [
  /(^|\/)ai-post-drafts\.jsonl$/,
  /(^|\/)ai-post-records\.jsonl$/,
  /(^|\/)channel-reads\.json$/
];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function shouldSkip(relativePath) {
  const normalized = toPosix(relativePath);
  if (!normalized) return false;
  if (FRONTEND_ONLY_PATHS.has(normalized)) return true;
  if (normalized === "public" || normalized.startsWith("public/")) return true;
  if (normalized === ".git" || normalized.startsWith(".git/")) return true;
  if (normalized === "node_modules" || normalized.startsWith("node_modules/")) return true;
  if (normalized === targetArg || normalized.startsWith(`${targetArg}/`)) return true;
  if (SECRET_FILE_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  return false;
}

function classifySkipped(relativePath) {
  const normalized = toPosix(relativePath);
  if (FRONTEND_ONLY_PATHS.has(normalized) || normalized === "public" || normalized.startsWith("public/")) return "frontend-only";
  if (SECRET_FILE_PATTERNS.some((pattern) => pattern.test(normalized))) return "secret-or-local-runtime";
  if (GENERATED_RUNTIME_PATTERNS.some((pattern) => pattern.test(normalized))) return "generated-runtime";
  return "skipped";
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureParent(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function copyPath(sourcePath, destPath, relativePath, manifest) {
  const stats = await fs.lstat(sourcePath);
  if (shouldSkip(relativePath)) {
    manifest.skipped.push({ path: toPosix(relativePath), reason: classifySkipped(relativePath) });
    return;
  }

  if (stats.isDirectory()) {
    await fs.mkdir(destPath, { recursive: true });
    const entries = await fs.readdir(sourcePath);
    for (const entry of entries) {
      await copyPath(
        path.join(sourcePath, entry),
        path.join(destPath, entry),
        path.join(relativePath, entry),
        manifest
      );
    }
    return;
  }

  if (!stats.isFile()) {
    manifest.skipped.push({ path: toPosix(relativePath), reason: "not-regular-file" });
    return;
  }

  await ensureParent(destPath);
  await fs.copyFile(sourcePath, destPath);
  manifest.copied.push({ path: toPosix(relativePath), bytes: stats.size });
}

async function writeBackendReadme(manifest) {
  const content = [
    "# lian-platform-server bootstrap export",
    "",
    "This directory was generated from `lian-mobile-web-full` by:",
    "",
    "```bash",
    `node scripts/prepare-backend-repo-export.js ${targetArg}`,
    "```",
    "",
    "## Purpose",
    "",
    "This is the non-destructive Phase 1 backend repo bootstrap workspace for LIAN. It preserves the current backend runtime behavior first; it does not migrate framework, database, feed ranking, auth, or publish behavior.",
    "",
    "## Expected first validation",
    "",
    "Run from this export directory after installing any dependencies needed by the deployment environment:",
    "",
    "```bash",
    "node --check server.js",
    "find src/server -name '*.js' -maxdepth 2 -print0 | xargs -0 -n1 node --check",
    "npm test",
    "npm run check",
    "npm run test:routes",
    "node --test test/audience-regression.test.mjs",
    "```",
    "",
    "## Split boundary",
    "",
    "- Backend owns: `server.js`, `src/server/*`, `data/*`, backend validators/tests, NodeBB integration, AI adapters, auth/session, upload/image proxy, feed, map data/admin APIs, and metadata writes.",
    "- Frontend repo keeps: `public/*`, `scripts/smoke-frontend.js`, and `docs/agent/contracts/api-contract.md`.",
    "",
    "## Deliberately excluded",
    "",
    "This export deliberately excludes frontend static files and local secrets/runtime-only files such as `.env`, auth users, sessions, email codes, and user cache.",
    "",
    "## Manifest",
    "",
    "See `repo-split-manifest.json` for copied and skipped paths.",
    "",
    `Generated at: ${manifest.generatedAt}`,
    `Source root: ${rootDir}`,
    ""
  ].join("\n");
  await fs.writeFile(path.join(targetDir, "BACKEND_BOOTSTRAP.md"), content, "utf8");
}

async function writeManifest(manifest) {
  await fs.writeFile(
    path.join(targetDir, "repo-split-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}

async function main() {
  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceRoot: rootDir,
    targetDir,
    copied: [],
    skipped: [],
    missing: []
  };

  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });

  for (const entry of COPY_ENTRIES) {
    const sourcePath = path.join(rootDir, entry);
    if (!(await exists(sourcePath))) {
      manifest.missing.push(entry);
      continue;
    }
    await copyPath(sourcePath, path.join(targetDir, entry), entry, manifest);
  }

  await writeBackendReadme(manifest);
  await writeManifest(manifest);

  console.log(`Backend bootstrap export written to ${targetDir}`);
  console.log(`Copied files: ${manifest.copied.length}`);
  console.log(`Skipped paths: ${manifest.skipped.length}`);
  if (manifest.missing.length) console.log(`Missing optional entries: ${manifest.missing.join(", ")}`);
  console.log("Next: create the empty lian-platform-server repository, copy this directory into it, then run the validation commands in BACKEND_BOOTSTRAP.md.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
