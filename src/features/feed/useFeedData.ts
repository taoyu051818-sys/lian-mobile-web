import { computed, ref } from "vue";
import { DEFAULT_TABS, fetchFeed } from "../../api/feed";
import { fetchAuthMe } from "../../api/profile";
import type { FeedItem, FeedTab } from "../../types/feed";
import type { AudienceVisibility } from "../../types/audience";
import { LOADING_FEED, EMPTY_FEED, ERROR_LOAD_GENERIC, FEED_EMPTY_HINT } from "../../config/brand";
import {
  accountReadHistoryScope,
  GUEST_READ_HISTORY_SCOPE,
  readHistoryQuery,
  rememberReadItem as rememberScopedReadItem,
  type ReadHistoryScope,
} from "../../platform/browser-storage";

const PAGE_SIZE = 12;

type FeedHistoryOwner =
  | { status: "resolving" }
  | { status: "ready"; scope: ReadHistoryScope }
  | { status: "unavailable" };

interface FeedLogicalCompletion {
  promise: Promise<void>;
  settle: () => void;
}

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

export function useFeedData(options: { detailOpen: () => boolean; closeDetail: () => void }) {
  const tabs = ref<FeedTab[]>(DEFAULT_TABS);
  const activeTab = ref(DEFAULT_TABS[0].id);
  const items = ref<FeedItem[]>([]);
  const page = ref(1);
  const hasMore = ref(true);
  const loading = ref(false);
  const loadingMore = ref(false);
  const errorMessage = ref("");
  const selectedVisibilities = ref<Set<AudienceVisibility>>(new Set());
  let requestGeneration = 0;
  let lifecycleGeneration = 0;
  let disposed = false;
  let initializationStarted = false;
  let historyOwner: FeedHistoryOwner = { status: "resolving" };
  let ownerResolutionPromise: Promise<void> | null = null;
  let initializationPromise: Promise<void> | null = null;
  let resolvingCompletion: FeedLogicalCompletion | null = null;

  const isEmpty = computed(() => !loading.value && !errorMessage.value && items.value.length === 0);
  const canAutoLoadMore = computed(
    () => hasMore.value && !loading.value && !loadingMore.value && !options.detailOpen(),
  );

  async function loadFeed(reset = false) {
    if (disposed) return;
    // A reset represents a new tab/filter context, so it must be allowed to
    // supersede an in-flight request. Pagination remains single-flight.
    if (!reset && (loading.value || loadingMore.value)) return;
    if (!reset && !hasMore.value) return;

    const generation = ++requestGeneration;
    const lifecycle = lifecycleGeneration;
    const logicalCompletion = resolvingCompletion;
    errorMessage.value = "";
    if (reset) {
      loading.value = true;
      loadingMore.value = false;
      page.value = 1;
      hasMore.value = true;
    } else {
      loadingMore.value = true;
    }

    // Production initialization resolves account ownership before any Feed
    // request. Reset/tab/filter intents may still arrive meanwhile; each owns
    // a newer request generation, so only the latest continues when the shared
    // identity promise settles. Direct pre-initialize calls remain available
    // to isolated composable consumers and load without a read-history owner.
    if (initializationStarted && historyOwner.status === "resolving") {
      if (ownerResolutionPromise) {
        await (logicalCompletion
          ? Promise.race([ownerResolutionPromise, logicalCompletion.promise])
          : ownerResolutionPromise);
      }
    }
    if (disposed || lifecycle !== lifecycleGeneration || generation !== requestGeneration) {
      if (logicalCompletion) await logicalCompletion.promise;
      return;
    }

    try {
      const visibilityArray =
        selectedVisibilities.value.size > 0 ? Array.from(selectedVisibilities.value) : undefined;
      const read =
        historyOwner.status === "ready" ? readHistoryQuery(historyOwner.scope) : undefined;

      const response = await fetchFeed({
        tab: activeTab.value,
        page: reset ? 1 : page.value,
        limit: PAGE_SIZE,
        read,
        visibility: visibilityArray,
      });

      if (disposed || lifecycle !== lifecycleGeneration || generation !== requestGeneration) {
        return;
      }
      tabs.value = response.tabs.length ? response.tabs : DEFAULT_TABS;
      const nextItems = response.items || [];
      items.value = mergeFeedItems(reset ? [] : items.value, nextItems);
      hasMore.value = Boolean(response.hasMore);
      page.value = response.nextPage || (reset ? 2 : page.value + 1);
    } catch (error) {
      if (disposed || lifecycle !== lifecycleGeneration || generation !== requestGeneration) {
        return;
      }
      errorMessage.value = error instanceof Error ? error.message : ERROR_LOAD_GENERIC;
      if (reset) items.value = [];
    } finally {
      // A superseded request must not clear the loading flag owned by the
      // latest request; otherwise the list flashes stale content mid-load.
      if (!disposed && lifecycle === lifecycleGeneration && generation === requestGeneration) {
        if (reset) loading.value = false;
        else loadingMore.value = false;
        logicalCompletion?.settle();
        if (resolvingCompletion === logicalCompletion) resolvingCompletion = null;
      }
    }
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
      if (!disposed && lifecycle === lifecycleGeneration) {
        historyOwner = resolvedOwner;
      }
    });

    const initialLoad = loadFeed(true);
    initializationPromise = initialLoad;
    return initializationPromise;
  }

  function rememberReadItem(id: FeedItem["tid"]): void {
    if (disposed || historyOwner.status !== "ready") return;
    rememberScopedReadItem(historyOwner.scope, id);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    lifecycleGeneration += 1;
    requestGeneration += 1;
    historyOwner = { status: "unavailable" };
    loading.value = false;
    loadingMore.value = false;
    resolvingCompletion?.settle();
    resolvingCompletion = null;
  }

  // Tab switch is a user-initiated context change. Closing the detail panel
  // is a no-op when no detail is open (the FSM is `closed`), so we can drop
  // the open-check that the legacy code needed.
  function switchTab(tabId: string) {
    options.closeDetail();
    if (activeTab.value !== tabId) activeTab.value = tabId;
    void loadFeed(true);
  }

  function triggerLoadMore() {
    if (!canAutoLoadMore.value) return;
    void loadFeed(false);
  }

  function setSelectedVisibilities(visibilities: Set<AudienceVisibility>) {
    selectedVisibilities.value = visibilities;
    void loadFeed(true);
  }

  return {
    tabs,
    activeTab,
    items,
    page,
    hasMore,
    loading,
    loadingMore,
    errorMessage,
    isEmpty,
    canAutoLoadMore,
    selectedVisibilities,
    initialize,
    loadFeed,
    switchTab,
    triggerLoadMore,
    setSelectedVisibilities,
    rememberReadItem,
    dispose,
    LOADING_FEED,
    EMPTY_FEED,
    FEED_EMPTY_HINT,
  };
}
