import { describe, expect, it } from "vitest";
import {
  resolveDetailCtaPresentation,
  selectDetailCtaState,
  type DetailCtaState,
} from "../../src/features/detail/detailCtaState";

describe("detailCtaState — visual contract", () => {
  const EXPECTED: Record<
    DetailCtaState,
    {
      disabled: boolean;
      tone: "primary" | "muted" | "success" | "danger";
    }
  > = {
    enabled: { disabled: false, tone: "primary" },
    disabled: { disabled: true, tone: "muted" },
    loading: { disabled: true, tone: "primary" },
    success: { disabled: true, tone: "success" },
    failure: { disabled: false, tone: "danger" },
    reason: { disabled: true, tone: "muted" },
  };

  for (const state of Object.keys(EXPECTED) as DetailCtaState[]) {
    it(`maps ${state} to the expected button presentation`, () => {
      expect(resolveDetailCtaPresentation(state)).toEqual({
        state,
        ...EXPECTED[state],
      });
    });
  }
});

describe("detailCtaState — merchant pilot selection", () => {
  it("uses the reason state when a blocked reason is present", () => {
    expect(
      selectDetailCtaState({
        blockedReason: "商家暂未开放代取",
        clickable: false,
      }),
    ).toBe("reason");
  });

  it("uses the disabled state when the CTA exists but cannot open yet", () => {
    expect(
      selectDetailCtaState({
        clickable: false,
      }),
    ).toBe("disabled");
  });

  it("keeps the merchant CTA enabled when the entry is open", () => {
    expect(
      selectDetailCtaState({
        clickable: true,
      }),
    ).toBe("enabled");
  });

  it("lets loading, success, and failure override the base availability state", () => {
    expect(selectDetailCtaState({ clickable: true, loading: true })).toBe("loading");
    expect(selectDetailCtaState({ clickable: true, success: true })).toBe("success");
    expect(selectDetailCtaState({ clickable: true, failure: true })).toBe("failure");
  });
});
