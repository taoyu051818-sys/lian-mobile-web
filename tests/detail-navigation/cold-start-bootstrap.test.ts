/**
 * Cold-start history bootstrap (#636 follow-up).
 *
 * When the SPA loads directly at `#/post/{tid}` the browser has only one
 * history entry — the post URL itself. `history.back()` then walks out of
 * the page. The bootstrap synthesizes a `#/feed` entry beneath the post so
 * back stays inside the SPA and the underlying FeedView becomes visible
 * when the App-level DetailSurface unmounts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bootstrapColdStartHistory,
  __resetColdStartBootstrapForTesting,
} from "../../src/app/post-detail-hash";

interface FakeHistory {
  state: unknown;
  length: number;
  pushed: Array<{ url: string }>;
  replaced: Array<{ url: string }>;
}

function installFakeWindow(opts: { initialHash: string }) {
  const history: FakeHistory = {
    state: null,
    length: 1,
    pushed: [],
    replaced: [],
  };

  const location = {
    pathname: "/",
    search: "",
    hash: opts.initialHash,
  };

  const win = {
    location,
    history: {
      get state() {
        return history.state;
      },
      get length() {
        return history.length;
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
  };

  vi.stubGlobal("window", win);
  return { window: win, history, location };
}

describe("bootstrapColdStartHistory", () => {
  beforeEach(() => {
    __resetColdStartBootstrapForTesting();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("synthesizes a #/feed entry beneath a cold-loaded #/post/{tid}", () => {
    const { history, location } = installFakeWindow({ initialHash: "#/post/42" });

    bootstrapColdStartHistory();

    expect(history.replaced).toEqual([{ url: "/#/feed" }]);
    expect(history.pushed).toEqual([{ url: "/#/post/42" }]);
    // After bootstrap, the URL is right back where it was so the FSM still
    // observes the post hash on first paint.
    expect(location.hash).toBe("#/post/42");
  });

  it("is a no-op when the URL is not a post-detail hash", () => {
    const { history } = installFakeWindow({ initialHash: "#/feed" });

    bootstrapColdStartHistory();

    expect(history.replaced).toHaveLength(0);
    expect(history.pushed).toHaveLength(0);
  });

  it("is a no-op on empty hash", () => {
    const { history } = installFakeWindow({ initialHash: "" });

    bootstrapColdStartHistory();

    expect(history.replaced).toHaveLength(0);
    expect(history.pushed).toHaveLength(0);
  });

  it("only runs once even if invoked again", () => {
    const { history } = installFakeWindow({ initialHash: "#/post/42" });

    bootstrapColdStartHistory();
    bootstrapColdStartHistory();

    expect(history.replaced).toHaveLength(1);
    expect(history.pushed).toHaveLength(1);
  });
});
