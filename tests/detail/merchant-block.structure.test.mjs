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
  // The errand-entry / errand-unavailable testids are bound to a computed
  // `errandWrapperTestId` (mw#827), so we match the bare strings.
  assert.match(src, /"post-detail-merchant-errand-entry"/);
});

// --- issue #693 / mw#827: explicit CTA + dispatch contract via DetailCtaButton ---

test("PostDetailMerchantBlock CTA derives 6-state visuals from the shared DetailCtaButton", () => {
  // mw#827 acceptance: the CTA renders through `DetailCtaButton` so the
  // 6-state vocabulary (enabled / disabled / loading / success / failure /
  // reason) lands here in one place. The block must NOT render a bare
  // <button> for the primary errand action — the cta-shared-base structure
  // test pins the same invariant.
  const src = read("src/features/detail/PostDetailMerchantBlock.vue");
  assert.match(src, /import DetailCtaButton from "\.\/DetailCtaButton\.vue"/);
  assert.match(src, /<DetailCtaButton[\s\S]*?test-id="post-detail-merchant-errand-cta"/);
});

test("PostDetailMerchantBlock gates the CTA on errandEntryAvailable + a positive merchantPostId", () => {
  // Issue #693 acceptance preserved: the CTA is clickable only when the
  // backend says the entry is available AND the block has a merchantPostId
  // to hand to the route singleton. The wave 3-A composable owns the
  // boolean expression but the block keeps the legacy local computed so
  // the source-text contract still matches.
  const src = read("src/features/detail/PostDetailMerchantBlock.vue");
  assert.match(src, /errandEntryAvailable === true/);
  assert.match(src, /merchantPostId\s*\?\?\s*0\)\s*>\s*0/);
});

test("PostDetailMerchantBlock click dispatches into useErrandOrderRoute with origin=feed", () => {
  // Issue #693 acceptance: tapping the CTA must open the errand-order secret
  // view AND tag the route singleton with the merchant post id. The origin
  // must be pinned to "feed" so the close/back handlers route the user back
  // to the feed tab where the post detail was open.
  //
  // Issue #609 PR2 layered: the click also seeds `merchant.name` as the
  // pickup hint so the order form opens with "到 <商家>" already filled.
  //
  // mw#827 layered: the click runs through `useErrandHelpCta.runClick` so
  // the lifecycle (loading → success / failure) is centralized.
  const src = read("src/features/detail/PostDetailMerchantBlock.vue");
  assert.match(src, /useErrandOrderRoute/);
  assert.match(src, /useDetailNavigation/);
  assert.match(src, /useErrandHelpCta/);
  assert.match(src, /detail\.close\("view-change"\)/);
  assert.match(
    src,
    /errandRoute\.enterForMerchant\([\s\S]*?props\.merchantPostId as number,[\s\S]*?"feed",[\s\S]*?props\.merchant\.name/,
  );
  assert.match(src, /setActiveView\("errand-order"\)/);
  // The composable's runClick gates on clickable + handles loading/success
  // latching. The block must use it rather than its own hand-rolled gate.
  assert.match(src, /cta\.runClick\(/);
});

test("PostDetailMerchantBlock surfaces the unavailable reason instead of silently hiding the journey", () => {
  // Issue #693 acceptance: when eligibility rejects, the detail surface MUST
  // render the reason instead of silently omitting the journey. We pin both
  // the reason testid and the call into errandReasonText so the
  // backend-supplied prose path stays wired.
  //
  // mw#827 changed the wiring so the testids come through `:data-testid`
  // computed bindings rather than literal `data-testid="..."` attributes,
  // so we match the bare strings here. The cta-shared-base structure test
  // pins the binding shape on top of this.
  const src = read("src/features/detail/PostDetailMerchantBlock.vue");
  assert.match(src, /"post-detail-merchant-errand-unavailable"/);
  assert.match(src, /"post-detail-merchant-errand-reason"/);
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
  assert.match(src, /v-if="showErrandEntry \|\| errandUnavailable"/);
});

// --- mw#827 capability gate ---

test("PostDetailMerchantBlock takes a viewerCanOrderErrand prop with a default of true (mw#827)", () => {
  // Wave 3-A: the merchant block accepts a capability gate prop that
  // routes the CTA into the disabled-permission state without hiding it.
  // Default `true` keeps every existing call site byte-identical until
  // the parent surface opts in.
  const src = read("src/features/detail/PostDetailMerchantBlock.vue");
  assert.match(src, /viewerCanOrderErrand\?:\s*boolean/);
  assert.match(src, /viewerCanOrderErrand:\s*true/);
});

test("PostDetailMerchantBlock surfaces the permission-blocked reason copy when the gate is closed (mw#827)", () => {
  const src = read("src/features/detail/PostDetailMerchantBlock.vue");
  assert.match(src, /MERCHANT_ERRAND_PERMISSION_BLOCKED_HINT/);
  assert.match(src, /MERCHANT_ERRAND_PERMISSION_BLOCKED_TITLE/);
});

test("PostDetailContent forwards viewer-can-order-errand to the merchant block (mw#827)", () => {
  const src = read("src/features/detail/PostDetailContent.vue");
  assert.match(src, /:viewer-can-order-errand="viewerCanOrderErrand"/);
});

test("PostDetailPanel probes campus_verified and routes the result through viewerCanOrderErrand (mw#827)", () => {
  // The panel composes `useViewerErrandPermission`, which performs the
  // same campus_verified probe `useErrandOrderDraft` does so the CTA
  // reflects the gate up-front. The api call lives in the composable
  // (view-boundary guard) — the panel only consumes its boolean output.
  const panel = read("src/features/detail/PostDetailPanel.vue");
  assert.match(panel, /useViewerErrandPermission/);
  assert.match(panel, /:viewer-can-order-errand="viewerCanOrderErrand"/);

  const probe = read("src/features/detail/useViewerErrandPermission.ts");
  assert.match(probe, /verificationState\?\.campus_verified\?\.active/);
  assert.match(probe, /fetchAuthMe/);
});

// --- existing wiring stays untouched ---

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
