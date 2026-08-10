import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * mw-merchant-gating — capability-gate the merchant kind + default-collapse the
 * merchant hint banner.
 *
 * Locks the structural contract behind two product directives:
 *
 *   1. "做更多无感化隐式提示，例如商家其实不是主要用户的功能，只有商家才出现
 *      对应按钮，普通用户都不出现相关按钮和提示" — merchant entry is gated on
 *      the verification flag at every layer:
 *        - PRD V0.2 step F removed the 4-radio entirely (no merchant radio
 *          for any user, verified or not).
 *        - The remaining merchant entry path is `accept(merchant_info)`
 *          from the inline ghost-component list, which already gates on
 *          `merchant_verified` inside `createSuggestedComponentsActions`
 *          (see usePublishDraft) — non-merchants never see the merchant
 *          panel even if a malformed server response leaks the ghost.
 *        - The PublishMerchantControls panel gate inside the form stays
 *          as defense-in-depth.
 *   2. "发布页的商家贴的提示现在都是默认弹出的，太影响用户体验了" — the
 *      merchant hint inside PublishMerchantControls is default-collapsed
 *      (PublishGateNotice receives `:default-open="false"`, which renders
 *      a <details> with the body collapsed on initial mount).
 *
 * Trade is intentionally NOT capability-gated. Trade uses the
 * campus_verified gate (校园邮箱认证) which is the baseline most users hit;
 * only the merchant kind is the small-minority surface that warrants
 * progressive disclosure.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8").replace(/\r\n/g, "\n");
}

test("PublishView no longer renders any publishKind radio (PRD V0.2 step F)", () => {
  const src = read("src/features/publish/PublishView.vue");
  // Step F removed the 4-radio fieldset entirely. The merchant-capability
  // gate now lives at the ghost-component accept layer (verified-only
  // mutation in createSuggestedComponentsActions) plus the in-panel gate
  // inside PublishMerchantControls.
  assert.doesNotMatch(src, /data-testid="publish-type-switch"/);
  assert.doesNotMatch(src, /data-testid="publish-type-merchant"/);
  assert.doesNotMatch(src, /data-testid="publish-type-event"/);
  assert.doesNotMatch(src, /data-testid="publish-type-trade"/);
  assert.doesNotMatch(src, /name="publish-kind"/);
  // The standalone affordance banner the old flow rendered above the form is
  // also gone — hiding the entry point replaces it.
  assert.doesNotMatch(src, /merchantAffordanceLocked/);
  assert.doesNotMatch(src, /data-testid="publish-merchant-affordance-gate"/);
});

test("createSuggestedComponentsActions enforces merchant_verified before flipping publishKind", () => {
  // The canonical V2 merchant ghost runs through accept(merchant). The
  // mutation on publishKind is wrapped in a verification check, so a
  // leaked ghost cannot dump a non-merchant into the merchant panel.
  const src = read("src/features/publish/usePublishDraft.ts");
  assert.match(
    src,
    /case\s+"merchant"\s*:\s*if\s*\(params\.merchantVerified\.value\)\s*params\.publishKind\.value\s*=\s*"merchant"/,
  );
});

test("PublishView falls back to regular when merchant verification flips off mid-session", () => {
  const src = read("src/features/publish/PublishView.vue");
  // Defense-in-depth: if the verification ref flips false while publishKind
  // was already "merchant" (set via accept(merchant_info)), reset to
  // "regular" so the form doesn't sit on a panel the user can't satisfy.
  assert.match(
    src,
    /watch\(draft\.merchant\.merchantVerified[\s\S]*?draft\.publishKind\.value\s*=\s*"regular"/,
  );
});

test("merchant hint banner default-collapsed (closed <details> on initial render)", () => {
  // Consumer side: PublishMerchantControls passes `:default-open="false"`
  // into the shared PublishGateNotice primitive. Trade keeps the default
  // (`true`) — assert the trade consumer is unchanged so the diff doesn't
  // accidentally collapse the trade gate too.
  const merchantSrc = read("src/features/publish/PublishMerchantControls.vue");
  const merchantNotice = merchantSrc.match(/<PublishGateNotice\b[\s\S]*?>/);
  assert.ok(merchantNotice, "merchant gate notice should be mounted");
  assert.match(merchantNotice[0], /data-testid="publish-merchant-gate"/);
  assert.match(merchantNotice[0], /:default-open="false"/);

  const tradeSrc = read("src/features/publish/PublishTradeControls.vue");
  assert.doesNotMatch(
    tradeSrc,
    /:default-open="false"/,
    "trade gate must not be default-collapsed (campus_verified is the baseline gate)",
  );

  // Primitive side: PublishGateNotice exposes a `defaultOpen` prop with a
  // `true` default, and renders a <details> (no `open` attribute) when the
  // consumer passes `false`. The absence of `open=` on the <details> is
  // what makes the banner closed on initial render — tap to expand.
  const noticeSrc = read("src/features/publish/PublishGateNotice.vue");
  assert.match(noticeSrc, /defaultOpen\?:\s*boolean/);
  assert.match(noticeSrc, /\{\s*defaultOpen:\s*true\s*\}/);

  // The collapsed branch is a <details> with no `open` attribute. We assert
  // both: the v-else <details> exists, and it has no `open` attribute.
  const detailsMatch = noticeSrc.match(/<details\b[\s\S]*?>/);
  assert.ok(detailsMatch, "PublishGateNotice must render a <details> for the collapsed branch");
  assert.doesNotMatch(
    detailsMatch[0],
    /\sopen(\s|=|>)/,
    "<details> must not carry the `open` attribute — that's what 'closed on initial render' means",
  );
  // The <details> branch fires only when defaultOpen is false (v-else of the
  // v-if="defaultOpen" expanded branch).
  assert.match(noticeSrc, /v-if="defaultOpen"/);
  assert.match(noticeSrc, /<details[\s\S]*?v-else/);
});
