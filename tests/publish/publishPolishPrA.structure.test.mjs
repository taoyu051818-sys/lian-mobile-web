import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Polish PR-A (mw#823) — gate-collapse + 4-radio disabled-state lock.
 *
 * Issue #823 audit identified two consistency risks in the publish-page
 * affordance lane:
 *
 *   1. PublishGateNotice needed a reusable `defaultOpen` path so both the
 *      top-level publish gate and the merchant inline gate could share one
 *      collapse vocabulary instead of each consumer reinventing v-if/details.
 *
 *      Note: the historic top-level affordance banner (the "merchant lock"
 *      panel above the form) was already retired by mw-merchant-gating —
 *      capability `v-if` on the merchant radio replaces it. The PR-A goal
 *      of "consistently collapsed at the top" is satisfied by the radio
 *      simply not rendering for non-merchants. This test pins both branches
 *      of the primitive so the collapse path stays reusable for any future
 *      gate added to PublishView.
 *
 *   2. The 4-radio publishKind switch had `is-disabled` CSS in PublishView
 *      but no shared wiring — merchant got HTML `:disabled` via prior PRs,
 *      trade/event/regular had nothing equivalent. Future per-kind disabled
 *      rules (e.g. trade gaining a campus_verified gate up here) would
 *      drift unless one source of truth feeds all 4 radios.
 *
 *      The fix introduces a `kindStates` computed map. Both the active /
 *      disabled CSS classes and the native `disabled` / `aria-disabled` /
 *      `title` attributes on every radio read from this map, so adding a
 *      new disabled rule is a one-liner that automatically applies to the
 *      right radio with no template duplication.
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

test("PublishView exposes a single kindStates source of truth for the 4 publishKind radios", () => {
  const src = read("src/features/publish/PublishView.vue");

  // The shared computed map exists and produces an entry per kind.
  assert.match(
    src,
    /const\s+kindStates\s*=\s*computed\(/,
    "kindStates must be a `computed` (auto-tracks publishKind + future per-kind reactive guards)",
  );
  for (const kind of ["regular", "event", "merchant", "trade"]) {
    assert.match(
      src,
      new RegExp(`${kind}:\\s*state\\("${kind}"`),
      `kindStates must produce an entry for ${kind}`,
    );
  }

  // Each entry exposes the 3 fields the template binds to. We assert on the
  // factory so a future per-kind override (e.g. event-only) still flows
  // through the same shape and can't silently drop a field.
  assert.match(src, /active:\s*active\s*===\s*kind/);
  assert.match(src, /disabled:\s*disabledReason\.length\s*>\s*0/);
  assert.match(src, /disabledReason/);
});

test("all 4 publishKind radios bind their disabled vocabulary through kindStates", () => {
  const src = read("src/features/publish/PublishView.vue");

  // For each kind: the <input> reads `disabled` and `aria-disabled` from
  // the shared map, the wrapping <label> reads `is-active` / `is-disabled`
  // from the same map, and the disabled-reason flows into a `title`. That
  // keeps a future "trade is disabled because campus_verified=false" rule
  // a one-liner instead of a 4-block edit.
  for (const kind of ["regular", "event", "merchant", "trade"]) {
    assert.match(
      src,
      new RegExp(
        `value="${kind}"[\\s\\S]*?:checked="kindStates\\.${kind}\\.active"[\\s\\S]*?:disabled="kindStates\\.${kind}\\.disabled"[\\s\\S]*?:aria-disabled="kindStates\\.${kind}\\.disabled"`,
      ),
      `${kind} radio <input> must bind :checked / :disabled / :aria-disabled through kindStates`,
    );
    assert.match(
      src,
      new RegExp(
        `'is-active':\\s*kindStates\\.${kind}\\.active,\\s*'is-disabled':\\s*kindStates\\.${kind}\\.disabled`,
      ),
      `${kind} radio <label> must read both is-active and is-disabled from kindStates`,
    );
    assert.match(
      src,
      new RegExp(`:title="kindStates\\.${kind}\\.disabledReason \\|\\| undefined"`),
      `${kind} radio must surface the disabled reason as a title hint`,
    );
  }
});

test("selectPublishKind respects the shared disabled state instead of trusting the click", () => {
  const src = read("src/features/publish/PublishView.vue");

  // The early-return guards a label-driven activation path (where the
  // browser may still fire @change on a disabled <input>). Pinning it here
  // catches a refactor that drops the guard and lets a disabled radio
  // mutate publishKind through the side door.
  assert.match(
    src,
    /function\s+selectPublishKind\([\s\S]*?\)\s*\{[\s\S]*?if\s*\(kindStates\.value\[kind\]\.disabled\)\s*return;/,
    "selectPublishKind must early-return when the kind is disabled in kindStates",
  );
});
