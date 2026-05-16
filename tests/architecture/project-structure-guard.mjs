import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const guardScript = path.join(rootDir, "scripts/validate-project-structure.js");

function runGuard() {
  try {
    execFileSync(process.execPath, [guardScript], {
      cwd: rootDir,
      stdio: "pipe",
      timeout: 15000,
    });
    return { exitCode: 0, stdout: "", stderr: "" };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: String(err.stdout ?? ""),
      stderr: String(err.stderr ?? ""),
    };
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function removeDir(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true });
}

async function writeFile(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

describe("architecture boundary guards", () => {
  it("passes on clean codebase", () => {
    const result = runGuard();
    assert.equal(result.exitCode, 0, `guard should pass but exited ${result.exitCode}:\n${result.stdout}`);
  });

  it("fails if src/views/ exists", async () => {
    const viewsDir = path.join(rootDir, "src", "views");
    try {
      await ensureDir(viewsDir);
      await writeFile(path.join(viewsDir, "HomeView.vue"), "<template><div/></template>\n");
      const result = runGuard();
      assert.equal(result.exitCode, 1, "guard should fail when src/views/ exists");
      assert.ok(result.stdout.includes("src/views/"), "output should mention src/views/");
    } finally {
      await removeDir(viewsDir);
    }
  });

  it("fails if src/ui/ imports src/features/", async () => {
    const violationFile = path.join(rootDir, "src", "ui", "_test_violation.vue");
    try {
      await writeFile(
        violationFile,
        '<script setup>\nimport { FeedView } from "../features/feed/FeedView.vue";\n</script>\n<template><div/></template>\n',
      );
      const result = runGuard();
      assert.equal(result.exitCode, 1, "guard should fail when ui imports features");
      assert.ok(result.stdout.includes("ui → features"), "output should mention ui → features boundary");
    } finally {
      await fs.unlink(violationFile).catch(() => {});
    }
  });

  it("fails if src/domain/ imports Vue", async () => {
    const violationFile = path.join(rootDir, "src", "domain", "_test_violation.ts");
    try {
      await writeFile(violationFile, 'import { ref } from "vue";\nexport const x = ref(0);\n');
      const result = runGuard();
      assert.equal(result.exitCode, 1, "guard should fail when domain imports Vue");
      assert.ok(result.stdout.includes("domain purity"), "output should mention domain purity");
    } finally {
      await fs.unlink(violationFile).catch(() => {});
    }
  });

  it("fails if src/domain/ imports api code", async () => {
    const violationFile = path.join(rootDir, "src", "domain", "_test_violation_api.ts");
    try {
      await writeFile(violationFile, 'import { fetchFeed } from "../api/feed";\nexport const f = fetchFeed;\n');
      const result = runGuard();
      assert.equal(result.exitCode, 1, "guard should fail when domain imports api");
      assert.ok(result.stdout.includes("domain purity"), "output should mention domain purity");
    } finally {
      await fs.unlink(violationFile).catch(() => {});
    }
  });

  it("fails if src/platform/ imports features", async () => {
    const violationFile = path.join(rootDir, "src", "platform", "_test_violation.ts");
    try {
      await writeFile(
        violationFile,
        'import { FeedView } from "../features/feed/FeedView.vue";\nexport const v = FeedView;\n',
      );
      const result = runGuard();
      assert.equal(result.exitCode, 1, "guard should fail when platform imports features");
      assert.ok(result.stdout.includes("platform boundary"), "output should mention platform boundary");
    } finally {
      await fs.unlink(violationFile).catch(() => {});
    }
  });

  it("fails if feature imports private code from a barrelled feature", async () => {
    const violationFile = path.join(rootDir, "src", "features", "feed", "_test_violation.ts");
    try {
      await writeFile(
        violationFile,
        'import { MessagesView } from "../messages/MessagesView.vue";\nexport const v = MessagesView;\n',
      );
      const result = runGuard();
      assert.equal(result.exitCode, 1, "guard should fail when feature imports private barrelled code");
      assert.ok(result.stdout.includes("feature cross-import"), "output should mention feature cross-import");
    } finally {
      await fs.unlink(violationFile).catch(() => {});
    }
  });

  it("allows feature to import from another feature's barrel", async () => {
    const violationFile = path.join(rootDir, "src", "features", "feed", "_test_barrel_ok.ts");
    try {
      await writeFile(
        violationFile,
        'import { MessagesTabs } from "../messages";\nexport const c = MessagesTabs;\n',
      );
      const result = runGuard();
      assert.equal(result.exitCode, 0, `barrel import should pass but exited ${result.exitCode}:\n${result.stdout}`);
    } finally {
      await fs.unlink(violationFile).catch(() => {});
    }
  });
});
