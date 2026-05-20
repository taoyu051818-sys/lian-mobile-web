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

test("PostDetailPanel no longer passes the generic raw-error callback into the reply composer", () => {
  const src = read("src/features/detail/PostDetailPanel.vue");

  assert.doesNotMatch(src, /showError:\s*showActionError/);
  assert.match(src, /usePostReplyComposer\(\{[\s\S]*setActionError,[\s\S]*onReplySuccess:/);
});
