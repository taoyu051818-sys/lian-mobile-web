import { describe, expect, it } from "vitest";
import { inferKind, type InferKindInput } from "../../src/features/publish/inferKind";

/**
 * PRD V0.2 step F (§2.2) — `kind` is no longer a user-picked radio. At submit
 * time we derive the wire-`kind` tag from a snapshot of the publish draft.
 *
 * Priority chain (top wins):
 *
 *   1. tag === "#求助"           → `help`   (explicit user-typed semantic)
 *   2. hasImage                  → `image`  (PRD §2.2 媒体优先：有图就一定是
 *                                            kind=image，即使 ghost 已化实)
 *   3. publishKind === "event"   → `event`
 *      publishKind === "merchant" → `merchant`
 *      publishKind === "trade"  → `trade`   (also the result of
 *                                            accept(price) per §4.2.3)
 *   4. hasLocation && !hasBody   → `place`  (location-only card)
 *   5. fallback                  → `text`
 *
 * Branches map 1:1 to the 7 PRD enum values plus the explicit fallback.
 */

function baseInput(): InferKindInput {
  return {
    publishKind: "regular",
    hasLocation: false,
    hasImage: false,
    hasBody: false,
    tag: "",
  };
}

describe("inferKind (PRD V0.2 §2.2)", () => {
  // -- Priority rule #1: 求助 tag is the top of the chain -------------------

  it("publishKind=event → 'event' (no image, no help tag)", () => {
    expect(inferKind({ ...baseInput(), publishKind: "event", hasLocation: true })).toBe("event");
  });

  it("publishKind=merchant → 'merchant' (no image, no help tag)", () => {
    expect(inferKind({ ...baseInput(), publishKind: "merchant", hasBody: true })).toBe("merchant");
  });

  it("publishKind=trade → 'trade' (no image, no help tag)", () => {
    expect(inferKind({ ...baseInput(), publishKind: "trade", hasBody: true })).toBe("trade");
  });

  it("normalized 求助 tag → 'help' (regardless of body/image)", () => {
    expect(inferKind({ ...baseInput(), tag: "#求助", hasImage: true, hasBody: true })).toBe("help");
  });

  it("raw 求助 tag without leading # also resolves to 'help' (defensive)", () => {
    expect(inferKind({ ...baseInput(), tag: "求助" })).toBe("help");
  });

  // -- Priority rule #2: 媒体优先 — hasImage beats publishKind ghosts --------
  // PRD V0.2 §2.2 拍板：「有图就一定是 kind=image。媒体优先级最高，即便用户
  // 化实了 ghost component（地点/时间/价格），有图都覆盖。」

  it("tag=求助 + hasImage → 'help' (tag still beats image, §2.2 媒体优先 is 图 vs ghost)", () => {
    expect(inferKind({ ...baseInput(), tag: "求助", hasImage: true })).toBe("help");
  });

  it("hasImage + publishKind='trade' (from accept(price)) → 'image' (§2.2 媒体优先)", () => {
    // accept(price) flips publishKind to 'trade' per §4.2.3; if the user
    // also has an image attached, §2.2 says image wins.
    expect(inferKind({ ...baseInput(), publishKind: "trade", hasImage: true })).toBe("image");
  });

  it("hasImage + publishKind='event' → 'image' (§2.2 媒体优先 over ghost-driven event)", () => {
    expect(inferKind({ ...baseInput(), publishKind: "event", hasImage: true })).toBe("image");
  });

  it("hasImage + publishKind='merchant' → 'image' (§2.2 媒体优先 over ghost-driven merchant)", () => {
    expect(inferKind({ ...baseInput(), publishKind: "merchant", hasImage: true })).toBe("image");
  });

  // -- Priority rule #4: place is location-only (already past image/panel) --

  it("only location bound → 'place'", () => {
    expect(inferKind({ ...baseInput(), hasLocation: true })).toBe("place");
  });

  it("only image → 'image'", () => {
    expect(inferKind({ ...baseInput(), hasImage: true })).toBe("image");
  });

  it("only body → 'text'", () => {
    expect(inferKind({ ...baseInput(), hasBody: true })).toBe("text");
  });

  it("fallback (image + body, no other signals) → 'image' (有图 优先)", () => {
    expect(inferKind({ ...baseInput(), hasImage: true, hasBody: true })).toBe("image");
  });

  it("fallback (location + body, no image, no panel) → 'text' (place is location-only)", () => {
    // 'place' is reserved for "location-only" — once body or image is present
    // the post is content with a place attached, not a place-card.
    expect(inferKind({ ...baseInput(), hasLocation: true, hasBody: true })).toBe("text");
  });

  it("fallback (location + image, no body, no panel) → 'image' (place is location-only)", () => {
    expect(inferKind({ ...baseInput(), hasLocation: true, hasImage: true })).toBe("image");
  });

  it("totally empty input → 'text' (last-resort fallback per PRD §2.2)", () => {
    // Submit-side validation will block this elsewhere; the inference itself
    // still has to return a valid enum value rather than throw.
    expect(inferKind(baseInput())).toBe("text");
  });

  it("publishKind=merchant without image still resolves to 'merchant' (panel beats place/text)", () => {
    expect(
      inferKind({
        ...baseInput(),
        publishKind: "merchant",
        hasBody: true,
        hasLocation: true,
      }),
    ).toBe("merchant");
  });

  it("publishKind=trade without image still resolves to 'trade' (panel beats place/text)", () => {
    expect(
      inferKind({
        ...baseInput(),
        publishKind: "trade",
        hasBody: true,
        hasLocation: true,
      }),
    ).toBe("trade");
  });

  it("publishKind=event without image still resolves to 'event' (panel beats place/text)", () => {
    expect(
      inferKind({
        ...baseInput(),
        publishKind: "event",
        hasBody: true,
        hasLocation: true,
      }),
    ).toBe("event");
  });

  it("ignores whitespace-only tag", () => {
    expect(inferKind({ ...baseInput(), tag: "   ", hasImage: true })).toBe("image");
  });

  it("non-help tag does not flip kind", () => {
    expect(inferKind({ ...baseInput(), tag: "#夜跑", hasImage: true })).toBe("image");
  });

  // -- Gap 1 fix: kind=place reachable when location-only and no body ----------
  // PRD V0.2 §2.2 — `无图 + 仅地点 → place`. The inference returns `place`
  // when the user has bound a location and not typed a body or attached an
  // image. The companion fix in usePublishDraft.canSubmit + validatePublishForm
  // relaxes the body-required guard via `isPlaceOnly` so the user can
  // actually submit such a draft (previously canSubmit demanded non-empty
  // body, making the place branch dead code through the UI).

  it("location-only (regular publishKind) returns 'place' (Gap 1 fix: actually reachable)", () => {
    // The actual canSubmit check that previously blocked submit lives in
    // usePublishDraft; here we lock the inference contract: bound location,
    // no body, no image, no panel → place.
    expect(
      inferKind({
        ...baseInput(),
        publishKind: "regular",
        hasLocation: true,
        hasImage: false,
        hasBody: false,
      }),
    ).toBe("place");
  });

  // -- Gap 2 fix: LLM inferredKind hint plumbed into the priority chain --------
  // PRD V0.2 §4.3 — `candidates.inferredKind` is now wired through usePublishDraft
  // and read here as a low-priority hint. Slot lives below tag/image/panel and
  // above place-only/text. Hallucination guards strip 'image' (without an
  // actual upload) and 'help' (user-tag semantic, not LLM-imposable).

  it("Gap 2: llmInferredKind='event' with no panel materialized → 'event'", () => {
    expect(
      inferKind({
        ...baseInput(),
        publishKind: "regular",
        hasBody: true,
        llmInferredKind: "event",
      }),
    ).toBe("event");
  });

  it("Gap 2: panel publishKind beats LLM hint (user gesture wins over advisory)", () => {
    // accept(merchant_info) flipped publishKind to merchant; even if the LLM
    // is still emitting 'event' from a stale tick, the panel materialization
    // wins. Locks the priority chain order: publishKind > llmInferredKind.
    expect(
      inferKind({
        ...baseInput(),
        publishKind: "merchant",
        hasBody: true,
        llmInferredKind: "event",
      }),
    ).toBe("merchant");
  });

  it("Gap 2: llmInferredKind='image' is rejected when hasImage is false (anti-hallucination)", () => {
    // PRD §2.2 hard rule: 无图 不可能 image. The LLM may parrot 'image' as a
    // default; honoring it without an actual upload would contradict §2.2.
    // Falls through to the deterministic chain; here that's text.
    expect(
      inferKind({
        ...baseInput(),
        publishKind: "regular",
        hasImage: false,
        hasBody: true,
        llmInferredKind: "image",
      }),
    ).toBe("text");
  });

  it("Gap 2: llmInferredKind='help' is rejected (help is the user-tag semantic, not LLM-imposable)", () => {
    // PRD §2.2 reserves 'help' for the explicit 求助 tag. The LLM doesn't get
    // to impose a help-wanted classification; surface 'help_tag' as a ghost
    // suggestion and let the user accept(help_tag) instead.
    expect(
      inferKind({
        ...baseInput(),
        publishKind: "regular",
        hasBody: true,
        llmInferredKind: "help",
      }),
    ).toBe("text");
  });

  it("Gap 2: llmInferredKind='trade' with no panel and no image → 'trade'", () => {
    // The LLM saw trade signals (price + condition) the user hasn't yet
    // accepted as a ghost; we still lift the wire `kind` so backend routing
    // matches what the LLM saw, without forcing the user through panel UI.
    expect(
      inferKind({
        ...baseInput(),
        publishKind: "regular",
        hasBody: true,
        llmInferredKind: "trade",
      }),
    ).toBe("trade");
  });

  it("Gap 2: llmInferredKind='place' only honored when card is location-only (deterministic place rule still applies)", () => {
    // LLM may suggest 'place' on any tick; we only honor it when the
    // body is empty and a location is bound (matches the deterministic
    // place rule below). This avoids double-classifying a regular card
    // with a place attached as 'place'.
    expect(
      inferKind({
        ...baseInput(),
        publishKind: "regular",
        hasLocation: true,
        hasBody: false,
        llmInferredKind: "place",
      }),
    ).toBe("place");
    expect(
      inferKind({
        ...baseInput(),
        publishKind: "regular",
        hasLocation: true,
        hasBody: true,
        llmInferredKind: "place",
      }),
    ).toBe("text");
  });

  it("Gap 2: null llmInferredKind is treated identically to omitted (back-compat)", () => {
    expect(
      inferKind({
        ...baseInput(),
        hasLocation: true,
        hasBody: false,
        llmInferredKind: null,
      }),
    ).toBe("place");
    expect(
      inferKind({
        ...baseInput(),
        hasBody: true,
        llmInferredKind: null,
      }),
    ).toBe("text");
  });

  it("Gap 2: tag=求助 still beats LLM hint (priority above LLM)", () => {
    expect(
      inferKind({
        ...baseInput(),
        tag: "求助",
        hasBody: true,
        llmInferredKind: "event",
      }),
    ).toBe("help");
  });

  it("Gap 2: hasImage still beats LLM hint (媒体优先 over advisory)", () => {
    expect(
      inferKind({
        ...baseInput(),
        hasImage: true,
        hasBody: true,
        llmInferredKind: "event",
      }),
    ).toBe("image");
  });
});
