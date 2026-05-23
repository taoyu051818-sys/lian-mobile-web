import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Polish PR-A (mw#823) — gate-collapse lock + step-F follow-up.
 *
 * Issue #823 audit identified two consistency risks in the publish-page
 * affordance lane:
 *
 *   1. PublishGateNotice needed a reusable `defaultOpen` path so both the
 *      top-level publish gate and the merchant inline gate could share one
 *      collapse vocabulary instead of each consumer reinventing v-if/details.
 *
 *      Note: the historic top-level affordance banner (the "merchant lock"
 *      panel above the form) was already retired by mw-merchant-gating.
 *      Step F (PRD V0.2) further removed the 4-radio publishKind fieldset
 *      entirely — there is no top-level gate to collapse anymore. This test
 *      pins both branches of the primitive so the collapse path stays
 *      reusable for the merchant in-form gate (and any future gate added
 *      to the publish surface).
 *
 *   2. The 4-radio publishKind switch had `is-disabled` CSS in PublishView
 *      but no shared wiring — the original PR-A introduced a `kindStates`
 *      computed map as the single source of truth. Step F removed the
 *      radios entirely; the kindStates plumbing is gone with them. This
 *      test pins the post-step-F state (no radios, no kindStates, no
 *      selectPublishKind helper) so the cleanup can't silently regress
 *      to a half-removed shape.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

test("PublishGateNotice exposes both expanded and collapsed render paths", () => {
  const src = read("src/features/publish/PublishGateNotice.vue");

  // Reusable defaultOpen prop with a `true` default so consumers that don't
  // opt-in keep the original always-expanded behavior.
  assert.match(src, /defaultOpen\?:\s*boolean/);
  assert.match(src, /\{\s*defaultOpen:\s*true\s*\}/);

  // Expanded branch: <section v-if="defaultOpen"> stays the structural shape
  // older callers depended on (title + slot + CTA, no collapse machinery).
  assert.match(
    src,
    /<section\s+v-if="defaultOpen"[\s\S]*?class="publish-gate-notice"/,
    "expanded branch must be a <section v-if='defaultOpen'>",
  );

  // Collapsed branch: v-else <details> with no `open` attribute, so the
  // body is closed on initial render until the user taps the summary.
  const detailsMatch = src.match(/<details\b[\s\S]*?>/);
  assert.ok(detailsMatch, "collapsed branch must render a <details>");
  assert.doesNotMatch(
    detailsMatch[0],
    /\sopen(\s|=|>)/,
    "<details> must not carry the `open` attribute (closed on initial render)",
  );
  assert.match(src, /<details[\s\S]*?v-else/);
  assert.match(src, /data-testid="publish-gate-notice-collapsible"/);
});

test("PublishView no longer carries the kindStates / selectPublishKind plumbing (step F)", () => {
  const src = read("src/features/publish/PublishView.vue");

  // The PR-A `kindStates` computed map fed the 4 radios' shared disabled
  // vocabulary. Step F removed the radios; the computed is gone with them.
  assert.doesNotMatch(src, /const\s+kindStates\s*=\s*computed/);
  assert.doesNotMatch(src, /selectPublishKind\(/);
  // The radio inputs themselves are gone too (covered in detail by
  // publishViewControlOrder.structure.test.mjs).
  assert.doesNotMatch(src, /name="publish-kind"/);
  assert.doesNotMatch(src, /data-testid="publish-type-switch"/);
});
