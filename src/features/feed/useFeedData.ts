import { computed, ref } from "vue";
import { DEFAULT_TABS, fetchFeed } from "../../api/feed";
import { fetchAuthMe } from "../../api/profile";
import type { FeedItem, FeedTab } from "../../types/feed";
import type { AudienceVisibility } from "../../types/audience";
import { LOADING_FEED, EMPTY_FEED, ERROR_LOAD_GENERIC, FEED_EMPTY_HINT } from "../../config/brand";
import {
  postReactionSettlements,
  type PostReactionSettlement,
  type PostReactionSettlementPort,
} from "../reactions";
import {
  accountReadHistoryScope,
  GUEST_READ_HISTORY_SCOPE,
  readHistoryQuery,
  rememberReadItem as rememberScopedReadItem,
  type ReadHistoryScope,
} from "../../platform/browser-storage";

const PAGE_SIZE = 12;

type FeedRequestKind = "replace" | "refresh" | "append";

type FeedRequestDescriptor = Readonly<{
  kind: FeedRequestKind;
  tab: string;
  visibility?: readonly AudienceVisibility[];
  page: number;
}>;

type FeedHistoryOwner =
  | { status: "resolving" }
  | { status: "ready"; scope: ReadHistoryScope }
  | { status: "unavailable" };

interface FeedLogicalCompletion {
  promise: Promise<void>;
  settle: () => void;
}

interface ActiveFeedRequest {
  generation: number;
  lifecycle: number;
  descriptor: FeedRequestDescriptor;
  completion: FeedLogicalCompletion;
  retry: boolean;
  reactionBoundary: number | null;
  pendingLikeSettlements: Map<FeedItem["tid"], LikeSettlement>;
  pendingSaveSettlements: Map<FeedItem["tid"], SaveSettlement>;
}

type LikeSettlement = Extract<PostReactionSettlement, { kind: "like" }>;
type SaveSettlement = Extract<PostReactionSettlement, { kind: "save" }>;

function createFeedLogicalCompletion(): FeedLogicalCompletion {
  let settled = false;
  let resolvePromise!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    settle: () => {
      if (settled) return;
      settled = true;
      resolvePromise();
    },
  };
}

function canonicalVisibility(
  visibilities: ReadonlySet<AudienceVisibility>,
): readonly AudienceVisibility[] | undefined {
  if (visibilities.size === 0) return undefined;
  return Object.freeze(Array.from(visibilities).sort());
}

function sameVisibility(
  left: readonly AudienceVisibility[] | undefined,
  right: readonly AudienceVisibility[] | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function createDescriptor(
  kind: FeedRequestKind,
  tab: string,
  visibility: readonly AudienceVisibility[] | undefined,
  page: number,
): FeedRequestDescriptor {
  return Object.freeze({
    kind,
    tab,
    visibility,
    page,
  });
}

function sameDescriptor(left: FeedRequestDescriptor, right: FeedRequestDescriptor): boolean {
  return (
    left.kind === right.kind &&
    left.tab === right.tab &&
    left.page === right.page &&
    sameVisibility(left.visibility, right.visibility)
  );
}

function mergeFeedItems(base: readonly FeedItem[], incoming: readonly FeedItem[]): FeedItem[] {
  const merged: FeedItem[] = [];
  const slotByTid = new Map<FeedItem["tid"], number>();

  for (const item of [...base, ...incoming]) {
    if (!Number.isInteger(item.tid) || item.tid <= 0) {
      merged.push(item);
      continue;
    }
    const slot = slotByTid.get(item.tid);
    if (slot === undefined) {
      slotByTid.set(item.tid, merged.length);
      merged.push(item);
      continue;
    }
    merged[slot] = item;
  }

  return merged;
}

function projectReactionSettlements(
  feedItems: readonly FeedItem[],
  likeSettlements: ReadonlyMap<FeedItem["tid"], LikeSettlement>,
  saveSettlements: ReadonlyMap<FeedItem["tid"], SaveSettlement>,
): FeedItem[] {
  return feedItems.map((item) => {
    const like = likeSettlements.get(item.tid);
    const save = saveSettlements.get(item.tid);
    if (!like && !save) return item;
    return {
      ...item,
      ...(like ? { liked: like.liked, likeCount: like.likeCount } : {}),
      ...(save ? { bookmarked: save.bookmarked } : {}),
    };
  });
}

export function useFeedData(options: {
  detailOpen: () => boolean;
  closeDetail: () => void;
  settlements?: PostReactionSettlementPort;
}) {
  const settlements = options.settlements ?? postReactionSettlements;
  const tabs = ref<FeedTab[]>(DEFAULT_TABS);
  const activeTab = ref(DEFAULT_TABS[0].id);
  const items = ref<FeedItem[]>([]);
  const page = ref(1);
  const hasMore = ref(true);
  const loading = ref(false);
  const refreshing = ref(false);
  const loadingMore = ref(false);
  const errorMessage = ref("");
  const selectedVisibilities = ref<Set<AudienceVisibility>>(new Set());
  const failedRequest = ref<FeedRequestDescriptor | null>(null);

  let requestGeneration = 0;
  let lifecycleGeneration = 0;
  let disposed = false;
  let initializationStarted = false;
  let historyOwner: FeedHistoryOwner = { status: "resolving" };
  let ownerResolutionPromise: Promise<void> | null = null;
  let initializationPromise: Promise<void> | null = null;
  let resolvingCompletion: FeedLogicalCompletion | null = null;
  let activeRequest: ActiveFeedRequest | null = null;
  const latestLikeSequences = new Map<FeedItem["tid"], number>();
  const latestSaveSequences = new Map<FeedItem["tid"], number>();

  function applySettlement(event: PostReactionSettlement): void {
    if (disposed || !Number.isInteger(event.tid) || event.tid <= 0) return;

    const latestSequences = event.kind === "like" ? latestLikeSequences : latestSaveSequences;
    if (event.sequence <= (latestSequences.get(event.tid) ?? 0)) return;
    latestSequences.set(event.tid, event.sequence);

    let matched = false;
    const nextItems = items.value.map((item) => {
      if (item.tid !== event.tid) return item;
      matched = true;
      return event.kind === "like"
        ? { ...item, liked: event.liked, likeCount: event.likeCount }
        : { ...item, bookmarked: event.bookmarked };
    });
    if (matched) items.value = nextItems;

    const request = activeRequest;
    if (
      !request ||
      !isCurrent(request) ||
      request.reactionBoundary === null ||
      event.sequence <= request.reactionBoundary
    ) {
      return;
    }
    if (event.kind === "like") request.pendingLikeSettlements.set(event.tid, event);
    else request.pendingSaveSettlements.set(event.tid, event);
  }

  const unsubscribeSettlements = settlements.subscribe(applySettlement);

  const requestPending = computed(() => loading.value || refreshing.value || loadingMore.value);
  const isEmpty = computed(
    () => !requestPending.value && !errorMessage.value && items.value.length === 0,
  );
  const canAutoLoadMore = computed(
    () =>
      hasMore.value &&
      !requestPending.value &&
      failedRequest.value === null &&
      !options.detailOpen(),
  );

  function clearBusyState(): void {
    loading.value = false;
    refreshing.value = false;
    loadingMore.value = false;
  }

  function setBusyState(kind: FeedRequestKind): void {
    clearBusyState();
    if (kind === "replace") loading.value = true;
    else if (kind === "refresh") refreshing.value = true;
    else loadingMore.value = true;
  }

  function currentVisibility(): readonly AudienceVisibility[] | undefined {
    return canonicalVisibility(selectedVisibilities.value);
  }

  function descriptorFor(kind: FeedRequestKind): FeedRequestDescriptor {
    return createDescriptor(
      kind,
      activeTab.value,
      currentVisibility(),
      kind === "append" ? page.value : 1,
    );
  }

  function isCurrent(request: ActiveFeedRequest): boolean {
    return (
      !disposed &&
      request.lifecycle === lifecycleGeneration &&
      request.generation === requestGeneration &&
      activeRequest === request
    );
  }

  function finishCurrentRequest(request: ActiveFeedRequest): void {
    request.pendingLikeSettlements.clear();
    request.pendingSaveSettlements.clear();
    if (!isCurrent(request)) return;
    clearBusyState();
    activeRequest = null;
    if (resolvingCompletion === request.completion) resolvingCompletion = null;
    request.completion.settle();
  }

  async function executeRequest(request: ActiveFeedRequest): Promise<void> {
    if (initializationStarted && historyOwner.status === "resolving" && ownerResolutionPromise) {
      await Promise.race([ownerResolutionPromise, request.completion.promise]);
    }
    if (!isCurrent(request)) return;

    try {
      const read =
        historyOwner.status === "ready" ? readHistoryQuery(historyOwner.scope) : undefined;
      const query = {
        tab: request.descriptor.tab,
        page: request.descriptor.page,
        limit: PAGE_SIZE,
        read,
        visibility: request.descriptor.visibility ? [...request.descriptor.visibility] : undefined,
      };
      request.reactionBoundary = settlements.currentSequence();
      const response = await fetchFeed(query);

      if (!isCurrent(request)) return;
      tabs.value = response.tabs.length ? response.tabs : DEFAULT_TABS;
      const nextItems = response.items || [];
      items.value = projectReactionSettlements(
        mergeFeedItems(request.descriptor.kind === "append" ? items.value : [], nextItems),
        request.pendingLikeSettlements,
        request.pendingSaveSettlements,
      );
      hasMore.value = Boolean(response.hasMore);
      page.value = response.nextPage || request.descriptor.page + 1;
      errorMessage.value = "";
      failedRequest.value = null;
    } catch (error) {
      if (!isCurrent(request)) return;
      failedRequest.value = request.descriptor;
      errorMessage.value = error instanceof Error ? error.message : ERROR_LOAD_GENERIC;
    } finally {
      finishCurrentRequest(request);
    }
  }

  function admitRequest(descriptor: FeedRequestDescriptor, retry = false): Promise<void> {
    if (disposed) return Promise.resolve();

    if (activeRequest) {
      if (
        descriptor.kind === "refresh" &&
        activeRequest.descriptor.kind === "refresh" &&
        sameDescriptor(activeRequest.descriptor, descriptor)
      ) {
        return activeRequest.completion.promise;
      }
      if (descriptor.kind === "append") return Promise.resolve();
      if (retry && activeRequest.retry && sameDescriptor(activeRequest.descriptor, descriptor)) {
        return activeRequest.completion.promise;
      }

      if (activeRequest.completion !== resolvingCompletion) {
        activeRequest.completion.settle();
      }
      activeRequest.pendingLikeSettlements.clear();
      activeRequest.pendingSaveSettlements.clear();
    } else if (descriptor.kind === "append" && !hasMore.value) {
      return Promise.resolve();
    }

    const completion = resolvingCompletion ?? createFeedLogicalCompletion();
    const request: ActiveFeedRequest = {
      generation: ++requestGeneration,
      lifecycle: lifecycleGeneration,
      descriptor,
      completion,
      retry,
      reactionBoundary: null,
      pendingLikeSettlements: new Map(),
      pendingSaveSettlements: new Map(),
    };

    if (!retry) {
      errorMessage.value = "";
      failedRequest.value = null;
    }
    if (descriptor.kind === "replace") {
      items.value = [];
      page.value = 1;
      hasMore.value = true;
    }
    setBusyState(descriptor.kind);
    activeRequest = request;
    void executeRequest(request);
    return completion.promise;
  }

  function loadFeed(kind: FeedRequestKind): Promise<void> {
    return admitRequest(descriptorFor(kind));
  }

  async function resolveHistoryOwner(): Promise<FeedHistoryOwner> {
    try {
      const user = await fetchAuthMe();
      if (user === null) {
        return { status: "ready", scope: GUEST_READ_HISTORY_SCOPE };
      }
      const accountScope = accountReadHistoryScope(user.id || "");
      return accountScope ? { status: "ready", scope: accountScope } : { status: "unavailable" };
    } catch {
      return { status: "unavailable" };
    }
  }

  function initialize(): Promise<void> {
    if (disposed) return Promise.resolve();
    if (initializationPromise) return initializationPromise;

    initializationStarted = true;
    historyOwner = { status: "resolving" };
    const lifecycle = lifecycleGeneration;
    resolvingCompletion = createFeedLogicalCompletion();
    ownerResolutionPromise = resolveHistoryOwner().then((resolvedOwner) => {
      if (!disposed && lifecycle === lifecycleGeneration) historyOwner = resolvedOwner;
    });

    initializationPromise = admitRequest(descriptorFor("replace"));
    return initializationPromise;
  }

  function refreshFeed(): Promise<void> {
    return admitRequest(descriptorFor("refresh"));
  }

  function switchTab(tabId: string): Promise<void> {
    options.closeDetail();
    if (activeTab.value === tabId) return Promise.resolve();
    activeTab.value = tabId;
    return admitRequest(descriptorFor("replace"));
  }

  function triggerLoadMore(): Promise<void> {
    if (activeRequest) {
      if (
        activeRequest.retry &&
        activeRequest.descriptor.kind === "append" &&
        failedRequest.value &&
        sameDescriptor(activeRequest.descriptor, failedRequest.value)
      ) {
        return activeRequest.completion.promise;
      }
      return Promise.resolve();
    }
    if (failedRequest.value?.kind === "append") return retryFailedRequest();
    if (!canAutoLoadMore.value) return Promise.resolve();
    return admitRequest(descriptorFor("append"));
  }

  function setSelectedVisibilities(visibilities: Set<AudienceVisibility>): Promise<void> {
    const nextVisibility = canonicalVisibility(visibilities);
    if (sameVisibility(currentVisibility(), nextVisibility)) return Promise.resolve();
    selectedVisibilities.value = new Set(nextVisibility ?? []);
    return admitRequest(descriptorFor("replace"));
  }

  function retryFailedRequest(): Promise<void> {
    if (disposed || !failedRequest.value) return Promise.resolve();
    const failed = failedRequest.value;
    const descriptor = createDescriptor(
      failed.kind,
      failed.tab,
      failed.visibility ? Object.freeze([...failed.visibility]) : undefined,
      failed.page,
    );

    if (activeRequest) {
      return activeRequest.retry && sameDescriptor(activeRequest.descriptor, descriptor)
        ? activeRequest.completion.promise
        : Promise.resolve();
    }
    return admitRequest(descriptor, true);
  }

  function rememberReadItem(id: FeedItem["tid"]): void {
    if (disposed || historyOwner.status !== "ready") return;
    rememberScopedReadItem(historyOwner.scope, id);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    unsubscribeSettlements();
    lifecycleGeneration += 1;
    requestGeneration += 1;
    historyOwner = { status: "unavailable" };
    clearBusyState();
    activeRequest?.pendingLikeSettlements.clear();
    activeRequest?.pendingSaveSettlements.clear();
    activeRequest?.completion.settle();
    activeRequest = null;
    resolvingCompletion?.settle();
    resolvingCompletion = null;
    latestLikeSequences.clear();
    latestSaveSequences.clear();
  }

  return {
    tabs,
    activeTab,
    items,
    page,
    hasMore,
    loading,
    refreshing,
    loadingMore,
    requestPending,
    errorMessage,
    isEmpty,
    canAutoLoadMore,
    selectedVisibilities,
    initialize,
    loadFeed,
    refreshFeed,
    switchTab,
    triggerLoadMore,
    setSelectedVisibilities,
    retryFailedRequest,
    rememberReadItem,
    dispose,
    LOADING_FEED,
    EMPTY_FEED,
    FEED_EMPTY_HINT,
  };
}
