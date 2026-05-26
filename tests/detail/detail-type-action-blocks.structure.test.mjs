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
  assert.match(src, /presentationIntent === "activity"/);
  assert.match(src, /rawType === "help"/);
  assert.match(src, /presentationIntent === "help"/);
  assert.match(src, /rawType === "place"/);
  assert.match(src, /contentType === "location"/);
  assert.match(src, /presentationIntent === "place"/);
  assert.match(src, /rawType === "club"/);
  assert.match(src, /presentationIntent === "club"/);
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
  assert.match(
    src,
    /import PostDetailTypedFallbackBlock from "\.\/PostDetailTypedFallbackBlock\.vue"/,
  );
  assert.match(src, /postType\?:\s*PostType/);
  assert.match(src, /const showEventFallback = computed\(/);
  assert.match(src, /const showHelpFallback = computed\(/);
  assert.match(src, /const showMerchantFallback = computed\(/);
  assert.match(src, /const showTradeFallback = computed\(/);
  assert.match(src, /v-else-if="showEventFallback" post-type="event"/);
  assert.match(src, /v-else-if="showHelpFallback" post-type="help"/);
  assert.match(src, /v-else-if="showMerchantFallback" post-type="merchant"/);
  assert.match(src, /v-else-if="showTradeFallback" post-type="trade"/);
});

test("PostDetailPanel forwards the normalized post.type into PostDetailContent", () => {
  const src = read("src/features/detail/PostDetailPanel.vue");
  assert.match(src, /:post-type="post\?\.type"/);
});
