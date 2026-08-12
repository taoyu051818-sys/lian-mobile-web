import { computed, effectScope, ref, toRaw, type EffectScope, type Ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ERROR_SAVE_ACTION,
  FEED_BOOKMARK_REMOVED,
  FEED_BOOKMARK_SAVED,
} from "../../src/config/brand";
import type { FeedItem, FeedItemId, FeedResponse } from "../../src/types/feed";

const defaultFeedback = vi.hoisted(() => ({
  haptic: vi.fn(),
  sharePost: vi.fn(),
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

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

vi.mock("../../src/composables/useHapticFeedback", () => ({
  hapticMedium: defaultFeedback.haptic,
}));

vi.mock("../../src/platform/share", () => ({
  sharePost: defaultFeedback.sharePost,
}));

vi.mock("../../src/ui/feedback/useToast", () => ({
  useToast: () => defaultFeedback.toast,
}));

import * as feedApi from "../../src/api/feed";
import * as postsApi from "../../src/api/posts";
import * as profileApi from "../../src/api/profile";
import { useFeedCardContextActions } from "../../src/features/feed/useFeedCardContextActions";
import { useFeedData } from "../../src/features/feed/useFeedData";
import {
  createPostReactionSettlementChannel,
  postReactionSettlements,
  type PostReactionSettlement,
  type PostReactionSettlementPort,
} from "../../src/features/reactions";

type SavePost = (tid: FeedItemId, saved: boolean) => Promise<{ saved: boolean }>;
type SharePost = (input: {
  tid: FeedItemId;
  title: string;
}) => Promise<
  | { outcome: "shared" }
  | { outcome: "copied" }
  | { outcome: "cancelled" }
  | { outcome: "use-wechat-menu"; message: string }
  | { outcome: "failed"; message: string }
>;
type Actions = ReturnType<typeof useFeedCardContextActions>;
type ProductionActionOptions = Parameters<typeof useFeedCardContextActions>[0];
type RedActionOptions = ProductionActionOptions & {
  settlements?: PostReactionSettlementPort;
};
type FeedData = ReturnType<typeof useFeedData>;

const useActionsWithRedPort = useFeedCardContextActions as unknown as (
  options: RedActionOptions,
) => Actions;
const fetchFeedMock = vi.mocked(feedApi.fetchFeed);
const fetchAuthMeMock = vi.mocked(profileApi.fetchAuthMe);
const togglePostLikeMock = vi.mocked(postsApi.togglePostLike);
const togglePostSaveMock = vi.mocked(postsApi.togglePostSave);

const activeFeeds: FeedData[] = [];
const activeScopes: EffectScope[] = [];
const activeUnsubscribers: Array<() => void> = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function feedItem(tid: number, title = `item-${tid}`, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    tid,
    title,
    bodyPreview: `body-${tid}`,
    cover: "",
    primaryTag: "general",
    actor: { id: `actor-${tid}`, displayName: `Actor ${tid}` },
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

function makeFeed(settlements?: PostReactionSettlementPort): FeedData {
  const feed = settlements
    ? useFeedData({ detailOpen: () => false, closeDetail: vi.fn(), settlements })
    : useFeedData({ detailOpen: () => false, closeDetail: vi.fn() });
  activeFeeds.push(feed);
  return feed;
}

interface FeedbackSpies {
  success: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

interface ActionHarness {
  item: Readonly<Ref<FeedItem>>;
  actions: Actions;
  savePost: ReturnType<typeof vi.fn<SavePost>>;
  share: ReturnType<typeof vi.fn<SharePost>>;
  toast: FeedbackSpies;
  haptic: ReturnType<typeof vi.fn>;
  emitOpen: ReturnType<typeof vi.fn>;
  scope: EffectScope;
}

function makeActionHarness(
  options: {
    item?: Readonly<Ref<FeedItem>>;
    settlements?: PostReactionSettlementPort;
    savePost?: ReturnType<typeof vi.fn<SavePost>>;
    share?: ReturnType<typeof vi.fn<SharePost>>;
    toast?: FeedbackSpies;
    haptic?: ReturnType<typeof vi.fn>;
    productionDefaults?: boolean;
  } = {},
): ActionHarness {
  const item = options.item ?? ref(feedItem(1));
  const savePost = options.savePost ?? vi.fn<SavePost>(async (_tid, saved) => ({ saved }));
  const share = options.share ?? vi.fn<SharePost>(async () => ({ outcome: "cancelled" as const }));
  const toast = options.toast ?? { success: vi.fn(), info: vi.fn(), error: vi.fn() };
  const haptic = options.haptic ?? vi.fn();
  const emitOpen = vi.fn();
  const scope = effectScope();
  activeScopes.push(scope);
  let actions!: Actions;

  scope.run(() => {
    const productionOptions: ProductionActionOptions = {
      item,
      title: () => item.value.title,
      emitOpen,
      ...(options.productionDefaults ? {} : { dependencies: { savePost, share, toast, haptic } }),
    };
    actions = useActionsWithRedPort({
      ...productionOptions,
      ...(options.settlements ? { settlements: options.settlements } : {}),
    });
  });

  return { item, actions, savePost, share, toast, haptic, emitOpen, scope };
}

function openActions(
  harness: ActionHarness,
  ownerToken: unknown = harness.item.value,
  target: HTMLElement | null = null,
): boolean {
  return harness.actions.openMenu({ x: 10, y: 20, target, ownerToken });
}

function collectEvents(port: PostReactionSettlementPort): PostReactionSettlement[] {
  const events: PostReactionSettlement[] = [];
  activeUnsubscribers.push(port.subscribe((event) => events.push(event)));
  return events;
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
  defaultFeedback.haptic.mockReset();
  defaultFeedback.sharePost.mockReset();
  defaultFeedback.sharePost.mockResolvedValue({ outcome: "cancelled" });
  defaultFeedback.toast.success.mockReset();
  defaultFeedback.toast.info.mockReset();
  defaultFeedback.toast.error.mockReset();
});

afterEach(() => {
  for (const unsubscribe of activeUnsubscribers.splice(0)) unsubscribe();
  for (const feed of activeFeeds.splice(0)) feed.dispose();
  for (const scope of activeScopes.splice(0)) scope.stop();
});

describe("Feed context Save settlement production", () => {
  it("#1 publishes one captured authoritative response only after single-flight success", async () => {
    const port = createPostReactionSettlementChannel();
    const events = collectEvents(port);
    const feed = makeFeed(port);
    const first = feedItem(1, "authoritative", { bookmarked: false });
    feed.items.value = [first];
    const matchingBefore = feed.items.value[0];
    const liveItem = computed(() => feed.items.value[0] ?? first);
    const request = deferred<{ saved: boolean }>();
    const savePost = vi.fn<SavePost>().mockReturnValueOnce(request.promise);
    const harness = makeActionHarness({ item: liveItem, settlements: port, savePost });

    expect(openActions(harness)).toBe(true);
    const action = harness.actions.handleBookmark();
    const duplicate = harness.actions.handleBookmark();
    expect(savePost).toHaveBeenCalledTimes(1);
    expect(savePost).toHaveBeenCalledWith(1, true);
    expect(events).toEqual([]);
    expect(harness.actions.bookmarked.value).toBe(false);
    expect(harness.actions.bookmarkBusy.value).toBe(true);

    request.resolve({ saved: false });
    await Promise.all([action, duplicate]);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "save", tid: 1, bookmarked: false });
    expect(Object.isFrozen(events[0])).toBe(true);
    expect(feed.items.value[0]).not.toBe(matchingBefore);
    expect(feed.items.value[0]).toMatchObject({ bookmarked: false });
    expect(harness.actions.bookmarked.value).toBe(false);
    expect(harness.actions.bookmarkBusy.value).toBe(false);
    expect(harness.haptic).toHaveBeenCalledTimes(1);
    expect(harness.toast.success).toHaveBeenCalledWith(FEED_BOOKMARK_REMOVED);
    expect(harness.toast.error).not.toHaveBeenCalled();
  });

  it("#2 keeps both API and event on the captured tid after an in-place live mutation", async () => {
    const port = createPostReactionSettlementChannel();
    const events = collectEvents(port);
    const item = ref(feedItem(11, "captured"));
    const request = deferred<{ saved: boolean }>();
    const savePost = vi.fn<SavePost>().mockReturnValueOnce(request.promise);
    const harness = makeActionHarness({ item, settlements: port, savePost });

    expect(openActions(harness)).toBe(true);
    const action = harness.actions.handleBookmark();
    expect(savePost).toHaveBeenCalledWith(11, true);
    item.value.tid = 99;
    item.value.title = "mutated without replacement";
    request.resolve({ saved: true });
    await action;

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "save", tid: 11, bookmarked: true });
  });

  it("#3 keeps an open frozen action owner across real reaction-key additions", () => {
    const port = createPostReactionSettlementChannel();
    const feed = makeFeed(port);
    const sparse = feedItem(1, "sparse reaction owner") as FeedItem & Record<string, unknown>;
    delete sparse.liked;
    delete sparse.likeCount;
    delete sparse.bookmarked;
    feed.items.value = [sparse];
    const liveItem = computed(() => feed.items.value[0] ?? sparse);
    const harness = makeActionHarness({ item: liveItem, settlements: port });
    const liveBounds = { top: 101, left: 202, width: 303, height: 404 };
    const target = {
      getBoundingClientRect: vi.fn(() => liveBounds),
    } as unknown as HTMLElement;

    expect(openActions(harness, harness.item.value, target)).toBe(true);
    feed.items.value[0]!.title = "mutated live title";
    feed.items.value[0]!.bodyPreview = "mutated live body";
    liveBounds.top = 999;
    liveBounds.left = 888;
    publishLike(port, 1, true, 12);
    expect(harness.actions.visible.value).toBe(true);
    expect(harness.actions.bookmarked.value).toBe(false);
    publishSave(port, 1, true);
    expect(harness.actions.visible.value).toBe(true);
    expect(harness.actions.bookmarked.value).toBe(true);

    harness.actions.handleReport();
    expect(harness.emitOpen).toHaveBeenCalledTimes(1);
    expect(harness.emitOpen).toHaveBeenCalledWith(1, {
      item: expect.objectContaining({
        title: "sparse reaction owner",
        bodyPreview: "body-1",
      }),
      rect: { top: 101, left: 202, width: 303, height: 404 },
    });
    const reportPayload = harness.emitOpen.mock.calls[0]?.[1];
    expect(reportPayload?.item).not.toBe(toRaw(feed.items.value[0]));
    expect(reportPayload?.rect).not.toBe(liveBounds);
    expect(target.getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(feed.items.value[0]).toMatchObject({
      title: "mutated live title",
      bodyPreview: "mutated live body",
      liked: true,
      likeCount: 12,
      bookmarked: true,
    });
  });

  it.each(["liked", "likeCount", "bookmarked"] as const)(
    "#3 keeps pending Save ownership when the reaction key %s is removed directly",
    async (reactionKey) => {
      const port = createPostReactionSettlementChannel();
      const events = collectEvents(port);
      const item = ref(feedItem(1, `remove-${reactionKey}`));
      const request = deferred<{ saved: boolean }>();
      const savePost = vi.fn<SavePost>().mockReturnValueOnce(request.promise);
      const harness = makeActionHarness({ item, settlements: port, savePost });

      expect(openActions(harness)).toBe(true);
      const action = harness.actions.handleBookmark();
      expect(openActions(harness)).toBe(true);
      const replacement = { ...toRaw(item.value) } as FeedItem & Record<string, unknown>;
      delete replacement[reactionKey];
      item.value = replacement;

      expect(harness.actions.visible.value).toBe(true);
      expect(harness.actions.bookmarkBusy.value).toBe(true);
      request.resolve({ saved: true });
      await action;

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ kind: "save", tid: 1, bookmarked: true });
      expect(harness.actions.bookmarked.value).toBe(true);
      expect(harness.actions.bookmarkBusy.value).toBe(false);
    },
  );

  it("#4 lets pending Save and Share survive Like projection and preserves confirmed Save", async () => {
    const port = createPostReactionSettlementChannel();
    const events = collectEvents(port);
    const feed = makeFeed(port);
    const first = feedItem(1, "cross producer", { bookmarked: false });
    feed.items.value = [first];
    const liveItem = computed(() => feed.items.value[0] ?? first);
    const firstSave = deferred<{ saved: boolean }>();
    const secondSave = deferred<{ saved: boolean }>();
    const shareRequest = deferred<{ outcome: "shared" }>();
    const savePost = vi
      .fn<SavePost>()
      .mockReturnValueOnce(firstSave.promise)
      .mockReturnValueOnce(secondSave.promise);
    const share = vi.fn<SharePost>().mockReturnValueOnce(shareRequest.promise);
    const harness = makeActionHarness({ item: liveItem, settlements: port, savePost, share });

    expect(openActions(harness)).toBe(true);
    const saveAction = harness.actions.handleBookmark();
    expect(openActions(harness)).toBe(true);
    const shareAction = harness.actions.handleShare();
    publishLike(port, 1, true, 12);

    expect(harness.actions.bookmarkBusy.value).toBe(true);
    expect(harness.actions.shareBusy.value).toBe(true);
    firstSave.resolve({ saved: true });
    await saveAction;
    expect(feed.items.value[0]).toMatchObject({ liked: true, likeCount: 12, bookmarked: true });
    expect(harness.actions.bookmarked.value).toBe(true);

    shareRequest.resolve({ outcome: "shared" });
    await shareAction;
    expect(harness.actions.shareBusy.value).toBe(false);
    expect(harness.toast.error).not.toHaveBeenCalled();

    publishLike(port, 1, false, 9);
    expect(feed.items.value[0]).toMatchObject({ liked: false, likeCount: 9, bookmarked: true });
    expect(harness.actions.bookmarked.value).toBe(true);
    expect(openActions(harness)).toBe(true);
    const opposite = harness.actions.handleBookmark();
    expect(savePost).toHaveBeenLastCalledWith(1, false);
    secondSave.resolve({ saved: false });
    await opposite;

    const contextSaveEvents = events.filter(
      (event): event is Extract<PostReactionSettlement, { kind: "save" }> => event.kind === "save",
    );
    expect(contextSaveEvents.map((event) => event.bookmarked)).toEqual([true, false]);
    expect(feed.items.value[0]).toMatchObject({ liked: false, likeCount: 9, bookmarked: false });
  });

  const realReplacementCases = [
    "different-tid",
    "scalar-change",
    "nested-reference",
    "key-addition",
    "key-removal",
  ] as const;

  it.each(
    realReplacementCases.flatMap((replacementKind) =>
      (["resolve", "reject"] as const).map((completion) => [replacementKind, completion] as const),
    ),
  )(
    "#5 treats %s as a real boundary and makes old %s completion silent",
    async (replacementKind, completion) => {
      const port = createPostReactionSettlementChannel();
      const events = collectEvents(port);
      const initial = feedItem(1, `old-${replacementKind}`) as FeedItem & Record<string, unknown>;
      if (replacementKind === "key-removal") initial.ownerMarker = "remove-me";
      let replacement: FeedItem & Record<string, unknown>;
      switch (replacementKind) {
        case "different-tid":
          replacement = feedItem(2, "different tid") as FeedItem & Record<string, unknown>;
          break;
        case "scalar-change":
          replacement = { ...initial, title: "changed scalar" };
          break;
        case "nested-reference":
          replacement = {
            ...initial,
            actor: initial.actor ? { ...initial.actor } : undefined,
          };
          break;
        case "key-addition":
          replacement = { ...initial, ownerMarker: "new-key" };
          break;
        case "key-removal":
          replacement = { ...initial };
          delete replacement.ownerMarker;
          break;
      }

      const item = ref<FeedItem>(initial);
      const oldRequest = deferred<{ saved: boolean }>();
      const currentRequest = deferred<{ saved: boolean }>();
      const savePost = vi
        .fn<SavePost>()
        .mockReturnValueOnce(oldRequest.promise)
        .mockReturnValueOnce(currentRequest.promise);
      const harness = makeActionHarness({ item, settlements: port, savePost });

      expect(openActions(harness)).toBe(true);
      const oldAction = harness.actions.handleBookmark();
      expect(openActions(harness)).toBe(true);
      expect(harness.actions.visible.value).toBe(true);
      item.value = replacement;
      expect(harness.actions.visible.value).toBe(false);
      expect(harness.actions.bookmarkBusy.value).toBe(false);
      expect(openActions(harness)).toBe(true);
      const currentAction = harness.actions.handleBookmark();
      expect(harness.actions.bookmarkBusy.value).toBe(true);

      if (completion === "resolve") oldRequest.resolve({ saved: false });
      else oldRequest.reject(new Error("stale failure"));
      await oldAction;

      expect(events).toEqual([]);
      expect(harness.actions.bookmarkBusy.value).toBe(true);
      expect(harness.haptic).not.toHaveBeenCalled();
      expect(harness.toast.success).not.toHaveBeenCalled();
      expect(harness.toast.error).not.toHaveBeenCalled();

      currentRequest.resolve({ saved: true });
      await currentAction;
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        kind: "save",
        tid: replacement.tid,
        bookmarked: true,
      });
      expect(harness.actions.bookmarkBusy.value).toBe(false);
    },
  );

  it("#5 invalidates pending Share for a same-tid non-reaction replacement", async () => {
    const port = createPostReactionSettlementChannel();
    const item = ref(feedItem(1, "old share owner"));
    const oldRequest = deferred<{ outcome: "copied" }>();
    const currentRequest = deferred<{ outcome: "shared" }>();
    const share = vi
      .fn<SharePost>()
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);
    const harness = makeActionHarness({ item, settlements: port, share });

    expect(openActions(harness)).toBe(true);
    const oldAction = harness.actions.handleShare();
    expect(openActions(harness)).toBe(true);
    expect(harness.actions.visible.value).toBe(true);
    item.value = { ...toRaw(item.value), title: "new share owner" };
    expect(harness.actions.visible.value).toBe(false);
    expect(harness.actions.shareBusy.value).toBe(false);
    expect(openActions(harness)).toBe(true);
    const currentAction = harness.actions.handleShare();
    oldRequest.resolve({ outcome: "copied" });
    await oldAction;

    expect(harness.actions.shareBusy.value).toBe(true);
    expect(harness.toast.success).not.toHaveBeenCalled();
    currentRequest.resolve({ outcome: "shared" });
    await currentAction;
    expect(harness.actions.shareBusy.value).toBe(false);
  });

  it("#6 preserves a newer reaction-only baseline on failure and publishes only the retry", async () => {
    const port = createPostReactionSettlementChannel();
    const events = collectEvents(port);
    const feed = makeFeed(port);
    const first = feedItem(1, "failure baseline", { bookmarked: false });
    feed.items.value = [first];
    const liveItem = computed(() => feed.items.value[0] ?? first);
    const failedRequest = deferred<{ saved: boolean }>();
    const retryRequest = deferred<{ saved: boolean }>();
    const savePost = vi
      .fn<SavePost>()
      .mockReturnValueOnce(failedRequest.promise)
      .mockReturnValueOnce(retryRequest.promise);
    let failureObservation:
      | { message: unknown; busy: boolean; bookmarked: boolean; eventCount: number }
      | undefined;
    const actionHolder: { current: Actions | null } = { current: null };
    const toast: FeedbackSpies = {
      success: vi.fn(),
      info: vi.fn(),
      error: vi.fn((message: unknown) => {
        const currentActions = actionHolder.current;
        if (!currentActions) return;
        failureObservation = {
          message,
          busy: currentActions.bookmarkBusy.value,
          bookmarked: currentActions.bookmarked.value,
          eventCount: events.length,
        };
      }),
    };
    const harness = makeActionHarness({
      item: liveItem,
      settlements: port,
      savePost,
      toast,
    });
    const actions = harness.actions;
    actionHolder.current = actions;

    expect(openActions(harness)).toBe(true);
    const failedAction = actions.handleBookmark();
    publishSave(port, 1, true);
    expect(actions.bookmarkBusy.value).toBe(true);
    expect(actions.bookmarked.value).toBe(true);
    expect(events).toHaveLength(1);

    failedRequest.reject(new Error("current API failure"));
    await failedAction;

    expect(failureObservation).toEqual({
      message: ERROR_SAVE_ACTION,
      busy: false,
      bookmarked: true,
      eventCount: 1,
    });
    expect(events).toHaveLength(1);
    expect(harness.haptic).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();

    expect(openActions(harness)).toBe(true);
    const retry = actions.handleBookmark();
    expect(savePost).toHaveBeenLastCalledWith(1, false);
    retryRequest.resolve({ saved: false });
    await retry;

    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ kind: "save", tid: 1, bookmarked: false });
    expect(actions.bookmarked.value).toBe(false);
  });

  it("#7 retires the first Save before publish and preserves re-entrant second busy", async () => {
    const port = createPostReactionSettlementChannel();
    const feed = makeFeed(port);
    const first = feedItem(1, "terminal re-entry", { bookmarked: false });
    feed.items.value = [first];
    const liveItem = computed(() => feed.items.value[0] ?? first);
    const firstRequest = deferred<{ saved: boolean }>();
    const secondRequest = deferred<{ saved: boolean }>();
    const savePost = vi
      .fn<SavePost>()
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);
    const harness = makeActionHarness({ item: liveItem, settlements: port, savePost });
    const events = collectEvents(port);
    let delivery:
      | {
          bookmarked: boolean;
          busyBefore: boolean;
          hapticCount: number;
          successCount: number;
          busyAfterAdmission: boolean;
          apiCallsAfterAdmission: number;
        }
      | undefined;
    let reentered = false;
    let secondAction: Promise<void> | undefined;
    activeUnsubscribers.push(
      port.subscribe((event) => {
        if (reentered || event.kind !== "save") return;
        reentered = true;
        const before = {
          bookmarked: harness.actions.bookmarked.value,
          busyBefore: harness.actions.bookmarkBusy.value,
          hapticCount: harness.haptic.mock.calls.length,
          successCount: harness.toast.success.mock.calls.length,
        };
        secondAction = harness.actions.handleBookmark();
        delivery = {
          ...before,
          busyAfterAdmission: harness.actions.bookmarkBusy.value,
          apiCallsAfterAdmission: savePost.mock.calls.length,
        };
      }),
    );

    expect(openActions(harness)).toBe(true);
    const firstAction = harness.actions.handleBookmark();
    expect(openActions(harness)).toBe(true);
    firstRequest.resolve({ saved: true });
    await firstAction;

    expect(delivery).toEqual({
      bookmarked: true,
      busyBefore: false,
      hapticCount: 1,
      successCount: 1,
      busyAfterAdmission: true,
      apiCallsAfterAdmission: 2,
    });
    expect(savePost).toHaveBeenLastCalledWith(1, false);
    expect(harness.actions.bookmarkBusy.value).toBe(true);
    expect(events).toHaveLength(1);

    secondRequest.resolve({ saved: false });
    expect(secondAction).toBeDefined();
    await secondAction;
    expect(events).toHaveLength(2);
    expect(events.map((event) => (event.kind === "save" ? event.bookmarked : undefined))).toEqual([
      true,
      false,
    ]);
    expect(harness.actions.bookmarkBusy.value).toBe(false);
  });

  it.each(["haptic", "success-toast"] as const)(
    "#8 isolates a throwing %s without entering the API failure path",
    async (throwingFeedback) => {
      const port = createPostReactionSettlementChannel();
      const events = collectEvents(port);
      const haptic = vi.fn(() => {
        if (throwingFeedback === "haptic") throw new Error("haptic failed");
      });
      const toast: FeedbackSpies = {
        success: vi.fn(() => {
          if (throwingFeedback === "success-toast") throw new Error("toast failed");
        }),
        info: vi.fn(),
        error: vi.fn(),
      };
      const harness = makeActionHarness({
        settlements: port,
        savePost: vi.fn<SavePost>().mockResolvedValueOnce({ saved: true }),
        haptic,
        toast,
      });

      expect(openActions(harness)).toBe(true);
      await expect(harness.actions.handleBookmark()).resolves.toBeUndefined();

      expect(haptic).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith(FEED_BOOKMARK_SAVED);
      expect(toast.error).not.toHaveBeenCalled();
      expect(harness.actions.bookmarked.value).toBe(true);
      expect(harness.actions.bookmarkBusy.value).toBe(false);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ kind: "save", tid: 1, bookmarked: true });
    },
  );

  it("#8 isolates a throwing channel listener and still delivers the authoritative event", async () => {
    const port = createPostReactionSettlementChannel();
    activeUnsubscribers.push(
      port.subscribe(() => {
        throw new Error("listener failed");
      }),
    );
    const events = collectEvents(port);
    const harness = makeActionHarness({
      settlements: port,
      savePost: vi.fn<SavePost>().mockResolvedValueOnce({ saved: true }),
    });

    expect(openActions(harness)).toBe(true);
    await expect(harness.actions.handleBookmark()).resolves.toBeUndefined();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "save", tid: 1, bookmarked: true });
    expect(harness.toast.error).not.toHaveBeenCalled();
  });

  it.each(["replace", "dispose"] as const)(
    "#8 makes publication terminal when a listener performs %s",
    async (terminalAction) => {
      const port = createPostReactionSettlementChannel();
      const events = collectEvents(port);
      const item = ref(feedItem(1, "delivery owner"));
      const firstRequest = deferred<{ saved: boolean }>();
      const secondRequest = deferred<{ saved: boolean }>();
      const savePost = vi
        .fn<SavePost>()
        .mockReturnValueOnce(firstRequest.promise)
        .mockReturnValueOnce(secondRequest.promise);
      const harness = makeActionHarness({ item, settlements: port, savePost });
      let deliveryFeedback:
        | { haptic: number; success: number; bookmarked: boolean; busy: boolean }
        | undefined;
      let secondAction: Promise<void> | undefined;
      let handled = false;
      activeUnsubscribers.push(
        port.subscribe((event) => {
          if (handled || event.kind !== "save") return;
          handled = true;
          deliveryFeedback = {
            haptic: harness.haptic.mock.calls.length,
            success: harness.toast.success.mock.calls.length,
            bookmarked: harness.actions.bookmarked.value,
            busy: harness.actions.bookmarkBusy.value,
          };
          if (terminalAction === "dispose") {
            harness.actions.dispose();
            return;
          }
          item.value = feedItem(2, "replacement owner", { bookmarked: false });
          openActions(harness);
          secondAction = harness.actions.handleBookmark();
        }),
      );

      expect(openActions(harness)).toBe(true);
      const firstAction = harness.actions.handleBookmark();
      firstRequest.resolve({ saved: true });
      await firstAction;

      expect(deliveryFeedback).toEqual({ haptic: 1, success: 1, bookmarked: true, busy: false });
      expect(events).toHaveLength(1);
      if (terminalAction === "dispose") {
        expect(harness.actions.bookmarkBusy.value).toBe(false);
        expect(openActions(harness)).toBe(false);
        return;
      }

      expect(savePost).toHaveBeenLastCalledWith(2, true);
      expect(harness.actions.bookmarkBusy.value).toBe(true);
      secondRequest.resolve({ saved: true });
      expect(secondAction).toBeDefined();
      await secondAction;
      expect(events).toHaveLength(2);
      expect(harness.actions.bookmarkBusy.value).toBe(false);
    },
  );

  it.each(
    (["explicit", "scope"] as const).flatMap((disposal) =>
      (["resolve", "reject"] as const).map((completion) => [disposal, completion] as const),
    ),
  )(
    "#9 makes late %s after %s disposal silent and leaves the port usable",
    async (disposal, completion) => {
      const port = createPostReactionSettlementChannel();
      const events = collectEvents(port);
      const item = ref(feedItem(1, "disposed owner"));
      const request = deferred<{ saved: boolean }>();
      const savePost = vi.fn<SavePost>().mockReturnValueOnce(request.promise);
      const harness = makeActionHarness({ item, settlements: port, savePost });

      expect(openActions(harness)).toBe(true);
      const action = harness.actions.handleBookmark();
      if (disposal === "scope") harness.scope.stop();
      else harness.actions.dispose();
      expect(harness.actions.bookmarkBusy.value).toBe(false);
      item.value = feedItem(2, "ignored after dispose", { bookmarked: true });
      expect(harness.actions.bookmarked.value).toBe(false);

      if (completion === "resolve") request.resolve({ saved: true });
      else request.reject(new Error("late disposed failure"));
      await action;

      expect(events).toEqual([]);
      expect(harness.haptic).not.toHaveBeenCalled();
      expect(harness.toast.success).not.toHaveBeenCalled();
      expect(harness.toast.error).not.toHaveBeenCalled();
      expect(openActions(harness)).toBe(false);
      await harness.actions.handleBookmark();
      expect(savePost).toHaveBeenCalledTimes(1);

      const fresh = makeActionHarness({
        item: ref(feedItem(3, "fresh owner")),
        settlements: port,
        savePost: vi.fn<SavePost>().mockResolvedValueOnce({ saved: true }),
      });
      expect(openActions(fresh)).toBe(true);
      await fresh.actions.handleBookmark();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ kind: "save", tid: 3, bookmarked: true });
    },
  );

  it("#10 isolates an injected port while patching only the matching mounted Feed item", async () => {
    const port = createPostReactionSettlementChannel();
    const events = collectEvents(port);
    const singletonEvents: PostReactionSettlement[] = [];
    activeUnsubscribers.push(
      postReactionSettlements.subscribe((event) => singletonEvents.push(event)),
    );
    const feed = makeFeed(port);
    const first = feedItem(1, "matching", { bodyPreview: "preserve body" });
    const second = feedItem(2, "nonmatching", { bookmarked: true });
    feed.items.value = [first, second];
    const matchingBefore = feed.items.value[0];
    const nonmatchingBefore = feed.items.value[1];
    const liveItem = computed(() => feed.items.value[0] ?? first);
    const harness = makeActionHarness({
      item: liveItem,
      settlements: port,
      savePost: vi.fn<SavePost>().mockResolvedValueOnce({ saved: true }),
    });

    expect(openActions(harness)).toBe(true);
    await harness.actions.handleBookmark();

    expect(feed.items.value.map((item) => item.tid)).toEqual([1, 2]);
    expect(feed.items.value[0]).not.toBe(matchingBefore);
    expect(feed.items.value[0]).toMatchObject({
      tid: 1,
      title: "matching",
      bodyPreview: "preserve body",
      bookmarked: true,
    });
    expect(feed.items.value[1]).toBe(nonmatchingBefore);
    expect(events).toHaveLength(1);
    expect(singletonEvents).toEqual([]);

    const unknown = makeActionHarness({
      item: ref(feedItem(999, "unknown")),
      settlements: port,
      savePost: vi.fn<SavePost>().mockResolvedValueOnce({ saved: true }),
    });
    expect(openActions(unknown)).toBe(true);
    await unknown.actions.handleBookmark();
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ kind: "save", tid: 999, bookmarked: true });
    expect(feed.items.value.map((item) => item.tid)).toEqual([1, 2]);
    expect(singletonEvents).toEqual([]);
  });

  it.each(["replace", "refresh", "append"] as const)(
    "#11 overlays post-boundary context Save over a stale %s response",
    async (kind) => {
      const port = createPostReactionSettlementChannel();
      const request = deferred<FeedResponse>();
      fetchFeedMock.mockReturnValueOnce(request.promise);
      const feed = makeFeed(port);
      const first = feedItem(1, "old transport owner", { bookmarked: false });
      feed.items.value = [first];
      feed.hasMore.value = true;
      feed.page.value = 2;
      const liveItem = computed(() => feed.items.value[0] ?? first);
      const saveRequest = deferred<{ saved: boolean }>();
      const savePost = vi.fn<SavePost>().mockReturnValueOnce(saveRequest.promise);
      const harness = makeActionHarness({ item: liveItem, settlements: port, savePost });

      const load = feed.loadFeed(kind);
      expect(fetchFeedMock).toHaveBeenCalledTimes(1);
      expect(openActions(harness)).toBe(true);
      const action = harness.actions.handleBookmark();
      expect(savePost).toHaveBeenCalledWith(1, true);
      saveRequest.resolve({ saved: true });
      await action;
      if (kind !== "replace") {
        expect(feed.items.value[0]).toMatchObject({ bookmarked: true });
      }

      const transportItem = feedItem(1, "new transport title", {
        bodyPreview: "new transport body",
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
        bookmarked: true,
      });
    },
  );

  it("#12 gives a later response authority and provides no event replay on remount", async () => {
    const port = createPostReactionSettlementChannel();
    const feed = makeFeed(port);
    const first = feedItem(1, "before later request", { bookmarked: false });
    feed.items.value = [first];
    const liveItem = computed(() => feed.items.value[0] ?? first);
    const harness = makeActionHarness({
      item: liveItem,
      settlements: port,
      savePost: vi.fn<SavePost>().mockResolvedValueOnce({ saved: true }),
    });

    expect(openActions(harness)).toBe(true);
    await harness.actions.handleBookmark();
    expect(feed.items.value[0]).toMatchObject({ bookmarked: true });
    const sequenceAfterSave = port.currentSequence();
    const lateSubscriber = vi.fn();
    activeUnsubscribers.push(port.subscribe(lateSubscriber));
    expect(lateSubscriber).not.toHaveBeenCalled();
    expect(port.currentSequence()).toBe(sequenceAfterSave);

    const laterRequest = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(laterRequest.promise);
    const load = feed.refreshFeed();
    expect(fetchFeedMock).toHaveBeenCalledTimes(1);
    laterRequest.resolve(feedResponse([feedItem(1, "later authority", { bookmarked: false })]));
    await load;
    expect(feed.items.value[0]).toMatchObject({
      title: "later authority",
      bookmarked: false,
    });

    feed.dispose();
    const remounted = makeFeed(port);
    expect(remounted.items.value).toEqual([]);
    fetchFeedMock.mockResolvedValueOnce(
      feedResponse([feedItem(1, "first remount fetch", { bookmarked: false })]),
    );
    await remounted.loadFeed("replace");
    expect(remounted.items.value[0]).toMatchObject({
      title: "first remount fetch",
      bookmarked: false,
    });
    expect(port.currentSequence()).toBe(sequenceAfterSave);
  });

  it("#13 links no-option action and Feed through the named production singleton", async () => {
    const singletonEvents: PostReactionSettlement[] = [];
    activeUnsubscribers.push(
      postReactionSettlements.subscribe((event) => singletonEvents.push(event)),
    );
    const feed = makeFeed();
    const first = feedItem(1, "default singleton", { bookmarked: false });
    feed.items.value = [first];
    const liveItem = computed(() => feed.items.value[0] ?? first);
    togglePostSaveMock.mockResolvedValueOnce({ saved: true });
    const harness = makeActionHarness({ item: liveItem, productionDefaults: true });

    expect(openActions(harness)).toBe(true);
    await harness.actions.handleBookmark();

    expect(harness.savePost).not.toHaveBeenCalled();
    expect(togglePostSaveMock).toHaveBeenCalledTimes(1);
    expect(togglePostSaveMock).toHaveBeenCalledWith(1, true);
    expect(singletonEvents).toHaveLength(1);
    expect(singletonEvents[0]).toMatchObject({ kind: "save", tid: 1, bookmarked: true });
    expect(feed.items.value[0]).toMatchObject({ bookmarked: true });
    expect(defaultFeedback.haptic).toHaveBeenCalledTimes(1);
    expect(defaultFeedback.toast.success).toHaveBeenCalledWith(FEED_BOOKMARK_SAVED);
    expect(defaultFeedback.toast.error).not.toHaveBeenCalled();

    postReactionSettlements.publish({ kind: "save", tid: 1, bookmarked: false });
    expect(singletonEvents).toHaveLength(2);
    expect(feed.items.value[0]).toMatchObject({ bookmarked: false });
  });
});
