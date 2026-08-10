import {
  compile,
  computed,
  createRenderer,
  defineComponent,
  effectScope,
  h,
  nextTick,
  reactive,
  ref,
  ssrContextKey,
  toRaw,
  type EffectScope,
  type Ref,
  type SetupContext,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import FeedItemCardFooter from "../../src/features/feed/FeedItemCardFooter.vue";
import feedItemCardFooterSource from "../../src/features/feed/FeedItemCardFooter.vue?raw";
import { useFeedCardContextActions } from "../../src/features/feed/useFeedCardContextActions";
import { useFeedData } from "../../src/features/feed/useFeedData";
import {
  createPostReactionSettlementChannel,
  postReactionSettlements,
  type PostReactionSettlement,
  type PostReactionSettlementPort,
} from "../../src/features/reactions";

type ToggleLike = (
  tid: FeedItemId,
  liked: boolean,
) => Promise<{ liked: boolean; likeCount: number }>;
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

interface LikeController {
  liked: Readonly<Ref<boolean>>;
  likeCount: Readonly<Ref<number>>;
  likeBusy: Readonly<Ref<boolean>>;
  likeLabel: Readonly<Ref<string>>;
  handleLike(): Promise<void>;
  dispose(): void;
}

interface LikeOptions {
  tid: Readonly<Ref<FeedItemId>>;
  liked: Readonly<Ref<boolean | undefined>>;
  likeCount: Readonly<Ref<number | undefined>>;
  settlements?: PostReactionSettlementPort;
  dependencies?: { toggleLike?: ToggleLike };
}

interface LikeModule {
  useFeedCardLike(options: LikeOptions): LikeController;
}

type FeedData = ReturnType<typeof useFeedData>;
type ContextActions = ReturnType<typeof useFeedCardContextActions>;
type ProductionContextOptions = Parameters<typeof useFeedCardContextActions>[0];

const LIKE_MODULE_ID = "../../src/features/feed/useFeedCardLike.ts";
const fetchFeedMock = vi.mocked(feedApi.fetchFeed);
const fetchAuthMeMock = vi.mocked(profileApi.fetchAuthMe);
const togglePostLikeMock = vi.mocked(postsApi.togglePostLike);
const togglePostSaveMock = vi.mocked(postsApi.togglePostSave);

const footerTemplateMatch = feedItemCardFooterSource.match(/<template>([\s\S]*?)<\/template>/);
if (!footerTemplateMatch) throw new Error("expected the production Footer SFC template");
const ssrFeedItemCardFooter = FeedItemCardFooter as unknown as {
  setup?: (props: Readonly<Record<string, unknown>>, context: SetupContext) => unknown;
};
const productionFooterSetup = ssrFeedItemCardFooter.setup;
if (!productionFooterSetup) throw new Error("expected the production Footer SFC setup");
const clientFeedItemCardFooter = {
  ...FeedItemCardFooter,
  setup(props: Readonly<Record<string, unknown>>, context: SetupContext) {
    const result = productionFooterSetup(props, context);
    return result !== null && typeof result === "object" && !(result instanceof Promise)
      ? { ...result }
      : result;
  },
  render: compile(footerTemplateMatch[1], {
    isCustomElement: (tag) => tag === "TrustBadge" || tag === "VisibilityBadge",
  }),
};

const activeFeeds: FeedData[] = [];
const activeScopes: EffectScope[] = [];
const activeUnsubscribers: Array<() => void> = [];
const activeApps: Array<{ unmount(): void }> = [];

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

async function loadLikeModule(): Promise<LikeModule> {
  return vi.importActual<LikeModule>(LIKE_MODULE_ID);
}

interface LikeHarness {
  tid: Ref<FeedItemId>;
  liked: Ref<boolean | undefined>;
  likeCount: Ref<number | undefined>;
  controller: LikeController;
  toggleLike: ReturnType<typeof vi.fn<ToggleLike>>;
  scope: EffectScope;
}

async function makeLikeHarness(
  options: {
    tid?: Ref<FeedItemId>;
    liked?: Ref<boolean | undefined>;
    likeCount?: Ref<number | undefined>;
    settlements?: PostReactionSettlementPort;
    toggleLike?: ReturnType<typeof vi.fn<ToggleLike>>;
    productionDefaults?: boolean;
  } = {},
): Promise<LikeHarness> {
  const module = await loadLikeModule();
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
  let controller!: LikeController;

  scope.run(() => {
    controller = module.useFeedCardLike({
      tid,
      liked,
      likeCount,
      ...(options.settlements ? { settlements: options.settlements } : {}),
      ...(options.productionDefaults ? {} : { dependencies: { toggleLike } }),
    });
  });

  return { tid, liked, likeCount, controller, toggleLike, scope };
}

interface FeedbackSpies {
  success: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

interface ContextHarness {
  item: Readonly<Ref<FeedItem>>;
  actions: ContextActions;
  savePost: ReturnType<typeof vi.fn<SavePost>>;
  share: ReturnType<typeof vi.fn<SharePost>>;
  toast: FeedbackSpies;
  haptic: ReturnType<typeof vi.fn>;
  emitOpen: ReturnType<typeof vi.fn>;
  scope: EffectScope;
}

function makeContextHarness(
  options: {
    item?: Readonly<Ref<FeedItem>>;
    settlements?: PostReactionSettlementPort;
    savePost?: ReturnType<typeof vi.fn<SavePost>>;
    share?: ReturnType<typeof vi.fn<SharePost>>;
  } = {},
): ContextHarness {
  const item = options.item ?? ref(feedItem(1));
  const savePost = options.savePost ?? vi.fn<SavePost>(async (_tid, saved) => ({ saved }));
  const share = options.share ?? vi.fn<SharePost>(async () => ({ outcome: "cancelled" }));
  const toast = { success: vi.fn(), info: vi.fn(), error: vi.fn() };
  const haptic = vi.fn();
  const emitOpen = vi.fn();
  const scope = effectScope();
  activeScopes.push(scope);
  let actions!: ContextActions;

  scope.run(() => {
    const productionOptions: ProductionContextOptions = {
      item,
      title: () => item.value.title,
      emitOpen,
      dependencies: { savePost, share, toast, haptic },
    };
    actions = useFeedCardContextActions({
      ...productionOptions,
      ...(options.settlements ? { settlements: options.settlements } : {}),
    });
  });

  return { item, actions, savePost, share, toast, haptic, emitOpen, scope };
}

function openContext(
  harness: ContextHarness,
  target: HTMLElement | null = null,
  ownerToken: unknown = harness.item.value,
): boolean {
  return harness.actions.openMenu({ x: 10, y: 20, target, ownerToken });
}

function collectEvents(port: PostReactionSettlementPort): PostReactionSettlement[] {
  const events: PostReactionSettlement[] = [];
  activeUnsubscribers.push(port.subscribe((event) => events.push(event)));
  return events;
}

interface HostNode {
  type: string;
  props: Record<string, unknown>;
  children: HostNode[];
  parent: HostNode | null;
  text: string;
}

function hostNode(type: string, text = ""): HostNode {
  return { type, props: {}, children: [], parent: null, text };
}

function detachHostNode(node: HostNode): void {
  const parent = node.parent;
  if (!parent) return;
  const index = parent.children.indexOf(node);
  if (index >= 0) parent.children.splice(index, 1);
  node.parent = null;
}

const hostRenderer = createRenderer<HostNode, HostNode>({
  patchProp(element, key, _previous, next) {
    if (next === null || next === undefined) delete element.props[key];
    else element.props[key] = next;
  },
  insert(child, parent, anchor = null) {
    detachHostNode(child);
    child.parent = parent;
    const anchorIndex = anchor ? parent.children.indexOf(anchor) : -1;
    if (anchorIndex < 0) parent.children.push(child);
    else parent.children.splice(anchorIndex, 0, child);
  },
  remove: detachHostNode,
  createElement: (type) => hostNode(type),
  createText: (text) => hostNode("#text", text),
  createComment: (text) => hostNode("#comment", text),
  setText(node, text) {
    node.text = text;
  },
  setElementText(element, text) {
    for (const child of element.children) child.parent = null;
    const child = hostNode("#text", text);
    child.parent = element;
    element.children = [child];
  },
  parentNode: (node) => node.parent,
  nextSibling(node) {
    const parent = node.parent;
    if (!parent) return null;
    const index = parent.children.indexOf(node);
    return parent.children[index + 1] ?? null;
  },
  querySelector: () => null,
  setScopeId(element, id) {
    element.props[id] = "";
  },
  insertStaticContent(content, parent, anchor) {
    const node = hostNode("#static", content);
    detachHostNode(node);
    node.parent = parent;
    const anchorIndex = anchor ? parent.children.indexOf(anchor) : -1;
    if (anchorIndex < 0) parent.children.push(node);
    else parent.children.splice(anchorIndex, 0, node);
    return [node, node];
  },
});

function findHostNodes(node: HostNode, predicate: (candidate: HostNode) => boolean): HostNode[] {
  const matches = predicate(node) ? [node] : [];
  for (const child of node.children) matches.push(...findHostNodes(child, predicate));
  return matches;
}

interface FooterSource {
  tid: number;
  liked?: boolean;
  likeCount?: number;
  key?: number;
}

interface FooterHarness {
  container: HostNode;
  onLiked: ReturnType<typeof vi.fn>;
  button(): HostNode;
  maybeButton(): HostNode | null;
  clickLike(): Promise<void>;
}

function mountFooterSource(source: () => FooterSource | null): FooterHarness {
  const container = hostNode("#root");
  const onLiked = vi.fn();
  const Root = defineComponent({
    name: "FeedFooterTestRoot",
    setup() {
      return () => {
        const current = source();
        if (!current) return null;
        return h(clientFeedItemCardFooter, {
          ...current,
          authorName: "Footer Author",
          authorAvatarUrl: "",
          authorInitial: "F",
          timeLabel: "now",
          onLiked,
        });
      };
    },
  });
  const app = hostRenderer.createApp(Root);
  app.config.warnHandler = (message) => {
    throw new Error(`unexpected Vue warning while mounting the production Footer: ${message}`);
  };
  app.provide(ssrContextKey, { modules: new Set<string>() });
  app.mount(container);
  activeApps.push(app);

  const maybeButton = () => {
    const buttons = findHostNodes(
      container,
      (node) => node.type === "button" && node.props["data-card-control"] === "like",
    );
    if (buttons.length > 1) throw new Error("expected exactly one production Footer Like button");
    return buttons[0] ?? null;
  };
  const button = () => {
    const current = maybeButton();
    if (!current) throw new Error("expected the production Footer Like button to be mounted");
    return current;
  };
  const clickLike = () => {
    const handler = button().props.onClick;
    if (typeof handler !== "function") {
      throw new TypeError("expected the production Footer Like button click handler");
    }
    const result = handler({ stopPropagation: vi.fn() });
    if (!(result instanceof Promise)) {
      throw new TypeError("Footer Like handler must return its semantic Promise<void>");
    }
    return result as Promise<void>;
  };

  return { container, onLiked, button, maybeButton, clickLike };
}

function mountStaticFooter(initial: FooterSource): {
  state: FooterSource;
  footer: FooterHarness;
} {
  const state = reactive({ ...initial });
  return { state, footer: mountFooterSource(() => state) };
}

function mountFeedFooter(feed: FeedData, tid: FeedItemId): FooterHarness {
  return mountFooterSource(() => {
    const item = feed.items.value.find((candidate) => candidate.tid === tid);
    return item
      ? { tid: item.tid, liked: item.liked, likeCount: item.likeCount, key: item.tid }
      : null;
  });
}

function normalizedCount(value: number | undefined): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
}

function expectLikeDisplay(controller: LikeController, expected: number): void {
  expect(controller.likeCount.value).toBe(expected);
  expect(Number.isFinite(controller.likeCount.value)).toBe(true);
  expect(Number.isInteger(controller.likeCount.value)).toBe(true);
  expect(controller.likeLabel.value).toContain(`当前 ${expected} 个喜欢`);
}

function expectNoLikeFeedback(): void {
  expect(defaultFeedback.haptic).not.toHaveBeenCalled();
  expect(defaultFeedback.toast.success).not.toHaveBeenCalled();
  expect(defaultFeedback.toast.info).not.toHaveBeenCalled();
  expect(defaultFeedback.toast.error).not.toHaveBeenCalled();
}

async function settleMicrotasks(): Promise<void> {
  await Promise.resolve();
  await nextTick();
}

beforeEach(() => {
  fetchFeedMock.mockReset();
  fetchFeedMock.mockResolvedValue(feedResponse([]));
  fetchAuthMeMock.mockReset();
  fetchAuthMeMock.mockResolvedValue(null);
  togglePostLikeMock.mockReset();
  togglePostLikeMock.mockImplementation(async (_tid, desired) => ({
    liked: desired,
    likeCount: desired ? 5 : 3,
  }));
  togglePostSaveMock.mockReset();
  togglePostSaveMock.mockImplementation(async (_tid, desired) => ({ saved: desired }));
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
  for (const app of activeApps.splice(0)) app.unmount();
  for (const scope of activeScopes.splice(0)) scope.stop();
  vi.restoreAllMocks();
});

describe("Feed Footer Like settlement production", () => {
  const normalizationCases = [
    { label: "fractional", value: 7.9 },
    { label: "negative", value: -4 },
    { label: "missing", value: undefined },
    { label: "NaN", value: Number.NaN },
    { label: "Infinity", value: Number.POSITIVE_INFINITY },
    { label: "-Infinity", value: Number.NEGATIVE_INFINITY },
  ] as const;

  it.each(normalizationCases)(
    "#1 normalizes $label counts at every producer ingress before channel delivery",
    async ({ value }) => {
      const expected = normalizedCount(value);

      const initial = await makeLikeHarness({ likeCount: ref<number | undefined>(value) });
      expectLikeDisplay(initial.controller, expected);

      initial.likeCount.value = 6;
      expectLikeDisplay(initial.controller, 6);
      initial.likeCount.value = value;
      expectLikeDisplay(initial.controller, expected);

      const pendingRequest = deferred<{ liked: boolean; likeCount: number }>();
      const pending = await makeLikeHarness({
        likeCount: ref<number | undefined>(4),
        toggleLike: vi.fn<ToggleLike>().mockReturnValueOnce(pendingRequest.promise),
      });
      const pendingAction = pending.controller.handleLike();
      expectLikeDisplay(pending.controller, 5);
      pending.likeCount.value = value;
      expect(pending.controller.likeBusy.value).toBe(true);
      expectLikeDisplay(pending.controller, expected);
      pendingRequest.resolve({ liked: true, likeCount: 5 });
      await pendingAction;

      const incrementRequest = deferred<{ liked: boolean; likeCount: number }>();
      const increment = await makeLikeHarness({
        liked: ref<boolean | undefined>(false),
        likeCount: ref<number | undefined>(value),
        toggleLike: vi.fn<ToggleLike>().mockReturnValueOnce(incrementRequest.promise),
      });
      const incrementAction = increment.controller.handleLike();
      expectLikeDisplay(increment.controller, expected + 1);
      incrementRequest.resolve({ liked: true, likeCount: expected + 1 });
      await incrementAction;

      const decrementRequest = deferred<{ liked: boolean; likeCount: number }>();
      const decrement = await makeLikeHarness({
        liked: ref<boolean | undefined>(true),
        likeCount: ref<number | undefined>(value),
        toggleLike: vi.fn<ToggleLike>().mockReturnValueOnce(decrementRequest.promise),
      });
      const decrementAction = decrement.controller.handleLike();
      expectLikeDisplay(decrement.controller, Math.max(0, expected - 1));
      decrementRequest.resolve({ liked: false, likeCount: Math.max(0, expected - 1) });
      await decrementAction;

      const port = createPostReactionSettlementChannel();
      const publishSpy = vi.spyOn(port, "publish");
      const events = collectEvents(port);
      const authoritative = await makeLikeHarness({
        settlements: port,
        toggleLike: vi
          .fn<ToggleLike>()
          .mockResolvedValueOnce({ liked: false, likeCount: value as number }),
      });
      await authoritative.controller.handleLike();

      expectLikeDisplay(authoritative.controller, expected);
      expect(authoritative.controller.liked.value).toBe(false);
      expect(publishSpy).toHaveBeenCalledTimes(1);
      expect(publishSpy).toHaveBeenCalledWith({
        kind: "like",
        tid: 1,
        liked: false,
        likeCount: expected,
      });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ kind: "like", tid: 1, liked: false, likeCount: expected });
    },
  );

  it("#1 treats the authoritative opposite response as the only final producer value", async () => {
    const port = createPostReactionSettlementChannel();
    const publishSpy = vi.spyOn(port, "publish");
    const events = collectEvents(port);
    const harness = await makeLikeHarness({
      liked: ref<boolean | undefined>(false),
      likeCount: ref<number | undefined>(2),
      settlements: port,
      toggleLike: vi.fn<ToggleLike>().mockResolvedValueOnce({ liked: false, likeCount: 7.9 }),
    });

    await harness.controller.handleLike();

    expect(harness.controller.liked.value).toBe(false);
    expectLikeDisplay(harness.controller, 7);
    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect(publishSpy).toHaveBeenCalledWith({
      kind: "like",
      tid: 1,
      liked: false,
      likeCount: 7,
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "like", tid: 1, liked: false, likeCount: 7 });
  });

  it("#2 keeps the real Footer single-flight and gives duplicate admission its own prompt Promise", async () => {
    const events = collectEvents(postReactionSettlements);
    const request = deferred<{ liked: boolean; likeCount: number }>();
    togglePostLikeMock.mockReturnValueOnce(request.promise);
    const { footer } = mountStaticFooter({ tid: 11, liked: false, likeCount: 3 });

    const first = footer.clickLike();
    const duplicate = footer.clickLike();
    expect(duplicate).not.toBe(first);
    expect(togglePostLikeMock).toHaveBeenCalledTimes(1);
    expect(togglePostLikeMock).toHaveBeenCalledWith(11, true);
    await nextTick();
    expect(footer.button().props.disabled).toBe(true);

    let firstSettled = false;
    let duplicateSettled = false;
    void first.then(() => {
      firstSettled = true;
    });
    void duplicate.then(() => {
      duplicateSettled = true;
    });
    await settleMicrotasks();
    expect(duplicateSettled).toBe(true);
    expect(firstSettled).toBe(false);

    request.resolve({ liked: true, likeCount: 4 });
    await first;
    await nextTick();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "like", tid: 11, liked: true, likeCount: 4 });
    expect(footer.onLiked).not.toHaveBeenCalled();
    expect(footer.button().props.disabled).toBe(false);
    expectNoLikeFeedback();
  });

  it("#3 restores the newest same-tid baseline after failure and publishes only the retry", async () => {
    const port = createPostReactionSettlementChannel();
    const events = collectEvents(port);
    const failedRequest = deferred<{ liked: boolean; likeCount: number }>();
    const retryRequest = deferred<{ liked: boolean; likeCount: number }>();
    const toggleLike = vi
      .fn<ToggleLike>()
      .mockReturnValueOnce(failedRequest.promise)
      .mockReturnValueOnce(retryRequest.promise);
    const harness = await makeLikeHarness({ settlements: port, toggleLike });

    const failed = harness.controller.handleLike();
    expect(harness.controller.liked.value).toBe(true);
    expectLikeDisplay(harness.controller, 5);
    harness.liked.value = true;
    harness.likeCount.value = 12.8;
    expect(harness.controller.likeBusy.value).toBe(true);
    expect(harness.controller.liked.value).toBe(true);
    expectLikeDisplay(harness.controller, 12);

    failedRequest.reject(new Error("current failure"));
    await expect(failed).resolves.toBeUndefined();
    expect(harness.controller.likeBusy.value).toBe(false);
    expect(harness.controller.liked.value).toBe(true);
    expectLikeDisplay(harness.controller, 12);
    expect(events).toEqual([]);

    const retry = harness.controller.handleLike();
    expect(toggleLike).toHaveBeenLastCalledWith(1, false);
    retryRequest.resolve({ liked: false, likeCount: 10.9 });
    await retry;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "like", tid: 1, liked: false, likeCount: 10 });
    expectLikeDisplay(harness.controller, 10);
    expectNoLikeFeedback();
  });

  it("#4 keeps a pending real Footer Like current across a real Context Save projection", async () => {
    const events = collectEvents(postReactionSettlements);
    const feed = makeFeed();
    const first = feedItem(1, "save-only continuity", {
      liked: false,
      likeCount: 4,
      bookmarked: false,
    });
    feed.items.value = [first];
    const matchingBefore = feed.items.value[0];
    const liveItem = computed(() => feed.items.value[0] ?? first);
    const likeRequest = deferred<{ liked: boolean; likeCount: number }>();
    const saveRequest = deferred<{ saved: boolean }>();
    togglePostLikeMock.mockReturnValueOnce(likeRequest.promise);
    const context = makeContextHarness({
      item: liveItem,
      savePost: vi.fn<SavePost>().mockReturnValueOnce(saveRequest.promise),
    });
    const footer = mountFeedFooter(feed, 1);

    const likeAction = footer.clickLike();
    await nextTick();
    expect(footer.button().props.disabled).toBe(true);
    expect(openContext(context)).toBe(true);
    const saveAction = context.actions.handleBookmark();
    expect(context.savePost).toHaveBeenCalledWith(1, true);
    saveRequest.resolve({ saved: true });
    await saveAction;
    await nextTick();

    expect(feed.items.value[0]).not.toBe(matchingBefore);
    expect(feed.items.value[0]).toMatchObject({
      liked: false,
      likeCount: 4,
      bookmarked: true,
    });
    expect(context.actions.bookmarkBusy.value).toBe(false);
    expect(footer.button().props.disabled).toBe(true);

    likeRequest.resolve({ liked: true, likeCount: 5 });
    await likeAction;
    await nextTick();

    expect(events.map((event) => event.kind)).toEqual(["save", "like"]);
    expect(events[1]).toMatchObject({ kind: "like", tid: 1, liked: true, likeCount: 5 });
    expect(feed.items.value[0]).toMatchObject({
      liked: true,
      likeCount: 5,
      bookmarked: true,
    });
    expect(footer.button().props.disabled).toBe(false);
  });

  it("#5 preserves a live Context menu and its detached Report snapshot across Footer Like", async () => {
    const feed = makeFeed();
    const first = feedItem(1, "detached title", {
      bodyPreview: "detached body",
      liked: false,
      likeCount: 3,
    });
    feed.items.value = [first];
    const liveItem = computed(() => feed.items.value[0] ?? first);
    const context = makeContextHarness({ item: liveItem });
    const liveBounds = { top: 101, left: 202, width: 303, height: 404 };
    const target = {
      getBoundingClientRect: vi.fn(() => liveBounds),
    } as unknown as HTMLElement;
    const footer = mountFeedFooter(feed, 1);

    expect(openContext(context, target)).toBe(true);
    feed.items.value[0]!.title = "mutated live title";
    feed.items.value[0]!.bodyPreview = "mutated live body";
    liveBounds.top = 999;
    liveBounds.left = 888;
    const matchingBefore = feed.items.value[0];
    togglePostLikeMock.mockResolvedValueOnce({ liked: true, likeCount: 8 });
    await footer.clickLike();
    await nextTick();

    expect(feed.items.value[0]).not.toBe(matchingBefore);
    expect(feed.items.value[0]).toMatchObject({
      liked: true,
      likeCount: 8,
      title: "mutated live title",
      bodyPreview: "mutated live body",
    });
    expect(context.actions.visible.value).toBe(true);
    context.actions.handleReport();

    expect(context.emitOpen).toHaveBeenCalledTimes(1);
    expect(context.emitOpen).toHaveBeenCalledWith(1, {
      item: expect.objectContaining({
        title: "detached title",
        bodyPreview: "detached body",
      }),
      rect: { top: 101, left: 202, width: 303, height: 404 },
    });
    const payload = context.emitOpen.mock.calls[0]?.[1];
    expect(payload?.item).not.toBe(toRaw(feed.items.value[0]));
    expect(payload?.rect).not.toBe(liveBounds);
    expect(target.getBoundingClientRect).toHaveBeenCalledTimes(1);
  });

  it("#5 preserves pending Save, Share, and a third live menu through Footer Like", async () => {
    const events = collectEvents(postReactionSettlements);
    const feed = makeFeed();
    const first = feedItem(1, "captured context title", {
      bodyPreview: "captured context body",
      liked: false,
      likeCount: 4,
      bookmarked: false,
    });
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
    const context = makeContextHarness({ item: liveItem, savePost, share });
    const thirdBounds = { top: 11, left: 22, width: 33, height: 44 };
    const thirdTarget = {
      getBoundingClientRect: vi.fn(() => thirdBounds),
    } as unknown as HTMLElement;
    const footer = mountFeedFooter(feed, 1);

    expect(openContext(context)).toBe(true);
    const saveAction = context.actions.handleBookmark();
    expect(savePost).toHaveBeenCalledWith(1, true);
    expect(openContext(context)).toBe(true);
    const shareAction = context.actions.handleShare();
    expect(share).toHaveBeenCalledWith({ tid: 1, title: "captured context title" });
    expect(openContext(context, thirdTarget)).toBe(true);
    expect(context.actions.bookmarkBusy.value).toBe(true);
    expect(context.actions.shareBusy.value).toBe(true);
    expect(context.actions.visible.value).toBe(true);

    feed.items.value[0]!.title = "mutated after third open";
    feed.items.value[0]!.bodyPreview = "mutated after third open body";
    thirdBounds.top = 999;
    const matchingBefore = feed.items.value[0];
    togglePostLikeMock.mockResolvedValueOnce({ liked: true, likeCount: 9 });
    await footer.clickLike();
    await nextTick();

    expect(feed.items.value[0]).not.toBe(matchingBefore);
    expect(feed.items.value[0]).toMatchObject({ liked: true, likeCount: 9, bookmarked: false });
    expect(context.actions.bookmarkBusy.value).toBe(true);
    expect(context.actions.shareBusy.value).toBe(true);
    expect(context.actions.visible.value).toBe(true);
    context.actions.handleReport();
    expect(context.emitOpen).toHaveBeenCalledWith(1, {
      item: expect.objectContaining({
        title: "captured context title",
        bodyPreview: "captured context body",
      }),
      rect: { top: 11, left: 22, width: 33, height: 44 },
    });

    firstSave.resolve({ saved: true });
    await saveAction;
    shareRequest.resolve({ outcome: "shared" });
    await shareAction;
    expect(context.actions.bookmarkBusy.value).toBe(false);
    expect(context.actions.shareBusy.value).toBe(false);
    expect(feed.items.value[0]).toMatchObject({ liked: true, likeCount: 9, bookmarked: true });

    expect(openContext(context)).toBe(true);
    const oppositeSave = context.actions.handleBookmark();
    expect(savePost).toHaveBeenLastCalledWith(1, false);
    secondSave.resolve({ saved: false });
    await oppositeSave;

    expect(feed.items.value[0]).toMatchObject({ liked: true, likeCount: 9, bookmarked: false });
    expect(events.map((event) => event.kind)).toEqual(["like", "save", "save"]);
    expect(context.toast.error).not.toHaveBeenCalled();
  });

  it.each(
    (["A-B", "A-B-A"] as const).flatMap((transition) =>
      (["resolve", "reject"] as const).map((completion) => ({ transition, completion })),
    ),
  )(
    "#6 makes old A $completion silent after $transition while the current owner stays busy",
    async ({ transition, completion }) => {
      const port = createPostReactionSettlementChannel();
      const events = collectEvents(port);
      const oldRequest = deferred<{ liked: boolean; likeCount: number }>();
      const currentRequest = deferred<{ liked: boolean; likeCount: number }>();
      const toggleLike = vi
        .fn<ToggleLike>()
        .mockReturnValueOnce(oldRequest.promise)
        .mockReturnValueOnce(currentRequest.promise);
      const harness = await makeLikeHarness({ settlements: port, toggleLike });

      const oldAction = harness.controller.handleLike();
      expect(toggleLike).toHaveBeenCalledWith(1, true);
      harness.tid.value = 2;
      harness.liked.value = false;
      harness.likeCount.value = 10;
      if (transition === "A-B-A") {
        harness.tid.value = 1;
        harness.liked.value = true;
        harness.likeCount.value = 20;
      } else {
        harness.liked.value = true;
      }

      expect(harness.controller.likeBusy.value).toBe(false);
      const currentTid = transition === "A-B-A" ? 1 : 2;
      const currentBaselineCount = transition === "A-B-A" ? 20 : 10;
      const currentAction = harness.controller.handleLike();
      expect(toggleLike).toHaveBeenLastCalledWith(currentTid, false);
      expect(harness.controller.likeBusy.value).toBe(true);
      expect(harness.controller.liked.value).toBe(false);
      expectLikeDisplay(harness.controller, currentBaselineCount - 1);

      if (completion === "resolve") oldRequest.resolve({ liked: true, likeCount: 99 });
      else oldRequest.reject(new Error("stale old A failure"));
      await expect(oldAction).resolves.toBeUndefined();

      expect(events).toEqual([]);
      expect(harness.controller.likeBusy.value).toBe(true);
      expect(harness.controller.liked.value).toBe(false);
      expectLikeDisplay(harness.controller, currentBaselineCount - 1);

      currentRequest.resolve({ liked: true, likeCount: 33.9 });
      await currentAction;
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        kind: "like",
        tid: currentTid,
        liked: true,
        likeCount: 33,
      });
      expect(harness.controller.likeBusy.value).toBe(false);
      expectLikeDisplay(harness.controller, 33);
    },
  );

  it("#6 treats one real parent tid/liked/count rerender as a Footer owner boundary", async () => {
    const events = collectEvents(postReactionSettlements);
    const oldRequest = deferred<{ liked: boolean; likeCount: number }>();
    const currentRequest = deferred<{ liked: boolean; likeCount: number }>();
    togglePostLikeMock
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);
    const { state, footer } = mountStaticFooter({ tid: 1, liked: false, likeCount: 3 });

    const oldAction = footer.clickLike();
    Object.assign(state, { tid: 2, liked: true, likeCount: 11 });
    await nextTick();
    expect(footer.button().props.disabled).toBe(false);
    expect(footer.button().props["aria-pressed"]).toBe(true);
    expect(footer.button().props["aria-label"]).toContain("当前 11 个喜欢");

    const currentAction = footer.clickLike();
    expect(togglePostLikeMock).toHaveBeenCalledTimes(2);
    expect(togglePostLikeMock).toHaveBeenLastCalledWith(2, false);
    oldRequest.resolve({ liked: true, likeCount: 99 });
    await oldAction;
    await nextTick();
    expect(events).toEqual([]);
    expect(footer.button().props.disabled).toBe(true);
    expect(footer.button().props["aria-pressed"]).toBe(false);
    expect(footer.button().props["aria-label"]).toContain("当前 10 个喜欢");

    currentRequest.resolve({ liked: false, likeCount: 8 });
    await currentAction;
    await nextTick();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "like", tid: 2, liked: false, likeCount: 8 });
    expect(footer.button().props.disabled).toBe(false);
  });

  it.each([
    { label: "zero", tid: 0 },
    { label: "negative", tid: -2 },
    { label: "fractional", tid: 1.5 },
    { label: "NaN", tid: Number.NaN },
    { label: "Infinity", tid: Number.POSITIVE_INFINITY },
    { label: "-Infinity", tid: Number.NEGATIVE_INFINITY },
  ])(
    "#6 rejects invalid $label tids without API, display, busy, or event changes",
    async ({ tid }) => {
      const port = createPostReactionSettlementChannel();
      const events = collectEvents(port);
      const toggleLike = vi.fn<ToggleLike>();
      const harness = await makeLikeHarness({
        tid: ref(tid),
        liked: ref<boolean | undefined>(true),
        likeCount: ref<number | undefined>(6),
        settlements: port,
        toggleLike,
      });

      const before = {
        liked: harness.controller.liked.value,
        count: harness.controller.likeCount.value,
        label: harness.controller.likeLabel.value,
        busy: harness.controller.likeBusy.value,
      };
      await expect(harness.controller.handleLike()).resolves.toBeUndefined();

      expect(toggleLike).not.toHaveBeenCalled();
      expect(events).toEqual([]);
      expect({
        liked: harness.controller.liked.value,
        count: harness.controller.likeCount.value,
        label: harness.controller.likeLabel.value,
        busy: harness.controller.likeBusy.value,
      }).toEqual(before);
    },
  );

  it("#6 permanently stales old A across A-invalid-A without exposing internal tickets", async () => {
    const port = createPostReactionSettlementChannel();
    const events = collectEvents(port);
    const oldRequest = deferred<{ liked: boolean; likeCount: number }>();
    const currentRequest = deferred<{ liked: boolean; likeCount: number }>();
    const toggleLike = vi
      .fn<ToggleLike>()
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);
    const harness = await makeLikeHarness({ settlements: port, toggleLike });

    const oldAction = harness.controller.handleLike();
    harness.tid.value = Number.NaN;
    harness.liked.value = true;
    harness.likeCount.value = 30;
    expect(harness.controller.likeBusy.value).toBe(false);
    harness.tid.value = 1;
    harness.liked.value = false;
    harness.likeCount.value = 7;
    const currentAction = harness.controller.handleLike();
    expect(toggleLike).toHaveBeenLastCalledWith(1, true);

    oldRequest.resolve({ liked: true, likeCount: 99 });
    await oldAction;
    expect(events).toEqual([]);
    expect(harness.controller.likeBusy.value).toBe(true);
    expect(harness.controller.liked.value).toBe(true);
    expectLikeDisplay(harness.controller, 8);

    currentRequest.resolve({ liked: false, likeCount: 6 });
    await currentAction;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "like", tid: 1, liked: false, likeCount: 6 });
  });

  it("#7 lets the current authoritative response beat a pending same-tid props rebase", async () => {
    const port = createPostReactionSettlementChannel();
    const events = collectEvents(port);
    const request = deferred<{ liked: boolean; likeCount: number }>();
    const harness = await makeLikeHarness({
      settlements: port,
      toggleLike: vi.fn<ToggleLike>().mockReturnValueOnce(request.promise),
    });

    const action = harness.controller.handleLike();
    harness.liked.value = true;
    harness.likeCount.value = 14.8;
    expect(harness.controller.likeBusy.value).toBe(true);
    expect(harness.controller.liked.value).toBe(true);
    expectLikeDisplay(harness.controller, 14);
    request.resolve({ liked: false, likeCount: 2.9 });
    await action;

    expect(harness.controller.likeBusy.value).toBe(false);
    expect(harness.controller.liked.value).toBe(false);
    expectLikeDisplay(harness.controller, 2);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "like", tid: 1, liked: false, likeCount: 2 });
  });

  it("#8 retires success before publish and preserves a subscriber's inverse Like", async () => {
    const port = createPostReactionSettlementChannel();
    const firstRequest = deferred<{ liked: boolean; likeCount: number }>();
    const secondRequest = deferred<{ liked: boolean; likeCount: number }>();
    const toggleLike = vi
      .fn<ToggleLike>()
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);
    const harness = await makeLikeHarness({ settlements: port, toggleLike });
    let secondAction: Promise<void> | undefined;
    let delivery:
      | {
          liked: boolean;
          count: number;
          busyBefore: boolean;
          busyAfter: boolean;
          requests: number;
        }
      | undefined;
    let reentered = false;
    activeUnsubscribers.push(
      port.subscribe((event) => {
        if (reentered || event.kind !== "like") return;
        reentered = true;
        const liked = harness.controller.liked.value;
        const count = harness.controller.likeCount.value;
        const busyBefore = harness.controller.likeBusy.value;
        secondAction = harness.controller.handleLike();
        delivery = {
          liked,
          count,
          busyBefore,
          busyAfter: harness.controller.likeBusy.value,
          requests: toggleLike.mock.calls.length,
        };
      }),
    );
    const events = collectEvents(port);

    const firstAction = harness.controller.handleLike();
    firstRequest.resolve({ liked: true, likeCount: 9 });
    await firstAction;

    expect(delivery).toEqual({
      liked: true,
      count: 9,
      busyBefore: false,
      busyAfter: true,
      requests: 2,
    });
    expect(toggleLike).toHaveBeenLastCalledWith(1, false);
    expect(harness.controller.likeBusy.value).toBe(true);
    expect(harness.controller.liked.value).toBe(false);
    expectLikeDisplay(harness.controller, 8);
    expect(events).toHaveLength(1);

    secondRequest.resolve({ liked: true, likeCount: 15.7 });
    if (!secondAction) throw new Error("expected the settlement listener to re-enter Like");
    await secondAction;
    expect(events).toHaveLength(2);
    expect(
      events.map((event) => (event.kind === "like" ? [event.liked, event.likeCount] : [])),
    ).toEqual([
      [true, 9],
      [true, 15],
    ]);
    expect(harness.controller.likeBusy.value).toBe(false);
    expect(harness.controller.liked.value).toBe(true);
    expectLikeDisplay(harness.controller, 15);
  });

  it("#9 isolates a throwing listener while later listeners and mounted Feed receive success", async () => {
    const port = createPostReactionSettlementChannel();
    activeUnsubscribers.push(
      port.subscribe(() => {
        throw new Error("listener failed");
      }),
    );
    const events = collectEvents(port);
    const feed = makeFeed(port);
    feed.items.value = [feedItem(1, "listener isolation", { liked: false, likeCount: 3 })];
    const harness = await makeLikeHarness({
      settlements: port,
      toggleLike: vi.fn<ToggleLike>().mockResolvedValueOnce({ liked: true, likeCount: 4 }),
    });

    await expect(harness.controller.handleLike()).resolves.toBeUndefined();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "like", tid: 1, liked: true, likeCount: 4 });
    expect(feed.items.value[0]).toMatchObject({ liked: true, likeCount: 4 });
    expect(harness.controller.liked.value).toBe(true);
    expectLikeDisplay(harness.controller, 4);
  });

  it("#10 isolates an injected real port from the named singleton and patches only its Feed", async () => {
    const port = createPostReactionSettlementChannel();
    const events = collectEvents(port);
    const singletonEvents = collectEvents(postReactionSettlements);
    const feed = makeFeed(port);
    const first = feedItem(1, "injected matching", { liked: false, likeCount: 3 });
    const second = feedItem(2, "injected nonmatching", { liked: true, likeCount: 20 });
    feed.items.value = [first, second];
    const matchingBefore = feed.items.value[0];
    const nonmatchingBefore = feed.items.value[1];
    const injectedToggle = vi.fn<ToggleLike>().mockResolvedValueOnce({ liked: true, likeCount: 6 });
    const harness = await makeLikeHarness({
      settlements: port,
      toggleLike: injectedToggle,
    });

    await harness.controller.handleLike();

    expect(injectedToggle).toHaveBeenCalledWith(1, true);
    expect(togglePostLikeMock).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    expect(singletonEvents).toEqual([]);
    expect(feed.items.value[0]).not.toBe(matchingBefore);
    expect(feed.items.value[0]).toMatchObject({
      tid: 1,
      title: "injected matching",
      liked: true,
      likeCount: 6,
    });
    expect(feed.items.value[1]).toBe(nonmatchingBefore);
  });

  it("#11 wires the real Footer default API to the named singleton and no-option Feed", async () => {
    const events = collectEvents(postReactionSettlements);
    const feed = makeFeed();
    const first = feedItem(1, "default singleton", { liked: false, likeCount: 2 });
    feed.items.value = [first];
    const matchingBefore = feed.items.value[0];
    const request = deferred<{ liked: boolean; likeCount: number }>();
    togglePostLikeMock.mockReturnValueOnce(request.promise);
    const footer = mountFeedFooter(feed, 1);

    const action = footer.clickLike();
    expect(togglePostLikeMock).toHaveBeenCalledTimes(1);
    expect(togglePostLikeMock).toHaveBeenCalledWith(1, true);
    expect(events).toEqual([]);
    request.resolve({ liked: false, likeCount: 7.9 });
    await action;
    await nextTick();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "like", tid: 1, liked: false, likeCount: 7 });
    expect(feed.items.value[0]).not.toBe(matchingBefore);
    expect(feed.items.value[0]).toMatchObject({ liked: false, likeCount: 7 });
    expect(footer.button().props["aria-pressed"]).toBe(false);
    expect(footer.button().props["aria-label"]).toContain("当前 7 个喜欢");
    expect(String(footer.button().props["aria-label"])).not.toContain("7.9");
    expect(footer.onLiked).not.toHaveBeenCalled();
    expectNoLikeFeedback();
  });

  it.each(["refresh", "append"] as const)(
    "#12 overlays a post-boundary real Footer settlement over stale %s transport reactions",
    async (kind) => {
      const events = collectEvents(postReactionSettlements);
      const feed = makeFeed();
      feed.items.value = [
        feedItem(1, "old transport title", {
          bodyPreview: "old transport body",
          liked: false,
          likeCount: 3,
        }),
      ];
      feed.hasMore.value = true;
      feed.page.value = 2;
      const footer = mountFeedFooter(feed, 1);
      const transport = deferred<FeedResponse>();
      fetchFeedMock.mockReturnValueOnce(transport.promise);

      const load = feed.loadFeed(kind);
      expect(fetchFeedMock).toHaveBeenCalledTimes(1);
      const likeRequest = deferred<{ liked: boolean; likeCount: number }>();
      togglePostLikeMock.mockReturnValueOnce(likeRequest.promise);
      const likeAction = footer.clickLike();
      expect(togglePostLikeMock).toHaveBeenCalledWith(1, true);
      likeRequest.resolve({ liked: true, likeCount: 8 });
      await likeAction;
      await nextTick();
      expect(events).toHaveLength(1);
      expect(feed.items.value[0]).toMatchObject({ liked: true, likeCount: 8 });

      transport.resolve(
        feedResponse(
          [
            feedItem(1, "new transport title", {
              bodyPreview: "new transport body",
              liked: false,
              likeCount: 1,
            }),
          ],
          { hasMore: kind === "append", nextPage: kind === "append" ? 3 : null },
        ),
      );
      await load;
      await nextTick();

      expect(feed.items.value[0]).toMatchObject({
        title: "new transport title",
        bodyPreview: "new transport body",
        liked: true,
        likeCount: 8,
      });
      expect(footer.button().props["aria-pressed"]).toBe(true);
      expect(footer.button().props["aria-label"]).toContain("当前 8 个喜欢");
    },
  );

  it("#12 disposes a truly unmounted nested Footer before its late replace completion", async () => {
    const events = collectEvents(postReactionSettlements);
    const feed = makeFeed();
    feed.items.value = [feedItem(1, "removed card", { liked: false, likeCount: 3 })];
    const footer = mountFeedFooter(feed, 1);
    const likeRequest = deferred<{ liked: boolean; likeCount: number }>();
    togglePostLikeMock.mockReturnValueOnce(likeRequest.promise);
    const likeAction = footer.clickLike();
    const transport = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(transport.promise);

    const load = feed.loadFeed("replace");
    expect(fetchFeedMock).toHaveBeenCalledTimes(1);
    expect(feed.items.value).toEqual([]);
    await nextTick();
    expect(footer.maybeButton()).toBeNull();

    likeRequest.resolve({ liked: true, likeCount: 9 });
    await likeAction;
    expect(events).toEqual([]);
    expect(footer.onLiked).not.toHaveBeenCalled();
    expect(feed.items.value).toEqual([]);

    transport.resolve(
      feedResponse([feedItem(1, "replace authority", { liked: false, likeCount: 12 })]),
    );
    await load;
    await nextTick();
    expect(feed.items.value[0]).toMatchObject({
      title: "replace authority",
      liked: false,
      likeCount: 12,
    });
    expect(footer.button().props["aria-pressed"]).toBe(false);
  });

  it("#12 overlays replace through an independent real composable producer on the same port", async () => {
    const port = createPostReactionSettlementChannel();
    const events = collectEvents(port);
    const feed = makeFeed(port);
    feed.items.value = [feedItem(1, "independent producer", { liked: false, likeCount: 3 })];
    const transport = deferred<FeedResponse>();
    fetchFeedMock.mockReturnValueOnce(transport.promise);
    const load = feed.loadFeed("replace");
    expect(fetchFeedMock).toHaveBeenCalledTimes(1);
    expect(feed.items.value).toEqual([]);
    const likeRequest = deferred<{ liked: boolean; likeCount: number }>();
    const producer = await makeLikeHarness({
      settlements: port,
      toggleLike: vi.fn<ToggleLike>().mockReturnValueOnce(likeRequest.promise),
    });

    const likeAction = producer.controller.handleLike();
    likeRequest.resolve({ liked: true, likeCount: 10 });
    await likeAction;
    expect(events).toHaveLength(1);
    transport.resolve(
      feedResponse([
        feedItem(1, "replace transport fields", {
          bodyPreview: "replace transport body",
          liked: false,
          likeCount: 1,
        }),
      ]),
    );
    await load;

    expect(feed.items.value[0]).toMatchObject({
      title: "replace transport fields",
      bodyPreview: "replace transport body",
      liked: true,
      likeCount: 10,
    });
  });

  it.each(["replace", "refresh", "append"] as const)(
    "#12 lets a later physical %s response retire an earlier Footer settlement",
    async (kind) => {
      const feed = makeFeed();
      feed.items.value = [feedItem(1, "before later request", { liked: false, likeCount: 3 })];
      feed.hasMore.value = true;
      feed.page.value = 2;
      const footer = mountFeedFooter(feed, 1);
      togglePostLikeMock.mockResolvedValueOnce({ liked: true, likeCount: 8 });

      await footer.clickLike();
      await nextTick();
      expect(feed.items.value[0]).toMatchObject({ liked: true, likeCount: 8 });

      const transport = deferred<FeedResponse>();
      fetchFeedMock.mockReturnValueOnce(transport.promise);
      const load = feed.loadFeed(kind);
      expect(fetchFeedMock).toHaveBeenCalledTimes(1);
      transport.resolve(
        feedResponse(
          [
            feedItem(1, `later ${kind} authority`, {
              bodyPreview: `later ${kind} body`,
              liked: false,
              likeCount: 2,
            }),
          ],
          { hasMore: kind === "append", nextPage: kind === "append" ? 3 : null },
        ),
      );
      await load;
      await nextTick();

      expect(feed.items.value[0]).toMatchObject({
        title: `later ${kind} authority`,
        bodyPreview: `later ${kind} body`,
        liked: false,
        likeCount: 2,
      });
    },
  );

  it("#13 provides no event replay or sequence advance to a remounted Feed or late subscriber", async () => {
    const port = createPostReactionSettlementChannel();
    const firstFeed = makeFeed(port);
    firstFeed.items.value = [feedItem(1, "first mount", { liked: false, likeCount: 3 })];
    const producer = await makeLikeHarness({
      settlements: port,
      toggleLike: vi.fn<ToggleLike>().mockResolvedValueOnce({ liked: true, likeCount: 7 }),
    });

    await producer.controller.handleLike();
    expect(firstFeed.items.value[0]).toMatchObject({ liked: true, likeCount: 7 });
    const sequenceAfterLike = port.currentSequence();
    const lateSubscriber = vi.fn();
    activeUnsubscribers.push(port.subscribe(lateSubscriber));
    expect(lateSubscriber).not.toHaveBeenCalled();
    expect(port.currentSequence()).toBe(sequenceAfterLike);

    firstFeed.dispose();
    const remounted = makeFeed(port);
    expect(remounted.items.value).toEqual([]);
    fetchFeedMock.mockResolvedValueOnce(
      feedResponse([feedItem(1, "first remount fetch", { liked: false, likeCount: 2 })]),
    );
    await remounted.loadFeed("replace");

    expect(remounted.items.value[0]).toMatchObject({
      title: "first remount fetch",
      liked: false,
      likeCount: 2,
    });
    expect(lateSubscriber).not.toHaveBeenCalled();
    expect(port.currentSequence()).toBe(sequenceAfterLike);
  });

  it("#13 does not transfer a superseded request-local Like projection to the next request", async () => {
    const port = createPostReactionSettlementChannel();
    const feed = makeFeed(port);
    feed.items.value = [feedItem(1, "superseded base", { liked: false, likeCount: 3 })];
    feed.hasMore.value = true;
    feed.page.value = 2;
    const staleTransport = deferred<FeedResponse>();
    const currentTransport = deferred<FeedResponse>();
    fetchFeedMock
      .mockReturnValueOnce(staleTransport.promise)
      .mockReturnValueOnce(currentTransport.promise);
    const staleLoad = feed.loadFeed("append");
    expect(fetchFeedMock).toHaveBeenCalledTimes(1);
    const producer = await makeLikeHarness({
      settlements: port,
      toggleLike: vi.fn<ToggleLike>().mockResolvedValueOnce({ liked: true, likeCount: 9 }),
    });
    await producer.controller.handleLike();
    expect(feed.items.value[0]).toMatchObject({ liked: true, likeCount: 9 });

    const currentLoad = feed.refreshFeed();
    expect(fetchFeedMock).toHaveBeenCalledTimes(2);
    staleTransport.resolve(
      feedResponse([feedItem(1, "stale append", { liked: true, likeCount: 9 })]),
    );
    await staleLoad;
    currentTransport.resolve(
      feedResponse([feedItem(1, "current refresh", { liked: false, likeCount: 2 })]),
    );
    await currentLoad;

    expect(feed.items.value[0]).toMatchObject({
      title: "current refresh",
      liked: false,
      likeCount: 2,
    });
  });

  it.each(
    (["explicit", "scope"] as const).flatMap((disposal) =>
      (["resolve", "reject"] as const).map((completion) => ({ disposal, completion })),
    ),
  )(
    "#14 makes late $completion silent after $disposal disposal and leaves the real port usable",
    async ({ disposal, completion }) => {
      const port = createPostReactionSettlementChannel();
      const events = collectEvents(port);
      const request = deferred<{ liked: boolean; likeCount: number }>();
      const toggleLike = vi.fn<ToggleLike>().mockReturnValueOnce(request.promise);
      const harness = await makeLikeHarness({ settlements: port, toggleLike });

      const action = harness.controller.handleLike();
      expect(harness.controller.likeBusy.value).toBe(true);
      const displayedAtDisposal = {
        liked: harness.controller.liked.value,
        count: harness.controller.likeCount.value,
        label: harness.controller.likeLabel.value,
      };
      if (disposal === "scope") harness.scope.stop();
      else harness.controller.dispose();
      expect(harness.controller.likeBusy.value).toBe(false);
      const terminalState = {
        liked: harness.controller.liked.value,
        count: harness.controller.likeCount.value,
        label: harness.controller.likeLabel.value,
        busy: harness.controller.likeBusy.value,
      };
      expect(() => harness.controller.dispose()).not.toThrow();
      expect(() => harness.controller.dispose()).not.toThrow();
      expect({
        liked: harness.controller.liked.value,
        count: harness.controller.likeCount.value,
        label: harness.controller.likeLabel.value,
        busy: harness.controller.likeBusy.value,
      }).toEqual(terminalState);
      expect(events).toEqual([]);
      harness.tid.value = 2;
      harness.liked.value = false;
      harness.likeCount.value = 40;
      expect({
        liked: harness.controller.liked.value,
        count: harness.controller.likeCount.value,
        label: harness.controller.likeLabel.value,
      }).toEqual(displayedAtDisposal);

      if (completion === "resolve") request.resolve({ liked: true, likeCount: 99 });
      else request.reject(new Error("late disposed failure"));
      await expect(action).resolves.toBeUndefined();

      expect(events).toEqual([]);
      expect(harness.controller.likeBusy.value).toBe(false);
      await expect(harness.controller.handleLike()).resolves.toBeUndefined();
      expect(toggleLike).toHaveBeenCalledTimes(1);

      const fresh = await makeLikeHarness({
        tid: ref(3),
        settlements: port,
        toggleLike: vi.fn<ToggleLike>().mockResolvedValueOnce({ liked: true, likeCount: 6 }),
      });
      await fresh.controller.handleLike();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ kind: "like", tid: 3, liked: true, likeCount: 6 });
    },
  );
});
