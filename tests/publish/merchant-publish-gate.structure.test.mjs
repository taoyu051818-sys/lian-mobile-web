import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

// --- types: PublishPayload exposes merchant + contentType ---

test("PublishPayload carries optional contentType + merchant block", () => {
  const src = read("src/types/publish.ts");
  assert.match(src, /MerchantContentType/);
  assert.match(src, /MerchantPublishInput/);
  assert.match(src, /contentType\?:\s*MerchantContentType/);
  assert.match(src, /merchant\?:\s*MerchantPublishInput/);
  assert.match(src, /"merchant_food"\s*\|\s*"merchant_service"\s*\|\s*"merchant_retail"/);
});

test("ProfileUser surfaces verificationState + verificationTags", () => {
  const src = read("src/types/profile.ts");
  assert.match(src, /verificationState\?:\s*VerificationState/);
  assert.match(src, /verificationTags\?:\s*VerificationTag\[\]/);
});

// --- buildPublishPayload wires merchant ---

test("buildPublishPayload sets merchant + contentType on the wire", () => {
  const src = read("src/api/publish.ts");
  // payload spreads merchant input + contentType at top level (matches backend #383 wire shape)
  assert.match(src, /input\.merchant/);
  assert.match(src, /presentationIntent\s*=\s*"merchant"/);
  assert.match(src, /contentType:\s*input\.merchant\.contentType/);
});

// --- composable + control component ---

test("useMerchantPublishDraft owns the merchant gate + payload", () => {
  const src = read("src/features/publish/useMerchantPublishDraft.ts");
  assert.match(src, /merchant_verified/);
  assert.match(src, /verificationState\?\.merchant_verified/);
  assert.match(src, /export function useMerchantPublishDraft/);
  assert.match(src, /contentType.*MerchantContentType/);
  for (const slug of ["merchant_food", "merchant_service", "merchant_retail"]) {
    assert.match(src, new RegExp(`"${slug}"`));
  }
});

test("PublishMerchantControls renders gate when not verified, form when verified", () => {
  const src = read("src/features/publish/PublishMerchantControls.vue");
  assert.match(src, /v-if="!merchantVerified"/);
  assert.match(src, /data-testid="publish-merchant-gate"/);
  // Gate CTA is owned by the shared PublishGateNotice primitive (PR-2);
  // the merchant component just supplies title / cta-label / @cta.
  assert.match(src, /<PublishGateNotice[\s\S]*?data-testid="publish-merchant-gate"/);
  assert.match(src, /:cta-label="PUBLISH_MERCHANT_GATE_CTA"/);
  assert.match(src, /@cta="emit\('goVerify'\)"/);
  assert.match(src, /data-testid="publish-merchant-form"/);
  assert.match(src, /data-testid="publish-merchant-name"/);
  assert.match(src, /data-testid="publish-merchant-category"/);
  assert.match(src, /data-testid="publish-merchant-errand-toggle"/);
  assert.match(src, /goVerify/);
});

// --- PublishView wires the type switch + gate routing ---

test("PublishView exposes a merchant/regular type switch", () => {
  const src = read("src/features/publish/PublishView.vue");
  assert.match(src, /data-testid="publish-type-switch"/);
  assert.match(src, /data-testid="publish-type-merchant"/);
  // Vue templates use single quotes inside attributes; allow either quote style.
  assert.match(src, /selectPublishKind\('merchant'\)/);
  assert.match(src, /selectPublishKind\('regular'\)/);
});

test("PublishView locks the merchant affordance when merchant_verified is inactive", () => {
  const src = read("src/features/publish/PublishView.vue");
  assert.match(src, /merchantAffordanceLocked/);
  assert.match(src, /data-testid="publish-merchant-affordance-gate"/);
  // The CTA is owned by the shared PublishGateNotice primitive (PR-2);
  // PublishView wires the title / cta-label / @cta wire-up, not the button.
  assert.match(src, /<PublishGateNotice[\s\S]*?data-testid="publish-merchant-affordance-gate"/);
  assert.match(src, /:cta-label="PUBLISH_MERCHANT_GATE_CTA"/);
  assert.match(src, /@cta="goToVerification"/);
  assert.match(src, /:disabled="merchantAffordanceLocked"/);
  assert.match(src, /PUBLISH_MERCHANT_GATE_BLOCK/);
});

test("PublishView routes the verification CTA to the verification view", () => {
  const src = read("src/features/publish/PublishView.vue");
  assert.match(src, /useActiveView/);
  assert.match(src, /setActiveView\("verification"\)/);
  assert.match(src, /@go-verify="goToVerification"/);
  assert.match(src, /@click="goToVerification"/);
});

test("PublishView refreshes merchant verification before and during merchant entry", () => {
  const src = read("src/features/publish/PublishView.vue");
  assert.match(src, /onMounted\([\s\S]*merchant\.refreshVerification/);
  assert.match(src, /kind === "merchant"/);
  assert.match(src, /merchant\.refreshVerification/);
});

// --- usePublishSubmit gates and forwards merchant payload ---

test("usePublishSubmit blocks submit when merchant_verified is missing", () => {
  const src = read("src/features/publish/usePublishSubmit.ts");
  assert.match(src, /publishKind/);
  assert.match(src, /PUBLISH_MERCHANT_GATE_BLOCK/);
  assert.match(src, /PUBLISH_MERCHANT_NAME_REQUIRED/);
  assert.match(src, /merchantPayload\(\)/);
});
