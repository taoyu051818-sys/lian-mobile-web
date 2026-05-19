/**
 * Pure state machine for the profile-settings flow.
 *
 * The settings block — load, three optimistic toggles, error/rollback — derives
 * from a single discriminated state. The first cut of this surface (PR #627)
 * spread state across four parallel refs (`settings/loading/saving/errorMessage`)
 * which is the same shape #628 just collapsed for detail navigation: any two
 * concurrent writers can race, optimistic rollback lives in a `catch` block far
 * from the value being rolled back, and stale PATCH-results are dropped only by
 * a `disabled` guard on the controls. Folding it into a reducer makes those
 * races unrepresentable.
 *
 * Invariants the reducer guarantees (covered by reducer.test):
 * - Token strictly monotonically increases with every action that begins a new
 *   network round-trip (`load`, `patch`). A `*-result` whose token does not
 *   match the current state's token is dropped.
 * - While `kind === "saving"`, further `patch` actions are no-ops. The UI keeps
 *   the controls `disabled` for the same reason, but the reducer enforces it
 *   so a stray dispatch cannot start a second concurrent PATCH.
 * - On `patch-result(err)`, state returns to `ready` with the `previous`
 *   snapshot taken when entering `saving` — not whatever value the UI had
 *   just before `patch-result` arrived (which could be from a later, also
 *   stale, patch).
 * - `load-result(err)` while we already have a `previous` ready snapshot does
 *   not erase it; the user keeps seeing their last-known good settings with
 *   an inline error rather than the UI snapping back to a spinner.
 */

import type { ProfileSettings, ProfileSettingsPatch } from "../../../types/profile";

export type SettingsState =
  | { kind: "idle" }
  | { kind: "loading"; token: number; previous: ProfileSettings | null }
  | { kind: "ready"; settings: ProfileSettings }
  | {
      kind: "saving";
      settings: ProfileSettings;
      previous: ProfileSettings;
      token: number;
    }
  | {
      kind: "error";
      phase: "load" | "patch";
      previous: ProfileSettings | null;
    };

export type SettingsAction =
  | { type: "load" }
  | {
      type: "load-result";
      token: number;
      result: { ok: ProfileSettings } | { err: unknown };
    }
  | { type: "patch"; patch: ProfileSettingsPatch }
  | {
      type: "patch-result";
      token: number;
      result: { ok: ProfileSettings } | { err: unknown };
    };

export type SideEffect =
  | { kind: "fetch"; token: number }
  | { kind: "patch"; token: number; patch: ProfileSettingsPatch };

export interface ReducerResult {
  state: SettingsState;
  effects: SideEffect[];
}

export function initialState(): SettingsState {
  return { kind: "idle" };
}

function lastToken(state: SettingsState): number {
  if (state.kind === "loading" || state.kind === "saving") return state.token;
  return 0;
}

function previousReady(state: SettingsState): ProfileSettings | null {
  if (state.kind === "ready") return state.settings;
  if (state.kind === "saving") return state.settings;
  if (state.kind === "loading") return state.previous;
  if (state.kind === "error") return state.previous;
  return null;
}

export function reduce(state: SettingsState, action: SettingsAction): ReducerResult {
  switch (action.type) {
    case "load": {
      // Reload is allowed from any state. Carry forward whatever ready snapshot
      // we have so a transient GET failure cannot wipe the visible settings.
      const token = lastToken(state) + 1;
      return {
        state: { kind: "loading", token, previous: previousReady(state) },
        effects: [{ kind: "fetch", token }],
      };
    }

    case "load-result": {
      if (state.kind !== "loading" || action.token !== state.token) {
        // Stale GET — the user already started another action. Drop.
        return { state, effects: [] };
      }
      if ("ok" in action.result) {
        return {
          state: { kind: "ready", settings: action.result.ok },
          effects: [],
        };
      }
      return {
        state: { kind: "error", phase: "load", previous: state.previous },
        effects: [],
      };
    }

    case "patch": {
      // Patch is only legal from ready. While saving, the in-flight PATCH owns
      // the token; the UI's `disabled` keeps users out, but enforce it here too.
      if (state.kind !== "ready") return { state, effects: [] };
      const token = lastToken(state) + 1;
      const optimistic: ProfileSettings = { ...state.settings, ...action.patch };
      return {
        state: {
          kind: "saving",
          settings: optimistic,
          previous: state.settings,
          token,
        },
        effects: [{ kind: "patch", token, patch: action.patch }],
      };
    }

    case "patch-result": {
      if (state.kind !== "saving" || action.token !== state.token) {
        // Stale PATCH result. With the `patch` guard above this cannot
        // currently happen — there can only be one in-flight patch — but the
        // check costs nothing and survives future refactors that allow
        // overlapping patches.
        return { state, effects: [] };
      }
      if ("ok" in action.result) {
        return {
          state: { kind: "ready", settings: action.result.ok },
          effects: [],
        };
      }
      // Roll back to the snapshot taken when entering `saving`. Note: not
      // `state.settings` (that's the optimistic value) and not `previousReady`
      // (that walks more states than we need here).
      return {
        state: { kind: "error", phase: "patch", previous: state.previous },
        effects: [],
      };
    }
  }
}

/**
 * Selectors for component-side consumers. Components should read these rather
 * than peek at `state.kind` so the discriminant union can grow without churning
 * every consumer.
 */
export const select = {
  isReady(state: SettingsState): boolean {
    return state.kind === "ready" || state.kind === "saving";
  },
  saving(state: SettingsState): boolean {
    return state.kind === "saving";
  },
  /**
   * The settings shape that the UI should render. During `saving` this is the
   * optimistic value; during `error(patch)` it's the snapshot that was rolled
   * back to (so controls visibly revert); during `error(load)` it's whatever
   * ready snapshot we had before the failed reload, or null if none.
   */
  settings(state: SettingsState): ProfileSettings | null {
    if (state.kind === "ready" || state.kind === "saving") return state.settings;
    if (state.kind === "error") return state.previous;
    return null;
  },
  /**
   * "load" errors block rendering of the controls (we have nothing to show
   * unless we had a prior ready snapshot); "patch" errors render the controls
   * at their rolled-back value with the message above. Component decides which
   * by combining `errorPhase` with `settings`.
   */
  errorPhase(state: SettingsState): "load" | "patch" | null {
    return state.kind === "error" ? state.phase : null;
  },
};
