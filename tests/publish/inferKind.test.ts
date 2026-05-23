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
});
