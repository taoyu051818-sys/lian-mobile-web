import { describe, expect, it } from "vitest";
import { ref } from "vue";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSuggestedComponentsActions } from "../../src/features/publish/usePublishDraft";
import type { PublishKind } from "../../src/features/publish/usePublishDraft";
import type { SuggestedComponent } from "../../src/types/publishSuggestion";

/**
 * PRD V0.2 step E-main — accept / dismiss API for the inline ghost
 * component list. Tests drive the pure factory `createSuggestedComponentsActions`
 * directly so we don't have to mount a component (the wrapping
 * `usePublishDraft` calls `provide()`, which requires a setup context).
 *
 * The factory is the same code path the composable runs through; mirror of
 * the publishBodyCandidate / publishTitleCandidate test pattern.
 */

interface Harness {
  components: ReturnType<typeof ref<SuggestedComponent[]>>;
  publishKind: ReturnType<typeof ref<PublishKind>>;
  tagInput: ReturnType<typeof ref<string>>;
  merchantVerified: ReturnType<typeof ref<boolean>>;
  campusVerified: ReturnType<typeof ref<boolean>>;
  actions: ReturnType<typeof createSuggestedComponentsActions>;
}

function makeHarness(
  initial: SuggestedComponent[],
  flags: { merchantVerified?: boolean; campusVerified?: boolean } = {},
): Harness {
  const components = ref<SuggestedComponent[]>([...initial]);
  const publishKind = ref<PublishKind>("regular");
  const tagInput = ref("");
  const merchantVerified = ref(flags.merchantVerified ?? false);
  const campusVerified = ref(flags.campusVerified ?? false);
  const actions = createSuggestedComponentsActions({
    components,
    publishKind,
    tagInput,
    merchantVerified,
    campusVerified,
  });
  return { components, publishKind, tagInput, merchantVerified, campusVerified, actions };
}

// PRD V0.3 stage B2: V2 component kinds (paired with ps#624). Legacy V1 names
// (event_time / price / merchant_info / trade_condition / help_tag) are still
// accepted at the wire boundary by `parseSuggestedComponents`, but every UI
// state — including this test harness — sees only canonical V2 kinds.
const LOCATION_HINT: SuggestedComponent = {
  kind: "location",
  payload: {},
  label: "在哪儿？加个地点",
};
const EVENT_HINT: SuggestedComponent = {
  kind: "event",
  payload: {},
  label: "活动吗？加个时间",
};
const PRICE_HINT: SuggestedComponent = {
  // V2: legacy `price` collapses into `trade` at the wire mapper. The
  // §4.2.3 ratchet (accept(price) → kind=trade) lives in the V2 `trade` arm.
  kind: "trade",
  payload: {},
  label: "加个价格",
};
const MERCHANT_HINT: SuggestedComponent = {
  kind: "merchant",
  payload: {},
  label: "看起来像商家信息",
};
const TRADE_HINT: SuggestedComponent = {
  kind: "trade",
  payload: {},
  label: "加个二手物品状态",
};
const HELP_HINT: SuggestedComponent = {
  kind: "help",
  payload: {},
  label: "需要别人帮忙吗？",
};
const GROUPBUY_HINT: SuggestedComponent = {
  kind: "groupbuy",
  payload: {},
  label: "发起拼单吗？补充成团人数和结算说明",
};

describe("createSuggestedComponentsActions accept (PRD V0.2 step E-main)", () => {
  it("accept(event_time) flips publishKind to event and removes the entry", () => {
    const h = makeHarness([EVENT_HINT, LOCATION_HINT]);

    h.actions.accept(EVENT_HINT);

    expect(h.publishKind.value).toBe("event");
    expect(h.components.value).toEqual([LOCATION_HINT]);
  });

  it("accept(merchant_info) flips publishKind to merchant for verified merchants", () => {
    const h = makeHarness([MERCHANT_HINT], { merchantVerified: true });

    h.actions.accept(MERCHANT_HINT);

    expect(h.publishKind.value).toBe("merchant");
    expect(h.components.value).toEqual([]);
  });

  it("accept(merchant_info) does not flip publishKind for unverified merchants but still removes the entry", () => {
    // Defense in depth — the server filter (PRD §2.3) shouldn't emit
    // merchant_info to non-merchants, but if it leaks the UI must not
    // dump the user into a panel they can't satisfy.
    const h = makeHarness([MERCHANT_HINT], { merchantVerified: false });

    h.actions.accept(MERCHANT_HINT);

    expect(h.publishKind.value).toBe("regular");
    expect(h.components.value).toEqual([]);
  });

  it("accept(trade) flips publishKind to trade for campus_verified users", () => {
    const h = makeHarness([TRADE_HINT], { campusVerified: true });

    h.actions.accept(TRADE_HINT);

    expect(h.publishKind.value).toBe("trade");
    expect(h.components.value).toEqual([]);
  });

  it("accept(trade) flips publishKind to trade unconditionally — V0.3 stage B2 unifies legacy price + trade_condition under one V2 kind, so capability gating happens upstream (visibility), not at inference", () => {
    // Legacy `price` was unconditional (§4.2.3), legacy `trade_condition` was
    // campus-gated. Both collapse to V2 `trade` after ps#624; a single inline
    // `trade` ghost no longer carries enough wire info to distinguish the
    // two. We mirror the §4.2.3 unconditional rule so accept() never silently
    // no-ops on a ghost the user can see.
    const h = makeHarness([TRADE_HINT], { campusVerified: false });

    h.actions.accept(TRADE_HINT);

    expect(h.publishKind.value).toBe("trade");
    expect(h.components.value).toEqual([]);
  });

  it("accept(trade) — alias of legacy price ghost — flips publishKind to trade unconditionally (PRD V0.2 §4.2.3)", () => {
    // §4.2.3 拍板：accept(price) → kind=trade，enum 不变. After ps#624, legacy
    // `price` wire is mapped to V2 `trade` at the parser; the inference
    // contract is unchanged for the user.
    const h = makeHarness([PRICE_HINT], {
      merchantVerified: true,
      campusVerified: true,
    });

    h.actions.accept(PRICE_HINT);

    expect(h.publishKind.value).toBe("trade");
    expect(h.components.value).toEqual([]);
  });

  it("accept(trade) — alias of legacy price — flips publishKind to trade even when only campus_verified", () => {
    const h = makeHarness([PRICE_HINT], {
      merchantVerified: false,
      campusVerified: true,
    });

    h.actions.accept(PRICE_HINT);

    expect(h.publishKind.value).toBe("trade");
    expect(h.components.value).toEqual([]);
  });

  it("accept(trade) — alias of legacy price — flips publishKind to trade with no verification flags (visibility gate is upstream)", () => {
    // Capability gating decides whether the ghost surfaces at all. If it
    // did surface (server filter slip, or campusVerified flipped mid-tick),
    // the inference contract still says trade per §4.2.3.
    const h = makeHarness([PRICE_HINT], {
      merchantVerified: false,
      campusVerified: false,
    });

    h.actions.accept(PRICE_HINT);

    expect(h.publishKind.value).toBe("trade");
    expect(h.components.value).toEqual([]);
  });

  it("accept(help) seeds tagInput with 求助 only when blank", () => {
    const h = makeHarness([HELP_HINT]);

    h.actions.accept(HELP_HINT);

    expect(h.tagInput.value).toBe("求助");
    expect(h.publishKind.value).toBe("regular");
    expect(h.components.value).toEqual([]);
  });

  it("accept(help) preserves an existing user-typed tag (no silent clobber)", () => {
    const h = makeHarness([HELP_HINT]);
    h.tagInput.value = "#夜跑";

    h.actions.accept(HELP_HINT);

    expect(h.tagInput.value).toBe("#夜跑");
    expect(h.components.value).toEqual([]);
  });

  it("accept(groupbuy) seeds the group-buy tag without changing the publish panel", () => {
    const h = makeHarness([GROUPBUY_HINT]);

    h.actions.accept(GROUPBUY_HINT);

    expect(h.tagInput.value).toBe("拼单");
    expect(h.publishKind.value).toBe("regular");
    expect(h.components.value).toEqual([]);
  });

  it("accept(groupbuy) preserves an existing user-typed tag", () => {
    const h = makeHarness([GROUPBUY_HINT]);
    h.tagInput.value = "#咖啡";

    h.actions.accept(GROUPBUY_HINT);

    expect(h.tagInput.value).toBe("#咖啡");
    expect(h.publishKind.value).toBe("regular");
    expect(h.components.value).toEqual([]);
  });

  it("accept(location) is a no-op on draft state but consumes the ghost (place kind reserved for step F)", () => {
    const h = makeHarness([LOCATION_HINT]);

    h.actions.accept(LOCATION_HINT);

    expect(h.publishKind.value).toBe("regular");
    expect(h.tagInput.value).toBe("");
    expect(h.components.value).toEqual([]);
  });

  it("accept(component) on an entry that's already gone is a no-op (double-tap protection)", () => {
    const h = makeHarness([EVENT_HINT]);

    h.actions.accept(EVENT_HINT);
    expect(h.publishKind.value).toBe("event");

    // User is now on event panel; if accept fires again (double tap during
    // a slow render) it must not regress publishKind or throw.
    h.publishKind.value = "regular";
    h.actions.accept(EVENT_HINT);

    expect(h.publishKind.value).toBe("regular");
    expect(h.components.value).toEqual([]);
  });
});

describe("createSuggestedComponentsActions dismiss (PRD V0.2 step E-main)", () => {
  it("dismiss(component) removes the entry without touching the draft", () => {
    const h = makeHarness([LOCATION_HINT, EVENT_HINT]);

    h.actions.dismiss(EVENT_HINT);

    expect(h.publishKind.value).toBe("regular");
    expect(h.tagInput.value).toBe("");
    expect(h.components.value).toEqual([LOCATION_HINT]);
  });

  it("dismiss matches by kind + label, leaving same-kind-different-label entries alone", () => {
    // The parser dedupes by kind in step E-pre, so two same-kind ghosts
    // never coexist — but we want the matcher to be unambiguous if that
    // contract ever loosens.
    const h = makeHarness([
      { kind: "location", payload: {}, label: "在哪儿？加个地点" },
      { kind: "location", payload: {}, label: "图书馆？加个地点" },
    ]);

    h.actions.dismiss({ kind: "location", payload: {}, label: "图书馆？加个地点" });

    expect(h.components.value).toEqual([
      { kind: "location", payload: {}, label: "在哪儿？加个地点" },
    ]);
  });

  it("dismiss(component) on a missing entry is a no-op", () => {
    const h = makeHarness([LOCATION_HINT]);

    h.actions.dismiss(EVENT_HINT);

    expect(h.components.value).toEqual([LOCATION_HINT]);
  });
});

describe("createSuggestedComponentsActions integration: end-to-end pipe (PRD V0.2 step E-main)", () => {
  it("renders → accept(event_time) → component disappears + publishKind moves to event", () => {
    // Simulates the user-visible round trip without mounting: list arrives
    // populated (from a tick), one ghost is materialized, list shrinks.
    const h = makeHarness([LOCATION_HINT, EVENT_HINT, PRICE_HINT]);

    expect(h.components.value).toHaveLength(3);

    h.actions.accept(EVENT_HINT);

    expect(h.publishKind.value).toBe("event");
    expect(h.components.value).toEqual([LOCATION_HINT, PRICE_HINT]);
  });

  it("a fresh tick replacing the ref's value is independent of accept/dismiss bookkeeping", () => {
    // usePublishLlmTick does `suggestedComponents.value = response.suggestedComponents`
    // — i.e. it overwrites the array wholesale on each tick. Make sure the
    // factory captured the ref by identity and reads the latest value, so a
    // post-tick accept hits the new list, not a stale snapshot.
    const h = makeHarness([LOCATION_HINT]);

    // External writer (the tick) replaces the array.
    h.components.value = [EVENT_HINT];

    h.actions.accept(EVENT_HINT);

    expect(h.publishKind.value).toBe("event");
    expect(h.components.value).toEqual([]);
  });
});

describe("PublishSuggestedComponents DOM structure (PRD V0.2 step E-main)", () => {
  // Lock the rendered DOM the same way publishBodyCandidate /
  // publishTitleCandidate do — snapshot the <template> source so any future
  // change to the visibility predicate / labels / aria wiring forces a
  // conscious update.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "..", "..");

  function readTemplate(rel: string): string {
    const src = fs.readFileSync(path.join(repoRoot, rel), "utf8");
    const match = src.match(/<template>[\s\S]*?<\/template>/);
    if (!match) throw new Error(`No <template> block found in ${rel}`);
    return match[0];
  }

  function readSource(rel: string): string {
    return fs.readFileSync(path.join(repoRoot, rel), "utf8");
  }

  it("PublishSuggestedComponents renders a list gated on items.length", () => {
    const tpl = readTemplate("src/features/publish/PublishSuggestedComponents.vue");
    expect(tpl).toMatchSnapshot();
  });

  it("PublishSuggestedComponents pulls its labels from brand constants only", () => {
    const src = readSource("src/features/publish/PublishSuggestedComponents.vue");
    expect(src).toMatch(/PUBLISH_SUGGESTED_COMPONENTS_LABEL/);
    expect(src).toMatch(/PUBLISH_SUGGESTED_ACCEPT/);
    expect(src).toMatch(/PUBLISH_SUGGESTED_DISMISS/);
    expect(src).toMatch(/PUBLISH_SUGGESTED_HINT_PREFIX/);

    // Anti-pattern guard: the action verbs must not appear as hardcoded
    // literals in template-expression position. Comments are fine; quoted
    // labels in JS / Vue interpolation are not.
    const tpl = readTemplate("src/features/publish/PublishSuggestedComponents.vue");
    expect(tpl).not.toMatch(/['"]加入['"]/);
    expect(tpl).not.toMatch(/['"]忽略['"]/);
    expect(tpl).not.toMatch(/['"]建议添加['"]/);
  });

  it("PublishSuggestedComponents wires aria-label and the reduced-motion modifier", () => {
    const tpl = readTemplate("src/features/publish/PublishSuggestedComponents.vue");
    expect(tpl).toMatch(/:aria-label="PUBLISH_SUGGESTED_COMPONENTS_LABEL"/);
    // Reduced-motion modifier: BEM `publish-suggested--reduced` keeps the
    // .is-* namespace (canonical state-class vocabulary) clean.
    expect(tpl).toMatch(/'publish-suggested--reduced': reduced/);
    // Each list item must expose its kind so per-kind UI / e2e selectors
    // and downstream telemetry have a stable hook.
    expect(tpl).toMatch(/:data-kind="component\.kind"/);
  });

  it("PublishSuggestedComponents consumes the actions API via inject only (no prop drilling)", () => {
    const src = readSource("src/features/publish/PublishSuggestedComponents.vue");
    expect(src).toMatch(/useInjectedSuggestedComponentsActions/);
    expect(src).not.toMatch(/defineProps/);
  });
});

describe("PublishComposer wires the suggested-components list under the body candidate bar (step E-main)", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "..", "..");

  it("PublishComposer mounts PublishSuggestedComponents after the body candidate bar", () => {
    const src = fs.readFileSync(
      path.join(repoRoot, "src/features/publish/PublishComposer.vue"),
      "utf8",
    );

    expect(src).toMatch(/import PublishSuggestedComponents/);
    expect(src).toMatch(/<PublishSuggestedComponents/);

    // Order: ghost component list must come after the body candidate bar
    // (the natural spot for "extra fields the model thinks you should add"
    // sits below "polish my body"), and before the summary row.
    const bodyBarIdx = src.search(/<PublishCandidateBar/);
    const ghostIdx = src.search(/<PublishSuggestedComponents/);
    const summaryIdx = src.search(/publish-composer__summary-row/);

    expect(bodyBarIdx).toBeGreaterThan(-1);
    expect(ghostIdx).toBeGreaterThan(-1);
    expect(summaryIdx).toBeGreaterThan(-1);
    expect(bodyBarIdx).toBeLessThan(ghostIdx);
    expect(ghostIdx).toBeLessThan(summaryIdx);
  });
});
