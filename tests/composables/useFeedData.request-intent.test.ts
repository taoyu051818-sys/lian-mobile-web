import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AudienceVisibility } from "../../src/types/audience";
import type { FeedItem, FeedResponse } from "../../src/types/feed";
import type { ProfileUser } from "../../src/types/profile";

vi.mock("../../src/api/feed", () => ({
  DEFAULT_TABS: [
    { id: "now", label: "Now" },
    { id: "featured", label: "Featured" },
  ],
  fetchFeed: vi.fn(),
}));

vi.mock("../../src/api/profile", () => ({
  fetchAuthMe: vi.fn(),
}));

vi.mock("../../src/platform/browser-storage", () => ({
  GUEST_READ_HISTORY_SCOPE: Object.freeze({ kind: "guest" }),
  accountReadHistoryScope: vi.fn((userId: string) => {
    const normalized = typeof userId === "string" ? userId.trim() : "";
    return normalized ? { kind: "account", userId: normalized } : null;
  }),
  readHistoryQuery: vi.fn((scope: { kind: string; userId?: string }) =>
    scope.userId === "user-a" ? "101" : "",
  ),
  rememberReadItem: vi.fn(),
}));

import * as feedApi from "../../src/api/feed";
import * as profileApi from "../../src/api/profile";
import * as browserStorage from "../../src/platform/browser-storage";
import { useFeedData } from "../../src/features/feed/useFeedData";

const fetchFeedMock = vi.mocked(feedApi.fetchFeed);
const fetchAuthMeMock = vi.mocked(profileApi.fetchAuthMe);
const readHistoryQueryMock = vi.mocked(browserStorage.readHistoryQuery);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function item(tid: number, title: string, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    tid,
    title,
    bodyPreview: "",
    cover: "",
    primaryTag: "",
    timeLabel: "",
    timestampISO: "",
    likeCount: 0,
    liked: false,
    locationArea: "",
    contentType: "text",
    ...overrides,
  };
}

function response(
  items: FeedItem[],
  options: Pick<FeedResponse, "hasMore" | "nextPage"> = {
    hasMore: false,
    nextPage: null,
  },
): FeedResponse {
  return {
    tabs: [
      { id: "now", label: "Now" },
      { id: "featured", label: "Featured" },
    ],
    items,
    ...options,
  };
}

function makeHarness() {
  return useFeedData({ detailOpen: () => false, closeDetail: vi.fn() });
}

async function expectLogicalSettlement(promise: Promise<void>): Promise<void> {
  let settled = false;
  void promise.then(() => {
    settled = true;
  });
  await vi.waitFor(() => expect(settled).toBe(true), { timeout: 250 });
}

beforeEach(() => {
  fetchFeedMock.mockReset();
  fetchAuthMeMock.mockReset();
  readHistoryQueryMock.mockClear();
});

describe("useFeedData request intent state", () => {
  it("#1 preserves a committed multi-page snapshot through refresh failure and exact retry", async () => {
    fetchFeedMock
      .mockResolvedValueOnce(response([item(1, "page one")], { hasMore: true, nextPage: 2 }))
      .mockResolvedValueOnce(response([item(2, "page two")], { hasMore: true, nextPage: 3 }));
    const feed = makeHarness();

    await feed.loadFeed("replace");
    await feed.loadFeed("append");

    const refreshAttempt = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(refreshAttempt.promise);
    const refresh = feed.refreshFeed();

    expect(feed.items.value.map((entry) => entry.tid)).toEqual([1, 2]);
    expect(feed.page.value).toBe(3);
    expect(feed.hasMore.value).toBe(true);
    expect(feed.loading.value).toBe(false);
    expect(feed.refreshing.value).toBe(true);
    expect(feed.loadingMore.value).toBe(false);
    expect(feed.requestPending.value).toBe(true);
    expect(feed.isEmpty.value).toBe(false);

    refreshAttempt.reject(new Error("refresh failed"));
    await refresh;

    expect(feed.items.value.map((entry) => entry.tid)).toEqual([1, 2]);
    expect(feed.page.value).toBe(3);
    expect(feed.hasMore.value).toBe(true);
    expect(feed.errorMessage.value).toBe("refresh failed");

    const retryAttempt = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(retryAttempt.promise);
    const retry = feed.retryFailedRequest();

    expect(fetchFeedMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ tab: "now", page: 1, visibility: undefined }),
    );
    expect(feed.errorMessage.value).toBe("refresh failed");
    expect(feed.refreshing.value).toBe(true);
    expect(feed.requestPending.value).toBe(true);

    const latest = item(9, "latest snapshot", { liked: true, likeCount: 8 });
    retryAttempt.resolve(
      response([item(9, "old duplicate"), latest, item(10, "new item")], {
        hasMore: false,
        nextPage: null,
      }),
    );
    await retry;

    expect(feed.items.value).toEqual([latest, item(10, "new item")]);
    expect(feed.page.value).toBe(2);
    expect(feed.hasMore.value).toBe(false);
    expect(feed.errorMessage.value).toBe("");
    expect(feed.requestPending.value).toBe(false);
  });

  it("#2 clears old context at tab admission and retries the captured replacement", async () => {
    fetchFeedMock.mockResolvedValueOnce(response([item(1, "old context")]));
    const feed = makeHarness();
    await feed.loadFeed("replace");

    const tabAttempt = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(tabAttempt.promise);
    const tabChange = feed.switchTab("featured");

    expect(feed.items.value).toEqual([]);
    expect(feed.loading.value).toBe(true);
    expect(feed.refreshing.value).toBe(false);
    expect(feed.page.value).toBe(1);
    expect(feed.hasMore.value).toBe(true);

    tabAttempt.reject(new Error("featured unavailable"));
    await tabChange;
    expect(feed.items.value).toEqual([]);
    expect(feed.errorMessage.value).toBe("featured unavailable");

    const retryAttempt = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(retryAttempt.promise);
    const retry = feed.retryFailedRequest();

    expect(fetchFeedMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ tab: "featured", page: 1 }),
    );
    expect(feed.errorMessage.value).toBe("featured unavailable");
    expect(feed.loading.value).toBe(true);
    expect(feed.requestPending.value).toBe(true);

    retryAttempt.resolve(response([item(8, "featured result")]));
    await retry;
    expect(feed.items.value.map((entry) => entry.tid)).toEqual([8]);
    expect(feed.errorMessage.value).toBe("");
  });

  it("#3 pauses automatic append after failure and retries the same page with F3a merge", async () => {
    const oldOverlap = item(2, "old overlap", { likeCount: 1 });
    fetchFeedMock.mockResolvedValueOnce(
      response([item(1, "first"), oldOverlap], { hasMore: true, nextPage: 2 }),
    );
    const feed = makeHarness();
    await feed.loadFeed("replace");

    fetchFeedMock.mockRejectedValueOnce(new Error("page two failed"));
    await feed.loadFeed("append");

    expect(feed.items.value.map((entry) => entry.tid)).toEqual([1, 2]);
    expect(feed.page.value).toBe(2);
    expect(feed.hasMore.value).toBe(true);
    expect(feed.canAutoLoadMore.value).toBe(false);
    expect(feed.errorMessage.value).toBe("page two failed");

    const retryAttempt = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(retryAttempt.promise);
    const retry = feed.triggerLoadMore();

    expect(fetchFeedMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(feed.errorMessage.value).toBe("page two failed");
    expect(feed.loadingMore.value).toBe(true);
    expect(feed.requestPending.value).toBe(true);

    const latestOverlap = item(2, "latest overlap", { liked: true, likeCount: 5 });
    retryAttempt.resolve(
      response([latestOverlap, item(3, "third")], { hasMore: false, nextPage: null }),
    );
    await retry;

    expect(feed.items.value).toEqual([item(1, "first"), latestOverlap, item(3, "third")]);
    expect(feed.page.value).toBe(3);
    expect(feed.hasMore.value).toBe(false);
    expect(feed.errorMessage.value).toBe("");
  });

  it("#4/#16 keeps an initial replacement failure retryable and single-flights duplicate retry", async () => {
    fetchFeedMock.mockRejectedValueOnce(new Error("initial failed"));
    const feed = makeHarness();
    await feed.loadFeed("replace");

    expect(feed.items.value).toEqual([]);
    expect(feed.errorMessage.value).toBe("initial failed");

    const retryAttempt = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(retryAttempt.promise);
    const firstRetry = feed.retryFailedRequest();
    const duplicateRetry = feed.retryFailedRequest();

    expect(duplicateRetry).toBe(firstRetry);
    expect(fetchFeedMock).toHaveBeenCalledTimes(2);
    expect(fetchFeedMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ tab: "now", page: 1 }),
    );
    expect(feed.errorMessage.value).toBe("initial failed");
    expect(feed.loading.value).toBe(true);
    expect(feed.requestPending.value).toBe(true);

    retryAttempt.resolve(response([item(1, "recovered")]));
    await Promise.all([firstRetry, duplicateRetry]);
    expect(feed.items.value.map((entry) => entry.tid)).toEqual([1]);
    expect(feed.errorMessage.value).toBe("");
  });

  it("#5/#13 single-flights duplicate refresh and suppresses append while refresh is pending", async () => {
    fetchFeedMock.mockResolvedValueOnce(
      response([item(1, "committed")], { hasMore: true, nextPage: 2 }),
    );
    const feed = makeHarness();
    await feed.loadFeed("replace");

    const refreshAttempt = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(refreshAttempt.promise);
    const firstRefresh = feed.refreshFeed();
    const duplicateRefresh = feed.refreshFeed();
    const rejectedAppend = feed.triggerLoadMore();

    expect(duplicateRefresh).toBe(firstRefresh);
    expect(fetchFeedMock).toHaveBeenCalledTimes(2);
    await rejectedAppend;
    expect(feed.refreshing.value).toBe(true);
    expect(feed.loadingMore.value).toBe(false);
    expect(feed.items.value.map((entry) => entry.tid)).toEqual([1]);

    refreshAttempt.resolve(response([item(2, "refreshed")]));
    await Promise.all([firstRefresh, duplicateRefresh]);
    expect(feed.items.value.map((entry) => entry.tid)).toEqual([2]);
  });

  it("#12 keeps strict empty refresh non-empty-state while pending", async () => {
    const refreshAttempt = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(refreshAttempt.promise);
    const feed = makeHarness();

    const refresh = feed.refreshFeed();
    expect(feed.items.value).toEqual([]);
    expect(feed.loading.value).toBe(false);
    expect(feed.refreshing.value).toBe(true);
    expect(feed.requestPending.value).toBe(true);
    expect(feed.isEmpty.value).toBe(false);

    refreshAttempt.resolve(response([]));
    await refresh;
    expect(feed.requestPending.value).toBe(false);
    expect(feed.isEmpty.value).toBe(true);
  });

  it("#14 settles a superseded owner-ready replacement promptly and rejects every late write", async () => {
    fetchAuthMeMock.mockResolvedValueOnce(null);
    fetchFeedMock.mockResolvedValueOnce(response([]));
    const feed = makeHarness();
    await feed.initialize();

    const staleReplace = deferred<FeedResponse>();
    const latestRefresh = deferred<FeedResponse>();
    fetchFeedMock
      .mockReturnValueOnce(staleReplace.promise)
      .mockReturnValueOnce(latestRefresh.promise);

    const replacement = feed.loadFeed("replace");
    const refresh = feed.refreshFeed();

    await expectLogicalSettlement(replacement);
    expect(fetchFeedMock).toHaveBeenCalledTimes(3);
    expect(feed.loading.value).toBe(false);
    expect(feed.refreshing.value).toBe(true);
    expect(feed.loadingMore.value).toBe(false);
    expect(feed.isEmpty.value).toBe(false);

    latestRefresh.resolve(response([item(9, "latest refresh")]));
    await refresh;
    staleReplace.reject(new Error("late replacement failure"));
    await Promise.resolve();

    expect(feed.items.value.map((entry) => entry.tid)).toEqual([9]);
    expect(feed.errorMessage.value).toBe("");
    expect(feed.requestPending.value).toBe(false);
  });

  it("#5 settles a superseded refresh promptly when a context replacement takes ownership", async () => {
    fetchFeedMock.mockResolvedValueOnce(response([item(1, "old context")]));
    const feed = makeHarness();
    await feed.loadFeed("replace");

    const staleRefresh = deferred<FeedResponse>();
    const latestTab = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(staleRefresh.promise).mockReturnValueOnce(latestTab.promise);

    const refresh = feed.refreshFeed();
    const tabChange = feed.switchTab("featured");
    await expectLogicalSettlement(refresh);

    expect(feed.items.value).toEqual([]);
    expect(feed.loading.value).toBe(true);
    expect(feed.refreshing.value).toBe(false);

    latestTab.resolve(response([item(2, "featured")]));
    await tabChange;
    staleRefresh.resolve(response([item(3, "late refresh")]));
    await Promise.resolve();

    expect(feed.items.value.map((entry) => entry.tid)).toEqual([2]);
    expect(feed.errorMessage.value).toBe("");
    expect(feed.requestPending.value).toBe(false);
  });

  it("#5 settles a superseded append promptly when refresh takes ownership", async () => {
    fetchFeedMock.mockResolvedValueOnce(
      response([item(1, "committed")], { hasMore: true, nextPage: 2 }),
    );
    const feed = makeHarness();
    await feed.loadFeed("replace");

    const staleAppend = deferred<FeedResponse>();
    const latestRefresh = deferred<FeedResponse>();
    fetchFeedMock
      .mockReturnValueOnce(staleAppend.promise)
      .mockReturnValueOnce(latestRefresh.promise);

    const append = feed.loadFeed("append");
    const refresh = feed.refreshFeed();
    await expectLogicalSettlement(append);

    expect(feed.items.value.map((entry) => entry.tid)).toEqual([1]);
    expect(feed.loadingMore.value).toBe(false);
    expect(feed.refreshing.value).toBe(true);

    latestRefresh.resolve(response([item(2, "latest refresh")]));
    await refresh;
    staleAppend.resolve(response([item(3, "late append")], { hasMore: false, nextPage: null }));
    await Promise.resolve();

    expect(feed.items.value.map((entry) => entry.tid)).toEqual([2]);
    expect(feed.errorMessage.value).toBe("");
    expect(feed.requestPending.value).toBe(false);
  });

  it("#5 settles an append promptly when a real visibility replacement takes ownership", async () => {
    fetchAuthMeMock.mockResolvedValueOnce(null);
    fetchFeedMock.mockResolvedValueOnce(
      response([item(1, "committed")], { hasMore: true, nextPage: 2 }),
    );
    const feed = makeHarness();
    await feed.initialize();

    const staleAppend = deferred<FeedResponse>();
    const latestFilter = deferred<FeedResponse>();
    fetchFeedMock
      .mockReturnValueOnce(staleAppend.promise)
      .mockReturnValueOnce(latestFilter.promise);

    const append = feed.loadFeed("append");
    const filterChange = feed.setSelectedVisibilities(new Set(["school"]));
    await expectLogicalSettlement(append);

    expect(fetchFeedMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ tab: "now", page: 1, visibility: ["school"] }),
    );
    expect(feed.items.value).toEqual([]);
    expect(feed.loading.value).toBe(true);
    expect(feed.loadingMore.value).toBe(false);

    staleAppend.resolve(response([item(2, "late append")], { hasMore: false, nextPage: null }));
    await Promise.resolve();
    expect(feed.items.value).toEqual([]);
    expect(feed.loading.value).toBe(true);
    expect(feed.page.value).toBe(1);
    expect(feed.hasMore.value).toBe(true);

    latestFilter.resolve(response([item(3, "school result")]));
    await filterChange;
    expect(feed.items.value.map((entry) => entry.tid)).toEqual([3]);
    expect(feed.errorMessage.value).toBe("");
  });
});

describe("useFeedData owner-resolution intent cohort", () => {
  it("#6/#8 freezes the latest context and settles every resolving caller on latest rejection", async () => {
    const auth = deferred<ProfileUser | null>();
    const latestRequest = deferred<FeedResponse>();
    fetchAuthMeMock.mockReturnValueOnce(auth.promise);
    fetchFeedMock.mockReturnValueOnce(latestRequest.promise);
    const feed = makeHarness();
    const selected = new Set<AudienceVisibility>(["school", "public"]);
    const settlements = [false, false, false, false];

    const initialization = feed.initialize().then(() => {
      settlements[0] = true;
    });
    const refresh = feed.refreshFeed().then(() => {
      settlements[1] = true;
    });
    const tabChange = feed.switchTab("featured").then(() => {
      settlements[2] = true;
    });
    const filterChange = feed.setSelectedVisibilities(selected).then(() => {
      settlements[3] = true;
    });
    selected.clear();
    selected.add("private");

    expect(fetchFeedMock).not.toHaveBeenCalled();
    auth.resolve({ id: "user-a" });
    await vi.waitFor(() => expect(fetchFeedMock).toHaveBeenCalledTimes(1));

    expect(fetchFeedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tab: "featured",
        page: 1,
        visibility: ["public", "school"],
        read: "101",
      }),
    );
    expect(settlements).toEqual([false, false, false, false]);
    expect(readHistoryQueryMock).toHaveBeenCalledWith({ kind: "account", userId: "user-a" });

    latestRequest.reject(new Error("latest cohort failed"));
    await Promise.all([initialization, refresh, tabChange, filterChange]);

    expect(settlements).toEqual([true, true, true, true]);
    expect(feed.errorMessage.value).toBe("latest cohort failed");
    expect(feed.loading.value).toBe(false);
    expect(feed.refreshing.value).toBe(false);
    expect(feed.loadingMore.value).toBe(false);
    expect(feed.requestPending.value).toBe(false);

    const retryAttempt = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(retryAttempt.promise);
    const retry = feed.retryFailedRequest();
    expect(fetchFeedMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tab: "featured",
        page: 1,
        visibility: ["public", "school"],
        read: "101",
      }),
    );
    retryAttempt.resolve(response([item(9, "frozen retry result")]));
    await retry;
    expect(feed.items.value.map((entry) => entry.tid)).toEqual([9]);
  });

  it("#17 keeps a cohort open when a post-auth physical refresh is superseded by tab B", async () => {
    const auth = deferred<ProfileUser | null>();
    const staleRefresh = deferred<FeedResponse>();
    const latestTab = deferred<FeedResponse>();
    fetchAuthMeMock.mockReturnValueOnce(auth.promise);
    fetchFeedMock.mockReturnValueOnce(staleRefresh.promise).mockReturnValueOnce(latestTab.promise);
    const feed = makeHarness();
    const settled = { initialize: false, refresh: false };

    const initialization = feed.initialize().then(() => {
      settled.initialize = true;
    });
    const refresh = feed.refreshFeed().then(() => {
      settled.refresh = true;
    });

    auth.resolve({ id: "user-a" });
    await vi.waitFor(() => expect(fetchFeedMock).toHaveBeenCalledTimes(1));
    const tabChange = feed.switchTab("featured");
    expect(fetchFeedMock).toHaveBeenCalledTimes(2);

    const tabBSnapshot = {
      items: [...feed.items.value],
      tabs: [...feed.tabs.value],
      page: feed.page.value,
      hasMore: feed.hasMore.value,
      errorMessage: feed.errorMessage.value,
    };

    staleRefresh.resolve({
      ...response([item(1, "stale refresh")], { hasMore: false, nextPage: null }),
      tabs: [{ id: "stale", label: "Stale" }],
    });
    await Promise.resolve();
    expect(settled).toEqual({ initialize: false, refresh: false });
    expect({
      items: feed.items.value,
      tabs: feed.tabs.value,
      page: feed.page.value,
      hasMore: feed.hasMore.value,
      errorMessage: feed.errorMessage.value,
    }).toEqual(tabBSnapshot);
    expect(feed.loading.value).toBe(true);

    latestTab.resolve(response([item(2, "tab B")]));
    await Promise.all([initialization, refresh, tabChange]);
    expect(settled).toEqual({ initialize: true, refresh: true });
    expect(feed.items.value.map((entry) => entry.tid)).toEqual([2]);
  });

  it("#7 settles every resolving semantic promise on dispose without resolving auth", async () => {
    const auth = deferred<ProfileUser | null>();
    fetchAuthMeMock.mockReturnValueOnce(auth.promise);
    const feed = makeHarness();

    const initialization = feed.initialize();
    const refresh = feed.refreshFeed();
    const tabChange = feed.switchTab("featured");
    const filterChange = feed.setSelectedVisibilities(new Set(["school"]));

    feed.dispose();
    await expectLogicalSettlement(
      Promise.all([initialization, refresh, tabChange, filterChange]).then(() => undefined),
    );

    expect(fetchFeedMock).not.toHaveBeenCalled();
    expect(readHistoryQueryMock).not.toHaveBeenCalled();
    expect(feed.loading.value).toBe(false);
    expect(feed.refreshing.value).toBe(false);
    expect(feed.loadingMore.value).toBe(false);
    expect(feed.requestPending.value).toBe(false);
  });
});

describe("useFeedData no-op, retry, and dispose ownership", () => {
  it("#9 updates a repeated retry failure and leaves the exact descriptor retryable", async () => {
    fetchFeedMock.mockRejectedValueOnce(new Error("first failure"));
    const feed = makeHarness();
    await feed.loadFeed("replace");

    fetchFeedMock.mockRejectedValueOnce(new Error("second failure"));
    await feed.retryFailedRequest();

    expect(feed.errorMessage.value).toBe("second failure");
    expect(feed.items.value).toEqual([]);
    expect(feed.requestPending.value).toBe(false);

    fetchFeedMock.mockResolvedValueOnce(response([item(1, "recovered after two failures")]));
    await feed.retryFailedRequest();

    expect(fetchFeedMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ tab: "now", page: 1 }),
    );
    expect(fetchFeedMock).toHaveBeenCalledTimes(3);
    expect(feed.items.value.map((entry) => entry.tid)).toEqual([1]);
    expect(feed.errorMessage.value).toBe("");
  });

  it("#8 preserves failure across same tab and reverse-order equal visibility no-ops", async () => {
    fetchFeedMock.mockResolvedValueOnce(response([item(1, "filtered")]));
    const feed = makeHarness();
    await feed.setSelectedVisibilities(new Set(["school", "public"]));

    fetchFeedMock.mockRejectedValueOnce(new Error("refresh remains retryable"));
    await feed.refreshFeed();
    const callsBeforeNoOps = fetchFeedMock.mock.calls.length;

    await feed.switchTab("now");
    await feed.setSelectedVisibilities(new Set(["public", "school"]));

    expect(fetchFeedMock).toHaveBeenCalledTimes(callsBeforeNoOps);
    expect(feed.errorMessage.value).toBe("refresh remains retryable");
    expect(feed.items.value.map((entry) => entry.tid)).toEqual([1]);
    expect(feed.canAutoLoadMore.value).toBe(false);

    const retryAttempt = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(retryAttempt.promise);
    const retry = feed.retryFailedRequest();
    expect(fetchFeedMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ tab: "now", page: 1, visibility: ["public", "school"] }),
    );
    retryAttempt.resolve(response([item(2, "same-context retry result")]));
    await retry;
    expect(feed.items.value.map((entry) => entry.tid)).toEqual([2]);
    expect(feed.errorMessage.value).toBe("");
  });

  it.each(["replace", "refresh", "append"] as const)(
    "#7 settles a never-ending %s request immediately on dispose",
    async (kind) => {
      const neverEnding = deferred<FeedResponse>();
      fetchFeedMock.mockReturnValueOnce(neverEnding.promise);
      const feed = makeHarness();
      if (kind === "append") {
        feed.items.value = [item(1, "committed")];
        feed.page.value = 2;
        feed.hasMore.value = true;
      }

      const request = feed.loadFeed(kind);
      feed.dispose();
      await expectLogicalSettlement(request);

      expect(feed.loading.value).toBe(false);
      expect(feed.refreshing.value).toBe(false);
      expect(feed.loadingMore.value).toBe(false);
      expect(feed.requestPending.value).toBe(false);
    },
  );

  it("#15 settles a deferred exact retry on dispose and rejects its late error write", async () => {
    fetchFeedMock.mockRejectedValueOnce(new Error("original failure"));
    const feed = makeHarness();
    await feed.loadFeed("replace");

    const lateRetry = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(lateRetry.promise);
    const retry = feed.retryFailedRequest();
    expect(feed.errorMessage.value).toBe("original failure");
    expect(feed.loading.value).toBe(true);

    feed.dispose();
    await expectLogicalSettlement(retry);
    expect(feed.loading.value).toBe(false);
    expect(feed.requestPending.value).toBe(false);

    lateRetry.reject(new Error("late retry failure"));
    await Promise.resolve();
    expect(feed.errorMessage.value).toBe("original failure");
    expect(feed.requestPending.value).toBe(false);
  });
});
