import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

test("journey: detail normalizer stamps a stable post.type even when the extension payload is absent", () => {
  const api = read("src/api/posts.ts");
  assert.match(api, /const type = normalizeDetailPostType\(record, Boolean\(cover\)\)/);
  assert.match(api, /return \{[\s\S]*\btype,\s*title:/);
});

test("journey: panel forwards the normalized type into the detail content surface", () => {
  const panel = read("src/features/detail/PostDetailPanel.vue");
  assert.match(panel, /<PostDetailContent/);
  assert.match(panel, /:post-type="post\?\.type"/);
});

test("journey: detail content falls back for event, help, merchant, and trade posts", () => {
  const content = read("src/features/detail/PostDetailContent.vue");
  for (const slug of ["event", "help", "merchant", "trade"]) {
    assert.match(content, new RegExp(`postType === '${slug}'`));
  }
  assert.match(content, /<PostDetailTypedFallbackBlock/);
});

test("journey: typed fallback surfaces an explicit blocked action instead of disappearing", () => {
  const fallback = read("src/features/detail/PostDetailTypedFallbackBlock.vue");
  assert.match(fallback, /:data-testid="rootTestId"/);
  assert.match(fallback, /:data-testid="actionTestId"/);
  assert.match(fallback, /:data-testid="reasonTestId"/);
  assert.match(fallback, /disabled/);
  assert.match(fallback, /暂时无法报名/);
  assert.match(fallback, /暂时无法投票/);
  assert.match(fallback, /暂时无法帮我取/);
  assert.match(fallback, /暂时无法查看交易状态/);
});
