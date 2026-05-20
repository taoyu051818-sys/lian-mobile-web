import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

test("PostDetail carries an optional normalized type on detail payloads", () => {
  const src = read("src/types/post.ts");
  assert.match(src, /export interface PostDetail\s*{/);
  assert.match(src, /type\?:\s*PostType/);
});

test("normalizePostDetail derives typed-detail fallbacks from type, contentType, and presentationIntent", () => {
  const src = read("src/api/posts.ts");
  assert.match(src, /function normalizeDetailPostType/);
  assert.match(src, /contentType\.startsWith\("merchant_"\)/);
  assert.match(src, /presentationIntent === "merchant"/);
  assert.match(src, /contentType === "trade" \|\| presentationIntent === "trade"/);
  assert.match(src, /rawType === "event"/);
  assert.match(src, /rawType === "activity"/);
  assert.match(src, /rawType === "help"/);
  assert.match(src, /type,\s*title:/s);
});

test("typed fallback block exposes stable per-type testids and disabled action states", () => {
  const src = read("src/features/detail/PostDetailTypedFallbackBlock.vue");
  for (const slug of ["event", "help", "merchant", "trade"]) {
    assert.match(src, new RegExp(`${slug}:\\s*\\{`));
  }
  assert.match(src, /post-detail-\$\{props\.postType\}-fallback-block/);
  assert.match(src, /post-detail-\$\{props\.postType\}-fallback-action/);
  assert.match(src, /post-detail-\$\{props\.postType\}-fallback-reason/);
  assert.match(src, /disabled[\s\S]*aria-disabled="true"/);
});

test("PostDetailContent mounts typed fallback blocks whenever a typed extension is missing", () => {
  const src = read("src/features/detail/PostDetailContent.vue");
  assert.match(src, /import type \{ PostType \} from "\.\.\/\.\.\/types\/post"/);
  assert.match(src, /import PostDetailTypedFallbackBlock from "\.\/PostDetailTypedFallbackBlock\.vue"/);
  assert.match(src, /postType\?:\s*PostType/);
  assert.match(src, /v-else-if="postType === 'event'"/);
  assert.match(src, /v-else-if="postType === 'help'"/);
  assert.match(src, /v-else-if="postType === 'merchant'"/);
  assert.match(src, /v-else-if="postType === 'trade'"/);
});

test("PostDetailPanel forwards the normalized post.type into PostDetailContent", () => {
  const src = read("src/features/detail/PostDetailPanel.vue");
  assert.match(src, /:post-type="post\?\.type"/);
});
