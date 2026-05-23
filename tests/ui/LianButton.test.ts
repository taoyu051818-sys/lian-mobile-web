/**
 * Apple Music gap analysis — PR-δ (LianButton 6-state vocabulary).
 *
 * The repo intentionally does not ship `@vue/test-utils` (see
 * `tests/publish/publishHintPrimitives.test.ts` for the rationale: every
 * other component test is a source-text contract). This file follows the
 * same convention — we lock the prop shape, the class wiring, the click
 * guard, and the aria-pressed binding by reading `LianButton.vue` as text
 * and asserting against the source. The actual browser semantics ride on
 * Vue's `:class={ ... }` and `:disabled` evaluation rules, which are
 * stable contract.
 *
 * The 6-state vocabulary:
 *
 *   default   no `.is-*` class, no aria-pressed, click enabled.
 *   loading   `.is-loading` + native :disabled + spinner. Click suppressed.
 *   disabled  `.is-disabled` + native :disabled. Click suppressed.
 *   pressed   `.is-pressed` + aria-pressed="true". Click still enabled.
 *   success   `.is-success`. Click still enabled. Emphasized ease entry.
 *   error     `.is-error`. Click still enabled. Emphasized ease entry.
 *
 * Compatibility: when `state` is omitted (or "default"), the legacy
 * `loading` / `disabled` props drive behaviour exactly as before. Every
 * existing call site (39 across `src/features/*`) remains zero-edit.
 *
 * Precedence: when both `state` and the legacy props are supplied, `state`
 * wins. The compatibility test below pins this so the rule never silently
 * flips.
 *
 * The variant vocabulary is also locked here (sibling to mw#834's state
 * vocab): `primary | tonal | ghost | danger`. Adding "secondary" or any
 * other name requires a separate PR that updates this list.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const source = readFileSync(path.join(repoRoot, "src/ui/LianButton.vue"), "utf8").replace(
  /\r\n/g,
  "\n",
);

describe("LianButton variant vocabulary lock (apple-gap PR-δ)", () => {
  it("declares exactly the 4 allowed variants — primary | tonal | ghost | danger", () => {
    // Pin the `variant` union literal to the four allowed names, in this
    // exact order. Adding "secondary" or any other name requires a doc + PR.
    expect(source).toMatch(/variant\?:\s*"primary"\s*\|\s*"tonal"\s*\|\s*"ghost"\s*\|\s*"danger";/);
  });

  it("does not declare a 'secondary' variant", () => {
    // Cheap smoke guard: nobody slipped a "secondary" past the union lock.
    expect(source).not.toMatch(/"secondary"/);
  });
});

describe("LianButton state vocabulary lock (apple-gap PR-δ)", () => {
  it("declares the 6-state union — default | loading | disabled | pressed | success | error", () => {
    // The vocabulary is the contract. The structure test
    // (`tests/structure/state-class-vocabulary.test.ts`) grants the matching
    // `.is-*` classes their seat at the table; this assertion locks the
    // typed prop union.
    expect(source).toMatch(
      /state\?:\s*"default"\s*\|\s*"loading"\s*\|\s*"disabled"\s*\|\s*"pressed"\s*\|\s*"success"\s*\|\s*"error";/,
    );
  });

  it("defaults state to 'default' so callers without state see legacy behaviour", () => {
    expect(source).toMatch(/state:\s*"default",/);
  });
});

describe("LianButton 6-state class wiring", () => {
  it("emits .is-loading when state === 'loading' (or legacy loading=true)", () => {
    // The state="loading" branch reuses the same `.is-loading` class as the
    // legacy `loading` prop did, which is why the legacy fallthrough remains
    // byte-identical for existing call sites.
    expect(source).toMatch(/'is-loading':\s*showLoadingClass/);
    expect(source).toMatch(
      /const showLoadingClass = computed\(\(\)\s*=>\s*\n\s*stateExplicit\.value \? props\.state === "loading" : props\.loading,\s*\n\s*\);/,
    );
  });

  it("emits .is-disabled only when state === 'disabled' (never via legacy disabled prop)", () => {
    // CRITICAL compat rule: the legacy `disabled` prop must not paint
    // `.is-disabled` onto the button — only an explicit state="disabled"
    // does. Otherwise 39 existing call sites would gain an unexpected
    // class and bleed CSS through any selector that targets .is-disabled.
    expect(source).toMatch(/'is-disabled':\s*showDisabledClass/);
    expect(source).toMatch(
      /const showDisabledClass = computed\(\(\)\s*=>\s*stateExplicit\.value && props\.state === "disabled"\);/,
    );
  });

  it("emits .is-pressed only when state === 'pressed'", () => {
    expect(source).toMatch(/'is-pressed':\s*showPressedClass/);
    expect(source).toMatch(
      /const showPressedClass = computed\(\(\)\s*=>\s*stateExplicit\.value && props\.state === "pressed"\);/,
    );
  });

  it("emits .is-success only when state === 'success'", () => {
    expect(source).toMatch(/'is-success':\s*showSuccessClass/);
    expect(source).toMatch(
      /const showSuccessClass = computed\(\(\)\s*=>\s*stateExplicit\.value && props\.state === "success"\);/,
    );
  });

  it("emits .is-error only when state === 'error'", () => {
    expect(source).toMatch(/'is-error':\s*showErrorClass/);
    expect(source).toMatch(
      /const showErrorClass = computed\(\(\)\s*=>\s*stateExplicit\.value && props\.state === "error"\);/,
    );
  });

  it("default state emits no .is-* class — bare lian-button + variant + size only", () => {
    // No standalone `'is-default': ...` binding in the template — verifies
    // the rest state stays clean (no `.is-default` ghost class polluting CSS).
    expect(source).not.toMatch(/'is-default'/);
  });
});

describe("LianButton click suppression (loading + disabled)", () => {
  it("loading state goes through the disabled gate (state OR legacy loading)", () => {
    // The click handler short-circuits when isDisabled() is true. The
    // helper consults isDisabledState which returns true for loading
    // OR disabled effective state — covering both the new state="loading"
    // path and the legacy loading=true path.
    expect(source).toMatch(/const isDisabledState = computed\(\(\) => \{/);
    expect(source).toMatch(/const s = effectiveState\.value;/);
    expect(source).toMatch(/return s === "loading" \|\| s === "disabled";/);
  });

  it("function isDisabled() routes through isDisabledState (preserves legacy contract)", () => {
    expect(source).toMatch(
      /function isDisabled\(\)\s*\{\s*\n\s*return isDisabledState\.value;\s*\n\s*\}/,
    );
  });

  it("handleClick suppresses emit when isDisabled() is true", () => {
    expect(source).toMatch(
      /function handleClick\(event: MouseEvent\)\s*\{\s*\n\s*if \(isDisabled\(\)\) return;\s*\n\s*emit\("click", event\);\s*\n\s*\}/,
    );
  });

  it("native :disabled binds to isDisabledState (so HTML reflects the gate too)", () => {
    expect(source).toMatch(/:disabled="isDisabledState"/);
  });

  it("pressed/success/error states do NOT suppress click (toggles + acks remain interactive)", () => {
    // The disabled gate enumerates "loading" and "disabled" only.
    // pressed / success / error are not in that set, so click continues
    // to fire — which is what callers expect for a toggle (press again
    // to un-press) or an ack (re-submit after success).
    const gate = /return s === "loading" \|\| s === "disabled";/;
    const match = source.match(gate);
    expect(match, "click gate should enumerate exactly loading + disabled").not.toBeNull();
  });
});

describe("LianButton aria-pressed binding (state === 'pressed' only)", () => {
  it("binds aria-pressed only when showPressedClass is true; undefined otherwise", () => {
    // The `aria-pressed` attribute should NOT default to "false" — that
    // would pollute non-toggle CTAs with an ARIA toggle role implication.
    // Vue drops attributes whose value is undefined, so binding to
    // `showPressedClass ? 'true' : undefined` means: pressed → "true",
    // anything else → no attribute on the rendered button.
    expect(source).toMatch(/:aria-pressed="showPressedClass \? 'true' : undefined"/);
  });

  it("does not emit a default aria-pressed='false' for non-pressed states", () => {
    // Cheap regression smoke: aria-pressed must not appear with a hard-
    // coded "false" value anywhere in the template.
    expect(source).not.toMatch(/aria-pressed="false"/);
  });
});

describe("LianButton spinner gating", () => {
  it("renders the spinner only when showLoadingClass is true", () => {
    // Spinner visibility tracks the .is-loading class so state="loading"
    // and the legacy loading=true both produce a spinner; nothing else
    // does (success/error/pressed get colour transitions, no spinner).
    expect(source).toMatch(/v-if="showLoadingClass"\s+class="lian-button__spinner"/);
  });
});

describe("LianButton state precedence — `state` wins when both are supplied", () => {
  it("stateExplicit gates both class wiring and click handling", () => {
    // The precedence rule: when `state` is anything other than "default",
    // it is the single source of truth. The class bindings AND the click
    // gate both go through `effectiveState` / `stateExplicit`, so a caller
    // that passes `state="success"` together with `loading={true}` will
    // see `.is-success` (state wins) and the click WILL fire (because
    // success is not in the loading/disabled gate). This pins the rule.
    expect(source).toMatch(
      /const stateExplicit = computed\(\(\)\s*=>\s*props\.state !== "default"\);/,
    );
    expect(source).toMatch(/const effectiveState = computed</);
    // Inside effectiveState: when state is explicit, return it directly.
    expect(source).toMatch(/if \(stateExplicit\.value\) return props\.state;/);
    // Only when state is NOT explicit do legacy loading/disabled feed in.
    expect(source).toMatch(/if \(props\.loading\) return "loading";/);
    expect(source).toMatch(/if \(props\.disabled\) return "disabled";/);
  });

  it("legacy loading prop alone (no state) still drives the spinner + .is-loading", () => {
    // Compat assertion: 39 existing call sites pass `loading={someRef}`
    // without ever touching `state`. The showLoadingClass branch falls
    // through to `props.loading`, so behaviour is preserved verbatim.
    expect(source).toMatch(
      /const showLoadingClass = computed\(\(\)\s*=>\s*\n\s*stateExplicit\.value \? props\.state === "loading" : props\.loading,\s*\n\s*\);/,
    );
  });

  it("legacy disabled prop alone (no state) still gates click + native :disabled", () => {
    // Compat assertion: legacy `disabled={!canSubmit}` callers continue
    // to short-circuit the click and toggle the native :disabled
    // attribute, but no `.is-disabled` class is emitted (see the class
    // wiring suite — `.is-disabled` only appears under explicit
    // state="disabled"). Behaviour is byte-equivalent to pre-PR-δ.
    expect(source).toMatch(/if \(props\.disabled\) return "disabled";/);
  });
});

describe("LianButton motion polish (apple-gap PR-δ uses mw#835 emphasized ease)", () => {
  it("success / error transition uses --motion-ease-emphasized for entry", () => {
    // The mw#835 motion vocab introduced --motion-ease-emphasized for
    // important state transitions; ack states are exactly that. The
    // standard hover/active transition is left alone — only the
    // settled-state colour swap takes the emphasized curve.
    expect(source).toMatch(
      /\.lian-button\.is-success,\s*\n\s*\.lian-button\.is-error\s*\{[\s\S]*?--motion-ease-emphasized/,
    );
  });
});
