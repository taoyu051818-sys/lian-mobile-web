import { effectScope, ref, toRaw, watch, type EffectScope, type Ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem, FeedItemId } from "../../src/types/feed";
import type { PostDetail } from "../../src/types/post";

vi.mock("../../src/api/posts", () => ({
  fetchPostDetail: vi.fn(),
  togglePostLike: vi.fn(),
  togglePostSave: vi.fn(),
}));

import * as postsApi from "../../src/api/posts";
import { fetchDetailWithToken, type DetailDispatch } from "../../src/app/detail-navigation/fetcher";
import {
  __resetStoreForTesting,
  dispatch,
  getDetailStateRef,
} from "../../src/app/detail-navigation/store";
import type { DetailAction, DetailState } from "../../src/app/detail-navigation/state";
import { usePostReactions } from "../../src/features/detail/usePostReactions";
import { useFeedCardContextActions } from "../../src/features/feed/useFeedCardContextActions";
import { useFeedCardLike } from "../../src/features/feed/useFeedCardLike";
import {
  createPostReactionSettlementChannel,
  postReactionSettlements,
  type PostReactionSettlement,
  type PostReactionSettlementPort,
} from "../../src/features/reactions";

type ToggleLike = typeof postsApi.togglePostLike;
type Reactions = ReturnType<typeof usePostReactions> & { dispose?: () => void };
type FooterLike = ReturnType<typeof useFeedCardLike>;
type ContextActions = ReturnType<typeof useFeedCardContextActions>;

interface RedFetchOptions {
  settlements?: PostReactionSettlementPort;
  signal?: AbortSignal;
}

const fetchWithOptions = fetchDetailWithToken as unknown as (
  tid: number,
  token: number,
  dispatchAction: DetailDispatch,
  options?: RedFetchOptions,
) => Promise<void>;

const fetchPostDetailMock = vi.mocked(postsApi.fetchPostDetail);
const togglePostLikeMock = vi.mocked(postsApi.togglePostLike);
const togglePostSaveMock = vi.mocked(postsApi.togglePostSave);

const activeScopes: EffectScope[] = [];
const activeUnsubscribers: Array<() => void> = [];
const activeRestorers: Array<() => void> = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function postSnapshot(tid: FeedItemId, overrides: Partial<PostDetail> = {}): PostDetail {
  const actor = { id: `actor-${tid}`, name: `Actor ${tid}`, avatar: "" };
  return {
    tid,
    title: `post-${tid}`,
    cover: "",
    primaryTag: "general",
    actor,
    timeLabel: "now",
    timestampISO: "2026-08-11T00:00:00.000Z",
    likeCount: 4,
    liked: false,
    locationArea: "campus",
    contentHtml: `<p>body-${tid}</p>`,
    imageUrls: [`image-${tid}`],
    sourceUrl: `https://example.invalid/post/${tid}`,
    replies: [],
    bookmarked: false,
    ...overrides,
  } as PostDetail;
}

function feedItem(tid: FeedItemId, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    tid,
    title: `feed-${tid}`,
    bodyPreview: `body-${tid}`,
    cover: "",
    primaryTag: "general",
    timeLabel: "now",
    timestampISO: "2026-08-11T00:00:00.000Z",
    likeCount: 4,
    liked: false,
    bookmarked: false,
    locationArea: "campus",
    contentType: "text",
    ...overrides,
  };
}

function serializeNonReactionFields(post: PostDetail): string {
  const record = { ...(toRaw(post) as PostDetail) } as Record<PropertyKey, unknown>;
  delete record.liked;
  delete record.likeCount;
  delete record.bookmarked;
  return JSON.stringify(record);
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function publishLike(
  port: PostReactionSettlementPort,
  tid: FeedItemId,
  liked: boolean,
  likeCount: number,
) {
  return port.publish({ kind: "like", tid, liked, likeCount });
}

function publishSave(port: PostReactionSettlementPort, tid: FeedItemId, bookmarked: boolean) {
  return port.publish({ kind: "save", tid, bookmarked });
}

function collectEvents(port: PostReactionSettlementPort): PostReactionSettlement[] {
  const events: PostReactionSettlement[] = [];
  activeUnsubscribers.push(port.subscribe((event) => events.push(event)));
  return events;
}

function makeReactions(
  options: {
    settlements?: PostReactionSettlementPort;
    clearMessages?: () => void;
    showError?: (error: unknown, fallback: string) => void;
    showMessage?: (message: string) => void;
  } = {},
) {
  const scope = effectScope();
  activeScopes.push(scope);
  const clearMessages = options.clearMessages ?? vi.fn();
  const showError = options.showError ?? vi.fn();
  const showMessage = options.showMessage ?? vi.fn();
  let reactions!: Reactions;
  scope.run(() => {
    reactions = usePostReactions({
      clearMessages,
      showError,
      showMessage,
      ...(options.settlements ? { settlements: options.settlements } : {}),
    }) as Reactions;
  });
  return { reactions, scope, clearMessages, showError, showMessage };
}

function makeFooterProducer(
  options: {
    tid?: Ref<FeedItemId>;
    liked?: Ref<boolean | undefined>;
    likeCount?: Ref<number | undefined>;
    settlements?: PostReactionSettlementPort;
    toggleLike?: ReturnType<typeof vi.fn<ToggleLike>>;
    productionApi?: boolean;
  } = {},
) {
  const tid = options.tid ?? ref<FeedItemId>(1);
  const liked = options.liked ?? ref<boolean | undefined>(false);
  const likeCount = options.likeCount ?? ref<number | undefined>(4);
  const toggleLike =
    options.toggleLike ??
    vi.fn<ToggleLike>(async (_tid, desired) => ({
      liked: desired,
      likeCount: desired ? 5 : 3,
    }));
  const scope = effectScope();
  activeScopes.push(scope);
  let controller!: FooterLike;
  scope.run(() => {
    controller = useFeedCardLike({
      tid,
      liked,
      likeCount,
      ...(options.settlements ? { settlements: options.settlements } : {}),
      ...(options.productionApi ? {} : { dependencies: { toggleLike } }),
    });
  });
  return { controller, scope, tid, liked, likeCount, toggleLike };
}

function makeContextProducer(
  options: {
    item?: Ref<FeedItem>;
    settlements?: PostReactionSettlementPort;
  } = {},
) {
  const item = options.item ?? ref(feedItem(1));
  const scope = effectScope();
  activeScopes.push(scope);
  let actions!: ContextActions;
  scope.run(() => {
    actions = useFeedCardContextActions({
      item,
      title: () => item.value.title,
      emitOpen: vi.fn(),
      ...(options.settlements ? { settlements: options.settlements } : {}),
    });
  });
  return { actions, scope, item };
}

function openContext(harness: ReturnType<typeof makeContextProducer>): void {
  expect(
    harness.actions.openMenu({
      x: 10,
      y: 20,
      target: null,
      ownerToken: harness.item.value,
    }),
  ).toBe(true);
}

function installReady(post: PostDetail): Extract<DetailState, { kind: "ready" }> {
  fetchPostDetailMock.mockReturnValueOnce(new Promise<PostDetail>(() => {}));
  dispatch({ type: "url-sync", tid: post.tid });
  const loading = getDetailStateRef().value;
  expect(loading.kind).toBe("loading");
  if (loading.kind !== "loading") throw new Error("expected loading state");
  dispatch({
    type: "fetch-result",
    token: loading.token,
    result: { ok: post },
  });
  const ready = getDetailStateRef().value;
  expect(ready.kind).toBe("ready");
  if (ready.kind !== "ready") throw new Error("expected ready state");
  return ready;
}

function successfulPost(action: DetailAction | undefined): PostDetail {
  if (action?.type !== "fetch-result" || !("ok" in action.result)) {
    throw new Error("expected successful fetch-result action");
  }
  return action.result.ok;
}

function failedAction(action: DetailAction | undefined): DetailAction {
  if (action?.type !== "fetch-result" || !("err" in action.result)) {
    throw new Error("expected failed fetch-result action");
  }
  return action;
}

function trackedPort(
  base: PostReactionSettlementPort,
  hooks: {
    onSubscribe?: () => void;
    onCurrentSequence?: () => void;
  } = {},
) {
  let active = 0;
  const transitions: string[] = [];
  const port: PostReactionSettlementPort = {
    publish(input) {
      return base.publish(input);
    },
    subscribe(listener) {
      const unsubscribeBase = base.subscribe(listener);
      active += 1;
      transitions.push("subscribe");
      hooks.onSubscribe?.();
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        active -= 1;
        transitions.push("unsubscribe");
        unsubscribeBase();
      };
    },
    currentSequence() {
      hooks.onCurrentSequence?.();
      return base.currentSequence();
    },
  };
  return {
    port,
    transitions,
    active: () => active,
  };
}

function trackSingletonRequestSubscriptions() {
  const baseSubscribe = postReactionSettlements.subscribe.bind(postReactionSettlements);
  let active = 0;
  const transitions: string[] = [];
  const spy = vi.spyOn(postReactionSettlements, "subscribe").mockImplementation((listener) => {
    const unsubscribeBase = baseSubscribe(listener);
    active += 1;
    transitions.push("subscribe");
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      active -= 1;
      transitions.push("unsubscribe");
      unsubscribeBase();
    };
  });
  activeRestorers.push(() => spy.mockRestore());
  return { active: () => active, transitions };
}

beforeEach(() => {
  __resetStoreForTesting();
  fetchPostDetailMock.mockReset();
  fetchPostDetailMock.mockResolvedValue(postSnapshot(1));
  togglePostLikeMock.mockReset();
  togglePostLikeMock.mockImplementation(async (_tid, desired) => ({
    liked: desired,
    likeCount: desired ? 5 : 3,
  }));
  togglePostSaveMock.mockReset();
  togglePostSaveMock.mockImplementation(async (_tid, desired) => ({ saved: desired }));
});

afterEach(() => {
  for (const unsubscribe of activeUnsubscribers.splice(0)) unsubscribe();
  for (const scope of activeScopes.splice(0)) scope.stop();
  __resetStoreForTesting();
  for (const restore of activeRestorers.splice(0)) restore();
});

describe("mounted Detail ready settlement ownership", () => {
  it("#1 projects real Footer Like and Context Save in place into ready store and local refs", async () => {
    const response = postSnapshot(1, {
      liked: false,
      likeCount: 4,
      bookmarked: false,
      title: "transport title",
    });
    const ready = installReady(response);
    const stateBefore = getDetailStateRef().value;
    const postBefore = ready.post;
    const rawBefore = toRaw(postBefore);
    const actorBefore = postBefore.actor;
    const imagesBefore = postBefore.imageUrls;
    const nonReactionJsonBefore = serializeNonReactionFields(postBefore);
    const reactionKeys = new Set<PropertyKey>(["liked", "likeCount", "bookmarked"]);
    const nonReactionBefore = Reflect.ownKeys(rawBefore)
      .filter((key) => !reactionKeys.has(key))
      .map((key) => [key, Reflect.get(postBefore, key)] as const);
    const unrelatedLocal = ref({ openReply: true });
    const detail = makeReactions();
    detail.reactions.resetReactions(postBefore);

    const footerRequest = deferred<{ liked: boolean; likeCount: number }>();
    const footer = makeFooterProducer({
      productionApi: true,
      liked: ref(false),
      likeCount: ref(4),
    });
    togglePostLikeMock.mockReturnValueOnce(footerRequest.promise);
    const likeAction = footer.controller.handleLike();
    footerRequest.resolve({ liked: true, likeCount: 8.9 });
    await likeAction;

    const afterLike = getDetailStateRef().value;
    expect(afterLike.kind).toBe("ready");
    if (afterLike.kind !== "ready") return;
    expect(afterLike).toBe(stateBefore);
    expect(afterLike.post).toBe(postBefore);
    expect(afterLike.post).toMatchObject({ liked: true, likeCount: 8, bookmarked: false });
    expect(serializeNonReactionFields(afterLike.post)).toBe(nonReactionJsonBefore);
    expect(detail.reactions.liked.value).toBe(true);
    expect(detail.reactions.likeCount.value).toBe(8);
    expect(detail.reactions.saved.value).toBe(false);

    const contextRequest = deferred<{ saved: boolean }>();
    const context = makeContextProducer();
    togglePostSaveMock.mockReturnValueOnce(contextRequest.promise);
    openContext(context);
    const saveAction = context.actions.handleBookmark();
    contextRequest.resolve({ saved: true });
    await saveAction;

    const stateAfter = getDetailStateRef().value;
    expect(stateAfter).toBe(stateBefore);
    expect(stateAfter.kind).toBe("ready");
    if (stateAfter.kind !== "ready") return;
    expect(stateAfter.post).toBe(postBefore);
    expect(toRaw(stateAfter.post)).toBe(rawBefore);
    expect(stateAfter.post.actor).toBe(actorBefore);
    expect(stateAfter.post.imageUrls).toBe(imagesBefore);
    for (const [key, value] of nonReactionBefore) {
      expect(Reflect.get(stateAfter.post, key)).toBe(value);
    }
    expect(serializeNonReactionFields(stateAfter.post)).toBe(nonReactionJsonBefore);
    expect(stateAfter.post).toMatchObject({
      title: "transport title",
      liked: true,
      likeCount: 8,
      bookmarked: true,
    });
    expect(detail.reactions.liked.value).toBe(true);
    expect(detail.reactions.likeCount.value).toBe(8);
    expect(detail.reactions.saved.value).toBe(true);
    expect(detail.showMessage).not.toHaveBeenCalled();
    expect(detail.showError).not.toHaveBeenCalled();
    expect(unrelatedLocal.value).toEqual({ openReply: true });

    const stableSnapshot = { ...stateAfter.post };
    expect(publishLike(postReactionSettlements, 0, false, 99)).toBeNull();
    publishSave(postReactionSettlements, 2, false);
    expect(stateAfter.post).toMatchObject(stableSnapshot);

    fetchPostDetailMock.mockReturnValueOnce(new Promise<PostDetail>(() => {}));
    dispatch({ type: "open", tid: 1, source: "retry" });
    const mismatchedLoading = getDetailStateRef().value;
    if (mismatchedLoading.kind !== "loading") {
      throw new Error("expected mismatched-owner loading state");
    }
    dispatch({
      type: "fetch-result",
      token: mismatchedLoading.token,
      result: {
        ok: postSnapshot(2, { liked: false, likeCount: 3, bookmarked: false }),
      },
    });
    const mismatchedReady = getDetailStateRef().value;
    expect(mismatchedReady).toMatchObject({ kind: "ready", tid: 1 });
    if (mismatchedReady.kind !== "ready") return;
    const mismatchedStateIdentity = mismatchedReady;
    const mismatchedPostIdentity = mismatchedReady.post;
    publishLike(postReactionSettlements, 1, true, 90);
    publishLike(postReactionSettlements, 2, true, 91);
    publishSave(postReactionSettlements, 1, true);
    publishSave(postReactionSettlements, 2, true);
    expect(getDetailStateRef().value).toBe(mismatchedStateIdentity);
    expect(mismatchedReady.post).toBe(mismatchedPostIdentity);
    expect(mismatchedReady.post).toMatchObject({
      tid: 2,
      liked: false,
      likeCount: 3,
      bookmarked: false,
    });
  });

  it("#1 closes the accepted-result to Vue-reset handoff gap without replacing the post", () => {
    const detail = makeReactions();
    detail.reactions.resetReactions(null);
    const staleResponse = postSnapshot(1, {
      liked: false,
      likeCount: 2,
      bookmarked: false,
    });
    const ready = installReady(staleResponse);
    const readyPost = ready.post;

    publishLike(postReactionSettlements, 1, true, 12.8);
    publishSave(postReactionSettlements, 1, true);

    expect(ready.post).toBe(readyPost);
    expect(ready.post).toMatchObject({ liked: true, likeCount: 12, bookmarked: true });
    expect(detail.reactions.liked.value).toBe(false);
    expect(detail.reactions.saved.value).toBe(false);

    detail.reactions.resetReactions(ready.post);
    expect(detail.reactions.liked.value).toBe(true);
    expect(detail.reactions.likeCount.value).toBe(12);
    expect(detail.reactions.saved.value).toBe(true);
  });

  it("#2 treats settlement as soft rebase but same-tid snapshot as a hard boundary", async () => {
    const port = createPostReactionSettlementChannel();
    const events = collectEvents(port);
    const likeRequest = deferred<{ liked: boolean; likeCount: number }>();
    togglePostLikeMock.mockReturnValueOnce(likeRequest.promise);
    const detail = makeReactions({ settlements: port });
    detail.reactions.resetReactions(postSnapshot(1, { liked: false, likeCount: 4 }));
    const action = detail.reactions.handleLike(1);
    expect(detail.reactions.likeBusy.value).toBe(true);

    publishLike(port, 1, true, 20);
    expect(detail.reactions.likeBusy.value).toBe(true);
    expect(detail.reactions.likeCount.value).toBe(20);

    detail.reactions.resetReactions(postSnapshot(1, { liked: false, likeCount: 7 }));
    expect(detail.reactions.likeBusy.value).toBe(false);
    likeRequest.resolve({ liked: true, likeCount: 99 });
    await action;
    expect(detail.reactions.liked.value).toBe(false);
    expect(detail.reactions.likeCount.value).toBe(7);
    expect(detail.showMessage).not.toHaveBeenCalled();
    expect(detail.showError).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "like", tid: 1, liked: true, likeCount: 20 });
  });

  it("#2 permanently stales old work across A-B-A snapshots", async () => {
    const port = createPostReactionSettlementChannel();
    const request = deferred<{ liked: boolean; likeCount: number }>();
    togglePostLikeMock.mockReturnValueOnce(request.promise);
    const events = collectEvents(port);
    const detail = makeReactions({ settlements: port });
    detail.reactions.resetReactions(postSnapshot(1, { liked: false, likeCount: 4 }));
    const action = detail.reactions.handleLike(1);
    detail.reactions.resetReactions(postSnapshot(2, { liked: true, likeCount: 30 }));
    detail.reactions.resetReactions(postSnapshot(1, { liked: false, likeCount: 9 }));

    request.resolve({ liked: true, likeCount: 99 });
    await action;

    expect(detail.reactions.liked.value).toBe(false);
    expect(detail.reactions.likeCount.value).toBe(9);
    expect(detail.reactions.likeBusy.value).toBe(false);
    expect(detail.showMessage).not.toHaveBeenCalled();
    expect(detail.showError).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it("#2 rejects a callback retained before same-tid and A-B-A reset boundaries", () => {
    const port = createPostReactionSettlementChannel();
    const detailBox: { current?: ReturnType<typeof makeReactions> } = {};
    let resetMode: "same" | "aba" = "same";
    activeUnsubscribers.push(
      port.subscribe((event) => {
        if (event.kind !== "like") return;
        const detail = detailBox.current;
        if (!detail) throw new Error("expected mounted Detail reactions");
        if (resetMode === "same") {
          detail.reactions.resetReactions(postSnapshot(1, { liked: false, likeCount: 30 }));
        } else {
          detail.reactions.resetReactions(postSnapshot(2, { liked: true, likeCount: 40 }));
          detail.reactions.resetReactions(postSnapshot(1, { liked: false, likeCount: 50 }));
        }
      }),
    );
    const detail = makeReactions({ settlements: port });
    detailBox.current = detail;
    detail.reactions.resetReactions(postSnapshot(1, { liked: false, likeCount: 4 }));

    publishLike(port, 1, true, 10);
    expect(detail.reactions.liked.value).toBe(false);
    expect(detail.reactions.likeCount.value).toBe(30);

    resetMode = "aba";
    publishLike(port, 1, true, 11);
    expect(detail.reactions.liked.value).toBe(false);
    expect(detail.reactions.likeCount.value).toBe(50);
  });

  it.each(["like", "save"] as const)(
    "#3 restores the latest external %s baseline after a current failure",
    async (kind) => {
      const port = createPostReactionSettlementChannel();
      const events = collectEvents(port);
      const detail = makeReactions({ settlements: port });
      detail.reactions.resetReactions(
        postSnapshot(1, { liked: false, likeCount: 4, bookmarked: false }),
      );

      if (kind === "like") {
        const request = deferred<{ liked: boolean; likeCount: number }>();
        togglePostLikeMock.mockReturnValueOnce(request.promise);
        const action = detail.reactions.handleLike(1);
        publishLike(port, 1, false, 17);
        expect(detail.reactions.likeBusy.value).toBe(true);
        expect(detail.reactions.likeCount.value).toBe(17);
        request.reject(new Error("like failed"));
        await expect(action).resolves.toBeUndefined();
        expect(detail.reactions.liked.value).toBe(false);
        expect(detail.reactions.likeCount.value).toBe(17);
        expect(detail.reactions.likeBusy.value).toBe(false);
      } else {
        const request = deferred<{ saved: boolean }>();
        togglePostSaveMock.mockReturnValueOnce(request.promise);
        const action = detail.reactions.handleSave(1);
        publishSave(port, 1, false);
        expect(detail.reactions.saveBusy.value).toBe(true);
        expect(detail.reactions.saved.value).toBe(false);
        request.reject(new Error("save failed"));
        await expect(action).resolves.toBeUndefined();
        expect(detail.reactions.saved.value).toBe(false);
        expect(detail.reactions.saveBusy.value).toBe(false);
      }

      expect(detail.showError).toHaveBeenCalledTimes(1);
      expect(detail.showMessage).not.toHaveBeenCalled();
      expect(events).toHaveLength(1);
    },
  );

  it.each(["like", "save"] as const)(
    "#3 lets current authoritative %s success win after external rebase",
    async (kind) => {
      const port = createPostReactionSettlementChannel();
      const events = collectEvents(port);
      const detail = makeReactions({ settlements: port });
      detail.reactions.resetReactions(
        postSnapshot(1, { liked: false, likeCount: 4, bookmarked: false }),
      );
      if (kind === "like") {
        const request = deferred<{ liked: boolean; likeCount: number }>();
        togglePostLikeMock.mockReturnValueOnce(request.promise);
        const action = detail.reactions.handleLike(1);
        publishLike(port, 1, false, 11);
        expect(detail.reactions.likeBusy.value).toBe(true);
        expect(detail.reactions.liked.value).toBe(false);
        expect(detail.reactions.likeCount.value).toBe(11);
        request.resolve({ liked: true, likeCount: 21.7 });
        await action;
        expect(detail.reactions.liked.value).toBe(true);
        expect(detail.reactions.likeCount.value).toBe(21);
      } else {
        const request = deferred<{ saved: boolean }>();
        togglePostSaveMock.mockReturnValueOnce(request.promise);
        const action = detail.reactions.handleSave(1);
        publishSave(port, 1, false);
        expect(detail.reactions.saveBusy.value).toBe(true);
        expect(detail.reactions.saved.value).toBe(false);
        request.resolve({ saved: true });
        await action;
        expect(detail.reactions.saved.value).toBe(true);
      }
      expect(events).toHaveLength(2);
      expect(events[1]).toMatchObject(
        kind === "like"
          ? { kind: "like", tid: 1, liked: true, likeCount: 21 }
          : { kind: "save", tid: 1, bookmarked: true },
      );
      expect(detail.showMessage).toHaveBeenCalledTimes(1);
    },
  );

  it("#3 applies a future equal-baseline event by sequence and rejects invalid admissions", async () => {
    const port = createPostReactionSettlementChannel();
    const request = deferred<{ liked: boolean; likeCount: number }>();
    togglePostLikeMock.mockReturnValueOnce(request.promise);
    const detail = makeReactions({ settlements: port });
    detail.reactions.resetReactions(postSnapshot(1, { liked: false, likeCount: 4 }));
    const action = detail.reactions.handleLike(1);
    expect(detail.reactions.liked.value).toBe(true);
    expect(detail.reactions.likeCount.value).toBe(5);

    publishLike(port, 1, false, 4);
    expect(detail.reactions.likeBusy.value).toBe(true);
    expect(detail.reactions.liked.value).toBe(false);
    expect(detail.reactions.likeCount.value).toBe(4);

    const invalidPort = createPostReactionSettlementChannel();
    const invalidEvents = collectEvents(invalidPort);
    const invalidDetail = makeReactions({ settlements: invalidPort });
    invalidDetail.reactions.resetReactions(
      postSnapshot(1, { liked: false, likeCount: 4, bookmarked: false }),
    );
    const invalidSequenceBefore = invalidPort.currentSequence();
    const invalidBefore = {
      liked: invalidDetail.reactions.liked.value,
      likeCount: invalidDetail.reactions.likeCount.value,
      saved: invalidDetail.reactions.saved.value,
    };
    const callsBefore = {
      like: togglePostLikeMock.mock.calls.length,
      save: togglePostSaveMock.mock.calls.length,
    };
    await invalidDetail.reactions.handleLike(null);
    await invalidDetail.reactions.handleLike(0);
    await invalidDetail.reactions.handleLike(1.5);
    await invalidDetail.reactions.handleLike(Number.NaN);
    await invalidDetail.reactions.handleLike(Number.POSITIVE_INFINITY);
    await invalidDetail.reactions.handleLike(2);
    await invalidDetail.reactions.handleLike(1, () => false);
    await invalidDetail.reactions.handleSave(null);
    await invalidDetail.reactions.handleSave(-1);
    await invalidDetail.reactions.handleSave(1.5);
    await invalidDetail.reactions.handleSave(Number.NaN);
    await invalidDetail.reactions.handleSave(Number.POSITIVE_INFINITY);
    await invalidDetail.reactions.handleSave(2);
    await invalidDetail.reactions.handleSave(1, () => false);
    expect(togglePostLikeMock).toHaveBeenCalledTimes(callsBefore.like);
    expect(togglePostSaveMock).toHaveBeenCalledTimes(callsBefore.save);
    expect(invalidDetail.reactions.liked.value).toBe(invalidBefore.liked);
    expect(invalidDetail.reactions.likeCount.value).toBe(invalidBefore.likeCount);
    expect(invalidDetail.reactions.saved.value).toBe(invalidBefore.saved);
    expect(invalidDetail.reactions.likeBusy.value).toBe(false);
    expect(invalidDetail.reactions.saveBusy.value).toBe(false);
    expect(invalidDetail.clearMessages).not.toHaveBeenCalled();
    expect(invalidDetail.showMessage).not.toHaveBeenCalled();
    expect(invalidDetail.showError).not.toHaveBeenCalled();
    expect(invalidPort.currentSequence()).toBe(invalidSequenceBefore);
    expect(invalidEvents).toEqual([]);

    request.reject(new Error("finish current action"));
    await action;
  });

  it("#4 keeps pending Detail Save independent from Footer Like", async () => {
    const port = createPostReactionSettlementChannel();
    const detail = makeReactions({ settlements: port });
    detail.reactions.resetReactions(
      postSnapshot(1, { liked: false, likeCount: 4, bookmarked: false }),
    );
    const saveRequest = deferred<{ saved: boolean }>();
    togglePostSaveMock.mockReturnValueOnce(saveRequest.promise);
    const saveAction = detail.reactions.handleSave(1);
    const footer = makeFooterProducer({
      settlements: port,
      toggleLike: vi.fn<ToggleLike>().mockResolvedValueOnce({ liked: true, likeCount: 9 }),
    });

    await footer.controller.handleLike();
    expect(detail.reactions.liked.value).toBe(true);
    expect(detail.reactions.likeCount.value).toBe(9);
    expect(detail.reactions.saved.value).toBe(true);
    expect(detail.reactions.saveBusy.value).toBe(true);

    saveRequest.resolve({ saved: true });
    await saveAction;
    expect(detail.reactions.saved.value).toBe(true);
    expect(detail.reactions.saveBusy.value).toBe(false);
  });

  it("#4 keeps pending Detail Like independent from Context Save", async () => {
    const port = createPostReactionSettlementChannel();
    const detail = makeReactions({ settlements: port });
    detail.reactions.resetReactions(
      postSnapshot(1, { liked: false, likeCount: 4, bookmarked: false }),
    );
    const likeRequest = deferred<{ liked: boolean; likeCount: number }>();
    togglePostLikeMock.mockReturnValueOnce(likeRequest.promise);
    const likeAction = detail.reactions.handleLike(1);
    togglePostSaveMock.mockResolvedValueOnce({ saved: true });
    const context = makeContextProducer({ settlements: port });
    openContext(context);

    await context.actions.handleBookmark();
    expect(detail.reactions.saved.value).toBe(true);
    expect(detail.reactions.likeBusy.value).toBe(true);
    expect(detail.reactions.liked.value).toBe(true);

    likeRequest.resolve({ liked: true, likeCount: 13 });
    await likeAction;
    expect(detail.reactions.likeCount.value).toBe(13);
    expect(detail.reactions.likeBusy.value).toBe(false);
  });

  it.each(["like-first", "save-first"] as const)(
    "#4 keeps concurrent own Like and Save independent when settling $0",
    async (order) => {
      const port = createPostReactionSettlementChannel();
      const events = collectEvents(port);
      const detail = makeReactions({ settlements: port });
      detail.reactions.resetReactions(
        postSnapshot(1, { liked: false, likeCount: 4, bookmarked: false }),
      );
      const likeRequest = deferred<{ liked: boolean; likeCount: number }>();
      const saveRequest = deferred<{ saved: boolean }>();
      togglePostLikeMock.mockReturnValueOnce(likeRequest.promise);
      togglePostSaveMock.mockReturnValueOnce(saveRequest.promise);
      const likeAction = detail.reactions.handleLike(1);
      const saveAction = detail.reactions.handleSave(1);
      expect(detail.reactions.likeBusy.value).toBe(true);
      expect(detail.reactions.saveBusy.value).toBe(true);
      expect(detail.reactions.liked.value).toBe(true);
      expect(detail.reactions.saved.value).toBe(true);

      if (order === "like-first") {
        likeRequest.resolve({ liked: true, likeCount: 8 });
        await likeAction;
        expect(detail.reactions.saveBusy.value).toBe(true);
        expect(detail.reactions.saved.value).toBe(true);
        saveRequest.resolve({ saved: true });
        await saveAction;
      } else {
        saveRequest.resolve({ saved: true });
        await saveAction;
        expect(detail.reactions.likeBusy.value).toBe(true);
        expect(detail.reactions.liked.value).toBe(true);
        expect(detail.reactions.likeCount.value).toBe(5);
        likeRequest.resolve({ liked: true, likeCount: 8 });
        await likeAction;
      }

      expect(detail.reactions.likeBusy.value).toBe(false);
      expect(detail.reactions.saveBusy.value).toBe(false);
      expect(detail.reactions.liked.value).toBe(true);
      expect(detail.reactions.likeCount.value).toBe(8);
      expect(detail.reactions.saved.value).toBe(true);
      expect(events.map((event) => event.kind)).toEqual(
        order === "like-first" ? ["like", "save"] : ["save", "like"],
      );
    },
  );

  it.each(["like", "save"] as const)(
    "#5 rebases but does not display an outer %s admitted before the Detail subscriber",
    async (kind) => {
      const port = createPostReactionSettlementChannel();
      const inverseRequest = deferred<{ liked: boolean; likeCount: number } | { saved: boolean }>();
      if (kind === "like") {
        togglePostLikeMock.mockReturnValueOnce(
          inverseRequest.promise as Promise<{ liked: boolean; likeCount: number }>,
        );
      } else {
        togglePostSaveMock.mockReturnValueOnce(
          inverseRequest.promise as Promise<{ saved: boolean }>,
        );
      }
      const detailBox: { current?: ReturnType<typeof makeReactions> } = {};
      let inverseAction: Promise<void> | undefined;
      activeUnsubscribers.push(
        port.subscribe((event) => {
          if (event.kind !== kind || inverseAction) return;
          const detail = detailBox.current;
          if (!detail) throw new Error("expected mounted Detail reactions");
          inverseAction =
            kind === "like" ? detail.reactions.handleLike(1) : detail.reactions.handleSave(1);
        }),
      );
      const detail = makeReactions({ settlements: port });
      detailBox.current = detail;
      detail.reactions.resetReactions(
        postSnapshot(1, { liked: true, likeCount: 10, bookmarked: true }),
      );
      const events = collectEvents(port);

      if (kind === "like") {
        publishLike(port, 1, true, 12);
        expect(togglePostLikeMock).toHaveBeenCalledWith(1, false);
        expect(detail.reactions.likeBusy.value).toBe(true);
        expect(detail.reactions.liked.value).toBe(false);
        expect(detail.reactions.likeCount.value).toBe(9);
      } else {
        publishSave(port, 1, false);
        expect(togglePostSaveMock).toHaveBeenCalledWith(1, false);
        expect(detail.reactions.saveBusy.value).toBe(true);
        expect(detail.reactions.saved.value).toBe(false);
      }

      inverseRequest.reject(new Error("inverse failed"));
      if (!inverseAction) throw new Error("expected reentrant inverse action");
      await expect(inverseAction).resolves.toBeUndefined();
      if (kind === "like") {
        expect(detail.reactions.liked.value).toBe(true);
        expect(detail.reactions.likeCount.value).toBe(12);
        expect(detail.reactions.likeBusy.value).toBe(false);
      } else {
        expect(detail.reactions.saved.value).toBe(false);
        expect(detail.reactions.saveBusy.value).toBe(false);
      }
      expect(detail.showError).toHaveBeenCalledTimes(1);
      expect(events).toHaveLength(1);
      expect(events[0]?.kind).toBe(kind);
    },
  );

  it("#5 preserves inverse Save display while rebasing an already-delivering outer baseline", async () => {
    const port = createPostReactionSettlementChannel();
    const inverseRequest = deferred<{ saved: boolean }>();
    togglePostSaveMock.mockReturnValueOnce(inverseRequest.promise);
    const detailBox: { current?: ReturnType<typeof makeReactions> } = {};
    let inverseAction: Promise<void> | undefined;
    activeUnsubscribers.push(
      port.subscribe((event) => {
        if (event.kind !== "save" || inverseAction) return;
        const detail = detailBox.current;
        if (!detail) throw new Error("expected mounted Detail reactions");
        inverseAction = detail.reactions.handleSave(1);
      }),
    );
    const detail = makeReactions({ settlements: port });
    detailBox.current = detail;
    detail.reactions.resetReactions(postSnapshot(1, { bookmarked: false }));
    const events = collectEvents(port);

    publishSave(port, 1, false);
    expect(togglePostSaveMock).toHaveBeenCalledWith(1, true);
    expect(detail.reactions.saveBusy.value).toBe(true);
    expect(detail.reactions.saved.value).toBe(true);

    inverseRequest.reject(new Error("inverse failed"));
    if (!inverseAction) throw new Error("expected reentrant inverse action");
    await expect(inverseAction).resolves.toBeUndefined();
    expect(detail.reactions.saved.value).toBe(false);
    expect(detail.reactions.saveBusy.value).toBe(false);
    expect(detail.showError).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "save", tid: 1, bookmarked: false });
  });

  it("#6 uses per-kind greatest sequence under nested delivery for the local consumer", () => {
    const port = createPostReactionSettlementChannel();
    let nestedLike = false;
    let nestedSibling = false;
    activeUnsubscribers.push(
      port.subscribe((event) => {
        if (event.tid !== 1) return;
        if (event.kind === "like" && !nestedLike) {
          nestedLike = true;
          publishLike(port, 1, true, 30);
        }
        if (event.kind === "save" && !nestedSibling) {
          nestedSibling = true;
          publishLike(port, 1, false, 40);
        }
      }),
    );
    const detail = makeReactions({ settlements: port });
    detail.reactions.resetReactions(
      postSnapshot(1, { liked: false, likeCount: 2, bookmarked: false }),
    );

    publishLike(port, 1, false, 10);
    expect(detail.reactions.liked.value).toBe(true);
    expect(detail.reactions.likeCount.value).toBe(30);

    publishSave(port, 1, true);
    expect(detail.reactions.liked.value).toBe(false);
    expect(detail.reactions.likeCount.value).toBe(40);
    expect(detail.reactions.saved.value).toBe(true);

    const nonmatchingPort = createPostReactionSettlementChannel();
    let nonmatchingNested = false;
    activeUnsubscribers.push(
      nonmatchingPort.subscribe((event) => {
        if (nonmatchingNested || event.kind !== "save") return;
        nonmatchingNested = true;
        publishSave(nonmatchingPort, 2, true);
      }),
    );
    const isolated = makeReactions({ settlements: nonmatchingPort });
    isolated.reactions.resetReactions(postSnapshot(1, { bookmarked: false }));
    publishSave(nonmatchingPort, 1, true);
    expect(isolated.reactions.saved.value).toBe(true);
  });

  it.each(["like", "save"] as const)(
    "#7 retires own %s success before terminal publication and preserves inverse reentry",
    async (kind) => {
      const port = createPostReactionSettlementChannel();
      const detail = makeReactions({ settlements: port });
      detail.reactions.resetReactions(
        postSnapshot(1, { liked: false, likeCount: 4, bookmarked: false }),
      );
      const first =
        kind === "like"
          ? deferred<{ liked: boolean; likeCount: number }>()
          : deferred<{ saved: boolean }>();
      const second =
        kind === "like"
          ? deferred<{ liked: boolean; likeCount: number }>()
          : deferred<{ saved: boolean }>();
      if (kind === "like") {
        togglePostLikeMock
          .mockReturnValueOnce(first.promise as Promise<{ liked: boolean; likeCount: number }>)
          .mockReturnValueOnce(second.promise as Promise<{ liked: boolean; likeCount: number }>);
      } else {
        togglePostSaveMock
          .mockReturnValueOnce(first.promise as Promise<{ saved: boolean }>)
          .mockReturnValueOnce(second.promise as Promise<{ saved: boolean }>);
      }
      let inverse: Promise<void> | undefined;
      let reentered = false;
      const observations: Array<{
        busyBefore: boolean;
        busyAfter: boolean;
        calls: number;
        liked: boolean;
        likeCount: number;
        saved: boolean;
        feedback: number;
      }> = [];
      activeUnsubscribers.push(
        port.subscribe((event) => {
          if (reentered || event.kind !== kind) return;
          reentered = true;
          const busyBefore =
            kind === "like" ? detail.reactions.likeBusy.value : detail.reactions.saveBusy.value;
          const likedBefore = detail.reactions.liked.value;
          const likeCountBefore = detail.reactions.likeCount.value;
          const savedBefore = detail.reactions.saved.value;
          const feedbackBefore = vi.mocked(detail.showMessage).mock.calls.length;
          inverse =
            kind === "like" ? detail.reactions.handleLike(1) : detail.reactions.handleSave(1);
          observations.push({
            busyBefore,
            busyAfter:
              kind === "like" ? detail.reactions.likeBusy.value : detail.reactions.saveBusy.value,
            calls:
              kind === "like"
                ? togglePostLikeMock.mock.calls.length
                : togglePostSaveMock.mock.calls.length,
            liked: likedBefore,
            likeCount: likeCountBefore,
            saved: savedBefore,
            feedback: feedbackBefore,
          });
        }),
      );
      const events = collectEvents(port);
      const outer =
        kind === "like" ? detail.reactions.handleLike(1) : detail.reactions.handleSave(1);
      if (kind === "like") {
        (first as ReturnType<typeof deferred<{ liked: boolean; likeCount: number }>>).resolve({
          liked: true,
          likeCount: 8,
        });
      } else {
        (first as ReturnType<typeof deferred<{ saved: boolean }>>).resolve({ saved: true });
      }
      await outer;
      expect(observations).toEqual([
        {
          busyBefore: false,
          busyAfter: true,
          calls: 2,
          liked: kind === "like",
          likeCount: kind === "like" ? 8 : 4,
          saved: kind === "save",
          feedback: 1,
        },
      ]);
      expect(
        kind === "like" ? detail.reactions.likeBusy.value : detail.reactions.saveBusy.value,
      ).toBe(true);
      if (kind === "like") {
        (second as ReturnType<typeof deferred<{ liked: boolean; likeCount: number }>>).resolve({
          liked: false,
          likeCount: 6,
        });
      } else {
        (second as ReturnType<typeof deferred<{ saved: boolean }>>).resolve({ saved: false });
      }
      if (!inverse) throw new Error("expected inverse action");
      await inverse;
      expect(events).toHaveLength(2);
      expect(events).toEqual(
        kind === "like"
          ? [
              expect.objectContaining({
                kind: "like",
                tid: 1,
                liked: true,
                likeCount: 8,
              }),
              expect.objectContaining({
                kind: "like",
                tid: 1,
                liked: false,
                likeCount: 6,
              }),
            ]
          : [
              expect.objectContaining({ kind: "save", tid: 1, bookmarked: true }),
              expect.objectContaining({ kind: "save", tid: 1, bookmarked: false }),
            ],
      );
      expect(detail.showMessage).toHaveBeenCalledTimes(2);
      expect(detail.reactions.likeBusy.value).toBe(false);
      expect(detail.reactions.saveBusy.value).toBe(false);
      expect(detail.reactions.liked.value).toBe(false);
      expect(detail.reactions.likeCount.value).toBe(kind === "like" ? 6 : 4);
      expect(detail.reactions.saved.value).toBe(false);
    },
  );

  it("#8 isolates throwing success, error, and channel feedback paths", async () => {
    const successPort = createPostReactionSettlementChannel();
    const successEvents = collectEvents(successPort);
    const throwingMessage = vi.fn(() => {
      throw new Error("message failed");
    });
    const success = makeReactions({
      settlements: successPort,
      showMessage: throwingMessage,
    });
    success.reactions.resetReactions(postSnapshot(1));
    togglePostLikeMock.mockResolvedValueOnce({ liked: true, likeCount: 8 });
    await expect(success.reactions.handleLike(1)).resolves.toBeUndefined();
    expect(success.reactions.liked.value).toBe(true);
    expect(success.reactions.likeCount.value).toBe(8);
    expect(success.reactions.likeBusy.value).toBe(false);
    expect(success.showError).not.toHaveBeenCalled();
    expect(throwingMessage).toHaveBeenCalledTimes(1);
    expect(successEvents).toHaveLength(1);

    const failurePort = createPostReactionSettlementChannel();
    const failureEvents = collectEvents(failurePort);
    const throwingError = vi.fn(() => {
      throw new Error("error feedback failed");
    });
    const failure = makeReactions({
      settlements: failurePort,
      showError: throwingError,
    });
    failure.reactions.resetReactions(postSnapshot(1));
    togglePostSaveMock.mockRejectedValueOnce(new Error("save failed"));
    await expect(failure.reactions.handleSave(1)).resolves.toBeUndefined();
    expect(failure.reactions.saved.value).toBe(false);
    expect(failure.reactions.saveBusy.value).toBe(false);
    expect(throwingError).toHaveBeenCalledTimes(1);
    expect(failure.showMessage).not.toHaveBeenCalled();
    expect(failureEvents).toEqual([]);

    const listenerPort = createPostReactionSettlementChannel();
    activeUnsubscribers.push(
      listenerPort.subscribe(() => {
        throw new Error("listener failed");
      }),
    );
    const listenerEvents = collectEvents(listenerPort);
    const listenerCase = makeReactions({ settlements: listenerPort });
    listenerCase.reactions.resetReactions(postSnapshot(1));
    togglePostLikeMock.mockResolvedValueOnce({ liked: true, likeCount: 9 });
    await expect(listenerCase.reactions.handleLike(1)).resolves.toBeUndefined();
    expect(listenerEvents).toHaveLength(1);
    expect(listenerCase.reactions.likeBusy.value).toBe(false);
  });

  it.each(["explicit", "scope"] as const)(
    "#9 makes %s disposal terminal, idempotent, and no-replay",
    async (mode) => {
      const port = createPostReactionSettlementChannel();
      const tracked = trackedPort(port);
      const events = collectEvents(port);
      const request = deferred<{ liked: boolean; likeCount: number }>();
      togglePostLikeMock.mockReturnValueOnce(request.promise);
      const detail = makeReactions({ settlements: tracked.port });
      detail.reactions.resetReactions(postSnapshot(1));
      const action = detail.reactions.handleLike(1);
      expect(detail.reactions.likeBusy.value).toBe(true);
      expect(tracked.active()).toBe(1);

      if (mode === "explicit") {
        expect(typeof detail.reactions.dispose).toBe("function");
        detail.reactions.dispose?.();
        expect(() => detail.reactions.dispose?.()).not.toThrow();
      } else {
        detail.scope.stop();
        expect(() => detail.reactions.dispose?.()).not.toThrow();
      }
      expect(detail.reactions.likeBusy.value).toBe(false);
      expect(tracked.active()).toBe(0);
      const terminal = {
        liked: detail.reactions.liked.value,
        likeCount: detail.reactions.likeCount.value,
        saved: detail.reactions.saved.value,
        likeBusy: detail.reactions.likeBusy.value,
        saveBusy: detail.reactions.saveBusy.value,
        clearMessages: vi.mocked(detail.clearMessages).mock.calls.length,
        showMessage: vi.mocked(detail.showMessage).mock.calls.length,
        showError: vi.mocked(detail.showError).mock.calls.length,
      };
      publishLike(port, 1, false, 40);
      const sequenceAfterExternal = port.currentSequence();
      expect(detail.reactions.liked.value).toBe(terminal.liked);
      expect(detail.reactions.likeCount.value).toBe(terminal.likeCount);
      expect(events).toHaveLength(1);
      request.resolve({ liked: true, likeCount: 99 });
      await action;
      expect(port.currentSequence()).toBe(sequenceAfterExternal);
      expect(events).toHaveLength(1);
      expect({
        liked: detail.reactions.liked.value,
        likeCount: detail.reactions.likeCount.value,
        saved: detail.reactions.saved.value,
        likeBusy: detail.reactions.likeBusy.value,
        saveBusy: detail.reactions.saveBusy.value,
        clearMessages: vi.mocked(detail.clearMessages).mock.calls.length,
        showMessage: vi.mocked(detail.showMessage).mock.calls.length,
        showError: vi.mocked(detail.showError).mock.calls.length,
      }).toEqual(terminal);
      const calls = togglePostLikeMock.mock.calls.length;
      await detail.reactions.handleLike(1);
      expect(togglePostLikeMock).toHaveBeenCalledTimes(calls);

      const fresh = makeReactions({ settlements: tracked.port });
      fresh.reactions.resetReactions(postSnapshot(1, { liked: false, likeCount: 2 }));
      expect(fresh.reactions.liked.value).toBe(false);
      expect(fresh.reactions.likeCount.value).toBe(2);
    },
  );

  it("#9 rejects a callback retained in the delivery snapshot after reentrant dispose", () => {
    const port = createPostReactionSettlementChannel();
    const detailBox: { current?: ReturnType<typeof makeReactions> } = {};
    let disposeWasAvailable = false;
    activeUnsubscribers.push(
      port.subscribe((event) => {
        if (event.kind !== "like") return;
        const detail = detailBox.current;
        if (!detail) throw new Error("expected mounted Detail reactions");
        disposeWasAvailable = typeof detail.reactions.dispose === "function";
        detail.reactions.dispose?.();
      }),
    );
    const detail = makeReactions({ settlements: port });
    detailBox.current = detail;
    detail.reactions.resetReactions(postSnapshot(1, { liked: false, likeCount: 4 }));

    publishLike(port, 1, true, 99);

    expect(disposeWasAvailable).toBe(true);
    expect(detail.reactions.liked.value).toBe(false);
    expect(detail.reactions.likeCount.value).toBe(4);
    expect(detail.reactions.likeBusy.value).toBe(false);
  });
});

describe("physical Detail request settlement projection", () => {
  it("#10 keeps pre-boundary transport authority and original response identity", async () => {
    const tracked = trackedPort(createPostReactionSettlementChannel());
    publishLike(tracked.port, 1, true, 20);
    publishSave(tracked.port, 1, true);
    const response = postSnapshot(1, { liked: false, likeCount: 3, bookmarked: false });
    const transport = deferred<PostDetail>();
    fetchPostDetailMock.mockReturnValueOnce(transport.promise);
    const dispatchAction = vi.fn<DetailDispatch>();

    const load = fetchWithOptions(1, 7, dispatchAction, { settlements: tracked.port });
    expect(tracked.active()).toBe(1);
    transport.resolve(response);
    await load;

    expect(fetchPostDetailMock).toHaveBeenCalledWith(1);
    expect(tracked.active()).toBe(0);
    const committed = successfulPost(dispatchAction.mock.calls[0]?.[0]);
    expect(committed).toBe(response);
    expect(committed).toMatchObject({ liked: false, likeCount: 3, bookmarked: false });
  });

  it("#11 catches a synchronous publish inside the physical API call", async () => {
    const port = createPostReactionSettlementChannel();
    const actor = { id: "actor", name: "transport actor" };
    const response = postSnapshot(1, {
      title: "transport title",
      actor: actor as PostDetail["actor"],
      liked: false,
      likeCount: 1,
    });
    fetchPostDetailMock.mockImplementationOnce(() => {
      publishLike(port, 1, true, 9.8);
      return Promise.resolve(response);
    });
    const dispatchAction = vi.fn<DetailDispatch>();

    await fetchWithOptions(1, 8, dispatchAction, { settlements: port });

    const committed = successfulPost(dispatchAction.mock.calls[0]?.[0]);
    expect(committed).toMatchObject({ title: "transport title", liked: true, likeCount: 9 });
    expect(committed.actor).toBe(actor);
    expect(committed.imageUrls).toBe(response.imageUrls);
  });

  it("#12 overlays greatest post-boundary Like/Save while preserving transport fields", async () => {
    const port = createPostReactionSettlementChannel();
    const transport = deferred<PostDetail>();
    fetchPostDetailMock.mockReturnValueOnce(transport.promise);
    const dispatchAction = vi.fn<DetailDispatch>();
    let nestedLike = false;
    let nestedSibling = false;
    activeUnsubscribers.push(
      port.subscribe((event) => {
        if (event.kind !== "like" || event.tid !== 1) return;
        if (!nestedLike) {
          nestedLike = true;
          publishLike(port, 1, true, 30);
        }
        if (event.likeCount === 40 && !nestedSibling) {
          nestedSibling = true;
          publishSave(port, 1, false);
        }
      }),
    );

    const load = fetchWithOptions(1, 9, dispatchAction, { settlements: port });
    expect(fetchPostDetailMock).toHaveBeenCalledTimes(1);
    publishLike(port, 1, false, 10);
    publishLike(port, 2, false, 99);
    publishSave(port, 1, true);
    publishLike(port, 1, false, 40);
    const response = postSnapshot(1, {
      title: "fresh title",
      contentHtml: "fresh body",
      liked: false,
      likeCount: 1,
      bookmarked: true,
    });
    transport.resolve(response);
    await load;

    const committed = successfulPost(dispatchAction.mock.calls[0]?.[0]);
    expect(committed).toMatchObject({
      title: "fresh title",
      contentHtml: "fresh body",
      liked: false,
      likeCount: 40,
      bookmarked: false,
    });
    expect(committed.actor).toBe(response.actor);
    expect(committed.replies).toBe(response.replies);
  });

  it("#13 preserves a mismatched response unchanged instead of crossing owners", async () => {
    const port = createPostReactionSettlementChannel();
    const response = postSnapshot(2, { liked: false, likeCount: 2 });
    fetchPostDetailMock.mockImplementationOnce(() => {
      publishLike(port, 1, true, 50);
      return Promise.resolve(response);
    });
    const dispatchAction = vi.fn<DetailDispatch>();

    await fetchWithOptions(1, 10, dispatchAction, { settlements: port });

    const committed = successfulPost(dispatchAction.mock.calls[0]?.[0]);
    expect(committed).toBe(response);
    expect(committed).toMatchObject({ tid: 2, liked: false, likeCount: 2 });
  });

  it("#14 retires failed request events and gives retry a fresh boundary", async () => {
    const tracked = trackedPort(createPostReactionSettlementChannel());
    const first = deferred<PostDetail>();
    fetchPostDetailMock.mockReturnValueOnce(first.promise);
    const firstDispatch = vi.fn<DetailDispatch>();
    const firstLoad = fetchWithOptions(1, 11, firstDispatch, { settlements: tracked.port });
    expect(tracked.active()).toBe(1);
    publishLike(tracked.port, 1, true, 15);
    first.reject(new Error("transport failed"));
    await firstLoad;
    expect(tracked.active()).toBe(0);
    failedAction(firstDispatch.mock.calls[0]?.[0]);

    const retryResponse = postSnapshot(1, { liked: false, likeCount: 3 });
    const retryTransport = deferred<PostDetail>();
    fetchPostDetailMock.mockReturnValueOnce(retryTransport.promise);
    const retryDispatch = vi.fn<DetailDispatch>();
    const retryLoad = fetchWithOptions(1, 12, retryDispatch, { settlements: tracked.port });
    expect(tracked.active()).toBe(1);
    retryTransport.resolve(retryResponse);
    await retryLoad;
    expect(tracked.active()).toBe(0);
    const committed = successfulPost(retryDispatch.mock.calls[0]?.[0]);
    expect(committed).toBe(retryResponse);
    expect(committed).toMatchObject({ liked: false, likeCount: 3 });
  });

  it("#19 handles pre-abort and subscribe/currentSequence abort timing without transport", async () => {
    const pre = new AbortController();
    pre.abort();
    const preTracked = trackedPort(createPostReactionSettlementChannel());
    const preDispatch = vi.fn<DetailDispatch>();
    await fetchWithOptions(1, 13, preDispatch, {
      settlements: preTracked.port,
      signal: pre.signal,
    });
    expect(preTracked.active()).toBe(0);
    expect(fetchPostDetailMock).not.toHaveBeenCalled();
    expect(preDispatch).not.toHaveBeenCalled();

    for (const edge of ["subscribe", "sequence"] as const) {
      fetchPostDetailMock.mockClear();
      const controller = new AbortController();
      const tracked = trackedPort(createPostReactionSettlementChannel(), {
        ...(edge === "subscribe" ? { onSubscribe: () => controller.abort() } : {}),
        ...(edge === "sequence" ? { onCurrentSequence: () => controller.abort() } : {}),
      });
      const dispatchAction = vi.fn<DetailDispatch>();
      await fetchWithOptions(1, 14, dispatchAction, {
        settlements: tracked.port,
        signal: controller.signal,
      });
      expect(tracked.active()).toBe(0);
      expect(fetchPostDetailMock).not.toHaveBeenCalled();
      expect(dispatchAction).not.toHaveBeenCalled();
    }
  });

  it("#19 makes abort after physical start stop collection and dispatch while transport drains", async () => {
    const controller = new AbortController();
    const tracked = trackedPort(createPostReactionSettlementChannel());
    const transport = deferred<PostDetail>();
    fetchPostDetailMock.mockReturnValueOnce(transport.promise);
    const dispatchAction = vi.fn<DetailDispatch>();
    const load = fetchWithOptions(1, 15, dispatchAction, {
      settlements: tracked.port,
      signal: controller.signal,
    });
    expect(fetchPostDetailMock).toHaveBeenCalledTimes(1);
    expect(tracked.active()).toBe(1);
    publishLike(tracked.port, 1, true, 10);

    controller.abort();
    expect(tracked.active()).toBe(0);
    publishSave(tracked.port, 1, true);
    transport.resolve(postSnapshot(1));
    await load;
    expect(dispatchAction).not.toHaveBeenCalled();
  });

  it("#20 uses the default singleton for synchronous physical-call projection", async () => {
    const response = postSnapshot(1, { liked: false, likeCount: 2, bookmarked: false });
    fetchPostDetailMock.mockImplementationOnce(() => {
      publishLike(postReactionSettlements, 1, true, 18);
      publishSave(postReactionSettlements, 1, true);
      return Promise.resolve(response);
    });
    const dispatchAction = vi.fn<DetailDispatch>();

    await fetchDetailWithToken(1, 16, dispatchAction);

    expect(successfulPost(dispatchAction.mock.calls[0]?.[0])).toMatchObject({
      liked: true,
      likeCount: 18,
      bookmarked: true,
    });
  });
});

describe("Detail store physical-request lease ownership", () => {
  it("#15 isolates A-B-A request projections and stale final cleanup", async () => {
    const subscriptions = trackSingletonRequestSubscriptions();
    const oldA = deferred<PostDetail>();
    const requestB = deferred<PostDetail>();
    const newA = deferred<PostDetail>();
    fetchPostDetailMock
      .mockReturnValueOnce(oldA.promise)
      .mockReturnValueOnce(requestB.promise)
      .mockReturnValueOnce(newA.promise);

    dispatch({ type: "url-sync", tid: 1 });
    expect(fetchPostDetailMock).toHaveBeenLastCalledWith(1);
    expect(subscriptions.active()).toBe(1);
    publishLike(postReactionSettlements, 1, true, 40);
    dispatch({ type: "url-sync", tid: 2 });
    expect(fetchPostDetailMock).toHaveBeenLastCalledWith(2);
    expect(subscriptions.active()).toBe(1);
    publishSave(postReactionSettlements, 2, true);
    dispatch({ type: "url-sync", tid: 1 });
    expect(fetchPostDetailMock).toHaveBeenLastCalledWith(1);
    expect(subscriptions.active()).toBe(1);

    oldA.resolve(postSnapshot(1, { title: "old A", liked: true, likeCount: 40 }));
    requestB.resolve(postSnapshot(2, { title: "old B", bookmarked: true }));
    await flushMicrotasks();
    const stillLoading = getDetailStateRef().value;
    expect(stillLoading).toMatchObject({ kind: "loading", tid: 1 });
    expect(subscriptions.active()).toBe(1);

    newA.resolve(postSnapshot(1, { title: "new A", liked: false, likeCount: 3 }));
    await flushMicrotasks();
    const ready = getDetailStateRef().value;
    expect(ready).toMatchObject({ kind: "ready", tid: 1 });
    if (ready.kind !== "ready") return;
    expect(ready.post).toMatchObject({
      title: "new A",
      liked: false,
      likeCount: 3,
      bookmarked: false,
    });
    expect(subscriptions.active()).toBe(0);
  });

  it("#16 promptly releases a never-settling request on close", async () => {
    const subscriptions = trackSingletonRequestSubscriptions();
    const transport = deferred<PostDetail>();
    fetchPostDetailMock.mockReturnValueOnce(transport.promise);
    dispatch({ type: "url-sync", tid: 1 });
    expect(fetchPostDetailMock).toHaveBeenCalledTimes(1);
    expect(subscriptions.active()).toBe(1);

    dispatch({ type: "url-sync", tid: null });
    expect(getDetailStateRef().value.kind).toBe("closed");
    expect(subscriptions.active()).toBe(0);

    publishLike(postReactionSettlements, 1, true, 99);
    transport.resolve(postSnapshot(1, { liked: true, likeCount: 99 }));
    await flushMicrotasks();
    expect(getDetailStateRef().value.kind).toBe("closed");
  });

  it("#16 makes a request callback retained during reentrant close inert", async () => {
    const transport = deferred<PostDetail>();
    fetchPostDetailMock.mockReturnValueOnce(transport.promise);
    let closed = false;
    activeUnsubscribers.push(
      postReactionSettlements.subscribe((event) => {
        if (closed || event.kind !== "like" || event.tid !== 1) return;
        closed = true;
        dispatch({ type: "url-sync", tid: null });
      }),
    );
    const subscriptions = trackSingletonRequestSubscriptions();
    dispatch({ type: "url-sync", tid: 1 });
    expect(subscriptions.active()).toBe(1);

    publishLike(postReactionSettlements, 1, true, 77);
    expect(getDetailStateRef().value.kind).toBe("closed");
    expect(subscriptions.active()).toBe(0);
    transport.resolve(postSnapshot(1, { liked: false, likeCount: 1 }));
    await flushMicrotasks();
    expect(getDetailStateRef().value.kind).toBe("closed");
  });

  it("#16 unsubscribes A before subscribing B and old completion cannot clear B", async () => {
    const subscriptions = trackSingletonRequestSubscriptions();
    const requestA = deferred<PostDetail>();
    const requestB = deferred<PostDetail>();
    fetchPostDetailMock.mockReturnValueOnce(requestA.promise).mockReturnValueOnce(requestB.promise);
    dispatch({ type: "url-sync", tid: 1 });
    dispatch({ type: "url-sync", tid: 2 });
    expect(subscriptions.transitions.slice(0, 3)).toEqual([
      "subscribe",
      "unsubscribe",
      "subscribe",
    ]);
    expect(subscriptions.active()).toBe(1);

    requestA.reject(new Error("late A"));
    await flushMicrotasks();
    expect(getDetailStateRef().value).toMatchObject({ kind: "loading", tid: 2 });
    expect(subscriptions.active()).toBe(1);
    requestB.resolve(postSnapshot(2));
    await flushMicrotasks();
    expect(getDetailStateRef().value).toMatchObject({ kind: "ready", tid: 2 });
    expect(subscriptions.active()).toBe(0);
  });

  it("#17 fences reset-token ABA by owner identity", async () => {
    const subscriptions = trackSingletonRequestSubscriptions();
    const oldTokenOne = deferred<PostDetail>();
    const newTokenOne = deferred<PostDetail>();
    fetchPostDetailMock
      .mockReturnValueOnce(oldTokenOne.promise)
      .mockReturnValueOnce(newTokenOne.promise);
    dispatch({ type: "url-sync", tid: 1 });
    expect(getDetailStateRef().value).toMatchObject({ kind: "loading", token: 1 });
    expect(subscriptions.active()).toBe(1);

    __resetStoreForTesting();
    expect(subscriptions.active()).toBe(0);
    dispatch({ type: "url-sync", tid: 1 });
    expect(getDetailStateRef().value).toMatchObject({ kind: "loading", token: 1 });
    expect(subscriptions.active()).toBe(1);

    oldTokenOne.resolve(postSnapshot(1, { title: "old token one" }));
    await flushMicrotasks();
    expect(getDetailStateRef().value).toMatchObject({ kind: "loading", token: 1 });
    expect(subscriptions.active()).toBe(1);

    dispatch({ type: "url-sync", tid: null });
    expect(getDetailStateRef().value.kind).toBe("closed");
    expect(subscriptions.active()).toBe(0);

    newTokenOne.resolve(postSnapshot(1, { title: "new token one" }));
    await flushMicrotasks();
    expect(getDetailStateRef().value.kind).toBe("closed");
    expect(subscriptions.active()).toBe(0);
  });

  it.each(["success", "error"] as const)(
    "#18 releases the accepted current %s lease immediately",
    async (outcome) => {
      const subscriptions = trackSingletonRequestSubscriptions();
      const transport = deferred<PostDetail>();
      fetchPostDetailMock.mockReturnValueOnce(transport.promise);
      let activeAtTerminal: number | undefined;
      const stop = watch(
        getDetailStateRef(),
        (state) => {
          if (state.kind === "ready" || state.kind === "error") {
            activeAtTerminal = subscriptions.active();
          }
        },
        { flush: "sync" },
      );
      activeRestorers.push(stop);
      dispatch({ type: "url-sync", tid: 1 });
      expect(subscriptions.active()).toBe(1);
      if (outcome === "success") transport.resolve(postSnapshot(1));
      else transport.reject(new Error("current error"));
      await flushMicrotasks();
      expect(getDetailStateRef().value.kind).toBe(outcome === "success" ? "ready" : "error");
      expect(activeAtTerminal).toBe(0);
      expect(subscriptions.active()).toBe(0);
    },
  );

  it("#18 preserves B owner on stale A result and treats same-tid loading as no-op", async () => {
    const subscriptions = trackSingletonRequestSubscriptions();
    const requestA = deferred<PostDetail>();
    const requestB = deferred<PostDetail>();
    fetchPostDetailMock.mockReturnValueOnce(requestA.promise).mockReturnValueOnce(requestB.promise);
    dispatch({ type: "url-sync", tid: 1 });
    dispatch({ type: "url-sync", tid: 2 });
    dispatch({ type: "url-sync", tid: 2 });
    expect(fetchPostDetailMock).toHaveBeenCalledTimes(2);
    expect(subscriptions.active()).toBe(1);
    requestA.resolve(postSnapshot(1));
    await flushMicrotasks();
    expect(getDetailStateRef().value).toMatchObject({ kind: "loading", tid: 2 });
    expect(subscriptions.active()).toBe(1);
    requestB.resolve(postSnapshot(2));
    await flushMicrotasks();
    expect(subscriptions.active()).toBe(0);
  });

  it("#18 rechecks stale outer effects after a sync watcher opens B", () => {
    const subscriptions = trackSingletonRequestSubscriptions();
    const requestB = deferred<PostDetail>();
    fetchPostDetailMock.mockReturnValue(requestB.promise);
    let redirected = false;
    const stop = watch(
      getDetailStateRef(),
      (state) => {
        if (!redirected && state.kind === "loading" && state.tid === 1) {
          redirected = true;
          dispatch({ type: "url-sync", tid: 2 });
        }
      },
      { flush: "sync" },
    );
    activeRestorers.push(stop);

    dispatch({ type: "url-sync", tid: 1 });

    expect(getDetailStateRef().value).toMatchObject({ kind: "loading", tid: 2 });
    expect(fetchPostDetailMock).toHaveBeenCalledTimes(1);
    expect(fetchPostDetailMock).toHaveBeenCalledWith(2);
    expect(subscriptions.active()).toBe(1);
  });

  it("#20 joins uninjected Footer and Context producers to one mounted Detail singleton", async () => {
    installReady(postSnapshot(1, { liked: false, likeCount: 4, bookmarked: false }));
    const ready = getDetailStateRef().value;
    if (ready.kind !== "ready") throw new Error("expected ready state");
    const detail = makeReactions();
    detail.reactions.resetReactions(ready.post);
    togglePostLikeMock.mockResolvedValueOnce({ liked: true, likeCount: 7 });
    togglePostSaveMock.mockResolvedValueOnce({ saved: true });
    const footer = makeFooterProducer({ productionApi: true });
    const context = makeContextProducer();

    await footer.controller.handleLike();
    openContext(context);
    await context.actions.handleBookmark();

    expect(ready.post).toMatchObject({ liked: true, likeCount: 7, bookmarked: true });
    expect(detail.reactions.liked.value).toBe(true);
    expect(detail.reactions.likeCount.value).toBe(7);
    expect(detail.reactions.saved.value).toBe(true);
  });

  it("#20 keeps closed events out of a later same-tid ready snapshot", () => {
    installReady(postSnapshot(1, { liked: false, likeCount: 4, bookmarked: false }));
    dispatch({ type: "url-sync", tid: null });
    publishLike(postReactionSettlements, 1, true, 99);
    publishSave(postReactionSettlements, 1, true);

    const remounted = installReady(
      postSnapshot(1, { liked: false, likeCount: 2, bookmarked: false }),
    );

    expect(remounted.post).toMatchObject({ liked: false, likeCount: 2, bookmarked: false });
  });
});

describe("ready projection retained-delivery floor", () => {
  it("#6 keeps per-kind store sequences and filters owner before its floor", async () => {
    vi.resetModules();
    const reactionsModule = await import("../../src/features/reactions");
    const freshPosts = await import("../../src/api/posts");
    vi.mocked(freshPosts.fetchPostDetail).mockReturnValue(new Promise<PostDetail>(() => {}));
    type FreshStore = typeof import("../../src/app/detail-navigation/store");
    const storeBox: { current?: FreshStore } = {};
    let nestedLike = false;
    let nestedSave = false;
    let nestedSibling = false;
    let sameReadyNoop = false;
    const unsubscribeEarlier = reactionsModule.postReactionSettlements.subscribe((event) => {
      if (event.kind === "like" && event.tid === 1 && !nestedLike) {
        nestedLike = true;
        reactionsModule.postReactionSettlements.publish({
          kind: "like",
          tid: 1,
          liked: true,
          likeCount: 30,
        });
      }
      if (event.kind === "save" && event.tid === 1 && event.bookmarked && !sameReadyNoop) {
        sameReadyNoop = true;
        const readyStore = storeBox.current;
        if (!readyStore) throw new Error("expected mounted ready store");
        readyStore.dispatch({ type: "url-sync", tid: 1 });
      }
      if (event.kind === "save" && event.tid === 1 && !nestedSave) {
        nestedSave = true;
        reactionsModule.postReactionSettlements.publish({
          kind: "save",
          tid: 2,
          bookmarked: true,
        });
      }
      if (event.kind === "like" && event.tid === 1 && event.likeCount === 40 && !nestedSibling) {
        nestedSibling = true;
        reactionsModule.postReactionSettlements.publish({
          kind: "save",
          tid: 1,
          bookmarked: false,
        });
      }
    });
    const freshStore = await import("../../src/app/detail-navigation/store");
    storeBox.current = freshStore;
    try {
      freshStore.dispatch({ type: "url-sync", tid: 1 });
      const loading = freshStore.getDetailStateRef().value;
      if (loading.kind !== "loading") throw new Error("expected loading state");
      freshStore.dispatch({
        type: "fetch-result",
        token: loading.token,
        result: {
          ok: postSnapshot(1, { liked: false, likeCount: 2, bookmarked: false }),
        },
      });
      const readyOwner = freshStore.getDetailStateRef().value;
      if (readyOwner.kind !== "ready") throw new Error("expected ready state");
      const postOwner = readyOwner.post;

      reactionsModule.postReactionSettlements.publish({
        kind: "like",
        tid: 1,
        liked: false,
        likeCount: 10,
      });
      expect(freshStore.getDetailStateRef().value).toBe(readyOwner);
      expect(readyOwner.post).toBe(postOwner);
      expect(readyOwner.post).toMatchObject({
        liked: true,
        likeCount: 30,
        bookmarked: false,
      });

      reactionsModule.postReactionSettlements.publish({
        kind: "save",
        tid: 1,
        bookmarked: true,
      });
      expect(freshStore.getDetailStateRef().value).toBe(readyOwner);
      expect(readyOwner.post).toBe(postOwner);
      expect(readyOwner.post).toMatchObject({
        liked: true,
        likeCount: 30,
        bookmarked: true,
      });
      expect(sameReadyNoop).toBe(true);
      expect(nestedSave).toBe(true);

      reactionsModule.postReactionSettlements.publish({
        kind: "like",
        tid: 1,
        liked: false,
        likeCount: 40,
      });

      const ready = freshStore.getDetailStateRef().value;
      expect(ready.kind).toBe("ready");
      if (ready.kind === "ready") {
        expect(ready).toBe(readyOwner);
        expect(ready.post).toBe(postOwner);
        expect(ready.post).toMatchObject({
          liked: false,
          likeCount: 40,
          bookmarked: false,
        });
      }
      expect(nestedSibling).toBe(true);
    } finally {
      unsubscribeEarlier();
      freshStore.__resetStoreForTesting();
    }
  });

  it("#1 makes a newly committed ready snapshot reject an older callback in the same delivery", async () => {
    vi.resetModules();
    const reactionsModule = await import("../../src/features/reactions");
    const freshPosts = await import("../../src/api/posts");
    vi.mocked(freshPosts.fetchPostDetail).mockReturnValue(new Promise<PostDetail>(() => {}));
    type FreshStore = typeof import("../../src/app/detail-navigation/store");
    const storeBox: { current?: FreshStore } = {};
    const authoritative = postSnapshot(1, { liked: false, likeCount: 70 });
    const unsubscribeEarlier = reactionsModule.postReactionSettlements.subscribe((event) => {
      const freshStore = storeBox.current;
      if (!freshStore || event.kind !== "like" || event.tid !== 1) return;
      freshStore.dispatch({ type: "open", tid: 1, source: "retry" });
      const loading = freshStore.getDetailStateRef().value;
      if (loading.kind !== "loading") throw new Error("expected reentrant loading state");
      freshStore.dispatch({
        type: "fetch-result",
        token: loading.token,
        result: { ok: authoritative },
      });
    });
    const freshStore = await import("../../src/app/detail-navigation/store");
    storeBox.current = freshStore;
    try {
      freshStore.dispatch({ type: "url-sync", tid: 1 });
      const loading = freshStore.getDetailStateRef().value;
      if (loading.kind !== "loading") throw new Error("expected initial loading state");
      freshStore.dispatch({
        type: "fetch-result",
        token: loading.token,
        result: { ok: postSnapshot(1, { liked: false, likeCount: 4 }) },
      });

      reactionsModule.postReactionSettlements.publish({
        kind: "like",
        tid: 1,
        liked: true,
        likeCount: 99,
      });

      const ready = freshStore.getDetailStateRef().value;
      expect(ready.kind).toBe("ready");
      if (ready.kind === "ready") {
        expect(toRaw(ready.post)).toBe(authoritative);
        expect(ready.post).toMatchObject({ liked: false, likeCount: 70 });
      }
    } finally {
      unsubscribeEarlier();
      freshStore.__resetStoreForTesting();
    }
  });
});
