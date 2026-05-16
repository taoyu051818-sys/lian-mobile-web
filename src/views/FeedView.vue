<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { DEFAULT_TABS, fetchFeed } from "../api/feed";
import { prefersReducedMotion } from "../motion/useReducedMotion";
import type { PageChromeSpec } from "../shell/page-model";
import type { FeedItem, FeedItemId, FeedTab } from "../types/feed";
import { InlineError } from "../ui";
import PostDetailPanel from "./detail/PostDetailPanel.vue";
import FeedList from "./feed/FeedList.vue";
import FeedLoadMore from "./feed/FeedLoadMore.vue";
import { normalizeFeedItemId } from "./feed/feedItemId";
import { useFeedDetail, type CardOpenPayload, type CardTransitionSnapshot } from "./feed/useFeedDetail";
import { READ_HISTORY_KEY } from "../platform/browser-storage";
import { LOADING_FEED, EMPTY_FEED, ERROR_LOAD_GENERIC, FEED_VIEW_TITLE, FEED_FILTER_LABEL, FEED_EMPTY_HINT, CHANNEL_RELOAD } from "../config/brand";

const PAGE_SIZE = 12;
const SWIPE_THRESHOLD = 96;
const SWIPE_VERTICAL_GUARD = 52;
const DETAIL_DRAG_EDGE_GUARD = 28;
const CARDIFY_DISTANCE = 320;
const DRAG_STAGE_MIN_SCALE = 0.9;
const RETURN_ANIMATION_MS = 380;

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

const tabs = ref<FeedTab[]>(DEFAULT_TABS);
const activeTab = ref(DEFAULT_TABS[0].id);
const items = ref<FeedItem[]>([]);
const page = ref(1);
const hasMore = ref(true);
const loading = ref(false);
const loadingMore = ref(false);
const errorMessage = ref("");
const cardTransition = ref<CardTransitionSnapshot | null>(null);
const cardTransitionActive = ref(false);
const viewportWidth = ref(390);
const viewportHeight = ref(844);

function updateViewport() {
  if (typeof window === "undefined") return;
  viewportWidth.value = window.innerWidth || 390;
  viewportHeight.value = window.innerHeight || 844;
}

function readHistoryQuery() {
  try {
    const history = JSON.parse(localStorage.getItem(READ_HISTORY_KEY) || "[]") as Array<{ tid: FeedItemId | string }>;
    return history
      .map((entry) => normalizeFeedItemId(entry.tid))
      .filter(Boolean)
      .join(",");
  } catch {
    return "";
  }
}

function rememberReadItem(id: FeedItemId) {
  try {
    const normalizedId = normalizeFeedItemId(id);
    const history = JSON.parse(localStorage.getItem(READ_HISTORY_KEY) || "[]") as Array<{ tid: FeedItemId | string; lastViewedAt: string }>;
    const nextHistory = history.filter((entry) => normalizeFeedItemId(entry.tid) !== normalizedId);
    nextHistory.push({ tid: normalizedId, lastViewedAt: new Date().toISOString() });
    localStorage.setItem(READ_HISTORY_KEY, JSON.stringify(nextHistory.slice(-500)));
  } catch {
    // Reading history should never block opening a card.
  }
}

// QUARANTINE: v1 card-camera overlay timer handles (issue #85 / #274).
let pendingCardRaf = 0;
let pendingCardTimer: ReturnType<typeof setTimeout> | undefined;

function cancelCardTransitionTimers() {
  if (pendingCardRaf) {
    cancelAnimationFrame(pendingCardRaf);
    pendingCardRaf = 0;
  }
  if (pendingCardTimer !== undefined) {
    clearTimeout(pendingCardTimer);
    pendingCardTimer = undefined;
  }
}

// Detail lifecycle composable: owns detail data, history, open/close/retry.
const {
  selectedPostId, selectedPost, detailLoading, detailError,
  detailOpen, detailDragging, detailReturning,
  detailDragX, detailPointerId, detailGestureLocked,
  dragStartX, dragStartY,
  detailCardifyProgress, detailDragStyle,
  openItem, retryDetail, closeDetail,
  closeDetailWithCardify, resetDetailState,
} = useFeedDetail({
  // QUARANTINE: v1 card-camera overlay (issue #85 / #274). Temporary scaffolding; do not extend.
  startCardTransition(payload) {
    if (!payload || typeof window === "undefined" || prefersReducedMotion()) return;
    cancelCardTransitionTimers();
    cardTransition.value = payload;
    cardTransitionActive.value = false;
    void nextTick(() => {
      pendingCardRaf = requestAnimationFrame(() => {
        pendingCardRaf = 0;
        cardTransitionActive.value = true;
        pendingCardTimer = window.setTimeout(() => {
          pendingCardTimer = undefined;
          cardTransition.value = null;
          cardTransitionActive.value = false;
        }, 320);
      });
    });
  },
  rememberReadItem,
  updateViewport,
  prefersReducedMotion,
  viewportWidth,
  viewportHeight,
  cardifyDistance: CARDIFY_DISTANCE,
  dragStageMinScale: DRAG_STAGE_MIN_SCALE,
  returnAnimationMs: RETURN_ANIMATION_MS,
});

const isEmpty = computed(() => !loading.value && !errorMessage.value && items.value.length === 0);
const cardTransitionStyle = computed(() => {
  const snapshot = cardTransition.value;
  if (!snapshot) return undefined;
  return {
    "--card-top": `${snapshot.rect.top}px`,
    "--card-left": `${snapshot.rect.left}px`,
    "--card-width": `${snapshot.rect.width}px`,
    "--card-height": `${snapshot.rect.height}px`,
  };
});
const canAutoLoadMore = computed(() => (
  hasMore.value
  && !loading.value
  && !loadingMore.value
  && !detailOpen.value
));

// Declarative chrome: emit spec whenever relevant state changes.
const pageChrome = computed<PageChromeSpec>(() => ({
  top: {
    tabs: {
      kind: "tabs",
      items: tabs.value,
      activeKey: activeTab.value,
      ariaLabel: FEED_FILTER_LABEL,
    },
    onTabSelect: switchTab,
  },
  autoHideOnDetail: detailOpen.value,
}));

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true });

async function loadFeed(reset = false) {
  if (loading.value || loadingMore.value) return;
  if (!reset && !hasMore.value) return;

  errorMessage.value = "";
  if (reset) {
    loading.value = true;
    page.value = 1;
    hasMore.value = true;
    if (detailOpen.value) {
      closeDetailWithCardify();
    } else {
      resetDetailState();
    }
  } else {
    loadingMore.value = true;
  }

  try {
    const response = await fetchFeed({
      tab: activeTab.value,
      page: reset ? 1 : page.value,
      limit: PAGE_SIZE,
      read: readHistoryQuery(),
    });

    tabs.value = response.tabs.length ? response.tabs : DEFAULT_TABS;
    const nextItems = response.items || [];
    items.value = reset ? nextItems : [...items.value, ...nextItems];
    hasMore.value = Boolean(response.hasMore);
    page.value = response.nextPage || (reset ? 2 : page.value + 1);
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : ERROR_LOAD_GENERIC;
    if (reset) items.value = [];
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function switchTab(tabId: string) {
  if (activeTab.value === tabId) {
    void loadFeed(true);
    return;
  }
  activeTab.value = tabId;
  void loadFeed(true);
}

function triggerLoadMore() {
  if (!canAutoLoadMore.value) return;
  void loadFeed(false);
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest(".post-detail-panel__gallery, .post-detail-panel__gallery-item")) return false;
  return Boolean(target.closest(".post-detail-panel__topbar, .post-detail-panel__dock, .post-detail-panel__report, .post-detail-panel__lightbox, a, button, input, textarea, select, [role='button']"));
}

function isInsideDetailDragBand(x: number) {
  return x >= DETAIL_DRAG_EDGE_GUARD && x <= viewportWidth.value - DETAIL_DRAG_EDGE_GUARD;
}

function abortDetailDrag(event: PointerEvent) {
  detailDragging.value = false;
  detailPointerId.value = null;
  detailGestureLocked.value = null;
  detailDragX.value = 0;
  (event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId);
}

function onDetailPointerDown(event: PointerEvent) {
  if (!detailOpen.value || detailLoading.value || detailReturning.value || isInteractiveTarget(event.target)) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  updateViewport();
  if (!isInsideDetailDragBand(event.clientX)) return;
  dragStartX.value = event.clientX;
  dragStartY.value = event.clientY;
  detailDragX.value = 0;
  detailDragging.value = true;
  detailPointerId.value = event.pointerId;
  detailGestureLocked.value = null;
  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
}

function onDetailPointerMove(event: PointerEvent) {
  if (!detailDragging.value || detailPointerId.value !== event.pointerId) return;
  const deltaX = event.clientX - dragStartX.value;
  const deltaY = event.clientY - dragStartY.value;
  if (!detailGestureLocked.value) {
    if (Math.abs(deltaY) > SWIPE_VERTICAL_GUARD && Math.abs(deltaY) > Math.abs(deltaX)) {
      detailGestureLocked.value = "vertical";
      abortDetailDrag(event);
      return;
    }
    if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY) * 1.05) {
      detailGestureLocked.value = "horizontal";
    }
  }
  if (detailGestureLocked.value !== "horizontal") return;
  event.preventDefault();
  const nextDragX = Math.max(-CARDIFY_DISTANCE, Math.min(CARDIFY_DISTANCE, deltaX));
  detailDragX.value = nextDragX;
}

function onDetailPointerUp(event: PointerEvent) {
  if (!detailDragging.value || detailPointerId.value !== event.pointerId) return;
  const finalX = detailDragX.value;
  detailDragging.value = false;
  detailPointerId.value = null;
  detailGestureLocked.value = null;
  (event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId);
  if (Math.abs(finalX) > SWIPE_THRESHOLD) {
    closeDetailWithCardify({ direction: finalX < 0 ? -1 : 1 });
    return;
  }
  detailDragX.value = 0;
}

function onDetailPointerCancel(event: PointerEvent) {
  if (detailPointerId.value !== event.pointerId) return;
  abortDetailDrag(event);
}

onMounted(() => {
  updateViewport();
  window.addEventListener("resize", updateViewport);
  emit("chrome", pageChrome.value);
  void loadFeed(true);
});

onBeforeUnmount(() => {
  cancelCardTransitionTimers();
  window.removeEventListener("resize", updateViewport);
});
</script>

<template>
  <section
    class="feed-view"
    :class="{ 'is-detail-open': detailOpen, 'is-detail-dragging': detailDragging, 'is-detail-returning': detailReturning }"
    :style="detailDragStyle"
    aria-labelledby="feed-view-title"
  >
    <h1 id="feed-view-title" class="feed-view__sr-title">{{ FEED_VIEW_TITLE }}</h1>

    <InlineError v-if="errorMessage">
      {{ errorMessage }}
      <button type="button" @click="loadFeed(true)">{{ CHANNEL_RELOAD }}</button>
    </InlineError>

    <div v-if="loading" class="feed-view__state" role="status">
      {{ LOADING_FEED }}
    </div>

    <div v-else-if="isEmpty" class="feed-view__state feed-view__state--empty">
      <strong>{{ EMPTY_FEED }}</strong>
      <span>{{ FEED_EMPTY_HINT }}</span>
    </div>

    <div v-show="!detailOpen || detailReturning || detailDragging" class="feed-view__content" :class="{ 'is-under-detail': detailOpen }">
      <FeedList v-if="!loading && !isEmpty" :items="items" @open="openItem" />

      <FeedLoadMore
        v-if="items.length"
        :has-more="hasMore"
        :loading-more="loadingMore"
        :can-auto-load-more="canAutoLoadMore"
        @load-more="triggerLoadMore"
      />
    </div>

    <PostDetailPanel
      v-if="detailOpen"
      key="feed-detail"
      class="feed-view__detail"
      :class="{ 'is-dragging': detailDragging, 'is-returning': detailReturning }"
      :style="detailDragStyle"
      :post="selectedPost"
      :loading="detailLoading"
      :error="detailError"
      @close="closeDetail"
      @retry="retryDetail"
      @pointerdown="onDetailPointerDown"
      @pointermove="onDetailPointerMove"
      @pointerup="onDetailPointerUp"
      @pointercancel="onDetailPointerCancel"
    />

    <!-- QUARANTINE: v1 card-camera overlay (issue #85 / #274). Temporary scaffolding; do not extend. -->
    <div
      v-if="cardTransition"
      class="feed-view__card-transition"
      :class="{ 'is-active': cardTransitionActive }"
      :style="cardTransitionStyle"
      aria-hidden="true"
    >
      <img v-if="cardTransition.item.cover" :src="cardTransition.item.cover" :alt="cardTransition.item.title" />
      <span v-if="cardTransition.item.primaryTag" class="feed-view__card-transition-tag">{{ cardTransition.item.primaryTag }}</span>
      <strong>{{ cardTransition.item.title }}</strong>
    </div>
  </section>
</template>

<style scoped>
.feed-view {
  display: grid;
  gap: var(--space-3);
  overscroll-behavior-x: contain;
  padding-top: calc(var(--floating-bar-height) + env(safe-area-inset-top));
}

.feed-view.is-detail-open {
  padding-top: 0;
}

.feed-view__sr-title {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.feed-view__content {
  display: grid;
  gap: var(--space-3);
  transition: opacity var(--motion-standard) var(--motion-ease-standard), transform var(--motion-standard) var(--motion-ease-standard), filter var(--motion-standard) var(--motion-ease-standard);
}

.feed-view__content.is-under-detail {
  opacity: var(--feed-under-detail-opacity, 0.1);
  transform: scale(var(--feed-under-detail-scale, 0.985));
  filter: saturate(0.96);
}

.feed-view__state {
  display: grid;
  gap: var(--space-2);
  min-height: 132px;
  place-items: center;
  color: var(--lian-muted);
  text-align: center;
}

.feed-view__state--empty {
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card);
}

.feed-view__detail {
  min-height: calc(100vh - var(--space-6));
  overscroll-behavior-x: contain;
  touch-action: pan-y;
}

.feed-view__detail.is-dragging {
  cursor: grabbing;
  touch-action: none;
}

.inline-error button {
  min-height: 32px;
  margin-left: var(--space-2);
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: currentColor;
  font-weight: 900;
}
</style>
