import { describe, it, expect } from "vitest";
import {
  initialState,
  reduce,
  select,
  type SettingsAction,
  type SettingsState,
} from "../../src/features/profile/settings-state/state";
import type { ProfileSettings } from "../../src/types/profile";

const S0: ProfileSettings = {
  notificationEnabled: true,
  profileVisibility: "campus",
  allowMessageMentions: true,
};
const S1: ProfileSettings = {
  notificationEnabled: false,
  profileVisibility: "private",
  allowMessageMentions: true,
};
const S2: ProfileSettings = {
  notificationEnabled: true,
  profileVisibility: "public",
  allowMessageMentions: false,
};

function ready(settings: ProfileSettings = S0): SettingsState {
  return { kind: "ready", settings };
}
function loading(token: number, previous: ProfileSettings | null = null): SettingsState {
  return { kind: "loading", token, previous };
}
function saving(
  optimistic: ProfileSettings,
  previous: ProfileSettings,
  token: number,
): SettingsState {
  return { kind: "saving", settings: optimistic, previous, token };
}
function errorState(
  phase: "load" | "patch",
  previous: ProfileSettings | null = null,
): SettingsState {
  return { kind: "error", phase, previous };
}

describe("profile settings-state reducer", () => {
  describe("initial state", () => {
    it("starts idle with no settings + no error", () => {
      const s = initialState();
      expect(s.kind).toBe("idle");
      expect(select.isReady(s)).toBe(false);
      expect(select.saving(s)).toBe(false);
      expect(select.settings(s)).toBeNull();
      expect(select.errorPhase(s)).toBeNull();
    });
  });

  describe("load action", () => {
    it("from idle: enters loading + emits fetch with token=1 + previous=null", () => {
      const out = reduce(initialState(), { type: "load" });
      expect(out.state).toEqual({ kind: "loading", token: 1, previous: null });
      expect(out.effects).toEqual([{ kind: "fetch", token: 1 }]);
    });

    it("from ready: re-load preserves prior settings as `previous` so a failure cannot wipe them", () => {
      const out = reduce(ready(S0), { type: "load" });
      expect(out.state).toEqual({ kind: "loading", token: 1, previous: S0 });
    });

    it("from error(load): retry path bumps token + still no previous if there never was one", () => {
      const out = reduce(errorState("load", null), { type: "load" });
      expect(out.state).toEqual({ kind: "loading", token: 1, previous: null });
    });

    it("from error(patch) with previous: carries previous forward", () => {
      const out = reduce(errorState("patch", S0), { type: "load" });
      expect(out.state).toEqual({ kind: "loading", token: 1, previous: S0 });
    });

    it("from saving: starts a fresh GET on top of saving — bumps token, prior fetch result stale", () => {
      const out = reduce(saving(S1, S0, 5), { type: "load" });
      // S1 is the optimistic value the user sees during saving; carry it forward
      // as `previous` so a GET failure does not flip them back to S0.
      expect(out.state).toEqual({ kind: "loading", token: 6, previous: S1 });
      expect(out.effects).toEqual([{ kind: "fetch", token: 6 }]);
    });
  });

  describe("load-result action (token discipline)", () => {
    it("from loading with matching token + ok: transitions to ready", () => {
      const out = reduce(loading(3, null), {
        type: "load-result",
        token: 3,
        result: { ok: S0 },
      });
      expect(out.state).toEqual({ kind: "ready", settings: S0 });
    });

    it("from loading with matching token + err: transitions to error(load) preserving previous", () => {
      const out = reduce(loading(3, S0), {
        type: "load-result",
        token: 3,
        result: { err: new Error("network") },
      });
      expect(out.state).toEqual({ kind: "error", phase: "load", previous: S0 });
    });

    it("from loading with stale token: dropped — no state change, no effects", () => {
      const before = loading(5, null);
      const out = reduce(before, {
        type: "load-result",
        token: 3,
        result: { ok: S0 },
      });
      expect(out.state).toBe(before);
      expect(out.effects).toEqual([]);
    });

    it("from idle: dropped (cannot transition to ready without a load)", () => {
      const before = initialState();
      const out = reduce(before, {
        type: "load-result",
        token: 1,
        result: { ok: S0 },
      });
      expect(out.state).toBe(before);
    });

    it("from ready: dropped (no in-flight fetch)", () => {
      const before = ready(S0);
      const out = reduce(before, {
        type: "load-result",
        token: 1,
        result: { ok: S2 },
      });
      expect(out.state).toBe(before);
    });
  });

  describe("patch action (optimistic update)", () => {
    it("from ready: enters saving with optimistic merge + previous snapshot + emits patch", () => {
      const out = reduce(ready(S0), {
        type: "patch",
        patch: { profileVisibility: "private" },
      });
      expect(out.state).toEqual({
        kind: "saving",
        settings: { ...S0, profileVisibility: "private" },
        previous: S0,
        token: 1,
      });
      expect(out.effects).toEqual([
        { kind: "patch", token: 1, patch: { profileVisibility: "private" } },
      ]);
    });

    it("from saving: dropped — concurrent patch is a no-op (UI also disables, this is the safety net)", () => {
      const before = saving(S1, S0, 3);
      const out = reduce(before, { type: "patch", patch: { allowMessageMentions: false } });
      expect(out.state).toBe(before);
      expect(out.effects).toEqual([]);
    });

    it("from idle / loading / error: dropped (no settings to base optimistic merge on)", () => {
      for (const before of [
        initialState(),
        loading(1, null),
        errorState("load", null),
        errorState("patch", S0),
      ]) {
        const out = reduce(before, { type: "patch", patch: { notificationEnabled: false } });
        expect(out.state).toBe(before);
        expect(out.effects).toEqual([]);
      }
    });
  });

  describe("patch-result action (rollback discipline)", () => {
    it("from saving with matching token + ok: replaces with server-returned settings", () => {
      // Server may normalize / fill defaults — trust its response, not the optimistic merge.
      const out = reduce(saving(S1, S0, 4), {
        type: "patch-result",
        token: 4,
        result: { ok: S2 },
      });
      expect(out.state).toEqual({ kind: "ready", settings: S2 });
    });

    it("from saving with matching token + err: rolls back to `previous` (NOT optimistic value)", () => {
      const out = reduce(saving(S1, S0, 4), {
        type: "patch-result",
        token: 4,
        result: { err: new Error("422") },
      });
      expect(out.state).toEqual({ kind: "error", phase: "patch", previous: S0 });
    });

    it("from saving with stale token: dropped — no state change", () => {
      const before = saving(S1, S0, 7);
      const out = reduce(before, {
        type: "patch-result",
        token: 4,
        result: { ok: S2 },
      });
      expect(out.state).toBe(before);
    });

    it("from ready: dropped (no in-flight patch)", () => {
      const before = ready(S0);
      const out = reduce(before, {
        type: "patch-result",
        token: 1,
        result: { ok: S2 },
      });
      expect(out.state).toBe(before);
    });
  });

  describe("selectors", () => {
    it("settings: returns current optimistic value during saving", () => {
      const s = saving(S1, S0, 1);
      expect(select.settings(s)).toEqual(S1);
    });

    it("settings: returns rollback target during error(patch) — controls visibly revert", () => {
      const s = errorState("patch", S0);
      expect(select.settings(s)).toEqual(S0);
    });

    it("settings: returns last-known-good during error(load) when one exists", () => {
      const s = errorState("load", S0);
      expect(select.settings(s)).toEqual(S0);
    });

    it("isReady: true for ready and saving (UI renders controls in both)", () => {
      expect(select.isReady(ready(S0))).toBe(true);
      expect(select.isReady(saving(S1, S0, 1))).toBe(true);
      expect(select.isReady(loading(1, null))).toBe(false);
      expect(select.isReady(errorState("load", null))).toBe(false);
    });

    it("saving: true only during saving", () => {
      expect(select.saving(saving(S1, S0, 1))).toBe(true);
      expect(select.saving(ready(S0))).toBe(false);
    });

    it("errorPhase: distinguishes load vs patch failure for UI copy", () => {
      expect(select.errorPhase(errorState("load", null))).toBe("load");
      expect(select.errorPhase(errorState("patch", S0))).toBe("patch");
      expect(select.errorPhase(ready(S0))).toBeNull();
    });
  });

  describe("invariants", () => {
    it("token strictly increases within an in-flight chain (resets after a terminal state)", () => {
      // Tokens are not global. They stay unique only while a result could
      // still land. Once the FSM transitions to ready/error, any prior
      // loading/saving result is now non-applicable (`kind` no longer matches),
      // so a fresh op is allowed to start at 1 again. This mirrors the
      // detail-navigation FSM (#628). What we actually care about is: within
      // a chain of overlapping operations, token never repeats.
      let state: SettingsState = initialState();
      state = reduce(state, { type: "load" }).state;
      expect(state).toMatchObject({ kind: "loading", token: 1 });

      // Re-issue load while still loading (e.g. user hammered refresh): token bumps.
      state = reduce(state, { type: "load" }).state;
      expect(state).toMatchObject({ kind: "loading", token: 2 });
      state = reduce(state, { type: "load" }).state;
      expect(state).toMatchObject({ kind: "loading", token: 3 });

      // Land on ready. The next operation may legally start at 1 again,
      // because no prior loading-token result can be accepted: the reducer
      // gates on `state.kind === "loading"` and we are now `ready`.
      state = reduce(state, { type: "load-result", token: 3, result: { ok: S0 } }).state;
      expect(state.kind).toBe("ready");

      state = reduce(state, { type: "patch", patch: { allowMessageMentions: false } }).state;
      expect(state).toMatchObject({ kind: "saving", token: 1 });
    });

    it("optimistic rollback restores the entering-saving snapshot, not the post-error UI state", () => {
      // Sequence:
      //   ready(S0) → patch(visibility=private) → optimistic = S0-with-private
      //   patch-result fails → must roll back to S0, not to S0-with-private.
      let state: SettingsState = ready(S0);
      state = reduce(state, {
        type: "patch",
        patch: { profileVisibility: "private" },
      }).state;
      expect(state.kind).toBe("saving");
      state = reduce(state, {
        type: "patch-result",
        token: 1,
        result: { err: new Error("nope") },
      }).state;
      expect(select.settings(state)).toEqual(S0);
    });

    it("load-error never erases a pre-existing ready snapshot from the UI's perspective", () => {
      // Sequence:
      //   ready(S0) → load → loading(prev=S0)
      //   load-result fails → error(load, previous=S0)
      //   selector still returns S0 to the UI.
      let state: SettingsState = ready(S0);
      state = reduce(state, { type: "load" }).state;
      state = reduce(state, {
        type: "load-result",
        token: 1,
        result: { err: new Error("offline") },
      }).state;
      expect(state.kind).toBe("error");
      expect(select.settings(state)).toEqual(S0);
    });

    it("stale patch-result after a fresh load does not corrupt loading state", () => {
      // Sequence (rare but expressible):
      //   ready(S0) → patch (token=1, saving)
      //   load (token=2, loading)   ← user pulls-to-refresh during in-flight PATCH
      //   patch-result(token=1) arrives late → must be dropped, loading stays intact.
      let state: SettingsState = ready(S0);
      state = reduce(state, {
        type: "patch",
        patch: { allowMessageMentions: false },
      }).state;
      const loadOut = reduce(state, { type: "load" });
      state = loadOut.state;
      expect(state.kind).toBe("loading");
      const stale = reduce(state, {
        type: "patch-result",
        token: 1,
        result: { ok: S2 },
      });
      expect(stale.state).toBe(state);
      expect(stale.effects).toEqual([]);
    });
  });
});
