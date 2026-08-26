import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function runtimeSources(directory) {
  const root = path.join(repoRoot, directory);
  return fs
    .readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:ts|vue)$/.test(entry.name))
    .map((entry) => ({
      relativePath: path.relative(repoRoot, path.join(entry.parentPath, entry.name)),
      source: fs.readFileSync(path.join(entry.parentPath, entry.name), "utf8"),
    }));
}

test("R1 removes the LA-specific browser client, component, and request state owner", () => {
  for (const relativePath of [
    "src/api/adminLaPlatform.ts",
    "src/features/admin/AdminLaMerchantsBlock.vue",
    "src/features/admin/useAdminMerchants.ts",
  ]) {
    assert.equal(exists(relativePath), false, `${relativePath} must be retired in R1`);
  }
});

test("R1 frontend runtime has no LA import, lane, or request path", () => {
  const retiredRuntimePattern =
    /adminLaPlatform|AdminLaMerchantsBlock|useAdminMerchants|session-merchants|\/api\/admin\/laplatform/i;
  for (const { relativePath, source } of runtimeSources("src")) {
    assert.doesNotMatch(
      source,
      retiredRuntimePattern,
      `${relativePath} retains retired LA runtime`,
    );
  }
});

test("AdminView keeps the legacy ops-token surfaces and deterministic gate", () => {
  const view = read("src/features/admin/AdminView.vue");
  const access = read("src/features/admin/useAdminAccess.ts");

  for (const surface of [
    "AdminReportsBlock",
    "AdminVerificationBlock",
    "AdminAuthLinkBlock",
    "AdminAuditBlock",
  ]) {
    assert.match(view, new RegExp(`<${surface}\\b`), `${surface} must remain mounted`);
  }

  assert.match(view, /<AdminTokenGate\b/);
  assert.doesNotMatch(view, /probe|merchant/i);
  assert.match(access, /export type AdminLane\s*=\s*"ops"\s*\|\s*"gate"\s*\|\s*"disposed"/);
  assert.doesNotMatch(access, /probe|merchant|session/i);
});

test("AdminView retires access and console ownership on exit and unmount", () => {
  const view = read("src/features/admin/AdminView.vue");
  const unmountBody = view.match(
    /onBeforeUnmount\s*\(\s*\(\)\s*=>\s*\{(?<body>[\s\S]*?)\}\s*\)\s*;?/,
  )?.groups?.body;

  assert.ok(unmountBody, "AdminView must have an explicit unmount-disposal callback");
  assert.match(view, /function\s+exitAdminAccess\b[\s\S]*?access\.exit\(\)/);
  assert.match(unmountBody, /access\.dispose\(\)/);
  assert.match(unmountBody, /adminConsole\.dispose\(\)/);
});
