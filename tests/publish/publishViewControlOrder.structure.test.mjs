import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * PR-3 (#813 follow-up) — publish-control structural lock.
 *
 * The publish view used to mix two "what kind of post am I making" decision
 * cards in the type-decision area: the `publishKind` fieldset (3 options)
 * plus PublishEventControls's inner "内容类型" panel (post / event), which
 * looked like a second decision and put the event-fields panel oddly far
 * from where users picked merchant/trade. This test pins the cleaned-up
 * shape so it can't silently regress:
 *
 *   1. Single 4-option publishKind switch: regular / event / merchant / trade
 *   2. Type-specific blocks (event panel, merchant form, trade form) render
 *      directly inside the form, in switch-order, gated on publishKind
 *   3. PublishEventControls owns the event fields only (the inner post-type
 *      chooser is gone) and is mounted by the parent on publishKind === "event"
 *   4. eventDraft.postType stays in lock-step with publishKind via a parent
 *      watch, so usePublishSubmit's createEvent branch keeps firing
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

test("PublishView publishKind switch exposes regular / event / merchant / trade", () => {
  const src = read("src/features/publish/PublishView.vue");
  assert.match(src, /data-testid="publish-type-switch"/);
  assert.match(src, /data-testid="publish-type-event"/);
  assert.match(src, /data-testid="publish-type-merchant"/);
  assert.match(src, /data-testid="publish-type-trade"/);
  assert.match(src, /selectPublishKind\('regular'\)/);
  assert.match(src, /selectPublishKind\('event'\)/);
  assert.match(src, /selectPublishKind\('merchant'\)/);
  assert.match(src, /selectPublishKind\('trade'\)/);
  assert.match(src, /PUBLISH_TYPE_REGULAR/);
  assert.match(src, /PUBLISH_TYPE_EVENT/);
  assert.match(src, /PUBLISH_TYPE_MERCHANT/);
  assert.match(src, /PUBLISH_TYPE_TRADE/);
});

test("PublishView selectPublishKind accepts the 4-option PublishKind union", () => {
  const src = read("src/features/publish/PublishView.vue");
  // The local helper signature should mirror the PublishKind union so
  // TypeScript catches drift at the call sites.
  assert.match(src, /selectPublishKind\(kind: "regular" \| "event" \| "merchant" \| "trade"\)/);
});

test("usePublishDraft promotes 'event' to a peer of regular / merchant / trade", () => {
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

test("PublishView mounts type-specific blocks in switch-order under the publishKind fieldset", () => {
  const src = read("src/features/publish/PublishView.vue");

  const eventIdx = src.search(/<PublishEventControls/);
  const merchantIdx = src.search(/<PublishMerchantControls/);
  const tradeIdx = src.search(/<PublishTradeControls/);
  const composerIdx = src.search(/<PublishComposer/);
  const switchIdx = src.search(/data-testid="publish-type-switch"/);

  assert.ok(eventIdx > -1, "PublishEventControls must be mounted");
  assert.ok(merchantIdx > -1, "PublishMerchantControls must be mounted");
  assert.ok(tradeIdx > -1, "PublishTradeControls must be mounted");
  assert.ok(composerIdx > -1, "PublishComposer must be mounted");
  assert.ok(switchIdx > -1, "publishKind switch must be mounted");

  assert.ok(switchIdx < eventIdx, "publishKind switch must come before event panel");
  assert.ok(
    eventIdx < merchantIdx,
    "event panel must come before merchant form (matches switch order)",
  );
  assert.ok(
    merchantIdx < tradeIdx,
    "merchant form must come before trade form (matches switch order)",
  );
  assert.ok(
    tradeIdx < composerIdx,
    "type-specific blocks must come before the composer (primary input)",
  );
});

test("PublishView gates each type-specific block on publishKind", () => {
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
