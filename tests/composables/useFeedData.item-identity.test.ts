import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem, FeedResponse } from "../../src/types/feed";

vi.mock("../../src/api/feed", () => ({
  DEFAULT_TABS: [
    { id: "now", label: "Now" },
    { id: "featured", label: "Featured" },
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

function feedItem(tid: number, title: string, overrides: Partial<FeedItem> = {}): FeedItem {
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

function feedResponse(
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

beforeEach(() => {
  fetchFeedMock.mockReset();
});

describe("useFeedData stable item identity", () => {
  it("collapses reset-response duplicates into the first slot with the latest snapshot", async () => {
    const oldSnapshot = feedItem(1, "old title", {
      bodyPreview: "old body",
      likeCount: 1,
      liked: false,
      relationHint: { type: "old-relation", targetTid: 99 },
    });
    const latestSnapshot = feedItem(1, "latest title", {
      bodyPreview: "latest body",
      likeCount: 8,
      liked: true,
    });
    const secondItem = feedItem(2, "second item");
    fetchFeedMock.mockResolvedValueOnce(feedResponse([oldSnapshot, latestSnapshot, secondItem]));
    const feed = makeHarness();

    await feed.loadFeed(true);

    expect(feed.items.value.map((item) => item.tid)).toEqual([1, 2]);
    expect(feed.items.value[0]).toEqual(latestSnapshot);
    expect(feed.items.value[0].relationHint).toBeUndefined();
    expect(feed.items.value[1]).toEqual(secondItem);
  });

  it("updates an overlapping page item in place and appends only new identities", async () => {
    const firstItem = feedItem(1, "first item");
    const oldSecondSnapshot = feedItem(2, "old second", {
      bodyPreview: "old body",
      likeCount: 2,
    });
    const latestSecondSnapshot = feedItem(2, "latest second", {
      bodyPreview: "latest body",
      likeCount: 12,
      liked: true,
    });
    const thirdItem = feedItem(3, "third item");
    fetchFeedMock
      .mockResolvedValueOnce(
        feedResponse([firstItem, oldSecondSnapshot], { hasMore: true, nextPage: 2 }),
      )
      .mockResolvedValueOnce(
        feedResponse([latestSecondSnapshot, thirdItem], { hasMore: true, nextPage: 7 }),
      );
    const feed = makeHarness();

    await feed.loadFeed(true);
    await feed.loadFeed(false);

    expect(fetchFeedMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2 }));
    expect(feed.items.value.map((item) => item.tid)).toEqual([1, 2, 3]);
    expect(feed.items.value[0]).toEqual(firstItem);
    expect(feed.items.value[1]).toEqual(latestSecondSnapshot);
    expect(feed.items.value[2]).toEqual(thirdItem);
    expect(feed.page.value).toBe(7);
    expect(feed.hasMore.value).toBe(true);
  });

  it("starts a reset from an empty context instead of merging prior items", async () => {
    fetchFeedMock
      .mockResolvedValueOnce(feedResponse([feedItem(1, "old context")]))
      .mockResolvedValueOnce(feedResponse([feedItem(9, "new context")]));
    const feed = makeHarness();

    await feed.loadFeed(true);
    await feed.loadFeed(true);

    expect(feed.items.value.map((item) => item.tid)).toEqual([9]);
  });

  it("keeps equal-looking items separate when their identities differ", async () => {
    const firstItem = feedItem(10, "same title", { bodyPreview: "same body" });
    const secondItem = feedItem(11, "same title", { bodyPreview: "same body" });
    fetchFeedMock.mockResolvedValueOnce(feedResponse([firstItem, secondItem]));
    const feed = makeHarness();

    await feed.loadFeed(true);

    expect(feed.items.value).toEqual([firstItem, secondItem]);
  });

  it("preserves non-positive ids without inventing an invalid-item identity policy", async () => {
    const invalidItems = [
      feedItem(0, "first zero id"),
      feedItem(0, "second zero id"),
      feedItem(-1, "first negative id"),
      feedItem(-1, "second negative id"),
    ];
    fetchFeedMock.mockResolvedValueOnce(feedResponse(invalidItems));
    const feed = makeHarness();

    await feed.loadFeed(true);

    expect(feed.items.value).toEqual(invalidItems);
  });

  it("does not let a superseded pagination response revive reset context or flags", async () => {
    const stalePagination = deferred<FeedResponse>();
    const latestReset = deferred<FeedResponse>();
    fetchFeedMock
      .mockResolvedValueOnce(
        feedResponse([feedItem(1, "initial context")], { hasMore: true, nextPage: 2 }),
      )
      .mockReturnValueOnce(stalePagination.promise)
      .mockReturnValueOnce(latestReset.promise);
    const feed = makeHarness();

    await feed.loadFeed(true);
    const paginationLoad = feed.loadFeed(false);
    expect(feed.loadingMore.value).toBe(true);

    const resetLoad = feed.loadFeed(true);
    expect(feed.loading.value).toBe(true);
    expect(feed.loadingMore.value).toBe(false);

    latestReset.resolve(feedResponse([feedItem(9, "latest reset context")]));
    await resetLoad;

    expect(feed.items.value.map((item) => item.tid)).toEqual([9]);
    expect(feed.page.value).toBe(2);
    expect(feed.hasMore.value).toBe(false);
    expect(feed.loading.value).toBe(false);
    expect(feed.loadingMore.value).toBe(false);

    stalePagination.resolve(
      feedResponse([feedItem(1, "stale initial item"), feedItem(2, "stale page item")], {
        hasMore: true,
        nextPage: 50,
      }),
    );
    await paginationLoad;

    expect(feed.items.value.map((item) => item.tid)).toEqual([9]);
    expect(feed.page.value).toBe(2);
    expect(feed.hasMore.value).toBe(false);
    expect(feed.loading.value).toBe(false);
    expect(feed.loadingMore.value).toBe(false);
    expect(feed.errorMessage.value).toBe("");
  });
});
