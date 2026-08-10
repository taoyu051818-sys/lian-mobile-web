import { describe, it, expect } from "vitest";
import {
  initialState,
  reduce,
  select,
  type DetailAction,
  type DetailState,
} from "../../src/app/detail-navigation/state";

const POST = { tid: 1, title: "p" } as any;
const POST2 = { tid: 2, title: "q" } as any;

function loading(tid: number, token: number): DetailState {
  return { kind: "loading", tid, token };
}
function ready(tid: number, post: any = POST, token = 0): DetailState {
  return { kind: "ready", tid, token, post };
}
function error(tid: number, message = "err", token = 0): DetailState {
  return { kind: "error", tid, token, message };
}

describe("detail-navigation reducer", () => {
  describe("initial state", () => {
    it("starts closed", () => {
      const s = initialState();
      expect(s).toEqual({ kind: "closed", token: 0 });
      expect(s.kind).toBe("closed");
      expect(select.isOpen(s)).toBe(false);
      expect(select.tid(s)).toBeNull();
      expect(select.loading(s)).toBe(false);
      expect(select.error(s)).toBe("");
      expect(select.post(s)).toBeNull();
    });
  });

  describe("open action", () => {
    it("from closed: enters loading + emits fetch + history-push for card source", () => {
      const out = reduce(initialState(), { type: "open", tid: 7, source: "card" });
      expect(out.state).toEqual({ kind: "loading", tid: 7, token: 1 });
      expect(out.effects).toEqual([
        { kind: "fetch", tid: 7, token: 1 },
        { kind: "history-push", tid: 7 },
      ]);
    });

    it("deep-link source does not push history (URL is already correct)", () => {
      const out = reduce(initialState(), { type: "open", tid: 7, source: "deep-link" });
      expect(out.state).toEqual({ kind: "loading", tid: 7, token: 1 });
      expect(out.effects).toEqual([{ kind: "fetch", tid: 7, token: 1 }]);
    });

    it("retry source does not push history (URL already matches the current tid)", () => {
      const out = reduce(error(7, "err", 4), { type: "open", tid: 7, source: "retry" });
      expect(out.state).toEqual({ kind: "loading", tid: 7, token: 5 });
      expect(out.effects).toEqual([{ kind: "fetch", tid: 7, token: 5 }]);
    });

    it("from loading on same tid: no-op (avoids token churn from immediate replays)", () => {
      const before: DetailState = loading(7, 5);
      const out = reduce(before, { type: "open", tid: 7, source: "deep-link" });
      expect(out.state).toBe(before);
      expect(out.effects).toEqual([]);
    });

    it("from loading on different tid: bumps token + invalidates prior fetch", () => {
      const out = reduce(loading(7, 4), { type: "open", tid: 9, source: "card" });
      expect(out.state).toEqual({ kind: "loading", tid: 9, token: 5 });
      expect(out.effects).toContainEqual({ kind: "fetch", tid: 9, token: 5 });
    });

    it("from ready: jumps to loading the new tid", () => {
      const out = reduce(ready(7, POST, 4), { type: "open", tid: 9, source: "card" });
      expect(out.state).toEqual({ kind: "loading", tid: 9, token: 5 });
    });

    it("from error: starts a new load (a fresh attempt, not a retry of the same tid)", () => {
      const out = reduce(error(7, "err", 4), { type: "open", tid: 9, source: "card" });
      expect(out.state).toEqual({ kind: "loading", tid: 9, token: 5 });
      expect(out.effects).toContainEqual({ kind: "history-push", tid: 9 });
    });
  });

  describe("close action", () => {
    it("from closed: no-op", () => {
      const before = initialState();
      const out = reduce(before, { type: "close", source: "user-tap" });
      expect(out.state).toBe(before);
      expect(out.effects).toEqual([]);
    });

    it("user-tap: clears state + clears history", () => {
      const out = reduce(loading(7, 3), { type: "close", source: "user-tap" });
      expect(out.state).toEqual({ kind: "closed", token: 3 });
      expect(out.effects).toEqual([{ kind: "history-clear" }]);
    });

    it("popstate: clears state but does not write history (browser already did)", () => {
      const out = reduce(ready(7), { type: "close", source: "popstate" });
      expect(out.state).toEqual({ kind: "closed", token: 0 });
      expect(out.effects).toEqual([]);
    });

    it("tab-switch: clears history", () => {
      const out = reduce(error(7), { type: "close", source: "tab-switch" });
      expect(out.state).toEqual({ kind: "closed", token: 0 });
      expect(out.effects).toEqual([{ kind: "history-clear" }]);
    });
  });

  describe("url-sync action (the popstate-race fix)", () => {
    it("null on closed: no-op", () => {
      const before = initialState();
      const out = reduce(before, { type: "url-sync", tid: null });
      expect(out.state).toBe(before);
      expect(out.effects).toEqual([]);
    });

    it("null on any open state: closes silently (URL already changed)", () => {
      const out = reduce(loading(7, 3), { type: "url-sync", tid: null });
      expect(out.state).toEqual({ kind: "closed", token: 3 });
      expect(out.effects).toEqual([]);
    });

    it("same tid on loading: idempotent — drops the message instead of resetting the fetch", () => {
      // This is the case that produced the stuck-loading bug: a spurious popstate
      // fired while a fetch was already in flight, the old code called closeDetail
      // mid-fetch, which bumped the loader token so the in-flight fetch's finally
      // branch skipped clearing detailLoading. The reducer treats it as a no-op.
      const before: DetailState = loading(7, 3);
      const out = reduce(before, { type: "url-sync", tid: 7 });
      expect(out.state).toBe(before);
      expect(out.effects).toEqual([]);
    });

    it("same tid on ready: idempotent", () => {
      const before = ready(7);
      const out = reduce(before, { type: "url-sync", tid: 7 });
      expect(out.state).toBe(before);
      expect(out.effects).toEqual([]);
    });

    it("different tid on ready: starts loading the new tid (forward nav between detail urls)", () => {
      const out = reduce(ready(7, POST, 4), { type: "url-sync", tid: 9 });
      expect(out.state).toEqual({ kind: "loading", tid: 9, token: 5 });
      expect(out.effects).toEqual([{ kind: "fetch", tid: 9, token: 5 }]);
    });

    it("non-null on closed: cold-load deep link enters loading", () => {
      const out = reduce(initialState(), { type: "url-sync", tid: 9 });
      expect(out.state).toEqual({ kind: "loading", tid: 9, token: 1 });
      expect(out.effects).toEqual([{ kind: "fetch", tid: 9, token: 1 }]);
    });

    it("does not emit history-push (URL is already there)", () => {
      const out = reduce(initialState(), { type: "url-sync", tid: 9 });
      expect(out.effects.some((e) => e.kind === "history-push")).toBe(false);
    });
  });

  describe("fetch-result action (token discipline)", () => {
    it("from loading with matching token + ok: transitions to ready", () => {
      const out = reduce(loading(7, 3), {
        type: "fetch-result",
        token: 3,
        result: { ok: POST },
      });
      expect(out.state).toEqual({ kind: "ready", tid: 7, token: 3, post: POST });
      expect(out.effects).toEqual([]);
    });

    it("from loading with matching token + Error: transitions to error with message", () => {
      const out = reduce(loading(7, 3), {
        type: "fetch-result",
        token: 3,
        result: { err: new Error("boom") },
      });
      expect(out.state).toEqual({ kind: "error", tid: 7, token: 3, message: "boom" });
    });

    it("from loading with matching token + non-Error: falls back to brand error copy", () => {
      const out = reduce(loading(7, 3), {
        type: "fetch-result",
        token: 3,
        result: { err: "string-rejection" },
      });
      expect(out.state.kind).toBe("error");
      if (out.state.kind === "error") {
        expect(out.state.message).toBeTruthy();
        expect(out.state.message).not.toBe("string-rejection");
      }
    });

    it("from loading with stale token: dropped — no state change, no effects", () => {
      const before: DetailState = loading(7, 5);
      const out = reduce(before, {
        type: "fetch-result",
        token: 3,
        result: { ok: POST },
      });
      expect(out.state).toBe(before);
      expect(out.effects).toEqual([]);
    });

    it("from closed: dropped (close already invalidated the fetch)", () => {
      const before = initialState();
      const out = reduce(before, {
        type: "fetch-result",
        token: 3,
        result: { ok: POST },
      });
      expect(out.state).toBe(before);
      expect(out.effects).toEqual([]);
    });

    it("from ready: dropped (the in-flight fetch token is already <= ready's token)", () => {
      const before = ready(7);
      const out = reduce(before, {
        type: "fetch-result",
        token: 1,
        result: { ok: POST2 },
      });
      expect(out.state).toBe(before);
      expect(out.effects).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("token strictly increases on every state-changing open/url-sync", () => {
      let state: DetailState = initialState();
      let lastToken = 0;
      const events: DetailAction[] = [
        { type: "open", tid: 1, source: "card" },
        { type: "open", tid: 2, source: "card" },
        { type: "url-sync", tid: 3 },
        { type: "open", tid: 4, source: "deep-link" },
      ];
      for (const ev of events) {
        const out = reduce(state, ev);
        state = out.state;
        if (state.kind === "loading") {
          expect(state.token).toBeGreaterThan(lastToken);
          lastToken = state.token;
        }
      }
      expect(lastToken).toBe(4);
    });

    it("close → fetch-result is a no-op (the close-mid-fetch race)", () => {
      let state: DetailState = initialState();
      state = reduce(state, { type: "open", tid: 7, source: "card" }).state;
      const tokenAtOpen = state.kind === "loading" ? state.token : -1;
      state = reduce(state, { type: "close", source: "user-tap" }).state;
      const out = reduce(state, {
        type: "fetch-result",
        token: tokenAtOpen,
        result: { ok: POST },
      });
      expect(out.state.kind).toBe("closed");
      expect(out.effects).toEqual([]);
    });

    it("open(a) → open(b) → fetch-result(a) is dropped, then fetch-result(b) wins", () => {
      let state: DetailState = initialState();
      state = reduce(state, { type: "open", tid: 1, source: "card" }).state;
      const tokenA = state.kind === "loading" ? state.token : -1;
      state = reduce(state, { type: "open", tid: 2, source: "card" }).state;
      const tokenB = state.kind === "loading" ? state.token : -1;

      state = reduce(state, {
        type: "fetch-result",
        token: tokenA,
        result: { ok: POST },
      }).state;
      expect(state).toEqual({ kind: "loading", tid: 2, token: tokenB });

      state = reduce(state, {
        type: "fetch-result",
        token: tokenB,
        result: { ok: POST2 },
      }).state;
      expect(state).toEqual({ kind: "ready", tid: 2, token: tokenB, post: POST2 });
    });

    it("open(a) -> close -> open(b) gives b a new token and drops a's late result", () => {
      let state: DetailState = initialState();
      state = reduce(state, { type: "open", tid: 1, source: "card" }).state;
      const tokenA = state.kind === "loading" ? state.token : -1;

      state = reduce(state, { type: "close", source: "user-tap" }).state;
      state = reduce(state, { type: "open", tid: 2, source: "card" }).state;
      const tokenB = state.kind === "loading" ? state.token : -1;

      expect(tokenB).toBeGreaterThan(tokenA);
      const beforeLateResult = state;
      const lateA = reduce(state, {
        type: "fetch-result",
        token: tokenA,
        result: { ok: POST },
      });
      expect(lateA.state).toBe(beforeLateResult);
    });

    it("open(a) -> open(b) -> b ready -> open(c) keeps advancing and drops a's late result", () => {
      let state: DetailState = initialState();
      state = reduce(state, { type: "open", tid: 1, source: "card" }).state;
      const tokenA = state.kind === "loading" ? state.token : -1;

      state = reduce(state, { type: "open", tid: 2, source: "card" }).state;
      const tokenB = state.kind === "loading" ? state.token : -1;
      state = reduce(state, {
        type: "fetch-result",
        token: tokenB,
        result: { ok: POST2 },
      }).state;

      state = reduce(state, { type: "open", tid: 3, source: "card" }).state;
      const tokenC = state.kind === "loading" ? state.token : -1;
      expect(tokenC).toBeGreaterThan(tokenB);

      const beforeLateResult = state;
      const lateA = reduce(state, {
        type: "fetch-result",
        token: tokenA,
        result: { ok: POST },
      });
      expect(lateA.state).toBe(beforeLateResult);

      const lateB = reduce(state, {
        type: "fetch-result",
        token: tokenB,
        result: { ok: POST2 },
      });
      expect(lateB.state).toBe(beforeLateResult);
    });

    it("error -> retry advances the token and drops a late result from the failed attempt", () => {
      let state: DetailState = initialState();
      state = reduce(state, { type: "open", tid: 1, source: "card" }).state;
      const failedToken = state.kind === "loading" ? state.token : -1;
      state = reduce(state, {
        type: "fetch-result",
        token: failedToken,
        result: { err: new Error("boom") },
      }).state;

      state = reduce(state, { type: "open", tid: 1, source: "retry" }).state;
      const retryToken = state.kind === "loading" ? state.token : -1;
      expect(retryToken).toBeGreaterThan(failedToken);

      const beforeLateResult = state;
      const out = reduce(state, {
        type: "fetch-result",
        token: failedToken,
        result: { ok: POST },
      });
      expect(out.state).toBe(beforeLateResult);
    });
  });
});
