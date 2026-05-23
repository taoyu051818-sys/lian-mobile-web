import { describe, expect, it } from "vitest";
import { inferKind, type InferKindInput } from "../../src/features/publish/inferKind";

/**
 * PRD V0.2 step F (§2.2) — `kind` is no longer a user-picked radio. At submit
 * time we derive the wire-`kind` tag from a snapshot of the publish draft:
 *
 *   - publishKind === "event"    → `event`
 *   - publishKind === "merchant" → `merchant`
 *   - publishKind === "trade"    → `trade`
 *   - tag === "#求助"           → `help`
 *   - has location, no image, no body → `place`
 *   - has image                 → `image`
 *   - else                      → `text`   (and `image` when both image+body
 *                                 are present, per PRD's 兜底 rule)
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
  it("publishKind=event → 'event'", () => {
    expect(inferKind({ ...baseInput(), publishKind: "event", hasLocation: true })).toBe("event");
  });

  it("publishKind=merchant → 'merchant' (merchant panel open ⇒ user explicitly entered merchant flow)", () => {
    expect(inferKind({ ...baseInput(), publishKind: "merchant", hasImage: true })).toBe("merchant");
  });

  it("publishKind=trade → 'trade' (trade panel open ⇒ user explicitly entered trade flow)", () => {
    expect(inferKind({ ...baseInput(), publishKind: "trade", hasBody: true })).toBe("trade");
  });

  it("normalized 求助 tag → 'help' (regardless of body/image)", () => {
    expect(inferKind({ ...baseInput(), tag: "#求助", hasImage: true, hasBody: true })).toBe("help");
  });

  it("raw 求助 tag without leading # also resolves to 'help' (defensive)", () => {
    expect(inferKind({ ...baseInput(), tag: "求助" })).toBe("help");
  });

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

  it("fallback (location + body, no image, no panel) → not 'place' because body is non-empty", () => {
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

  it("publishKind=merchant beats every other content-driven signal", () => {
    // Merchant panel is an explicit user gesture (accept(merchant_info) ghost
    // or future explicit entry); content-derived inference must defer to it.
    expect(
      inferKind({
        ...baseInput(),
        publishKind: "merchant",
        tag: "#求助",
        hasImage: true,
        hasBody: true,
        hasLocation: true,
      }),
    ).toBe("merchant");
  });

  it("publishKind=trade beats help / image / place", () => {
    expect(
      inferKind({
        ...baseInput(),
        publishKind: "trade",
        tag: "#求助",
        hasImage: true,
        hasLocation: true,
      }),
    ).toBe("trade");
  });

  it("publishKind=event beats help / image / place", () => {
    expect(
      inferKind({
        ...baseInput(),
        publishKind: "event",
        tag: "#求助",
        hasImage: true,
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
