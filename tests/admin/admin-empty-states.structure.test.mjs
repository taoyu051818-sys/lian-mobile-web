import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

test("admin queue empty state exposes guidance copy instead of bare 暂无 text", () => {
  const src = read("src/features/admin/AdminQueueList.vue");
  assert.match(src, /data-testid="admin-queue-empty"/);
  assert.match(src, /emptyState\.title/);
  assert.match(src, /emptyState\.body/);
});

test("admin audit empty state exposes guidance copy instead of bare 暂无 text", () => {
  const src = read("src/features/admin/AdminAuditLogList.vue");
  const brand = read("src/config/brand/admin.ts");
  assert.match(src, /data-testid="admin-audit-empty"/);
  assert.match(src, /ADMIN_AUDIT_EMPTY_TITLE/);
  assert.match(src, /ADMIN_AUDIT_EMPTY_BODY/);
  assert.match(brand, /ADMIN_QUEUE_EMPTY_TITLE/);
  assert.match(brand, /ADMIN_QUEUE_EMPTY_BODY/);
});