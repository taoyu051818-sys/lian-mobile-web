import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

const runnerBrand = read("src/config/brand/runner.ts");
const runnerView = read("src/features/runner/RunnerCenterView.vue");
const adminBrand = read("src/config/brand/admin.ts");
const adminQueue = read("src/features/admin/AdminQueueList.vue");
const adminAudit = read("src/features/admin/AdminAuditLogList.vue");
const adminView = read("src/features/admin/AdminView.vue");
const verificationBrand = read("src/config/brand/verification.ts");
const verificationView = read("src/features/verification/VerificationView.vue");

test("runner brand copy defines guidance titles and bodies for both empty tabs", () => {
  for (const key of [
    "RUNNER_EMPTY_AVAILABLE_TITLE",
    "RUNNER_EMPTY_AVAILABLE_BODY",
    "RUNNER_EMPTY_ACTIVE_TITLE",
    "RUNNER_EMPTY_ACTIVE_BODY",
  ]) {
    assert.match(runnerBrand, new RegExp(`export const ${key}\\s*=`));
  }
  assert.match(runnerBrand, /新的校园订单进入可接池后会先显示在这里/);
  assert.match(runnerBrand, /先从可接订单里接一单/);
});

test("RunnerCenterView renders structured empty cards for available and active states", () => {
  assert.match(runnerView, /class="runner-view__empty-card"/);
  assert.match(runnerView, /data-testid="runner-empty-available"/);
  assert.match(runnerView, /data-testid="runner-empty-active"/);
  assert.match(runnerView, /RUNNER_EMPTY_AVAILABLE_TITLE/);
  assert.match(runnerView, /RUNNER_EMPTY_ACTIVE_BODY/);
});

test("admin brand and queue files replace generic empty strings with guidance copy", () => {
  for (const key of [
    "ADMIN_QUEUE_EMPTY_TITLE",
    "ADMIN_QUEUE_EMPTY_BODY",
    "ADMIN_AUDIT_EMPTY_TITLE",
    "ADMIN_AUDIT_EMPTY_BODY",
  ]) {
    assert.match(adminBrand, new RegExp(`export const ${key}\\s*=`));
  }
  for (const phrase of [
    "当前没有待处理举报",
    "现在没有审核中的举报",
    "还没有已处理记录",
    "还没有已驳回记录",
    "当前还没有举报记录",
  ]) {
    assert.match(adminQueue, new RegExp(phrase));
  }
  assert.match(adminQueue, /data-testid="admin-queue-empty"/);
  assert.match(adminAudit, /data-testid="admin-audit-empty"/);
});

test("AdminView adds verification-review empty guidance keyed by the active filter", () => {
  assert.match(adminView, /const verificationEmptyState = computed/);
  assert.match(adminView, /现在没有待审核申请/);
  assert.match(adminView, /还没有已通过记录/);
  assert.match(adminView, /还没有已拒绝记录/);
  assert.match(adminView, /data-testid="admin-verification-empty"/);
});

test("VerificationView shows a no-record guide and the brand copy explains what happens next", () => {
  assert.match(verificationBrand, /VERIFICATION_EMPTY_TITLE/);
  assert.match(verificationBrand, /VERIFICATION_EMPTY_BODY/);
  assert.match(verificationBrand, /开放申请或审核完成后，这里会显示对应状态与时间/);
  assert.match(verificationView, /const hasAnyVerificationRecord = computed/);
  assert.match(verificationView, /data-testid="verification-empty-state"/);
  assert.match(verificationView, /!hasAnyVerificationRecord/);
});