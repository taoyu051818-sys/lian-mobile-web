import { describe, expect, it } from "vitest";
import {
  coerceSuggestedComponentKind,
  isSuggestedComponentKind,
  SUGGESTED_COMPONENT_KINDS,
  type SuggestedComponentKind,
} from "../../src/types/publishSuggestion";

/**
 * PRD V0.3 stage B2 (paired with ps#624) — V1→V2 wire mapper guard.
 *
 * The AI preview now emits canonical V2 component kinds. The wire still
 * tolerates legacy V1 type strings (event_time / price / merchant_info /
 * trade_condition / help_tag) so an older server doesn't black-hole the
 * ghost list. `coerceSuggestedComponentKind` is the single point of mapping;
 * locking it down here protects every downstream consumer from drift.
 */
describe("coerceSuggestedComponentKind (V0.3 B2)", () => {
  it("passes V2 kinds through unchanged", () => {
    const v2: SuggestedComponentKind[] = [
      "location",
      "time",
      "media",
      "quality",
      "audience",
      "tags",
      "event",
      "merchant",
      "trade",
      "help",
      "groupbuy",
    ];
    for (const kind of v2) {
      expect(coerceSuggestedComponentKind(kind)).toBe(kind);
    }
  });

  it("maps each legacy V1 kind to its V2 counterpart (mirrors ps post-metadata-components.js)", () => {
    expect(coerceSuggestedComponentKind("event_time")).toBe("time");
    expect(coerceSuggestedComponentKind("price")).toBe("trade");
    expect(coerceSuggestedComponentKind("merchant_info")).toBe("merchant");
    expect(coerceSuggestedComponentKind("trade_condition")).toBe("trade");
    expect(coerceSuggestedComponentKind("help_tag")).toBe("help");
  });

  it("returns null for unknown / non-string values", () => {
    expect(coerceSuggestedComponentKind("totally_unknown")).toBeNull();
    expect(coerceSuggestedComponentKind("")).toBeNull();
    expect(coerceSuggestedComponentKind(null)).toBeNull();
    expect(coerceSuggestedComponentKind(undefined)).toBeNull();
    expect(coerceSuggestedComponentKind(42)).toBeNull();
    expect(coerceSuggestedComponentKind({})).toBeNull();
  });
});

describe("isSuggestedComponentKind (V0.3 B2)", () => {
  it("accepts only the 11 canonical V2 kinds", () => {
    for (const kind of SUGGESTED_COMPONENT_KINDS) {
      expect(isSuggestedComponentKind(kind)).toBe(true);
    }
    expect(SUGGESTED_COMPONENT_KINDS).toHaveLength(11);
  });

  it("rejects legacy V1 kinds — V1 is wire-input only, never a UI shape", () => {
    expect(isSuggestedComponentKind("event_time")).toBe(false);
    expect(isSuggestedComponentKind("price")).toBe(false);
    expect(isSuggestedComponentKind("merchant_info")).toBe(false);
    expect(isSuggestedComponentKind("trade_condition")).toBe(false);
    expect(isSuggestedComponentKind("help_tag")).toBe(false);
  });
});
