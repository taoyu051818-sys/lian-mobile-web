import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- types: PostDetail surfaces merchant + errandEntryAvailable ---

test("PostDetail type carries optional merchant + errandEntryAvailable", () => {
  const src = read("src/types/post.ts");
  assert.match(src, /merchant\?:\s*MerchantPostExtension/);
  assert.match(src, /errandEntryAvailable\?:\s*boolean/);
});

test("MerchantPostExtension matches backend metadata.merchant shape", () => {
  const src = read("src/types/post-extensions.ts");
  // Backend (#383) ships { name, category, hours, contact, errandSupported, verifiedAt }.
  assert.match(src, /export interface MerchantPostExtension/);
  for (const field of ["name", "category", "hours", "contact", "errandSupported", "verifiedAt"]) {
    assert.match(src, new RegExp(`\\b${field}\\b`));
  }
  assert.match(src, /MerchantCategory/);
  assert.match(src, /"food"\s*\|\s*"service"\s*\|\s*"retail"/);
});

// --- normalizer wires merchant into PostDetail ---

test("normalizePostDetail surfaces merchant + errandEntryAvailable when present", () => {
  const src = read("src/api/posts.ts");
  assert.match(src, /normalizeMerchantExtension/);
  assert.match(src, /errandEntryAvailable/);
});

test("normalizeMerchantExtension defaults unknown category to service", () => {
  const src = read("src/platform/api-normalizers.ts");
  assert.match(src, /export function normalizeMerchantExtension/);
  // Mirrors backend normalizeMerchantMetadata fallback (post-merchant.test.mjs:60-63).
  assert.match(src, /service/);
  assert.match(src, /MERCHANT_CATEGORIES/);
});

// --- detail block component + wiring ---

test("PostDetailMerchantBlock renders the four required surfaces", () => {
  const src = read("src/features/detail/PostDetailMerchantBlock.vue");
  assert.match(src, /MerchantPostExtension/);
  // Category pill, verification stamp, hours/contact rows, errand entry.
  assert.match(src, /MERCHANT_VERIFIED_PREFIX/);
  assert.match(src, /MERCHANT_HOURS_LABEL/);
  assert.match(src, /MERCHANT_CONTACT_LABEL/);
  assert.match(src, /MERCHANT_ERRAND_CTA/);
  assert.match(src, /data-testid="post-detail-merchant-block"/);
  assert.match(src, /data-testid="post-detail-merchant-errand-entry"/);
});

test("PostDetailContent mounts MerchantBlock when merchant is present", () => {
  const src = read("src/features/detail/PostDetailContent.vue");
  assert.match(src, /import PostDetailMerchantBlock/);
  assert.match(src, /<PostDetailMerchantBlock/);
  assert.match(src, /v-if="merchant"/);
  assert.match(src, /:errand-entry-available="errandEntryAvailable"/);
});

test("PostDetailPanel forwards post.merchant + post.errandEntryAvailable to content", () => {
  const src = read("src/features/detail/PostDetailPanel.vue");
  assert.match(src, /:merchant="post\?\.merchant"/);
  assert.match(src, /:errand-entry-available="post\?\.errandEntryAvailable"/);
});

// --- brand registration ---

test("merchant brand module is re-exported from brand/index", () => {
  const src = read("src/config/brand/index.ts");
  assert.match(src, /from "\.\/merchant"/);
});
