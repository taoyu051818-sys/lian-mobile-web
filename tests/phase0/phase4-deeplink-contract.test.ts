import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildPostDetailHash, buildViewHash, parseDeepLink } from "../../src/app/deepLink";

function readRepoFile(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("Phase 4 (deeplink): parseDeepLink", () => {
  it("parses #/post/{tid} into a numeric tid", () => {
    expect(parseDeepLink("#/post/42")).toEqual({ view: "post-detail", tid: 42 });
    expect(parseDeepLink("/post/42")).toEqual({ view: "post-detail", tid: 42 });
  });

  it("returns null for empty / non-matching / non-positive hashes", () => {
    expect(parseDeepLink("")).toBeNull();
    expect(parseDeepLink("#/post/")).toBeNull();
    expect(parseDeepLink("#/post/abc")).toBeNull();
    expect(parseDeepLink("#/post/0")).toBeNull();
    expect(parseDeepLink("#/post/-3")).toBeNull();
    expect(parseDeepLink("#/unknown")).toBeNull();
    expect(parseDeepLink(null)).toBeNull();
    expect(parseDeepLink(undefined)).toBeNull();
  });

  it("tolerates trailing path/query/fragment segments", () => {
    expect(parseDeepLink("#/post/42/")).toEqual({ view: "post-detail", tid: 42 });
    expect(parseDeepLink("#/post/42?ref=share")).toEqual({ view: "post-detail", tid: 42 });
  });

  it("parses #/{view} into a top-level tab link for all five views", () => {
    expect(parseDeepLink("#/feed")).toEqual({ view: "feed" });
    expect(parseDeepLink("#/map")).toEqual({ view: "map" });
    expect(parseDeepLink("#/publish")).toEqual({ view: "publish" });
    expect(parseDeepLink("#/messages")).toEqual({ view: "messages" });
    expect(parseDeepLink("#/profile")).toEqual({ view: "profile" });
    expect(parseDeepLink("/feed")).toEqual({ view: "feed" });
    expect(parseDeepLink("#/feed/")).toEqual({ view: "feed" });
  });

  it("post-detail hashes win precedence over view-shaped paths", () => {
    expect(parseDeepLink("#/post/7")).toEqual({ view: "post-detail", tid: 7 });
  });
});

describe("Phase 4 (deeplink): builders", () => {
  it("buildPostDetailHash produces the canonical post hash", () => {
    expect(buildPostDetailHash(42)).toBe("#/post/42");
  });

  it("buildViewHash produces #/{view} for every top-level tab", () => {
    expect(buildViewHash("feed")).toBe("#/feed");
    expect(buildViewHash("map")).toBe("#/map");
    expect(buildViewHash("publish")).toBe("#/publish");
    expect(buildViewHash("messages")).toBe("#/messages");
    expect(buildViewHash("profile")).toBe("#/profile");
  });
});

describe("Phase 4 (deeplink): useDeepLink singleton (source-level guards)", () => {
  // Runtime push/clear is exercised in the integration smoke; here we lock the
  // wiring at the source level so jsdom isn't a dependency for the contract.
  const useDeepLink = readRepoFile("../../src/app/useDeepLink.ts");

  it("eagerly attaches hashchange + popstate listeners at module load", () => {
    expect(useDeepLink).toMatch(/window\.addEventListener\("hashchange"/);
    expect(useDeepLink).toMatch(/window\.addEventListener\("popstate"/);
  });

  it("pushPostDetailHash uses pushState and replace flag is honored", () => {
    expect(useDeepLink).toMatch(/window\.history\.pushState/);
    expect(useDeepLink).toMatch(/window\.history\.replaceState/);
  });

  it("exports getDetailTidRef + push/clear helpers", () => {
    expect(useDeepLink).toMatch(/export function pushPostDetailHash/);
    expect(useDeepLink).toMatch(/export function clearPostDetailHash/);
    expect(useDeepLink).toMatch(/export function getDetailTidRef/);
  });

  it("exports view-hash singleton helpers", () => {
    expect(useDeepLink).toMatch(/export function pushViewHash/);
    expect(useDeepLink).toMatch(/export function getViewFromHashRef/);
    // The singleton ref must default to "feed" so the bottom tab bar has a
    // sensible initial value before any hash is read.
    expect(useDeepLink).toMatch(/viewFromHash = ref<AppViewKey>\("feed"\)/);
  });
});

describe("Phase 4 (deeplink): producers point at the canonical hash shape", () => {
  const share = readRepoFile("../../src/platform/share.ts");
  const publishSubmit = readRepoFile("../../src/features/publish/usePublishSubmit.ts");

  it("buildCanonicalPostUrl uses #/post/{tid}", () => {
    expect(share).toMatch(/#\/post\/\$\{tid\}/);
  });

  it("usePublishSubmit's postDetailUrl matches the same shape", () => {
    expect(publishSubmit).toMatch(/`#\/post\/\$\{tid\}`/);
  });
});

describe("Phase 4 (deeplink): consumers wire the hash into the SPA", () => {
  const useActiveView = readRepoFile("../../src/app/useActiveView.ts");
  const feedView = readRepoFile("../../src/features/feed/FeedView.vue");
  const detailStore = readRepoFile("../../src/app/detail-navigation/store.ts");
  const detailUrlSync = readRepoFile("../../src/app/detail-navigation/url-sync.ts");
  const detailReducer = readRepoFile("../../src/app/detail-navigation/state.ts");
  const useFeedData = readRepoFile("../../src/features/feed/useFeedData.ts");

  it("useActiveView is independent of the detail-navigation FSM (post-#636)", () => {
    // Active view is no longer forced to feed when detail opens — detail is an
    // App-level overlay (DetailSurface), so opening/closing a detail must not
    // shuffle which tab is active.
    expect(useActiveView).not.toMatch(/useDetailNavigation/);
    expect(useActiveView).not.toMatch(/detailOpen/);
    expect(useActiveView).toMatch(/getViewFromHashRef/);
    expect(useActiveView).toMatch(/pushViewHash/);
  });

  it("useActiveView reads from the view-hash singleton and writes via pushViewHash", () => {
    expect(useActiveView).toMatch(/getViewFromHashRef/);
    expect(useActiveView).toMatch(/pushViewHash/);
    // setActiveView must drive the URL, not a private ref.
    const setActiveBlock = useActiveView.match(/function setActiveView[\s\S]*?\n {2}}/)?.[0] ?? "";
    expect(setActiveBlock).toMatch(/pushViewHash\(key\)/);
    // The legacy private activeViewKey ref must be gone — viewFromHash is now
    // the single source of truth.
    expect(useActiveView).not.toMatch(/activeViewKey = ref/);
  });

  it("FeedView opens detail through the navigation store and no longer mounts the panel locally", () => {
    expect(feedView).toMatch(/useDetailNavigation/);
    expect(feedView).toMatch(/detail\.open\(/);
    expect(feedView).not.toMatch(/useFeedDetail|usePostDetailLoader|useFeedDetailHistory/);
    // Detail panel is mounted by the App-level DetailSurface, not FeedView.
    expect(feedView).not.toMatch(/<PostDetailPanel/);
  });

  it("detail-navigation store dispatches push/clear via the deep-link helpers", () => {
    expect(detailStore).toMatch(/pushPostDetailHash/);
    expect(detailStore).toMatch(/clearPostDetailHash/);
    expect(detailStore).not.toMatch(/window\.location\.href/);
  });

  it("url-sync handles popstate without racing in-flight fetches", () => {
    // The reducer makes url-sync(currentTid) idempotent — no need for the old
    // defensive "early return when detailTid is still set" guard. The popstate
    // handler simply dispatches close or url-sync; the reducer drops repeats.
    expect(detailUrlSync).toMatch(/popstate/);
    expect(detailUrlSync).toMatch(/dispatch\(\{ type: "close", source: "popstate" \}\)/);
    expect(detailUrlSync).toMatch(/dispatch\(\{ type: "url-sync", tid \}\)/);
  });

  it("reducer's url-sync action is idempotent on the same tid (kills the stuck-loading race)", () => {
    expect(detailReducer).toMatch(/case "url-sync":/);
    expect(detailReducer).toMatch(/currentTid\(state\) === desired/);
  });

  it("useFeedData no longer closes the detail on initial mount load", () => {
    // Initial mount must not clobber a deep-link-opened detail. The close-detail
    // wiring should live in the user-initiated switchTab path only.
    const loadFeedBody = useFeedData.match(/async function loadFeed[\s\S]*?\n {2}}/)?.[0] ?? "";
    expect(loadFeedBody.length).toBeGreaterThan(0);
    expect(loadFeedBody).not.toMatch(/closeDetail/);
    const switchTabBody = useFeedData.match(/function switchTab[\s\S]*?\n {2}}/)?.[0] ?? "";
    expect(switchTabBody).toMatch(/closeDetail/);
  });
});
