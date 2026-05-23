import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * PRD V0.2 step F (§2.2 / §6 step F) — kind-by-radio is dead, kind-by-panel
 * is the new shape.
 *
 * Pre-step-F: a 4-radio "publishKind" fieldset (regular / event / merchant /
 * trade) sat at the top of the publish form. PR-3 (#813) had cleaned that up
 * into a `kindStates` source of truth that all 4 radios shared, but the user-
 * facing decision was still "pick a kind first, then fill the form".
 *
 * Step F removes the radios entirely. `publishKind` is still a ref; it is now
 * mutated by:
 *
 *   1. `accept(suggestedComponent)` from the inline ghost-component list
 *      (event_time / merchant_info / trade_condition / price). See
 *      createSuggestedComponentsActions in usePublishDraft.
 *   2. Verification drop-out (defense-in-depth watch resets to "regular").
 *
 * Wire-`kind` for the post is no longer driven by a user radio choice — it
 * is inferred at submit time by `inferKind` (src/features/publish/inferKind.ts).
 * This test pins the post-step-F structure so it can't silently regress.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

test("PublishView no longer renders the 4-radio publishKind fieldset (step F)", () => {
  const src = read("src/features/publish/PublishView.vue");

  // The radio fieldset, the per-radio testids, the selectPublishKind helper
  // and the kindStates computed are all gone in step F.
  assert.doesNotMatch(src, /data-testid="publish-type-switch"/);
  assert.doesNotMatch(src, /data-testid="publish-type-event"/);
  assert.doesNotMatch(src, /data-testid="publish-type-merchant"/);
  assert.doesNotMatch(src, /data-testid="publish-type-trade"/);
  assert.doesNotMatch(src, /selectPublishKind\(/);
  assert.doesNotMatch(src, /const\s+kindStates\s*=\s*computed/);
  assert.doesNotMatch(src, /name="publish-kind"/);

  // The brand-string imports the radios used go with them. The constants
  // themselves stay defined (PRD §5.2 — "保留至 i18n 迁移完成后再批量清"),
  // but PublishView no longer references them.
  assert.doesNotMatch(src, /PUBLISH_TYPE_LABEL/);
  assert.doesNotMatch(src, /PUBLISH_TYPE_REGULAR/);
  assert.doesNotMatch(src, /PUBLISH_TYPE_EVENT/);
  assert.doesNotMatch(src, /PUBLISH_TYPE_MERCHANT/);
  assert.doesNotMatch(src, /PUBLISH_TYPE_TRADE/);
});

test("usePublishDraft still exposes the 4-member PublishKind union (panel v-if keys)", () => {
  // The 4-member union stays — it keys the panel v-if guards in PublishView
  // (event/merchant/trade) plus the createEvent branch in usePublishSubmit
  // (postType === "event"). What changed in step F is *who* mutates the ref:
  // ghost-component accept actions, not a radio @change.
  const src = read("src/features/publish/usePublishDraft.ts");
  assert.match(src, /PublishKind\s*=\s*"regular"\s*\|\s*"event"\s*\|\s*"merchant"\s*\|\s*"trade"/);
});

test("PublishView keeps eventDraft.postType in lock-step with publishKind", () => {
  const src = read("src/features/publish/PublishView.vue");
  // Both arms must be present (event -> "event", anything else -> "post"),
  // and the watch must run with immediate: true so a refreshed page that
  // already has publishKind === "event" enters the createEvent branch.
  assert.match(
    src,
    /eventDraft\.postType\.value\s*=\s*kind\s*===\s*"event"\s*\?\s*"event"\s*:\s*"post"/,
  );
  assert.match(src, /immediate:\s*true/);
});

test("PublishView mounts type-specific panels gated on publishKind, in switch-order", () => {
  const src = read("src/features/publish/PublishView.vue");

  const eventIdx = src.search(/<PublishEventControls/);
  const merchantIdx = src.search(/<PublishMerchantControls/);
  const tradeIdx = src.search(/<PublishTradeControls/);
  const composerIdx = src.search(/<PublishComposer/);

  assert.ok(eventIdx > -1, "PublishEventControls must be mounted");
  assert.ok(merchantIdx > -1, "PublishMerchantControls must be mounted");
  assert.ok(tradeIdx > -1, "PublishTradeControls must be mounted");
  assert.ok(composerIdx > -1, "PublishComposer must be mounted");

  assert.ok(
    eventIdx < merchantIdx,
    "event panel must come before merchant panel (matches PublishKind union order)",
  );
  assert.ok(
    merchantIdx < tradeIdx,
    "merchant panel must come before trade panel (matches PublishKind union order)",
  );
  assert.ok(
    tradeIdx < composerIdx,
    "type-specific panels must come before the composer (primary input)",
  );
});

test("PublishView gates each type-specific panel on publishKind", () => {
  const src = read("src/features/publish/PublishView.vue");
  assert.match(
    src,
    /<PublishEventControls[\s\S]*?v-if="draft\.publishKind\.value\s*===\s*'event'"/,
  );
  assert.match(
    src,
    /<PublishMerchantControls[\s\S]*?v-if="draft\.publishKind\.value\s*===\s*'merchant'"/,
  );
  assert.match(
    src,
    /<PublishTradeControls[\s\S]*?v-if="draft\.publishKind\.value\s*===\s*'trade'"/,
  );
});

test("PublishEventControls owns event fields only (no inner post-type chooser)", () => {
  const src = read("src/features/publish/PublishEventControls.vue");
  // The inner chooser is gone — the parent publishKind switch owns that decision.
  assert.doesNotMatch(src, /PUBLISH_POST_TYPE_LABEL/);
  assert.doesNotMatch(src, /PUBLISH_POST_TYPE_POST/);
  assert.doesNotMatch(src, /PUBLISH_POST_TYPE_EVENT/);
  assert.doesNotMatch(src, /update:postType/);
  assert.doesNotMatch(src, /POST_TYPE_OPTIONS/);

  // The event-fields panel and its testids stay.
  assert.match(src, /data-testid="publish-event-panel"/);
  assert.match(src, /data-testid="publish-event-start-at"/);
  assert.match(src, /data-testid="publish-event-end-at"/);
  assert.match(src, /data-testid="publish-event-capacity"/);
  assert.match(src, /data-testid="publish-event-join-policy"/);
});

test("usePublishSubmit threads inferred kind onto the wire payload (step F §2.2)", () => {
  const src = read("src/features/publish/usePublishSubmit.ts");
  // The submit path imports the inference function and passes its result
  // into buildPublishPayload as the wire `kind` field.
  assert.match(src, /import\s+\{\s*inferKind\s*\}/);
  assert.match(src, /inferKind\(\{[\s\S]*?publishKind:[\s\S]*?\}\)/);
  assert.match(src, /kind,/);
});
