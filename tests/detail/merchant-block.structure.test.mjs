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

// --- issue #693: explicit CTA + dispatch contract ---

test("PostDetailMerchantBlock CTA is gated by errandEntryAvailable + a positive merchantPostId", () => {
  // Issue #693 acceptance: the CTA must be clickable only when (a) the backend
  // says the errand entry is available AND (b) we have a merchantPostId we can
  // hand to the route singleton. Without (b) we'd open the errand-order view
  // with no merchant target, which means the form has nothing to submit
  // against.
  const src = read("src/features/detail/PostDetailMerchantBlock.vue");
  assert.match(src, /errandEntryAvailable === true/);
  assert.match(src, /merchantPostId\s*\?\?\s*0\)\s*>\s*0/);
  assert.match(src, /:disabled="!errandEntryClickable"/);
  assert.match(src, /:aria-disabled="!errandEntryClickable"/);
});

test("PostDetailMerchantBlock click dispatches into useErrandOrderRoute with origin=feed", () => {
  // Issue #693 acceptance: tapping the CTA must open the errand-order secret
  // view AND tag the route singleton with the merchant post id. The origin
  // must be pinned to "feed" so the close/back handlers route the user back
  // to the feed tab where the post detail was open — without this, the
  // ErrandOrderView's go-back falls through to the singleton default and a
  // user who came from a non-feed surface gets dumped on feed.
  //
  // Issue #609 PR2 layered: the click also seeds `merchant.name` as the
  // pickup hint so the order form opens with "到 <商家>" already filled —
  // the merchant DTO doesn't ship a structured address, so name is the
  // runner-facing label that actually matters.
  const src = read("src/features/detail/PostDetailMerchantBlock.vue");
  assert.match(src, /useErrandOrderRoute/);
  assert.match(src, /useDetailNavigation/);
  assert.match(src, /detail\.close\("view-change"\)/);
  assert.match(
    src,
    /errandRoute\.enterForMerchant\([\s\S]*?props\.merchantPostId as number,[\s\S]*?"feed",[\s\S]*?props\.merchant\.name/,
  );
  assert.match(src, /setActiveView\("errand-order"\)/);
});

test("PostDetailMerchantBlock surfaces the unavailable reason instead of silently hiding the journey", () => {
  // Issue #693 acceptance: when eligibility rejects, the detail surface MUST
  // render the reason instead of silently omitting the journey. We pin both
  // the reason testid and the call into errandReasonText so the
  // backend-supplied prose path stays wired.
  const src = read("src/features/detail/PostDetailMerchantBlock.vue");
  assert.match(src, /data-testid="post-detail-merchant-errand-unavailable"/);
  assert.match(src, /data-testid="post-detail-merchant-errand-reason"/);
  // Generic fallback covers "unavailable but no reason code" — together with
  // the reasonText pass-through this guarantees the unavailable branch is
  // never silent.
  assert.match(src, /MERCHANT_ERRAND_UNAVAILABLE_FALLBACK/);
  assert.match(src, /errandReasonText\(\s*\{[\s\S]*reason:\s*props\.errandUnavailableReason/);
  assert.match(src, /reasonText:\s*props\.errandUnavailableReasonText/);
});

test("PostDetailMerchantBlock does NOT render anything errand-related when errandEntryAvailable is undefined", () => {
  // A non-errand merchant post must not grow a "暂未开放" chip just because
  // the merchant block is present — the unavailable branch is only reached
  // when the merchant supports errand but it's currently turned off.
  const src = read("src/features/detail/PostDetailMerchantBlock.vue");
  assert.match(src, /errandEntryAvailable === false/);
  // The available branch is gated by a positive boolean (not just truthiness),
  // so undefined falls through to neither branch.
  assert.match(src, /v-if="errandEntryAvailable"/);
  assert.match(src, /v-else-if="errandUnavailable"/);
});

test("PostDetailContent mounts MerchantBlock when merchant is present", () => {
  const src = read("src/features/detail/PostDetailContent.vue");
  assert.match(src, /import PostDetailMerchantBlock/);
  assert.match(src, /<PostDetailMerchantBlock/);
  assert.match(src, /showMerchantBlock/);
  assert.match(src, /v-if="showMerchantBlock"/);
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
