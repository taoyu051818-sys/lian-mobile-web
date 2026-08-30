#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GIT_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const REPOSITORIES = Object.freeze({
  frontend: "taoyu051818-sys/lian-mobile-web",
  backend: "taoyu051818-sys/lian-platform-server",
});

function exactGitObjectId(value, name) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!GIT_OBJECT_ID.test(normalized)) {
    throw new Error(`${name} must be an exact 40- or 64-character Git object id`);
  }
  return normalized;
}

function exactIsoTimestamp(value) {
  const normalized = String(value ?? "").trim();
  const timestamp = Date.parse(normalized);
  if (!normalized || !Number.isFinite(timestamp)) {
    throw new Error("LIAN_RELEASE_BUILT_AT must be an ISO-8601 timestamp");
  }
  return new Date(timestamp).toISOString();
}

function safeLabel(value, name, { fallback } = {}) {
  const normalized = String(value ?? fallback ?? "").trim();
  if (!/^[A-Za-z0-9._/-]{1,160}$/.test(normalized)) {
    throw new Error(`${name} contains unsupported characters`);
  }
  return normalized;
}

async function listAssets(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const assets = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) assets.push(...(await listAssets(target, root)));
    else if (entry.isFile()) {
      const relative = path.relative(root, target).split(path.sep).join("/");
      if (relative !== "release-manifest.json") assets.push(relative);
    }
  }
  return assets.sort((left, right) => left.localeCompare(right));
}

function npmVersion(userAgent = process.env.npm_config_user_agent) {
  const match = /(?:^|\s)npm\/([^\s]+)/.exec(String(userAgent ?? ""));
  return match?.[1] ?? "unknown";
}

async function buildReleaseManifest({
  repositoryRoot,
  distDirectory,
  frontendCommit,
  backendCommit,
  environment,
  builtAt,
  gitRef,
  workflowRunId,
  nodeVersion = process.version,
  packageManagerVersion = npmVersion(),
}) {
  const frontend = exactGitObjectId(frontendCommit, "LIAN_FRONTEND_COMMIT");
  const backend = exactGitObjectId(backendCommit, "LIAN_BACKEND_COMMIT");
  const lockContent = await readFile(path.join(repositoryRoot, "package-lock.json"));

  return {
    schemaVersion: 1,
    releaseId: `${frontend}.${backend}`,
    environment: safeLabel(environment, "LIAN_RELEASE_ENVIRONMENT"),
    builtAt: exactIsoTimestamp(builtAt),
    components: {
      frontend: {
        repository: REPOSITORIES.frontend,
        commit: frontend,
        artifact: `frontend-dist-${frontend}`,
      },
      backend: {
        repository: REPOSITORIES.backend,
        commit: backend,
        runtimeEvidence: "/api/system/health#revision",
      },
    },
    build: {
      gitRef: safeLabel(gitRef, "GITHUB_REF_NAME"),
      workflowRunId: safeLabel(workflowRunId, "GITHUB_RUN_ID"),
      nodeVersion: safeLabel(nodeVersion, "nodeVersion"),
      npmVersion: safeLabel(packageManagerVersion, "npmVersion"),
      packageLockSha256: createHash("sha256").update(lockContent).digest("hex"),
      assets: await listAssets(distDirectory),
    },
  };
}

async function writeReleaseManifest(options) {
  const manifest = await buildReleaseManifest(options);
  const outputPath = path.join(options.distDirectory, "release-manifest.json");
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifest, outputPath };
}

async function main(environment = process.env) {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const distDirectory = path.resolve(repositoryRoot, environment.LIAN_RELEASE_DIST_DIR || "dist");
  const { manifest, outputPath } = await writeReleaseManifest({
    repositoryRoot,
    distDirectory,
    frontendCommit: environment.LIAN_FRONTEND_COMMIT,
    backendCommit: environment.LIAN_BACKEND_COMMIT,
    environment: environment.LIAN_RELEASE_ENVIRONMENT || "production",
    builtAt: environment.LIAN_RELEASE_BUILT_AT,
    gitRef: environment.GITHUB_REF_NAME,
    workflowRunId: environment.GITHUB_RUN_ID,
  });
  process.stdout.write(`Release manifest ${manifest.releaseId} written to ${outputPath}\n`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error?.message || error}\n`);
    process.exitCode = 1;
  });
}

export { buildReleaseManifest, exactGitObjectId, listAssets, main, writeReleaseManifest };
