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
  // mw-merchant-gating: the merchant gate is now default-collapsed so a
  // non-merchant who somehow lands here doesn't see a default-popped prompt.
  // Trade keeps the default `true` because campus verification is the baseline.
  assert.match(src, /:default-open="false"/);
  assert.match(src, /data-testid="publish-merchant-form"/);
  assert.match(src, /data-testid="publish-merchant-name"/);
  assert.match(src, /data-testid="publish-merchant-category"/);
  assert.match(src, /data-testid="publish-merchant-errand-toggle"/);
  assert.match(src, /goVerify/);
});

// --- PublishView wires gate routing (post step F: no radio) ---

test("PublishView no longer renders the merchant radio (PRD V0.2 step F removed the 4-radio)", () => {
  const src = read("src/features/publish/PublishView.vue");
  // Step F removed the entire publishKind fieldset. Merchant entry now flows
  // through accept(merchant_info) on the inline ghost-component list, which
  // is itself merchant_verified-gated inside createSuggestedComponentsActions.
  assert.doesNotMatch(src, /data-testid="publish-type-switch"/);
  assert.doesNotMatch(src, /data-testid="publish-type-merchant"/);
  assert.doesNotMatch(src, /selectPublishKind\(/);
  // The standalone affordance banner above the form is also gone.
  assert.doesNotMatch(src, /merchantAffordanceLocked/);
  assert.doesNotMatch(src, /data-testid="publish-merchant-affordance-gate"/);
  assert.doesNotMatch(src, /PUBLISH_MERCHANT_GATE_BLOCK/);
});

test("PublishView falls back to regular when merchant verification flips off mid-session", () => {
  const src = read("src/features/publish/PublishView.vue");
  // Defense-in-depth: if the verification ref flips false while publishKind
  // was already "merchant" (set via accept(merchant_info)), reset to "regular"
  // so the form doesn't sit on a panel the user can't satisfy.
  assert.match(
    src,
    /watch\(draft\.merchant\.merchantVerified[\s\S]*?draft\.publishKind\.value\s*=\s*"regular"/,
  );
});

test("PublishView routes the verification CTA to the verification view", () => {
  const src = read("src/features/publish/PublishView.vue");
  assert.match(src, /useActiveView/);
  assert.match(src, /setActiveView\("verification"\)/);
  // mw-merchant-gating: the only remaining @go-verify is the inner merchant
  // gate inside PublishMerchantControls (defense-in-depth, default-collapsed).
  // The standalone affordance-gate banner that owned @click="goToVerification"
  // is gone — hiding the radio for non-merchants replaces it.
  assert.match(src, /@go-verify="goToVerification"/);
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
