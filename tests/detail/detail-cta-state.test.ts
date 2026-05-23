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
      buttonState: "default" | "loading" | "disabled" | "pressed" | "success" | "error";
      ariaPressed: boolean;
      ariaDisabled: boolean;
      ariaBusy: boolean;
      ariaCause: "permission" | "state" | "none";
    }
  > = {
    enabled: {
      disabled: false,
      tone: "primary",
      buttonState: "default",
      ariaPressed: false,
      ariaDisabled: false,
      ariaBusy: false,
      ariaCause: "none",
    },
    disabled: {
      disabled: true,
      tone: "muted",
      buttonState: "disabled",
      ariaPressed: false,
      ariaDisabled: true,
      ariaBusy: false,
      ariaCause: "state",
    },
    loading: {
      disabled: true,
      tone: "primary",
      buttonState: "loading",
      ariaPressed: false,
      ariaDisabled: true,
      ariaBusy: true,
      ariaCause: "none",
    },
    success: {
      disabled: false,
      tone: "success",
      buttonState: "success",
      ariaPressed: true,
      ariaDisabled: false,
      ariaBusy: false,
      ariaCause: "none",
    },
    failure: {
      disabled: false,
      tone: "danger",
      buttonState: "error",
      ariaPressed: false,
      ariaDisabled: false,
      ariaBusy: false,
      ariaCause: "none",
    },
    reason: {
      disabled: true,
      tone: "muted",
      buttonState: "disabled",
      ariaPressed: false,
      ariaDisabled: true,
      ariaBusy: false,
      ariaCause: "permission",
    },
  };

  for (const state of Object.keys(EXPECTED) as DetailCtaState[]) {
    it(`maps ${state} to the expected button presentation`, () => {
      expect(resolveDetailCtaPresentation(state)).toEqual({
        state,
        ...EXPECTED[state],
      });
    });
  }

  it("loading is the only state that sets aria-busy=true (RFC mw#827 — toggle-aware)", () => {
    // Apple gap §5: aria-busy is the screen-reader signal for "wait for the
    // result". It should be unique to the in-flight state so AT users do
    // not get spurious "busy" announcements on every settled state.
    const states: DetailCtaState[] = [
      "enabled",
      "disabled",
      "loading",
      "success",
      "failure",
      "reason",
    ];
    for (const s of states) {
      const presentation = resolveDetailCtaPresentation(s);
      expect(presentation.ariaBusy).toBe(s === "loading");
    }
  });

  it("only success sets aria-pressed=true so the toggle-on semantic does not bleed", () => {
    // Per spec: success is the "I confirmed this" state and the only one
    // that locks aria-pressed="true". The non-pressed states must NOT
    // emit aria-pressed at all (Vue drops undefined attributes).
    const states: DetailCtaState[] = ["enabled", "disabled", "loading", "failure", "reason"];
    for (const s of states) {
      expect(resolveDetailCtaPresentation(s).ariaPressed).toBe(false);
    }
    expect(resolveDetailCtaPresentation("success").ariaPressed).toBe(true);
  });

  it("aria-disabled tracks the native disabled bit so AT and DOM agree", () => {
    // Pin the invariant: aria-disabled === disabled. If they ever drift the
    // CTA either announces wrong or the click guard mismatches the AT state.
    for (const state of Object.keys(EXPECTED) as DetailCtaState[]) {
      const p = resolveDetailCtaPresentation(state);
      expect(p.ariaDisabled).toBe(p.disabled);
    }
  });

  it("disabled and reason share the visuals but disambiguate via ariaCause", () => {
    // Per spec: visually identical (.is-disabled / muted tone), the
    // disambiguation is the cause label so wrappers can route the right
    // reason copy and structure tests can lock the cause.
    const disabled = resolveDetailCtaPresentation("disabled");
    const reason = resolveDetailCtaPresentation("reason");
    expect(disabled.tone).toBe(reason.tone);
    expect(disabled.disabled).toBe(reason.disabled);
    expect(disabled.buttonState).toBe(reason.buttonState);
    expect(disabled.ariaCause).toBe("state");
    expect(reason.ariaCause).toBe("permission");
  });
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

  it("permissionBlocked routes to reason state (mw#827 capability gate)", () => {
    // The Apple-gap wave 3-A spec calls out a permission-blocked CTA
    // (e.g. "needs认证商家") as a reason state visually identical to the
    // backend "blocked because state" path but with a different cause
    // surface. The selection function honours the flag.
    expect(
      selectDetailCtaState({
        clickable: false,
        permissionBlocked: true,
      }),
    ).toBe("reason");
  });

  it("loading wins over permissionBlocked so the spinner does not vanish mid-flight", () => {
    // If the user lost permission server-side while a click was in flight,
    // the visible state must stay as "loading" until the request settles.
    // Otherwise the spinner disappears under the user's finger.
    expect(
      selectDetailCtaState({
        clickable: false,
        loading: true,
        permissionBlocked: true,
      }),
    ).toBe("loading");
  });

  it("success wins over a stale permissionBlocked signal so latched results stay latched", () => {
    expect(
      selectDetailCtaState({
        clickable: false,
        success: true,
        permissionBlocked: true,
      }),
    ).toBe("success");
  });
});
