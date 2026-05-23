/**
 * mw#827 PR-3 — state mapping unit tests for the trade + help CTA
 * selectors layered on top of `detailCtaState` for this PR. Companion
 * to `tests/detail/detail-cta-state.test.ts`, which still owns the
 * presentation contract for the merchant pilot.
 *
 * The selectors are pure functions (no Vue refs), so the assertions
 * read like decision tables — one row per (input -> expected state).
 */
import { describe, expect, it } from "vitest";
import {
  selectHelpCtaState,
  selectHelpManageCtaState,
  selectTradeCtaState,
  selectTradeManageCtaState,
  type DetailCtaState,
} from "../../src/features/detail/detailCtaState";

describe("selectHelpCtaState — help vote / unvote primary CTA", () => {
  it("vote (clickable) maps to enabled — no aria-pressed leak", () => {
    expect(
      selectHelpCtaState({
        mode: "vote",
        enabled: true,
        reasonKey: "",
        busy: false,
        hasError: false,
      }),
    ).toBe("enabled");
  });

  it("unvote (already voted, clickable) maps to success so aria-pressed=true", () => {
    // Apple gap §5: the toggle-on state announces aria-pressed="true". The
    // success state of `DetailCtaButton` is the only state that locks
    // aria-pressed=true, so the unvote intent must route through it.
    expect(
      selectHelpCtaState({
        mode: "unvote",
        enabled: true,
        reasonKey: "",
        busy: false,
        hasError: false,
      }),
    ).toBe("success");
  });

  it("notSignedIn maps to reason — permission cause, not state", () => {
    expect(
      selectHelpCtaState({
        mode: "disabled",
        enabled: false,
        reasonKey: "notSignedIn",
        busy: false,
        hasError: false,
      }),
    ).toBe("reason");
  });

  it("alreadyResolved maps to disabled — terminal lifecycle, not permission", () => {
    expect(
      selectHelpCtaState({
        mode: "disabled",
        enabled: false,
        reasonKey: "alreadyResolved",
        busy: false,
        hasError: false,
      }),
    ).toBe("disabled");
  });

  it("alreadyClosed maps to disabled", () => {
    expect(
      selectHelpCtaState({
        mode: "disabled",
        enabled: false,
        reasonKey: "alreadyClosed",
        busy: false,
        hasError: false,
      }),
    ).toBe("disabled");
  });

  it("busy wins over every settled state — spinner does not vanish mid-flight", () => {
    const cases: Array<Parameters<typeof selectHelpCtaState>[0]> = [
      { mode: "vote", enabled: true, reasonKey: "", busy: true, hasError: false },
      { mode: "unvote", enabled: true, reasonKey: "", busy: true, hasError: false },
      { mode: "disabled", enabled: false, reasonKey: "notSignedIn", busy: true, hasError: false },
      {
        mode: "disabled",
        enabled: false,
        reasonKey: "alreadyClosed",
        busy: true,
        hasError: false,
      },
    ];
    for (const input of cases) {
      expect(selectHelpCtaState(input)).toBe<DetailCtaState>("loading");
    }
  });

  it("hasError wins over enabled but is dominated by busy", () => {
    expect(
      selectHelpCtaState({
        mode: "vote",
        enabled: true,
        reasonKey: "",
        busy: false,
        hasError: true,
      }),
    ).toBe("failure");
    // Busy wins over hasError so the spinner doesn't read as a shake.
    expect(
      selectHelpCtaState({
        mode: "vote",
        enabled: true,
        reasonKey: "",
        busy: true,
        hasError: true,
      }),
    ).toBe("loading");
  });
});

describe("selectTradeCtaState — buyer-side trade contact CTA", () => {
  it("available is enabled", () => {
    expect(selectTradeCtaState("available")).toBe("enabled");
  });

  it("reserved keeps enabled — buyer can still ask 'still available?'", () => {
    expect(selectTradeCtaState("reserved")).toBe("enabled");
  });

  it("sold maps to disabled — terminal", () => {
    expect(selectTradeCtaState("sold")).toBe("disabled");
  });

  it("cancelled maps to disabled — terminal exit", () => {
    expect(selectTradeCtaState("cancelled")).toBe("disabled");
  });

  it("hidden maps to disabled — author soft-deleted the listing", () => {
    expect(selectTradeCtaState("hidden")).toBe("disabled");
  });
});

describe("selectTradeManageCtaState — author-side trade transition CTAs", () => {
  it("idle row reads as enabled when nothing is in flight", () => {
    expect(
      selectTradeManageCtaState({ busy: false, active: false, hasError: false }),
    ).toBe<DetailCtaState>("enabled");
  });

  it("the active row reads as loading when busy, even if the previous attempt errored", () => {
    expect(
      selectTradeManageCtaState({ busy: true, active: true, hasError: true }),
    ).toBe<DetailCtaState>("loading");
  });

  it("non-active rows go disabled while another row is in flight", () => {
    expect(
      selectTradeManageCtaState({ busy: true, active: false, hasError: false }),
    ).toBe<DetailCtaState>("disabled");
  });

  it("a settled error on this row reads as failure when nothing is busy", () => {
    expect(
      selectTradeManageCtaState({ busy: false, active: false, hasError: true }),
    ).toBe<DetailCtaState>("failure");
  });
});

describe("selectHelpManageCtaState mirrors selectTradeManageCtaState", () => {
  // The selector is the same function under a different name — but we
  // pin the equivalence here so a future drift would fail loud.
  const cases = [
    { busy: false, active: false, hasError: false },
    { busy: true, active: true, hasError: false },
    { busy: true, active: false, hasError: false },
    { busy: false, active: false, hasError: true },
    { busy: true, active: true, hasError: true },
  ];
  for (const input of cases) {
    it(`agrees with selectTradeManageCtaState for ${JSON.stringify(input)}`, () => {
      expect(selectHelpManageCtaState(input)).toBe(selectTradeManageCtaState(input));
    });
  }
});
