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
 *      对应按钮，普通用户都不出现相关按钮和提示" — non-merchants do not see
 *      the merchant publishKind radio at all (rendered with `v-if`, not
 *      `v-show` / display:none, so the DOM matches the role).
 *   2. "发布页的商家贴的提示现在都是默认弹出的，太影响用户体验了" — the
 *      merchant hint inside PublishMerchantControls is now default-collapsed
 *      (PublishGateNotice receives `:default-open="false"`, which renders a
 *      <details> with the body collapsed on initial mount).
 *
 * Trade is intentionally NOT capability-gated. Trade uses the
 * campus_verified gate (校园邮箱认证) which is the baseline most users hit;
 * only the merchant kind is the small-minority surface that warrants
 * progressive disclosure.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

test("non-merchant user: publishKind only renders the non-merchant radios (merchant is v-if-gated)", () => {
  const src = read("src/features/publish/PublishView.vue");

  // The merchant <label> is wrapped with v-if on the merchant verification
  // ref. When the ref is false (non-merchant), Vue elides the <label> from
  // the DOM entirely — no v-show / display:none.
  assert.match(
    src,
    /<label\s+v-if="draft\.merchant\.merchantVerified\.value"[\s\S]*?data-testid="publish-type-merchant"/,
    "merchant <label> must carry v-if on draft.merchant.merchantVerified.value",
  );
  assert.doesNotMatch(
    src,
    /v-show="[^"]*merchantVerified/,
    "merchant radio must not be rendered with v-show (non-merchants must not see the DOM node)",
  );

  // The non-merchant radios (regular / event / trade) are unconditional —
  // their <label> blocks have no v-if guard. Asserting source-side keeps
  // this fast (no Vue runtime needed in node:test).
  for (const testid of ["regular", "event", "trade"]) {
    const block = src.match(
      new RegExp(
        `<label[^>]*>\\s*<input[^>]*name="publish-kind"\\s+value="${testid}"[\\s\\S]*?<\\/label>`,
      ),
    );
    assert.ok(block, `${testid} radio block must exist`);
    const labelOpen = block[0].match(/<label[^>]*>/)[0];
    assert.doesNotMatch(
      labelOpen,
      /v-if=/,
      `${testid} radio <label> must not be capability-gated (only merchant is)`,
    );
  }

  // The standalone "you can't pick merchant" affordance-gate banner the old
  // flow rendered above the form is gone — hiding the radio replaces it.
  assert.doesNotMatch(src, /merchantAffordanceLocked/);
  assert.doesNotMatch(src, /data-testid="publish-merchant-affordance-gate"/);
});

test("merchant user: publishKind exposes all 4 radios (regular / event / merchant / trade)", () => {
  const src = read("src/features/publish/PublishView.vue");

  // The v-if guard reads draft.merchant.merchantVerified.value — when that
  // ref is true (merchant user) Vue renders the <label>, so all 4 radios
  // are present in the DOM. The other 3 are unconditional, asserted in the
  // sibling test.
  assert.match(src, /draft\.merchant\.merchantVerified\.value/);

  // All 4 radios + brand strings exist in source. The publishViewControlOrder
  // structure test already covers ordering; this test covers presence-as-
  // contract for the 4-option set under the gating commit.
  assert.match(src, /data-testid="publish-type-event"/);
  assert.match(src, /data-testid="publish-type-merchant"/);
  assert.match(src, /data-testid="publish-type-trade"/);
  assert.match(src, /value="regular"/);
  assert.match(src, /value="event"/);
  assert.match(src, /value="merchant"/);
  assert.match(src, /value="trade"/);
  assert.match(src, /PUBLISH_TYPE_REGULAR/);
  assert.match(src, /PUBLISH_TYPE_EVENT/);
  assert.match(src, /PUBLISH_TYPE_MERCHANT/);
  assert.match(src, /PUBLISH_TYPE_TRADE/);

  // selectPublishKind still accepts all 4 union members so the click handler
  // is type-safe for the merchant case once the v-if reveals the radio.
  assert.match(src, /selectPublishKind\('merchant'\)/);
  assert.match(src, /selectPublishKind\(kind: "regular" \| "event" \| "merchant" \| "trade"\)/);
});

test("merchant hint banner default-collapsed (closed <details> on initial render)", () => {
  // Consumer side: PublishMerchantControls passes `:default-open="false"`
  // into the shared PublishGateNotice primitive. Trade keeps the default
  // (`true`) — assert the trade consumer is unchanged so the diff doesn't
  // accidentally collapse the trade gate too.
  const merchantSrc = read("src/features/publish/PublishMerchantControls.vue");
  assert.match(
    merchantSrc,
    /<PublishGateNotice[\s\S]*?data-testid="publish-merchant-gate"[\s\S]*?:default-open="false"/,
    'merchant gate must pass :default-open="false" to the PublishGateNotice primitive',
  );

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
