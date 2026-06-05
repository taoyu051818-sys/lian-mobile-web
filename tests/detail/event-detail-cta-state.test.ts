/**
 * Event detail CTA state mapping tests (Apple-gap wave 3-A / mw#827 PR-2).
 *
 * Pins the policy → 6-state vocabulary mapping plus the source-text contract
 * on `PostDetailEventBlock.vue` so the primary join/cancel CTA stays wired
 * through the shared `DetailCtaButton` and never grows its own bare-button
 * `:disabled || busy` ladder again.
 *
 * Mirrors the merchant pilot test pattern (`detail-cta-state.test.ts`) plus
 * the structural source-text checks already in use across the event surface
 * (`event-completion-ui.test.ts`, `event-reward-summary.test.ts`).
 */

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("../../src/api/profile", () => ({
  fetchAuthMe: vi.fn(),
}));

import * as profileApi from "../../src/api/profile";
import { useViewerErrandPermission } from "../../src/features/detail/useViewerErrandPermission";

import {
  resolveDetailCtaPresentation,
  type DetailCtaState,
} from "../../src/features/detail/detailCtaState";
import { selectEventDetailCtaState } from "../../src/features/detail/eventDetailCtaState";
import type { EventActionPlan } from "../../src/domain/eventActionPolicy";

function readRepoFile(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

function plan(overrides: Partial<EventActionPlan> = {}): EventActionPlan {
  return {
    mode: "join",
    enabled: true,
    reasonKey: "",
    ...overrides,
  };
}

describe("selectEventDetailCtaState — state matrix (报名 / 取消 / 完成 / 已结束)", () => {
  it("报名 (joinable, idle) → enabled", () => {
    expect(
      selectEventDetailCtaState({ plan: plan({ mode: "join", enabled: true }), busy: false }),
    ).toBe("enabled");
  });

  it("submitting a join (busy) → loading", () => {
    expect(
      selectEventDetailCtaState({ plan: plan({ mode: "join", enabled: true }), busy: true }),
    ).toBe("loading");
  });

  it("已报名, 可以取消 → enabled with cancel mode (label swap is the wrapper's job)", () => {
    expect(
      selectEventDetailCtaState({
        plan: plan({ mode: "cancel", enabled: true }),
        busy: false,
      }),
    ).toBe("enabled");
  });

  it("submitting a cancel (busy) → loading", () => {
    expect(
      selectEventDetailCtaState({ plan: plan({ mode: "cancel", enabled: true }), busy: true }),
    ).toBe("loading");
  });

  it("已结束 (alreadyEnded — terminal) → disabled with state cause", () => {
    const state = selectEventDetailCtaState({
      plan: plan({ mode: "disabled", enabled: false, reasonKey: "alreadyEnded" }),
      busy: false,
    });
    expect(state).toBe("disabled");
    expect(resolveDetailCtaPresentation(state).ariaCause).toBe("state");
  });

  it("名额已满 (full) → disabled with state cause", () => {
    const state = selectEventDetailCtaState({
      plan: plan({ mode: "disabled", enabled: false, reasonKey: "full" }),
      busy: false,
    });
    expect(state).toBe("disabled");
    expect(resolveDetailCtaPresentation(state).ariaCause).toBe("state");
  });

  it("当前不在报名期 (notOpen) → disabled with state cause", () => {
    const state = selectEventDetailCtaState({
      plan: plan({ mode: "disabled", enabled: false, reasonKey: "notOpen" }),
      busy: false,
    });
    expect(state).toBe("disabled");
    expect(resolveDetailCtaPresentation(state).ariaCause).toBe("state");
  });

  it("notSignedIn → reason with permission cause (the viewer needs an account)", () => {
    const state = selectEventDetailCtaState({
      plan: plan({ mode: "disabled", enabled: false, reasonKey: "notSignedIn" }),
      busy: false,
    });
    expect(state).toBe("reason");
    expect(resolveDetailCtaPresentation(state).ariaCause).toBe("permission");
  });

  it("outOfScope → reason with permission cause (the viewer is gated by audience)", () => {
    const state = selectEventDetailCtaState({
      plan: plan({ mode: "disabled", enabled: false, reasonKey: "outOfScope" }),
      busy: false,
    });
    expect(state).toBe("reason");
    expect(resolveDetailCtaPresentation(state).ariaCause).toBe("permission");
  });

  it("busy wins over a stale terminal status — spinner never disappears mid-flight", () => {
    expect(
      selectEventDetailCtaState({
        plan: plan({ mode: "disabled", enabled: false, reasonKey: "alreadyEnded" }),
        busy: true,
      }),
    ).toBe("loading");
  });

  it("busy wins over notSignedIn — once the request is in flight, AT must announce busy", () => {
    expect(
      selectEventDetailCtaState({
        plan: plan({ mode: "disabled", enabled: false, reasonKey: "notSignedIn" }),
        busy: true,
      }),
    ).toBe("loading");
  });

  it("disabled with no reason key (defensive) → disabled (state-blocked, not permission)", () => {
    expect(
      selectEventDetailCtaState({
        plan: plan({ mode: "disabled", enabled: false, reasonKey: "" }),
        busy: false,
      }),
    ).toBe("disabled");
  });
});

describe("selectEventDetailCtaState — every state has a stable presentation", () => {
  const expectedStates: ReadonlyArray<{
    name: string;
    input: Parameters<typeof selectEventDetailCtaState>[0];
    state: DetailCtaState;
  }> = [
    { name: "join idle", input: { plan: plan({ mode: "join" }), busy: false }, state: "enabled" },
    {
      name: "cancel idle",
      input: { plan: plan({ mode: "cancel" }), busy: false },
      state: "enabled",
    },
    {
      name: "join submitting",
      input: { plan: plan({ mode: "join" }), busy: true },
      state: "loading",
    },
    {
      name: "ended",
      input: {
        plan: plan({ mode: "disabled", enabled: false, reasonKey: "alreadyEnded" }),
        busy: false,
      },
      state: "disabled",
    },
    {
      name: "out of scope",
      input: {
        plan: plan({ mode: "disabled", enabled: false, reasonKey: "outOfScope" }),
        busy: false,
      },
      state: "reason",
    },
  ];

  for (const c of expectedStates) {
    it(`${c.name} resolves to the documented presentation`, () => {
      const state = selectEventDetailCtaState(c.input);
      expect(state).toBe(c.state);
      // Every state must have a defined presentation — guards against the
      // mapping silently returning a token DetailCtaButton can't render.
      const presentation = resolveDetailCtaPresentation(state);
      expect(presentation.state).toBe(c.state);
    });
  }
});

describe("PostDetailEventBlock — primary CTA wires through DetailCtaButton (mw#827 PR-2)", () => {
  const view = readRepoFile("../../src/features/detail/PostDetailEventBlock.vue");

  it("imports DetailCtaButton and the shared state selector", () => {
    expect(view).toMatch(/import DetailCtaButton from "\.\/DetailCtaButton\.vue"/);
    expect(view).toMatch(/import \{ selectEventDetailCtaState \} from "\.\/eventDetailCtaState"/);
  });

  it("primary join/cancel CTA renders as <DetailCtaButton> (not a bare <button>)", () => {
    // Slice the template region containing the CTA so attribute ordering
    // does not lock the test to one specific layout.
    const ctaMatch = view.match(/<DetailCtaButton[\s\S]*?\/>/);
    expect(ctaMatch, "PostDetailEventBlock must mount a <DetailCtaButton>").toBeTruthy();
    const cta = ctaMatch![0];
    expect(cta).toMatch(/test-id="post-detail-event-action"/);
    expect(cta).toMatch(/:state="primaryCtaState"/);
    expect(cta).toMatch(/:label="buttonLabel"/);
    expect(cta).toMatch(/@click="emit\('act'\)"/);
  });

  it('does not retain the legacy bare <button data-testid="post-detail-event-action">', () => {
    // Regression guard: PR-2 explicitly migrates this CTA off the bare button.
    expect(view).not.toMatch(/<button[^>]*data-testid="post-detail-event-action"/);
  });

  it("derives primaryCtaState from selectEventDetailCtaState (no inline state ladder)", () => {
    expect(view).toMatch(/const primaryCtaState = computed/);
    expect(view).toMatch(/selectEventDetailCtaState\(\{ plan: props\.plan, busy: props\.busy \}\)/);
  });

  it("preserves the data-mode hook so existing E2E selectors keep working", () => {
    // The CTA still carries `:data-mode="plan.mode"` on the wrapper so
    // tests that look for `[data-mode="cancel"]` etc. don't regress.
    expect(view).toMatch(/:data-mode="plan\.mode"/);
  });

  it("keeps the dedicated reason hint line so layout does not shift", () => {
    expect(view).toMatch(/post-detail-event-block__hint/);
    expect(view).toMatch(/showPrimaryReason/);
  });
});

describe("PostDetailPanel — detail action auth gate", () => {
  const panel = readRepoFile("../../src/features/detail/PostDetailPanel.vue");
  const mockAuthMe = vi.mocked(profileApi.fetchAuthMe);

  it("uses the auth probe result instead of post presence for detail actions (#968)", () => {
    expect(panel).not.toMatch(/Boolean\(post\.value\)/);
    expect(panel).not.toMatch(/const isAuthenticated = computed/);
    expect(panel).toMatch(/campusVerified,[\s\S]*isAuthenticated,[\s\S]*refresh: refreshViewerAuth/);
    expect(panel).toMatch(/isAuthenticated,\n  onMessage: showActionMessage/);
  });

  it("the shared auth probe keeps a loaded public detail anonymous when /auth/me has no user", async () => {
    mockAuthMe.mockResolvedValueOnce(null);

    const authProbe = useViewerErrandPermission();
    await authProbe.refresh();

    expect(authProbe.probed.value).toBe(true);
    expect(authProbe.isAuthenticated.value).toBe(false);
    expect(authProbe.campusVerified.value).toBe(false);
  });

  it("the shared auth probe exposes signed-in state separately from campus verification", async () => {
    mockAuthMe.mockResolvedValueOnce({
      id: "u-1",
      username: "tester",
      verificationState: {},
    });

    const authProbe = useViewerErrandPermission();
    await authProbe.refresh();

    expect(authProbe.isAuthenticated.value).toBe(true);
    expect(authProbe.campusVerified.value).toBe(false);
  });

  it("refreshes the auth probe when the loaded detail post changes", () => {
    const watcher = panel.match(/watch\(\n  post,[\s\S]*?\n\);/);
    expect(watcher?.[0]).toContain("void refreshViewerAuth();");
  });
});
