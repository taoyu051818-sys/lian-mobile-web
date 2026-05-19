/**
 * Integration test for the store: dispatched actions update the reactive
 * computed views, and side effects route to the registered handlers.
 *
 * The reducer's purity is covered by reducer.test.ts. This file focuses on
 * the parts of `store.ts` that are not pure: reactive state propagation,
 * effect handler dispatch, and the public verb wrappers (open/close/retry).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useDetailNavigation,
  __resetStoreForTesting,
  __setEffectHandlersForTesting,
  dispatch,
} from "../../src/app/detail-navigation/store";
import type { SideEffect } from "../../src/app/detail-navigation/state";

const POST = { tid: 7, title: "p" } as any;

describe("detail-navigation store", () => {
  let restoreHandlers: () => void = () => {};
  let effects: SideEffect[];

  beforeEach(() => {
    __resetStoreForTesting();
    effects = [];
    restoreHandlers = __setEffectHandlersForTesting({
      fetch: (e) => effects.push(e),
      "history-push": (e) => effects.push(e),
      "history-clear": (e) => effects.push(e),
    });
  });

  afterEachRestore();

  function afterEachRestore() {
    // Avoid cross-test handler bleed.
    afterEach(() => restoreHandlers());
  }

  it("starts closed; computed views agree with state", () => {
    const nav = useDetailNavigation();
    expect(nav.detailOpen.value).toBe(false);
    expect(nav.detailTid.value).toBeNull();
    expect(nav.detailLoading.value).toBe(false);
    expect(nav.detailError.value).toBe("");
    expect(nav.detailPost.value).toBeNull();
  });

  it("open(tid, 'card') drives loading + emits fetch + history-push", () => {
    const nav = useDetailNavigation();
    nav.open(7, "card");

    expect(nav.detailLoading.value).toBe(true);
    expect(nav.detailTid.value).toBe(7);
    expect(nav.detailOpen.value).toBe(true);
    expect(effects).toContainEqual({ kind: "fetch", tid: 7, token: 1 });
    expect(effects).toContainEqual({ kind: "history-push", tid: 7 });
  });

  it("open(tid, 'deep-link') skips history-push", () => {
    const nav = useDetailNavigation();
    nav.open(7, "deep-link" as any);

    expect(effects.some((e) => e.kind === "history-push")).toBe(false);
    expect(effects.some((e) => e.kind === "fetch")).toBe(true);
  });

  it("a successful fetch transitions to ready and clears loading", () => {
    const nav = useDetailNavigation();
    nav.open(7, "card");
    const fetchEffect = effects.find((e) => e.kind === "fetch")!;
    expect(fetchEffect.kind).toBe("fetch");

    if (fetchEffect.kind === "fetch") {
      dispatch({
        type: "fetch-result",
        token: fetchEffect.token,
        result: { ok: POST },
      });
    }

    expect(nav.detailLoading.value).toBe(false);
    expect(nav.detailPost.value).toEqual(POST);
    expect(nav.detailError.value).toBe("");
  });

  it("close after open emits history-clear and resets state", () => {
    const nav = useDetailNavigation();
    nav.open(7, "card");
    effects.length = 0;

    nav.close("user-tap");

    expect(nav.detailOpen.value).toBe(false);
    expect(nav.detailTid.value).toBeNull();
    expect(effects).toEqual([{ kind: "history-clear" }]);
  });

  it("close('popstate') skips history-clear (browser already popped)", () => {
    const nav = useDetailNavigation();
    nav.open(7, "card");
    effects.length = 0;

    nav.close("popstate");

    expect(nav.detailOpen.value).toBe(false);
    expect(effects).toEqual([]);
  });

  it("retry re-dispatches an open with the current tid + retry source (no extra history push)", () => {
    const nav = useDetailNavigation();
    nav.open(7, "card");
    // Move to error
    const tokenAtOpen = (effects.find((e) => e.kind === "fetch") as any)?.token;
    dispatch({
      type: "fetch-result",
      token: tokenAtOpen,
      result: { err: new Error("boom") },
    });
    expect(nav.detailError.value).toBe("boom");
    effects.length = 0;

    nav.retry();

    expect(nav.detailLoading.value).toBe(true);
    const retryFetch = effects.find((e) => e.kind === "fetch");
    expect(retryFetch).toBeDefined();
    expect(effects.some((e) => e.kind === "history-push")).toBe(false);
  });

  it("retry on closed: no-op", () => {
    const nav = useDetailNavigation();
    nav.retry();
    expect(nav.detailOpen.value).toBe(false);
    expect(effects).toEqual([]);
  });

  it("a stale fetch result arriving after a re-open does not flip loading off", () => {
    // Reproduces the original "stuck loading" scenario at the store level: an
    // in-flight fetch's result arrives after the user already kicked off
    // another open. The reducer's token check makes this a no-op; the store
    // must surface that as "still loading the new tid."
    const nav = useDetailNavigation();
    nav.open(1, "card");
    const firstToken = (effects.find((e) => e.kind === "fetch") as any).token;
    nav.open(2, "card");
    const secondToken = (effects.filter((e) => e.kind === "fetch")[1] as any).token;
    expect(secondToken).toBeGreaterThan(firstToken);

    dispatch({
      type: "fetch-result",
      token: firstToken,
      result: { ok: { tid: 1, title: "stale" } as any },
    });

    expect(nav.detailLoading.value).toBe(true);
    expect(nav.detailTid.value).toBe(2);
    expect(nav.detailPost.value).toBeNull();

    dispatch({
      type: "fetch-result",
      token: secondToken,
      result: { ok: { tid: 2, title: "fresh" } as any },
    });

    expect(nav.detailLoading.value).toBe(false);
    expect(nav.detailPost.value).toEqual({ tid: 2, title: "fresh" });
  });
});

// Test harness must import after, not before, the store module above.
import { afterEach } from "vitest";
// Avoid an unused-import warning.
void vi;
