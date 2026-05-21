import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

test("usePostReplyComposer routes reply failures through the safe mapper and preserves expansion", () => {
  const src = read("src/features/detail/usePostReplyComposer.ts");

  assert.match(src, /resolveWriteActionErrorMessage\("reply", error\)/);
  assert.match(src, /replyExpanded\.value = true/);
  assert.doesNotMatch(src, /showError\(error, ERROR_SEND_REPLY\)/);
});

test("PostDetailPanel keeps the reply composer on setActionError without passing showError into that block", () => {
  const src = read("src/features/detail/PostDetailPanel.vue");
  const composerBlock = src.match(/usePostReplyComposer\(\{[\s\S]*?\}\);/);

  assert.ok(composerBlock, "expected usePostReplyComposer block");
  assert.match(composerBlock[0], /setActionError/);
  assert.match(composerBlock[0], /showActionMessage/);
  assert.doesNotMatch(composerBlock[0], /showError:/);
});
