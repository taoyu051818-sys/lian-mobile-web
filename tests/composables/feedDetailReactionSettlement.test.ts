import { computed, effectScope, toRaw, type EffectScope } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem, FeedItemId, FeedResponse } from "../../src/types/feed";
import type { PostDetail } from "../../src/types/post";

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

vi.mock("../../src/api/posts", () => ({
  togglePostLike: vi.fn(),
  togglePostSave: vi.fn(),
}));

vi.mock("../../src/platform/browser-storage", () => ({
  GUEST_READ_HISTORY_SCOPE: Object.freeze({ kind: "guest" }),
  accountReadHistoryScope: vi.fn((userId: string) =>
    userId.trim() ? Object.freeze({ kind: "account", userId: userId.trim() }) : null,
  ),
  readHistoryQuery: vi.fn(() => ""),
  rememberReadItem: vi.fn(),
}));

import * as feedApi from "../../src/api/feed";
import * as postsApi from "../../src/api/posts";
import * as profileApi from "../../src/api/profile";
import { usePostReactions } from "../../src/features/detail/usePostReactions";
import { useFeedCardContextActions } from "../../src/features/feed/useFeedCardContextActions";
import { useFeedData } from "../../src/features/feed/useFeedData";

type LikeSettlementInput = Readonly<{
  kind: "like";
  tid: FeedItemId;
  liked: boolean;
  likeCount: number;
}>;

type SaveSettlementInput = Readonly<{
  kind: "save";
  tid: FeedItemId;
  bookmarked: boolean;
}>;

type SettlementInput = LikeSettlementInput | SaveSettlementInput;
type Settlement =
  | Readonly<LikeSettlementInput & { sequence: number }>
  | Readonly<SaveSettlementInput & { sequence: number }>;

interface SettlementPort {
  currentSequence(): number;
  publish(input: SettlementInput): Settlement | null;
  subscribe(listener: (event: Settlement) => void): () => void;
}

interface SettlementModule {
  createPostReactionSettlementChannel(): SettlementPort;
  postReactionSettlements: SettlementPort;
}

type FeedData = ReturnType<typeof useFeedData>;
type Reactions = ReturnType<typeof usePostReactions>;

const fetchFeedMock = vi.mocked(feedApi.fetchFeed);
const fetchAuthMeMock = vi.mocked(profileApi.fetchAuthMe);
const togglePostLikeMock = vi.mocked(postsApi.togglePostLike);
const togglePostSaveMock = vi.mocked(postsApi.togglePostSave);

const SETTLEMENT_MODULE_ID = "../../src/features/reactions/postReactionSettlements.ts";
const activeFeeds: FeedData[] = [];
const activeScopes: EffectScope[] = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

type SettlementModuleLoad =
  | { module: SettlementModule; error?: never }
  | { module: null; error: unknown };

async function loadSettlementModule(): Promise<SettlementModuleLoad> {
  try {
    return { module: await vi.importActual<SettlementModule>(SETTLEMENT_MODULE_ID) };
  } catch (error) {
    return { module: null, error };
  }
}

async function requireSettlementModule(): Promise<SettlementModule | null> {
  const loaded = await loadSettlementModule();
  expect(
    loaded.error,
    "the controlled dynamic import must not hide syntax or initialization errors",
  ).toBeUndefined();
  expect(
    loaded.module,
    "the production settlement module must exist; this is an intentional red-phase assertion",
  ).not.toBeNull();
  return loaded.module;
}

async function createProductionPort(): Promise<SettlementPort | null> {
  const module = await requireSettlementModule();
  return module?.createPostReactionSettlementChannel() ?? null;
}

function feedItem(tid: number, title = `item-${tid}`, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    tid,
    title,
    bodyPreview: `body-${tid}`,
    cover: "",
    primaryTag: "general",
    timeLabel: "now",
    timestampISO: "2026-08-10T00:00:00.000Z",
    likeCount: 4,
    liked: false,
    bookmarked: false,
    locationArea: "campus",
    contentType: "text",
    ...overrides,
  };
}

function feedResponse(
  items: FeedItem[],
  options: Partial<Pick<FeedResponse, "hasMore" | "nextPage" | "tabs">> = {},
): FeedResponse {
  return {
    tabs: options.tabs ?? [
      { id: "now", label: "Now" },
      { id: "featured", label: "Featured" },
    ],
    items,
    hasMore: options.hasMore ?? false,
    nextPage: options.nextPage ?? null,
  };
}

function postSnapshot(
  tid: FeedItemId,
  overrides: Partial<Pick<PostDetail, "liked" | "likeCount" | "bookmarked">> = {},
): PostDetail {
  return {
    tid,
    liked: false,
    likeCount: 4,
    bookmarked: false,
    ...overrides,
  } as PostDetail;
}

function makeFeed(settlements?: SettlementPort): FeedData {
  const feed = settlements
    ? useFeedData({
        detailOpen: () => false,
        closeDetail: vi.fn(),
        settlements,
      })
    : useFeedData({
        detailOpen: () => false,
        closeDetail: vi.fn(),
      });
  activeFeeds.push(feed);
  return feed;
}

function makeReactions(settlements?: SettlementPort) {
  const scope = effectScope();
  activeScopes.push(scope);
  const clearMessages = vi.fn();
  const showError = vi.fn();
  const showMessage = vi.fn();
  let reactions!: Reactions;
  scope.run(() => {
    reactions = settlements
      ? usePostReactions({
          clearMessages,
          showError,
          showMessage,
          settlements,
        })
      : usePostReactions({
          clearMessages,
          showError,
          showMessage,
        });
  });
  return { reactions, scope, clearMessages, showError, showMessage };
}

function publishLike(port: SettlementPort, tid: FeedItemId, liked: boolean, likeCount: number) {
  return port.publish({ kind: "like", tid, liked, likeCount });
}

function publishSave(port: SettlementPort, tid: FeedItemId, bookmarked: boolean) {
  return port.publish({ kind: "save", tid, bookmarked });
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  fetchFeedMock.mockReset();
  fetchFeedMock.mockResolvedValue(feedResponse([]));
  fetchAuthMeMock.mockReset();
  fetchAuthMeMock.mockResolvedValue(null);
  togglePostLikeMock.mockReset();
  togglePostLikeMock.mockImplementation(async (_tid, liked) => ({
    liked,
    likeCount: liked ? 1 : 0,
  }));
  togglePostSaveMock.mockReset();
  togglePostSaveMock.mockImplementation(async (_tid, saved) => ({ saved }));
});

afterEach(() => {
  for (const feed of activeFeeds.splice(0)) feed.dispose();
  for (const scope of activeScopes.splice(0)) scope.stop();
});

describe("postReactionSettlements channel contract", () => {
  it("#1 normalizes and freezes monotonic Like/Save events without advancing for invalid tids", async () => {
    const module = await requireSettlementModule();
    if (!module) return;
    const channel = module.createPostReactionSettlementChannel();
    const listener = vi.fn();
    channel.subscribe(listener);

    const invalidZero = channel.publish({ kind: "like", tid: 0, liked: true, likeCount: 12 });
    const invalidNegative = channel.publish({
      kind: "save",
      tid: -1,
      bookmarked: true,
    });
    const invalidFractional = channel.publish({
      kind: "like",
      tid: 1.5,
      liked: true,
      likeCount: 12,
    });
    expect([invalidZero, invalidNegative, invalidFractional]).toEqual([null, null, null]);
    expect(channel.currentSequence()).toBe(0);
    expect(listener).not.toHaveBeenCalled();

    const fractional = channel.publish({ kind: "like", tid: 1, liked: true, likeCount: 7.9 });
    const negative = channel.publish({ kind: "like", tid: 1, liked: false, likeCount: -3.2 });
    const nan = channel.publish({ kind: "like", tid: 1, liked: true, likeCount: Number.NaN });
    const positiveInfinity = channel.publish({
      kind: "like",
      tid: 1,
      liked: true,
      likeCount: Number.POSITIVE_INFINITY,
    });
    const negativeInfinity = channel.publish({
      kind: "like",
      tid: 1,
      liked: false,
      likeCount: Number.NEGATIVE_INFINITY,
    });
    const saved = channel.publish({ kind: "save", tid: 1, bookmarked: true });

    expect(fractional).toEqual({ sequence: 1, kind: "like", tid: 1, liked: true, likeCount: 7 });
    expect(negative).toEqual({ sequence: 2, kind: "like", tid: 1, liked: false, likeCount: 0 });
    expect(nan).toEqual({ sequence: 3, kind: "like", tid: 1, liked: true, likeCount: 0 });
    expect(positiveInfinity).toEqual({
      sequence: 4,
      kind: "like",
      tid: 1,
      liked: true,
      likeCount: 0,
    });
    expect(negativeInfinity).toEqual({
      sequence: 5,
      kind: "like",
      tid: 1,
      liked: false,
      likeCount: 0,
    });
    expect(saved).toEqual({ sequence: 6, kind: "save", tid: 1, bookmarked: true });
    for (const event of [fractional, negative, nan, positiveInfinity, negativeInfinity, saved]) {
      expect(Object.isFrozen(event)).toBe(true);
    }
    expect(channel.currentSequence()).toBe(6);
  });

  it("#2 isolates throwing listeners, snapshots delivery, preserves re-entrant order, and unsubscribes idempotently", async () => {
    const module = await requireSettlementModule();
    if (!module) return;
    const channel = module.createPostReactionSettlementChannel();
    const received: number[] = [];
    const snapshotListener = vi.fn();
    let unsubscribeSnapshot = () => undefined;
    let reentered = false;

    channel.subscribe((event) => {
      unsubscribeSnapshot();
      if (!reentered && event.kind === "like") {
        reentered = true;
        publishSave(channel, 1, true);
      }
    });
    channel.subscribe(() => {
      throw new Error("isolated listener failure");
    });
    channel.subscribe((event) => received.push(event.sequence));
    unsubscribeSnapshot = channel.subscribe(snapshotListener);

    expect(() => publishLike(channel, 1, true, 5)).not.toThrow();
    expect(received).toEqual([2, 1]);
    expect(snapshotListener).toHaveBeenCalledTimes(1);

    unsubscribeSnapshot();
    unsubscribeSnapshot();
    publishSave(channel, 1, false);
    expect(snapshotListener).toHaveBeenCalledTimes(1);

    const lateSubscriber = vi.fn();
    channel.subscribe(lateSubscriber);
    expect(lateSubscriber).not.toHaveBeenCalled();
    publishSave(channel, 1, true);
    expect(lateSubscriber).toHaveBeenCalledTimes(1);
  });
});

describe("usePostReactions settlement ownership", () => {
  it("#3 publishes only authoritative Like results, including an opposite response and count zero", async () => {
    const port = await createProductionPort();
    if (!port) return;
    const events: Settlement[] = [];
    port.subscribe((event) => events.push(event));
    const first = deferred<{ liked: boolean; likeCount: number }>();
    const second = deferred<{ liked: boolean; likeCount: number }>();
    togglePostLikeMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { reactions } = makeReactions(port);
    reactions.resetReactions(postSnapshot(1));

    const opposite = reactions.handleLike(1, () => true);
    expect(reactions.liked.value).toBe(true);
    expect(reactions.likeCount.value).toBe(5);
    expect(reactions.likeBusy.value).toBe(true);
    expect(events).toEqual([]);

    first.resolve({ liked: false, likeCount: 0 });
    await opposite;
    expect(events).toEqual([{ sequence: 1, kind: "like", tid: 1, liked: false, likeCount: 0 }]);
    expect(reactions.liked.value).toBe(false);
    expect(reactions.likeCount.value).toBe(0);

    const active = reactions.handleLike(1, () => true);
    expect(events).toHaveLength(1);
    second.resolve({ liked: true, likeCount: 9 });
    await active;
    expect(events[1]).toEqual({
      sequence: 2,
      kind: "like",
      tid: 1,
      liked: true,
      likeCount: 9,
    });
  });

  it("#4 publishes the authoritative Save response rather than the optimistic desired value", async () => {
    const port = await createProductionPort();
    if (!port) return;
    const events: Settlement[] = [];
    port.subscribe((event) => events.push(event));
    const request = deferred<{ saved: boolean }>();
    togglePostSaveMock.mockReturnValueOnce(request.promise);
    const { reactions } = makeReactions(port);
    reactions.resetReactions(postSnapshot(1, { bookmarked: false }));

    const action = reactions.handleSave(1, () => true);
    expect(reactions.saved.value).toBe(true);
    expect(events).toEqual([]);
    request.resolve({ saved: false });
    await action;

    expect(reactions.saved.value).toBe(false);
    expect(events).toEqual([{ sequence: 1, kind: "save", tid: 1, bookmarked: false }]);
  });

  it("#5 rolls failures back and makes a false external owner predicate completely silent", async () => {
    const port = await createProductionPort();
    if (!port) return;
    const events: Settlement[] = [];
    port.subscribe((event) => events.push(event));
    const rejection = deferred<{ liked: boolean; likeCount: number }>();
    const staleRejection = deferred<{ liked: boolean; likeCount: number }>();
    const staleSuccess = deferred<{ saved: boolean }>();
    togglePostLikeMock
      .mockReturnValueOnce(rejection.promise)
      .mockReturnValueOnce(staleRejection.promise);
    togglePostSaveMock.mockReturnValueOnce(staleSuccess.promise);
    const harness = makeReactions(port);
    harness.reactions.resetReactions(postSnapshot(1));

    const failed = harness.reactions.handleLike(1, () => true);
    rejection.reject(new Error("like failed"));
    await failed;
    expect(harness.reactions.liked.value).toBe(false);
    expect(harness.reactions.likeCount.value).toBe(4);
    expect(harness.showError).toHaveBeenCalledTimes(1);
    expect(events).toEqual([]);

    let current = true;
    const stale = harness.reactions.handleSave(1, () => current);
    harness.reactions.resetReactions(postSnapshot(1, { bookmarked: true }));
    current = false;
    staleSuccess.resolve({ saved: false });
    await stale;
    expect(harness.reactions.saved.value).toBe(true);
    expect(harness.reactions.saveBusy.value).toBe(false);
    expect(harness.showMessage).not.toHaveBeenCalled();
    expect(events).toEqual([]);

    current = true;
    const staleFailure = harness.reactions.handleLike(1, () => current);
    harness.reactions.resetReactions(postSnapshot(1, { liked: true, likeCount: 30 }));
    current = false;
    staleRejection.reject(new Error("stale rejection"));
    await staleFailure;
    expect(harness.reactions.liked.value).toBe(true);
    expect(harness.reactions.likeCount.value).toBe(30);
    expect(harness.reactions.likeBusy.value).toBe(false);
    expect(harness.showError).toHaveBeenCalledTimes(1);
    expect(events).toEqual([]);
  });

  it("#6 rejects same-tid A1 work after A2 resets even when the old predicate becomes true again", async () => {
    const port = await createProductionPort();
    if (!port) return;
    const events: Settlement[] = [];
    port.subscribe((event) => events.push(event));
    const oldA = deferred<{ liked: boolean; likeCount: number }>();
    const newA = deferred<{ liked: boolean; likeCount: number }>();
    togglePostLikeMock.mockReturnValueOnce(oldA.promise).mockReturnValueOnce(newA.promise);
    const harness = makeReactions(port);
    const currentTid = 1;
    harness.reactions.resetReactions(postSnapshot(1));

    const oldAction = harness.reactions.handleLike(1, () => currentTid === 1);
    harness.reactions.resetReactions(postSnapshot(1, { liked: false, likeCount: 20 }));
    const newAction = harness.reactions.handleLike(1, () => currentTid === 1);
    oldA.resolve({ liked: true, likeCount: 99 });
    await oldAction;

    expect(harness.reactions.liked.value).toBe(true);
    expect(harness.reactions.likeCount.value).toBe(21);
    expect(harness.reactions.likeBusy.value).toBe(true);
    expect(events).toEqual([]);

    newA.resolve({ liked: false, likeCount: 20 });
    await newAction;
    expect(events).toEqual([{ sequence: 1, kind: "like", tid: 1, liked: false, likeCount: 20 }]);
  });

  it("#5/#6 rejects an old same-tid failure without feedback, publication, rollback, or clearing new busy", async () => {
    const port = await createProductionPort();
    if (!port) return;
    const events: Settlement[] = [];
    port.subscribe((event) => events.push(event));
    const oldA = deferred<{ liked: boolean; likeCount: number }>();
    const newA = deferred<{ liked: boolean; likeCount: number }>();
    togglePostLikeMock.mockReturnValueOnce(oldA.promise).mockReturnValueOnce(newA.promise);
    const harness = makeReactions(port);
    let currentTid = 1;
    harness.reactions.resetReactions(postSnapshot(1));
    const oldAction = harness.reactions.handleLike(1, () => currentTid === 1);

    currentTid = 2;
    harness.reactions.resetReactions(postSnapshot(2, { liked: true, likeCount: 8 }));
    currentTid = 1;
    harness.reactions.resetReactions(postSnapshot(1, { liked: false, likeCount: 20 }));
    const newAction = harness.reactions.handleLike(1, () => currentTid === 1);
    oldA.reject(new Error("old A rejection"));
    await oldAction;

    expect(harness.reactions.liked.value).toBe(true);
    expect(harness.reactions.likeCount.value).toBe(21);
    expect(harness.reactions.likeBusy.value).toBe(true);
    expect(harness.showError).not.toHaveBeenCalled();
    expect(events).toEqual([]);

    newA.resolve({ liked: true, likeCount: 21 });
    await newAction;
    expect(events).toEqual([{ sequence: 1, kind: "like", tid: 1, liked: true, likeCount: 21 }]);
  });

  it("#6 rejects A-to-B-to-A Save work and keeps Like/Save tickets independent", async () => {
    const port = await createProductionPort();
    if (!port) return;
    const events: Settlement[] = [];
    port.subscribe((event) => events.push(event));
    const oldSave = deferred<{ saved: boolean }>();
    const newSave = deferred<{ saved: boolean }>();
    const like = deferred<{ liked: boolean; likeCount: number }>();
    togglePostSaveMock.mockReturnValueOnce(oldSave.promise).mockReturnValueOnce(newSave.promise);
    togglePostLikeMock.mockReturnValueOnce(like.promise);
    const harness = makeReactions(port);
    let currentTid = 1;
    harness.reactions.resetReactions(postSnapshot(1));
    const oldAction = harness.reactions.handleSave(1, () => currentTid === 1);

    currentTid = 2;
    harness.reactions.resetReactions(postSnapshot(2));
    currentTid = 1;
    harness.reactions.resetReactions(postSnapshot(1));
    const newSaveAction = harness.reactions.handleSave(1, () => currentTid === 1);
    const likeAction = harness.reactions.handleLike(1, () => currentTid === 1);

    oldSave.resolve({ saved: true });
    await oldAction;
    expect(harness.reactions.saveBusy.value).toBe(true);
    expect(harness.reactions.likeBusy.value).toBe(true);
    expect(events).toEqual([]);

    newSave.resolve({ saved: false });
    await newSaveAction;
    expect(harness.reactions.saveBusy.value).toBe(false);
    expect(harness.reactions.likeBusy.value).toBe(true);
    like.resolve({ liked: true, likeCount: 5 });
    await likeAction;
    expect(events.map((event) => event.kind)).toEqual(["save", "like"]);
  });

  it("#7 makes scope disposal terminal for both pending actions", async () => {
    const port = await createProductionPort();
    if (!port) return;
    const events: Settlement[] = [];
    port.subscribe((event) => events.push(event));
    const like = deferred<{ liked: boolean; likeCount: number }>();
    const save = deferred<{ saved: boolean }>();
    togglePostLikeMock.mockReturnValueOnce(like.promise);
    togglePostSaveMock.mockReturnValueOnce(save.promise);
    const harness = makeReactions(port);
    harness.reactions.resetReactions(postSnapshot(1));
    const likeAction = harness.reactions.handleLike(1, () => true);
    const saveAction = harness.reactions.handleSave(1, () => true);

    harness.scope.stop();
    expect(harness.reactions.likeBusy.value).toBe(false);
    expect(harness.reactions.saveBusy.value).toBe(false);
    const terminal = {
      liked: harness.reactions.liked.value,
      saved: harness.reactions.saved.value,
      likeCount: harness.reactions.likeCount.value,
    };

    like.resolve({ liked: false, likeCount: 99 });
    save.reject(new Error("late save rejection"));
    await Promise.all([likeAction, saveAction]);
    expect({
      liked: harness.reactions.liked.value,
      saved: harness.reactions.saved.value,
      likeCount: harness.reactions.likeCount.value,
    }).toEqual(terminal);
    expect(harness.showMessage).not.toHaveBeenCalled();
    expect(harness.showError).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });
});

describe("mounted Feed settlement projection", () => {
  it("#8 shallow-replaces only the matching item and rebases the real F3e Bookmark owner", async () => {
    const port = await createProductionPort();
    if (!port) return;
    const feed = makeFeed(port);
    const first = feedItem(1, "first", { bookmarked: false });
    const second = feedItem(2, "second", { liked: true, likeCount: 8 });
    feed.items.value = [first, second];
    const matchingBefore = feed.items.value[0];
    const nonmatchingBefore = feed.items.value[1];

    const scope = effectScope();
    activeScopes.push(scope);
    const savePost = vi.fn(async (_tid: FeedItemId, saved: boolean) => ({ saved }));
    let contextActions!: ReturnType<typeof useFeedCardContextActions>;
    scope.run(() => {
      const liveItem = computed(() => feed.items.value.find((item) => item.tid === 1) ?? first);
      contextActions = useFeedCardContextActions({
        item: liveItem,
        title: () => liveItem.value.title,
        emitOpen: vi.fn(),
        dependencies: {
          savePost,
          share: vi.fn(async () => ({ outcome: "cancelled" as const })),
          toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
          haptic: vi.fn(),
        },
      });
    });

    publishLike(port, 1, true, 12);
    publishSave(port, 1, true);
    publishLike(port, 999, true, 1);

    expect(feed.items.value.map((item) => item.tid)).toEqual([1, 2]);
    expect(feed.items.value[0]).not.toBe(matchingBefore);
    expect(feed.items.value[0]).toMatchObject({
      tid: 1,
      title: "first",
      bodyPreview: first.bodyPreview,
      liked: true,
      likeCount: 12,
      bookmarked: true,
    });
    expect(feed.items.value[1]).toBe(nonmatchingBefore);
    expect(contextActions.bookmarked.value).toBe(true);

    const owner = feed.items.value[0];
    expect(contextActions.openMenu({ x: 1, y: 2, target: null, ownerToken: owner })).toBe(true);
    await contextActions.handleBookmark();
    expect(savePost).toHaveBeenCalledWith(1, false);
  });

  it.each(["replace", "refresh", "append"] as const)(
    "#9 keeps post-boundary Like/Save settlements over a stale %s response",
    async (kind) => {
      const port = await createProductionPort();
      if (!port) return;
      const request = deferred<FeedResponse>();
      fetchFeedMock.mockReturnValueOnce(request.promise);
      const feed = makeFeed(port);
      feed.items.value = [feedItem(1, "old title")];
      feed.hasMore.value = true;
      feed.page.value = 2;
      const load = feed.loadFeed(kind);
      expect(fetchFeedMock).toHaveBeenCalledTimes(1);

      publishLike(port, 1, true, 15);
      publishSave(port, 1, true);
      const transportItem = feedItem(1, "new transport title", {
        bodyPreview: "new transport body",
        liked: false,
        likeCount: 4,
        bookmarked: false,
      });
      request.resolve(
        feedResponse([transportItem], {
          hasMore: kind === "append",
          nextPage: kind === "append" ? 3 : null,
        }),
      );
      await load;

      expect(toRaw(feed.items.value[0])).not.toBe(transportItem);
      expect(feed.items.value[0]).toMatchObject({
        title: "new transport title",
        bodyPreview: "new transport body",
        liked: true,
        likeCount: 15,
        bookmarked: true,
      });
    },
  );

  it("#10 lets a response win when settlement precedes owner resolution and physical start", async () => {
    const port = await createProductionPort();
    if (!port) return;
    const auth = deferred<null>();
    const request = deferred<FeedResponse>();
    fetchAuthMeMock.mockReturnValueOnce(auth.promise);
    fetchFeedMock.mockReturnValueOnce(request.promise);
    const feed = makeFeed(port);
    const initialization = feed.initialize();

    publishLike(port, 1, true, 20);
    expect(fetchFeedMock).not.toHaveBeenCalled();
    auth.resolve(null);
    await vi.waitFor(() => expect(fetchFeedMock).toHaveBeenCalledTimes(1));
    request.resolve(feedResponse([feedItem(1, "owner response", { liked: false, likeCount: 4 })]));
    await initialization;

    expect(feed.items.value[0]).toMatchObject({ liked: false, likeCount: 4 });
  });

  it("#10 lets an already-owner-ready later response retire an earlier settlement", async () => {
    const port = await createProductionPort();
    if (!port) return;
    fetchFeedMock.mockResolvedValueOnce(feedResponse([feedItem(1, "initial")]));
    const feed = makeFeed(port);
    await feed.initialize();
    publishLike(port, 1, true, 21);
    expect(feed.items.value[0].liked).toBe(true);

    fetchFeedMock.mockResolvedValueOnce(
      feedResponse([feedItem(1, "server correction", { liked: false, likeCount: 3 })]),
    );
    await feed.refreshFeed();
    expect(feed.items.value[0]).toMatchObject({
      title: "server correction",
      liked: false,
      likeCount: 3,
    });
  });

  it("#11 captures the boundary before invoking a transport that synchronously publishes", async () => {
    const port = await createProductionPort();
    if (!port) return;
    fetchFeedMock.mockImplementationOnce(() => {
      publishLike(port, 1, true, 22);
      return Promise.resolve(
        feedResponse([feedItem(1, "transport", { liked: false, likeCount: 4 })]),
      );
    });
    const feed = makeFeed(port);

    await feed.loadFeed("replace");
    expect(feed.items.value[0]).toMatchObject({ liked: true, likeCount: 22 });
  });

  it("#12 uses newest per-kind sequence instead of re-entrant delivery-stack order", async () => {
    const port = await createProductionPort();
    if (!port) return;
    let nested = false;
    port.subscribe((event) => {
      if (!nested && event.kind === "like" && event.liked) {
        nested = true;
        publishLike(port, event.tid, false, 0);
        publishSave(port, event.tid, true);
      }
    });
    const request = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(request.promise);
    const feed = makeFeed(port);
    const load = feed.loadFeed("replace");

    publishLike(port, 1, true, 10);
    request.resolve(
      feedResponse([feedItem(1, "transport", { liked: true, likeCount: 99, bookmarked: false })]),
    );
    await load;

    expect(feed.items.value[0]).toMatchObject({ liked: false, likeCount: 0, bookmarked: true });
  });

  it("#13 keeps a settlement through request failure but lets the later exact retry respond authoritatively", async () => {
    const port = await createProductionPort();
    if (!port) return;
    const failedRequest = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(failedRequest.promise);
    const feed = makeFeed(port);
    feed.items.value = [feedItem(1, "existing")];
    const refresh = feed.refreshFeed();
    publishLike(port, 1, true, 23);
    failedRequest.reject(new Error("refresh failed"));
    await refresh;

    expect(feed.items.value[0]).toMatchObject({ liked: true, likeCount: 23 });
    expect(feed.errorMessage.value).toBe("refresh failed");

    fetchFeedMock.mockResolvedValueOnce(
      feedResponse([feedItem(1, "retry correction", { liked: false, likeCount: 2 })]),
    );
    await feed.retryFailedRequest();
    expect(feed.items.value[0]).toMatchObject({
      title: "retry correction",
      liked: false,
      likeCount: 2,
    });
    expect(feed.errorMessage.value).toBe("");
  });

  it("#14 keeps request-local boundaries across supersession without reviving unknown or stale items", async () => {
    const port = await createProductionPort();
    if (!port) return;
    const stale = deferred<FeedResponse>();
    const current = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise);
    const feed = makeFeed(port);
    const staleLoad = feed.loadFeed("refresh");
    publishLike(port, 1, true, 30);

    const currentLoad = feed.loadFeed("replace");
    publishSave(port, 1, true);
    publishLike(port, 999, true, 100);
    stale.resolve(feedResponse([feedItem(88, "stale item", { liked: true })]));
    await staleLoad;
    expect(feed.items.value).toEqual([]);
    expect(feed.loading.value).toBe(true);

    current.resolve(
      feedResponse([
        feedItem(1, "current item", { liked: false, likeCount: 3, bookmarked: false }),
      ]),
    );
    await currentLoad;
    expect(feed.items.value.map((item) => item.tid)).toEqual([1]);
    expect(feed.items.value[0]).toMatchObject({
      liked: false,
      likeCount: 3,
      bookmarked: true,
    });
  });

  it("#15 unsubscribes terminal feeds, rejects late transport writes, and provides no replay on remount", async () => {
    const port = await createProductionPort();
    if (!port) return;
    const late = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(late.promise);
    const oldFeed = makeFeed(port);
    oldFeed.items.value = [feedItem(1, "old mounted")];
    const terminalItem = oldFeed.items.value[0];
    let logicallySettled = false;
    const load = oldFeed.refreshFeed().then(() => {
      logicallySettled = true;
    });
    oldFeed.dispose();
    await flushMicrotasks();
    expect(logicallySettled).toBe(true);
    const terminalItems = [...oldFeed.items.value];
    publishLike(port, 1, true, 31);
    late.resolve(feedResponse([feedItem(1, "late response", { liked: true, likeCount: 31 })]));
    await load;

    expect(oldFeed.items.value).toEqual(terminalItems);
    expect(oldFeed.items.value[0]).toBe(terminalItem);
    expect(oldFeed.loading.value).toBe(false);
    expect(oldFeed.refreshing.value).toBe(false);
    expect(oldFeed.loadingMore.value).toBe(false);

    const newFeed = makeFeed(port);
    expect(newFeed.items.value).toEqual([]);
    fetchFeedMock.mockResolvedValueOnce(
      feedResponse([feedItem(1, "new mount response", { liked: false, likeCount: 1 })]),
    );
    await newFeed.loadFeed("replace");
    expect(newFeed.items.value[0]).toMatchObject({ liked: false, likeCount: 1 });
  });

  it("#16 isolates an earlier throwing production subscriber from real Detail-to-Feed settlement", async () => {
    const module = await requireSettlementModule();
    if (!module) return;
    const port = module.createPostReactionSettlementChannel();
    const throwing = port.subscribe(() => {
      throw new Error("subscriber failed");
    });
    const feed = makeFeed(port);
    feed.items.value = [feedItem(1, "mounted")];
    const harness = makeReactions(port);
    harness.reactions.resetReactions(postSnapshot(1));
    togglePostLikeMock.mockResolvedValueOnce({ liked: true, likeCount: 40 });
    togglePostSaveMock.mockResolvedValueOnce({ saved: true });

    await harness.reactions.handleLike(1, () => true);
    await harness.reactions.handleSave(1, () => true);
    expect(harness.showError).not.toHaveBeenCalled();
    expect(harness.reactions.liked.value).toBe(true);
    expect(harness.reactions.saved.value).toBe(true);
    expect(feed.items.value[0]).toMatchObject({ liked: true, likeCount: 40, bookmarked: true });
    throwing();
  });

  it("#17 rejects a Feed callback retained in the channel delivery snapshot after dispose", async () => {
    const port = await createProductionPort();
    if (!port) return;
    const feedHolder: { current: FeedData | null } = { current: null };
    let terminalSnapshot: unknown;
    port.subscribe(() => {
      const currentFeed = feedHolder.current;
      if (!currentFeed) return;
      currentFeed.dispose();
      terminalSnapshot = {
        items: [...currentFeed.items.value],
        error: currentFeed.errorMessage.value,
        loading: currentFeed.loading.value,
        refreshing: currentFeed.refreshing.value,
        loadingMore: currentFeed.loadingMore.value,
      };
    });
    const pending = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(pending.promise);
    const feed = makeFeed(port);
    feedHolder.current = feed;
    feed.items.value = [feedItem(1, "terminal baseline")];
    void feed.refreshFeed();
    expect(feed.refreshing.value).toBe(true);

    publishLike(port, 1, true, 50);
    expect({
      items: feed.items.value,
      error: feed.errorMessage.value,
      loading: feed.loading.value,
      refreshing: feed.refreshing.value,
      loadingMore: feed.loadingMore.value,
    }).toEqual(terminalSnapshot);
    expect(feed.items.value[0]).toMatchObject({ liked: false, likeCount: 4 });
  });

  it("#18 links real Detail success to real Feed through the uninjected production singleton", async () => {
    const module = await requireSettlementModule();
    if (!module) return;
    const singletonEvents: Settlement[] = [];
    const unsubscribe = module.postReactionSettlements.subscribe((event) =>
      singletonEvents.push(event),
    );
    const feed = makeFeed();
    feed.items.value = [feedItem(1, "default singleton item")];
    const harness = makeReactions();
    harness.reactions.resetReactions(postSnapshot(1));
    togglePostLikeMock.mockResolvedValueOnce({ liked: true, likeCount: 60 });

    await harness.reactions.handleLike(1, () => true);
    expect(feed.items.value[0]).toMatchObject({ liked: true, likeCount: 60 });
    expect(harness.reactions.liked.value).toBe(true);
    expect(singletonEvents).toHaveLength(1);
    expect(singletonEvents[0]).toMatchObject({
      kind: "like",
      tid: 1,
      liked: true,
      likeCount: 60,
    });

    module.postReactionSettlements.publish({
      kind: "save",
      tid: 1,
      bookmarked: true,
    });
    expect(feed.items.value[0]).toMatchObject({
      liked: true,
      likeCount: 60,
      bookmarked: true,
    });
    expect(singletonEvents).toHaveLength(2);
    unsubscribe();
  });
});
