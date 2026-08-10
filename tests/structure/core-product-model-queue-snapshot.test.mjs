import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8").replace(/\r\n?/g, "\n");
}

const readme = read("README.md");
const currentStatus = read("docs/CURRENT_STATUS.md");
const archivedSnapshot = read("docs/archive/status-snapshot-2026-06.md");
const phaseOrder = read("docs/product/CORE_PRODUCT_MODEL_V1_PHASE_ORDER.md");

test("README points contributors to current status instead of embedding a stale issue queue", () => {
  assert.match(readme, /\(docs\/CURRENT_STATUS\.md\)/);
  assert.match(readme, /\(docs\/archive\/status-snapshot-2026-06\.md\)/);
  assert.doesNotMatch(readme, /^## Core Product Model V1 queue snapshot$/m);
});

test("CURRENT_STATUS is the active queue contract", () => {
  assert.match(currentStatus, /No active execution queue/);
  assert.match(currentStatus, /open frontend issues/);
  assert.match(currentStatus, /recent merged pull requests/);
});

test("the retired README queue is preserved only as a clearly historical archive", () => {
  assert.match(archivedSnapshot, /Archived on 2026-08-02/);
  assert.match(archivedSnapshot, /historical and must not be used as an active execution queue/i);
  assert.match(archivedSnapshot, /\.\.\/CURRENT_STATUS\.md/);
  assert.match(archivedSnapshot, /## Core Product Model V1 queue snapshot/);
});

test("durable phase ordering lives in the product contract rather than issue-state prose", () => {
  for (const phase of ["Phase 0", "Phase 1", "Phase 2", "Phase 3", "Phase 4"]) {
    assert.match(phaseOrder, new RegExp(`^## ${phase}\\b`, "m"));
  }
  assert.match(phaseOrder, /## Queue maintenance rule/);
  assert.match(phaseOrder, /tests\/phase0\/phase-order-contract\.test\.ts/);
});
