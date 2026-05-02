#!/usr/bin/env node

// Metadata write safety tests — verifies serialized concurrent patches.
// Usage: node scripts/test-metadata-write-safety.js

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Use a temp file to avoid touching real metadata
const TEST_META_PATH = path.join(ROOT, "data", ".test-metadata-tmp.json");

let passed = 0, failed = 0;

function assert(cond, name) {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name}`); failed++; }
}

// Inline the write logic to test in isolation
async function writeJsonFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, filePath);
}

let metadataWriteQueue = Promise.resolve();

async function patchPostMetadata(tid, patch = {}) {
  const key = String(Number(tid) || tid || "");
  if (!key) return;
  metadataWriteQueue = metadataWriteQueue.then(async () => {
    const raw = await fs.readFile(TEST_META_PATH, "utf8").catch(() => "{\"items\":{}}");
    const data = JSON.parse(raw || "{\"items\":{}}");
    data.items ||= {};
    data.items[key] = { ...(data.items[key] || {}), ...patch };
    await writeJsonFile(TEST_META_PATH, data);
  });
  return metadataWriteQueue;
}

async function readTestMeta() {
  const raw = await fs.readFile(TEST_META_PATH, "utf8").catch(() => "{\"items\":{}}");
  return JSON.parse(raw || "{\"items\":{}}").items || {};
}

async function main() {
  console.log("═══ Metadata 写入安全测试 ═══\n");

  // Clean up
  await fs.rm(TEST_META_PATH, { force: true });

  // Test 1: Basic patch
  console.log("▶ 基础 patch");
  await patchPostMetadata(100, { title: "测试帖", visibility: "public" });
  const meta1 = await readTestMeta();
  assert(meta1["100"]?.title === "测试帖", "patch 写入 title");
  assert(meta1["100"]?.visibility === "public", "patch 写入 visibility");

  // Test 2: Merge preserves existing fields
  console.log("▶ 合并保留已有字段");
  await patchPostMetadata(100, { contentType: "campus_moment" });
  const meta2 = await readTestMeta();
  assert(meta2["100"]?.title === "测试帖", "合并后 title 保留");
  assert(meta2["100"]?.visibility === "public", "合并后 visibility 保留");
  assert(meta2["100"]?.contentType === "campus_moment", "合并新增 contentType");

  // Test 3: Concurrent patches to DIFFERENT tids
  console.log("▶ 并发写入不同 tid");
  await fs.rm(TEST_META_PATH, { force: true });
  await Promise.all([
    patchPostMetadata(200, { title: "帖A" }),
    patchPostMetadata(201, { title: "帖B" }),
    patchPostMetadata(202, { title: "帖C" })
  ]);
  const meta3 = await readTestMeta();
  assert(meta3["200"]?.title === "帖A", "tid 200 写入正确");
  assert(meta3["201"]?.title === "帖B", "tid 201 写入正确");
  assert(meta3["202"]?.title === "帖C", "tid 202 写入正确");

  // Test 4: Concurrent patches to SAME tid
  console.log("▶ 并发写入同一 tid");
  await fs.rm(TEST_META_PATH, { force: true });
  await patchPostMetadata(300, { title: "初始", visibility: "public" });
  await Promise.all([
    patchPostMetadata(300, { contentType: "food" }),
    patchPostMetadata(300, { locationArea: "二食堂" })
  ]);
  const meta4 = await readTestMeta();
  assert(meta4["300"]?.title === "初始", "同 tid 并发后 title 保留");
  assert(meta4["300"]?.visibility === "public", "同 tid 并发后 visibility 保留");
  assert(meta4["300"]?.contentType === "food", "同 tid 并发后 contentType 写入");
  assert(meta4["300"]?.locationArea === "二食堂", "同 tid 并发后 locationArea 写入");

  // Test 5: Empty tid rejected
  console.log("▶ 空 tid 拒绝");
  const before = await readTestMeta();
  await patchPostMetadata("", { title: "不应该写入" });
  await patchPostMetadata(null, { title: "不应该写入" });
  const after = await readTestMeta();
  assert(Object.keys(after).length === Object.keys(before).length, "空 tid 不写入");

  // Test 6: Backup
  console.log("▶ 备份");
  const { backupMetadata } = await import("../src/server/data-store.js");
  // backupMetadata uses the real metadataPath, so we just verify it doesn't throw
  const backupPath = await backupMetadata();
  assert(backupPath === null || typeof backupPath === "string", "backupMetadata 不抛异常");

  // Clean up
  await fs.rm(TEST_META_PATH, { force: true });
  await fs.rm(`${TEST_META_PATH}.tmp`, { force: true });

  console.log("");
  console.log("═══ 结果 ═══");
  console.log(`通过: ${passed}, 失败: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("\n全部通过！");
  }
}

main().catch((e) => {
  console.error("致命错误:", e.message);
  process.exit(1);
});
