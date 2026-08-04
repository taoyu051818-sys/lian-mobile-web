import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem, FeedResponse } from "../../src/types/feed";

vi.mock("../../src/api/feed", () => ({
  DEFAULT_TABS: [
    { id: "此刻", label: "此刻" },
    { id: "精选", label: "精选" },
  ],
  fetchFeed: vi.fn(),
}));

vi.mock("../../src/platform/browser-storage", () => ({
  readHistoryQuery: vi.fn(() => ""),
  rememberReadItem: vi.fn(),
}));

import * as feedApi from "../../src/api/feed";
import { useFeedData } from "../../src/features/feed/useFeedData";

const fetchFeedMock = vi.mocked(feedApi.fetchFeed);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function feedItem(tid: number, title: string): FeedItem {
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
  };
}

function feedResponse(items: FeedItem[]): FeedResponse {
  return {
    tabs: [
      { id: "此刻", label: "此刻" },
      { id: "精选", label: "精选" },
    ],
    items,
    hasMore: false,
    nextPage: null,
  };
}

function makeHarness() {
  return useFeedData({ detailOpen: () => false, closeDetail: vi.fn() });
}

beforeEach(() => {
  fetchFeedMock.mockReset();
});

describe("useFeedData request generation", () => {
  it("keeps the latest tab loading when the superseded request finishes first", async () => {
    const oldRequest = deferred<FeedResponse>();
    const latestRequest = deferred<FeedResponse>();
    fetchFeedMock
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(latestRequest.promise);
    const feed = makeHarness();

    const oldLoad = feed.loadFeed(true);
    feed.switchTab("精选");

    expect(fetchFeedMock).toHaveBeenCalledTimes(2);
    expect(fetchFeedMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ tab: "精选" }));
    expect(feed.loading.value).toBe(true);

    oldRequest.resolve(feedResponse([feedItem(1, "旧的此刻内容")]));
    await oldLoad;

    expect(feed.activeTab.value).toBe("精选");
    expect(feed.items.value).toEqual([]);
    expect(feed.loading.value).toBe(true);

    latestRequest.resolve(feedResponse([feedItem(2, "最新精选内容")]));
    await vi.waitFor(() => expect(feed.loading.value).toBe(false));

    expect(feed.items.value.map((item) => item.title)).toEqual(["最新精选内容"]);
  });

  it("ignores an old response that arrives after the latest visibility filter", async () => {
    const oldRequest = deferred<FeedResponse>();
    const latestRequest = deferred<FeedResponse>();
    fetchFeedMock
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(latestRequest.promise);
    const feed = makeHarness();

    const oldLoad = feed.loadFeed(true);
    feed.setSelectedVisibilities(new Set(["school"]));

    expect(fetchFeedMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ visibility: ["school"] }),
    );

    latestRequest.resolve(feedResponse([feedItem(3, "当前筛选结果")]));
    await vi.waitFor(() =>
      expect(feed.items.value.map((item) => item.title)).toEqual(["当前筛选结果"]),
    );

    oldRequest.resolve(feedResponse([feedItem(4, "迟到的未筛选结果")]));
    await oldLoad;

    expect(feed.items.value.map((item) => item.title)).toEqual(["当前筛选结果"]);
    expect(feed.errorMessage.value).toBe("");
    expect(feed.loading.value).toBe(false);
  });
});
