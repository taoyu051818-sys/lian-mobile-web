/**
 * mw#827 PR-4 — detail overlay exit contract.
 *
 * When in-app navigation overwrites the URL while a post-detail overlay is
 * open, the detail-navigation FSM must observe that navigation and close
 * itself BEFORE the new view mounts. Browser back must then resolve to the
 * view-before-detail, not to a ghost overlay sitting on top of the post hash.
 *
 * The bug before this PR: `pushViewHash` mutated `viewFromHash.value` and
 * called `history.pushState`. Neither fires `hashchange`, so the FSM's
 * url-sync listener never observed the navigation; the App-level
 * `DetailSurface` stayed mounted painting on top of the next route.
 *
 * Fix shape: `view-hash.pushViewHash` invokes registered before-navigate
 * hooks BEFORE mutating its own ref. The detail-navigation store registers
 * a hook that dispatches `close('view-change')` when the FSM is open. The
 * close's `history-clear` effect uses the still-OLD `viewFromHash` to
 * `replaceState` over the post-detail URL with `#/{view-before-detail}`,
 * and then `pushState` lays the next view on top — back walks
 * `#/{newview}` → `#/{view-before-detail}`, never re-opening the detail.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakeHistory {
  state: unknown;
  pushed: Array<{ url: string }>;
  replaced: Array<{ url: string }>;
}

function installFakeWindow(opts: { initialHash: string }) {
  const history: FakeHistory = {
    state: null,
    pushed: [],
    replaced: [],
  };

  const location = {
    pathname: "/",
    search: "",
    hash: opts.initialHash,
  };

  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  const win = {
    location,
    history: {
      get state() {
        return history.state;
      },
      pushState(state: unknown, _title: string, url: string) {
        history.state = state;
        history.pushed.push({ url });
        const hashIndex = url.indexOf("#");
        location.hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
      },
      replaceState(state: unknown, _title: string, url: string) {
        history.state = state;
        history.replaced.push({ url });
        const hashIndex = url.indexOf("#");
        location.hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
      },
    },
    addEventListener(name: string, fn: (...args: unknown[]) => void) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name)!.push(fn);
    },
    removeEventListener() {},
  };

  vi.stubGlobal("window", win);
  return { window: win, history, location };
}

describe("pushViewHash overlay-exit contract (mw#827 PR-4)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("registerBeforeNavigate fires hooks BEFORE viewFromHash mutates", async () => {
    installFakeWindow({ initialHash: "#/feed" });
    const mod = await import("../../src/app/view-hash");
    const seen: Array<{ ref: string }> = [];
    const off = mod.registerBeforeNavigate(() => {
      seen.push({ ref: mod.getViewFromHashRef().value });
    });
    try {
      mod.pushViewHash("map");
      // Hook saw the OLD value of viewFromHash. The ref only flips after the
      // hook returns — that ordering is what lets the detail FSM's
      // history-clear use the pre-mutation view as the replaceState fallback.
      expect(seen).toEqual([{ ref: "feed" }]);
      expect(mod.getViewFromHashRef().value).toBe("map");
    } finally {
      off();
    }
  });

  it("registered hook receives a unique invocation per pushViewHash call", async () => {
    installFakeWindow({ initialHash: "#/feed" });
    const mod = await import("../../src/app/view-hash");
    let count = 0;
    const off = mod.registerBeforeNavigate(() => {
      count += 1;
    });
    try {
      mod.pushViewHash("map");
      mod.pushViewHash("publish");
      mod.pushViewHash("profile");
      expect(count).toBe(3);
    } finally {
      off();
    }
  });

  it("unregister stops further invocations", async () => {
    installFakeWindow({ initialHash: "#/feed" });
    const mod = await import("../../src/app/view-hash");
    let count = 0;
    const off = mod.registerBeforeNavigate(() => {
      count += 1;
    });
    mod.pushViewHash("map");
    off();
    mod.pushViewHash("publish");
    expect(count).toBe(1);
  });

  it("detail-navigation store auto-registers and closes when nav fires while open", async () => {
    installFakeWindow({ initialHash: "#/post/42" });
    const viewHash = await import("../../src/app/view-hash");
    const store = await import("../../src/app/detail-navigation/store");

    // Force the store into an open state so the hook has work to do.
    store.dispatch({ type: "open", tid: 42, source: "deep-link" });
    const nav = store.useDetailNavigation();
    expect(nav.detailOpen.value).toBe(true);

    viewHash.pushViewHash("errand-order");

    // The hook ran inside pushViewHash before viewFromHash mutated, dispatched
    // close('view-change'), and the close's history-clear used the OLD
    // viewFromHash ('feed' default) to replaceState over #/post/42.
    expect(nav.detailOpen.value).toBe(false);
    expect(nav.detailTid.value).toBeNull();
  });

  it("history is rewritten so back skips the dead detail entry", async () => {
    const { history } = installFakeWindow({ initialHash: "#/post/42" });
    const viewHash = await import("../../src/app/view-hash");
    const store = await import("../../src/app/detail-navigation/store");

    // Pretend the user was on map before opening the detail. The view-hash
    // ref carries the pre-detail tab.
    viewHash.getViewFromHashRef().value = "map";
    store.dispatch({ type: "open", tid: 42, source: "deep-link" });
    history.pushed.length = 0;
    history.replaced.length = 0;

    viewHash.pushViewHash("errand-order");

    // history-clear (replaceState) uses the still-OLD viewFromHash ('map'),
    // overwriting #/post/42 in the history stack. Then pushViewHash itself
    // pushState(#/errand-order). Back from errand-order goes to map.
    expect(history.replaced).toEqual([{ url: "/#/map" }]);
    expect(history.pushed).toEqual([{ url: "/#/errand-order" }]);
  });

  it("close('view-change') from within the navigate hook does not double-write history", async () => {
    // Regression guard: if both the detail FSM AND pushViewHash wrote to
    // history during the same navigation, back would walk through a ghost
    // entry. The hook fires history-clear (replaceState) and pushViewHash
    // fires pushState — exactly one of each, never two pushes.
    const { history } = installFakeWindow({ initialHash: "#/post/42" });
    const viewHash = await import("../../src/app/view-hash");
    const store = await import("../../src/app/detail-navigation/store");

    store.dispatch({ type: "open", tid: 42, source: "deep-link" });
    history.pushed.length = 0;
    history.replaced.length = 0;

    viewHash.pushViewHash("profile");

    expect(history.pushed).toHaveLength(1);
    expect(history.replaced).toHaveLength(1);
  });

  it("hook is a no-op when detail is already closed (no extra history writes)", async () => {
    const { history } = installFakeWindow({ initialHash: "#/feed" });
    const viewHash = await import("../../src/app/view-hash");
    // Importing the store registers its hook; we don't open the FSM.
    await import("../../src/app/detail-navigation/store");

    viewHash.pushViewHash("map");

    // Only the pushState — close-on-navigate hook saw closed FSM and exited.
    expect(history.pushed).toEqual([{ url: "/#/map" }]);
    expect(history.replaced).toHaveLength(0);
  });
});
