import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedResponse } from "../../src/types/feed";
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
  readHistoryQuery: vi.fn(),
  rememberReadItem: vi.fn(),
}));

import * as feedApi from "../../src/api/feed";
import * as profileApi from "../../src/api/profile";
import * as browserStorage from "../../src/platform/browser-storage";
import { useFeedData } from "../../src/features/feed/useFeedData";

const fetchFeedMock = vi.mocked(feedApi.fetchFeed);
const fetchAuthMeMock = vi.mocked(profileApi.fetchAuthMe);
const readHistoryQueryMock = vi.mocked(browserStorage.readHistoryQuery);
const rememberReadItemMock = vi.mocked(browserStorage.rememberReadItem);

const EMPTY_FEED_RESPONSE: FeedResponse = {
  tabs: [{ id: "now", label: "Now" }],
  items: [],
  hasMore: false,
  nextPage: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function makeHarness() {
  return useFeedData({ detailOpen: () => false, closeDetail: vi.fn() });
}

beforeEach(() => {
  fetchFeedMock.mockReset();
  fetchFeedMock.mockResolvedValue(EMPTY_FEED_RESPONSE);
  fetchAuthMeMock.mockReset();
  readHistoryQueryMock.mockReset();
  readHistoryQueryMock.mockImplementation((scope) => {
    if (scope.kind === "guest") return "303";
    if (scope.userId === "user-a") return "101";
    if (scope.userId === "user-b") return "202";
    return "";
  });
  rememberReadItemMock.mockReset();
});

describe("useFeedData read-history ownership", () => {
  it("waits for account ownership before the first request and scopes reads and writes to A", async () => {
    const auth = deferred<ProfileUser | null>();
    fetchAuthMeMock.mockReturnValueOnce(auth.promise);
    const feed = makeHarness();

    const initialization = feed.initialize();
    await Promise.resolve();

    expect(fetchFeedMock).not.toHaveBeenCalled();
    expect(readHistoryQueryMock).not.toHaveBeenCalled();

    auth.resolve({ id: "user-a" });
    await initialization;

    const accountA = { kind: "account", userId: "user-a" } as const;
    expect(readHistoryQueryMock).toHaveBeenCalledWith(accountA);
    expect(fetchFeedMock).toHaveBeenCalledWith(expect.objectContaining({ read: "101" }));

    feed.rememberReadItem(909);
    expect(rememberReadItemMock).toHaveBeenCalledWith(accountA, 909);
  });

  it("keeps independent A and B mounts on independent scopes", async () => {
    fetchAuthMeMock.mockResolvedValueOnce({ id: "user-a" }).mockResolvedValueOnce({ id: "user-b" });
    const feedA = makeHarness();
    const feedB = makeHarness();

    await feedA.initialize();
    feedA.rememberReadItem(111);
    await feedB.initialize();
    feedB.rememberReadItem(222);

    expect(fetchFeedMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ read: "101" }));
    expect(fetchFeedMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ read: "202" }));
    expect(rememberReadItemMock).toHaveBeenNthCalledWith(
      1,
      { kind: "account", userId: "user-a" },
      111,
    );
    expect(rememberReadItemMock).toHaveBeenNthCalledWith(
      2,
      { kind: "account", userId: "user-b" },
      222,
    );
  });

  it("uses guest history only after auth explicitly resolves null", async () => {
    fetchAuthMeMock.mockResolvedValueOnce(null);
    const feed = makeHarness();

    await feed.initialize();
    feed.rememberReadItem(404);

    expect(readHistoryQueryMock).toHaveBeenCalledWith(browserStorage.GUEST_READ_HISTORY_SCOPE);
    expect(fetchFeedMock).toHaveBeenCalledWith(expect.objectContaining({ read: "303" }));
    expect(rememberReadItemMock).toHaveBeenCalledWith(browserStorage.GUEST_READ_HISTORY_SCOPE, 404);
  });

  it("loads without read ownership when auth lookup rejects", async () => {
    fetchAuthMeMock.mockRejectedValueOnce(new Error("auth unavailable"));
    const feed = makeHarness();

    await feed.initialize();
    feed.rememberReadItem(505);

    expect(fetchFeedMock).toHaveBeenCalledTimes(1);
    expect(fetchFeedMock.mock.calls[0][0].read).toBeUndefined();
    expect(readHistoryQueryMock).not.toHaveBeenCalled();
    expect(rememberReadItemMock).not.toHaveBeenCalled();
    expect(feed.errorMessage.value).toBe("");
  });

  it("does not fall back to guest when an authenticated user has no usable id", async () => {
    fetchAuthMeMock.mockResolvedValueOnce({ username: "missing-id" });
    const feed = makeHarness();

    await feed.initialize();
    feed.rememberReadItem(606);

    expect(fetchFeedMock).toHaveBeenCalledTimes(1);
    expect(fetchFeedMock.mock.calls[0][0].read).toBeUndefined();
    expect(readHistoryQueryMock).not.toHaveBeenCalled();
    expect(rememberReadItemMock).not.toHaveBeenCalled();
  });

  it("drops a late identity after dispose and lets a new B instance own only B history", async () => {
    const accountAAuth = deferred<ProfileUser | null>();
    fetchAuthMeMock
      .mockReturnValueOnce(accountAAuth.promise)
      .mockResolvedValueOnce({ id: "user-b" });
    const feedA = makeHarness();

    const accountAInitialization = feedA.initialize();
    feedA.dispose();
    accountAAuth.resolve({ id: "user-a" });
    await accountAInitialization;
    feedA.rememberReadItem(111);

    expect(fetchFeedMock).not.toHaveBeenCalled();
    expect(readHistoryQueryMock).not.toHaveBeenCalled();
    expect(rememberReadItemMock).not.toHaveBeenCalled();

    const feedB = makeHarness();
    await feedB.initialize();
    feedB.rememberReadItem(222);

    expect(fetchFeedMock).toHaveBeenCalledTimes(1);
    expect(fetchFeedMock).toHaveBeenCalledWith(expect.objectContaining({ read: "202" }));
    expect(readHistoryQueryMock).toHaveBeenCalledWith({ kind: "account", userId: "user-b" });
    expect(rememberReadItemMock).toHaveBeenCalledWith({ kind: "account", userId: "user-b" }, 222);
  });

  it("coalesces resolving load, tab, and filter intents into one latest-context request", async () => {
    const auth = deferred<ProfileUser | null>();
    fetchAuthMeMock.mockReturnValueOnce(auth.promise);
    const feed = makeHarness();

    const initialization = feed.initialize();
    const directLoad = feed.loadFeed(true);
    feed.switchTab("featured");
    feed.setSelectedVisibilities(new Set(["school"]));

    await Promise.resolve();
    expect(fetchFeedMock).not.toHaveBeenCalled();

    auth.resolve({ id: "user-a" });
    await Promise.all([initialization, directLoad]);

    expect(fetchFeedMock).toHaveBeenCalledTimes(1);
    expect(fetchFeedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tab: "featured",
        page: 1,
        read: "101",
        visibility: ["school"],
      }),
    );
  });
});
