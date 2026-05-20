import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

test("usePostReactions uses safe rollback copy and success messages for lightweight actions", () => {
  const src = read("src/features/detail/usePostReactions.ts");

  assert.match(src, /登录状态已失效，喜欢状态已恢复，请重新登录后再试。/);
  assert.match(src, /收藏操作没成功，已恢复原状态，请稍后再试。/);
  assert.match(src, /已标记喜欢。/);
  assert.match(src, /已加入收藏。/);
  assert.match(src, /options\.showMessage\(/);
  assert.match(src, /options\.showError\(new Error\(resolveReactionErrorMessage\("like", error\)\), ""\)/);
  assert.match(src, /options\.showError\(new Error\(resolveReactionErrorMessage\("save", error\)\), ""\)/);
  assert.doesNotMatch(src, /ERROR_LIKE_ACTION/);
  assert.doesNotMatch(src, /ERROR_SAVE_ACTION/);
});

test("PostReplyDock shows visible busy labels for like and save buttons", () => {
  const src = read("src/features/detail/PostReplyDock.vue");

  assert.match(src, /aria-busy="likeBusy \? 'true' : 'false'"/);
  assert.match(src, /aria-busy="saveBusy \? 'true' : 'false'"/);
  assert.match(src, /likeBusy \? "处理中…" : liked \? "已喜欢" : "喜欢"/);
  assert.match(src, /saveBusy \? "处理中…" : saved \? "已收藏" : "收藏"/);
  assert.match(src, /post-reply-dock__action-count/);
});

test("PostDetailPanel routes reaction success messages into the shared action feedback channel", () => {
  const src = read("src/features/detail/PostDetailPanel.vue");
  const reactionsBlock = src.match(/usePostReactions\(\{[\s\S]*?\}\);/);

  assert.ok(reactionsBlock, "expected usePostReactions block");
  assert.match(reactionsBlock[0], /showError: showActionError/);
  assert.match(reactionsBlock[0], /showMessage: showActionMessage/);
});
