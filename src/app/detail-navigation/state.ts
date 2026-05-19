/**
 * Pure state machine for the post-detail navigation flow.
 *
 * The whole detail panel — open/close, fetch lifecycle, URL hash, shell chrome
 * slot, KeepAlive routing — derives from a single discriminated state. Three
 * earlier hot fixes (#602, #614, #615) each patched one symptom of having the
 * same state spread across `useDeepLink`, `usePostDetailLoader`,
 * `usePostDetail`, `useFeedDetail`, `useFeedDetailHistory` and
 * `useShellChrome`. Collapsing it into one reducer makes those races
 * unrepresentable. (Post-#636 PR2: `useDeepLink` was split into the narrower
 * `view-hash` and `post-detail-hash` modules; the FSM here is the only owner
 * of "is a detail open" state.)
 *
 * Invariants the reducer guarantees:
 * - Token strictly monotonically increases per state transition that begins a
 *   new fetch (`open`, `url-sync` to a new tid, `retry`). A `fetch-result`
 *   whose token does not match the current loading token is dropped.
 * - `closed` is the only "no current tid" state.
 * - Every non-closed state carries a tid; ready/error also carry payload.
 * - Idempotent: dispatching the same `url-sync(tid)` while already on the
 *   same tid (loading/ready/error) is a no-op. This is what kills the popstate
 *   race that #602 patched defensively.
 */

import type { PostDetail } from "../../types/post";
import { ERROR_LOAD_DETAIL } from "../../config/brand";

export type DetailState =
  | { kind: "closed" }
  | { kind: "loading"; tid: number; token: number }
  | { kind: "ready"; tid: number; post: PostDetail }
  | { kind: "error"; tid: number; message: string };

export type OpenSource = "card" | "deep-link" | "retry";
export type CloseSource = "user-tap" | "popstate" | "tab-switch" | "view-change";

export type DetailAction =
  | { type: "open"; tid: number; source: OpenSource }
  | { type: "close"; source: CloseSource }
  | { type: "url-sync"; tid: number | null }
  | {
      type: "fetch-result";
      token: number;
      result: { ok: PostDetail } | { err: unknown };
    };

export type SideEffect =
  | { kind: "fetch"; tid: number; token: number }
  | { kind: "history-push"; tid: number }
  | { kind: "history-clear" };

export interface ReducerResult {
  state: DetailState;
  effects: SideEffect[];
}

export function initialState(): DetailState {
  return { kind: "closed" };
}

function currentTid(state: DetailState): number | null {
  return state.kind === "closed" ? null : state.tid;
}

function startLoading(
  tid: number,
  prevToken: number,
): {
  state: Extract<DetailState, { kind: "loading" }>;
  effects: SideEffect[];
} {
  const token = prevToken + 1;
  return {
    state: { kind: "loading", tid, token },
    effects: [{ kind: "fetch", tid, token }],
  };
}

function lastToken(state: DetailState): number {
  return state.kind === "loading" ? state.token : 0;
}

function extractError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return ERROR_LOAD_DETAIL;
}

export function reduce(state: DetailState, action: DetailAction): ReducerResult {
  switch (action.type) {
    case "open": {
      const tid = action.tid;
      if (currentTid(state) === tid && state.kind === "loading") {
        // Already loading exactly this tid — no-op (e.g. deep-link replays
        // the URL we just consumed).
        return { state, effects: [] };
      }
      const start = startLoading(tid, lastToken(state));
      const effects: SideEffect[] = [...start.effects];
      // Card and retry both want the URL to advance. Deep-link arrives because
      // the URL is already #/post/{tid}; pushing again would create a duplicate
      // history entry.
      if (action.source === "card") {
        effects.push({ kind: "history-push", tid });
      }
      return { state: start.state, effects };
    }

    case "close": {
      if (state.kind === "closed") return { state, effects: [] };
      const effects: SideEffect[] = [];
      // popstate arrives because the URL already changed; clearing it again
      // would push another history entry on top of the one the browser just
      // popped to.
      if (action.source !== "popstate") {
        effects.push({ kind: "history-clear" });
      }
      return { state: { kind: "closed" }, effects };
    }

    case "url-sync": {
      const desired = action.tid;
      if (desired === null) {
        if (state.kind === "closed") return { state, effects: [] };
        return { state: { kind: "closed" }, effects: [] };
      }
      if (currentTid(state) === desired) {
        // Hash already matches what we have — drop. This is the idempotence
        // that obviates the #602 popstate early-return defense.
        return { state, effects: [] };
      }
      const start = startLoading(desired, lastToken(state));
      return { state: start.state, effects: start.effects };
    }

    case "fetch-result": {
      if (state.kind !== "loading" || action.token !== state.token) {
        // Stale fetch — discard. This single check replaces the per-loader
        // `pendingToken` discipline duplicated in usePostDetail and
        // usePostDetailLoader.
        return { state, effects: [] };
      }
      if ("ok" in action.result) {
        return {
          state: { kind: "ready", tid: state.tid, post: action.result.ok },
          effects: [],
        };
      }
      return {
        state: { kind: "error", tid: state.tid, message: extractError(action.result.err) },
        effects: [],
      };
    }
  }
}

/**
 * Convenience derived selectors. Component code should depend on these rather
 * than peeking at `state.kind` directly so the discriminant union can grow
 * without churning every consumer.
 */
export const select = {
  isOpen(state: DetailState): boolean {
    return state.kind !== "closed";
  },
  tid(state: DetailState): number | null {
    return currentTid(state);
  },
  loading(state: DetailState): boolean {
    return state.kind === "loading";
  },
  error(state: DetailState): string {
    return state.kind === "error" ? state.message : "";
  },
  post(state: DetailState): PostDetail | null {
    return state.kind === "ready" ? state.post : null;
  },
};
