<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { fetchFeed } from "../api/feed";
import { useFloatingChromeController } from "../motion/floatingChrome";
import { useShellChrome } from "../shell/useShellChrome";
import type { FeedItem, FeedItemId, FeedTab } from "../types/feed";
import { InlineError, LianButton } from "../ui";
import PostDetailPanel from "./detail/PostDetailPanel.vue";
import FeedList from "./feed/FeedList.vue";
import FeedLoadMore from "./feed/FeedLoadMore.vue";
import { useFeedDetail, type CardOpenPayload, type CardTransitionSnapshot } from "./feed/useFeedDetail";
import { READ_HISTORY_KEY, HOME_UPDATE_PROBE_PREFIX } from "../platform/browser-storage";

const DEFAULT_TABS: FeedTab[] = [
  { id: "此刻", label: "此刻" },
  { id: "精选", label: "精选" },
];
const PAGE_SIZE = 12;
const HOME_UPDATE_PROBE_VERSION = "home-ui-main-2026-05-05-01";
const HOME_UPDATE_PROBE_KEY = `${HOME_UPDATE_PROBE_PREFIX}.${HOME_UPDATE_PROBE_VERSION}`;
const UPDATE_PROBE_ENABLED = import.meta.env.DEV;
const SWIPE_THRESHOLD = 96;
const SWIPE_VERTICAL_GUARD = 52;
const DETAIL_DRAG_EDGE_GUARD = 28;
const CARDIFY_DISTANCE = 320;
const DRAG_STAGE_MIN_SCALE = 0.9;
const CHROME_EXIT_DISTANCE = 0;
const RETURN_ANIMATION_MS = 380;

const emit = defineEmits<{
  chrome: [hidden: boolean];
}>();

const tabs = ref<FeedTab[]>(DEFAULT_TABS);
const activeTab = ref(DEFAULT_TABS[0].id);
const items = ref<FeedItem[]>([]);
const page = ref(1);
const hasMore = ref(true);
const loading = ref(false);
const loadingMore = ref(false);
const errorMessage = ref("");
const showUpdateProbe = ref(false);
const cardTransition = ref<CardTransitionSnapshot | null>(null);
const cardTransitionActive = ref(false);
const viewportWidth = ref(390);
const viewportHeight = ref(844);

const { setRegion } = useShellChrome();
const feedTabsChrome = useFloatingChromeController({ initialPhase: "visible" });
const detailChrome = useFloatingChromeController({ initialPhase: "hidden" });
const detailChromePhase = detailChrome.phase;
const detailChromeStyle = detailChrome.style;
const feedTabsChromeState = feedTabsChrome.phase;

function updateViewport() {
  if (typeof window === "undefined") return;
  viewportWidth.value = window.innerWidth || 390;
  viewportHeight.value = window.innerHeight || 844;
}

function readHistoryQuery() {
  try {
    const history = JSON.parse(localStorage.getItem(READ_HISTORY_KEY) || "[]") as Array<{ tid: FeedItemId }>;
    return history.map((entry) => entry.tid).join(",");
  } catch {
    return "";
  }
}

function rememberReadItem(id: FeedItemId) {
  try {
    const history = JSON.parse(localStorage.getItem(READ_HISTORY_KEY) || "[]") as Array<{ tid: FeedItemId; lastViewedAt: string }>;
    const nextHistory = history.filter((entry) => Number(entry.tid) !== Number(id));
    nextHistory.push({ tid: id, lastViewedAt: new Date().toISOString() });
    localStorage.setItem(READ_HISTORY_KEY, JSON.stringify(nextHistory.slice(-500)));
  } catch {
    // Reading history should never block opening a card.
  }
}

function openUpdateProbe() {
  if (!UPDATE_PROBE_ENABLED) {
    showUpdateProbe.value = false;
    return;
  }
  try {
    showUpdateProbe.value = localStorage.getItem(HOME_UPDATE_PROBE_KEY) !== "seen";
  } catch {
    showUpdateProbe.value = true;
  }
}

function dismissUpdateProbe() {
  showUpdateProbe.value = false;
  try {
    localStorage.setItem(HOME_UPDATE_PROBE_KEY, "seen");
  } catch {
    // The deploy probe should never block homepage browsing.
  }
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
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
  feedTabsChrome,
  detailChrome,
  emitChrome: (hidden) => emit("chrome", hidden),
  // QUARANTINE: v1 card-camera overlay (issue #85 / #274). Temporary scaffolding; do not extend.
  startCardTransition(payload) {
    if (!payload || typeof window === "undefined" || prefersReducedMotion()) return;
    cardTransition.value = payload;
    cardTransitionActive.value = false;
    void nextTick(() => {
      requestAnimationFrame(() => {
        cardTransitionActive.value = true;
        window.setTimeout(() => {
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
      : "内容暂时没加载出来，可以稍后再试。";
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

function abortDetailDrag(event: PointerEvent, restoreChrome = true) {
  detailDragging.value = false;
  detailPointerId.value = null;
  detailGestureLocked.value = null;
  detailDragX.value = 0;
  if (restoreChrome && detailOpen.value) {
    detailChrome.show();
    emit("chrome", true);
  }
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
  detailChrome.setProgress(1);
  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
}

function onDetailPointerMove(event: PointerEvent) {
  if (!detailDragging.value || detailPointerId.value !== event.pointerId) return;
  const deltaX = event.clientX - dragStartX.value;
  const deltaY = event.clientY - dragStartY.value;
  if (!detailGestureLocked.value) {
    if (Math.abs(deltaY) > SWIPE_VERTICAL_GUARD && Math.abs(deltaY) > Math.abs(deltaX)) {
      detailGestureLocked.value = "vertical";
      abortDetailDrag(event, true);
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
  detailChrome.setProgress(1 - Math.min(1, Math.abs(nextDragX) / CARDIFY_DISTANCE));
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
  detailChrome.show();
  emit("chrome", true);
}

function onDetailPointerCancel(event: PointerEvent) {
  if (detailPointerId.value !== event.pointerId) return;
  abortDetailDrag(event, true);
}

onMounted(() => {
  updateViewport();
  setRegion("top", {
    tabs: {
      kind: "tabs",
      items: tabs.value,
      activeKey: activeTab.value,
      ariaLabel: "信息分类",
      floatingState: feedTabsChromeState.value,
    },
    onTabSelect: switchTab,
    visible: true,
  });
  window.addEventListener("resize", updateViewport);
  emit("chrome", false);
  openUpdateProbe();
  void loadFeed(true);
});

watch([tabs, activeTab, feedTabsChromeState], () => {
  setRegion("top", {
    tabs: {
      kind: "tabs",
      items: tabs.value,
      activeKey: activeTab.value,
      ariaLabel: "信息分类",
      floatingState: feedTabsChromeState.value,
    },
  });
});

onBeforeUnmount(() => {
  setRegion("top", { tabs: null, onTabSelect: null, visible: false });
  feedTabsChrome.dispose();
  detailChrome.dispose();
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
    <h1 id="feed-view-title" class="feed-view__sr-title">首页</h1>

    <Transition name="feed-update-probe-motion">
      <div v-if="showUpdateProbe && !detailOpen" class="feed-view__update-probe" role="dialog" aria-modal="true" aria-labelledby="feed-update-probe-title">
        <div class="feed-view__update-probe-panel">
          <p class="feed-view__update-probe-kicker">更新验证</p>
          <h2 id="feed-update-probe-title">首页 UI 已进入当前构建</h2>
          <p>版本标记：{{ HOME_UPDATE_PROBE_VERSION }}</p>
          <p>看到这个弹窗，说明你当前打开的是这次 main 的首页版本。</p>
          <LianButton size="sm" variant="tonal" @click="dismissUpdateProbe">知道了</LianButton>
        </div>
      </div>
    </Transition>

    <InlineError v-if="errorMessage">
      {{ errorMessage }}
      <button type="button" @click="loadFeed(true)">重新加载</button>
    </InlineError>

    <div v-if="loading" class="feed-view__state" role="status">
      正在加载校园内容…
    </div>

    <div v-else-if="isEmpty" class="feed-view__state feed-view__state--empty">
      <strong>暂时没有内容</strong>
      <span>可以换个分类，或稍后再来看看。</span>
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
      :chrome-phase="detailChromePhase"
      :chrome-style="detailChromeStyle"
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

.feed-view__update-probe {
  position: fixed;
  inset: 0;
  z-index: 180;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgba(15, 23, 20, 0.32);
  backdrop-filter: blur(10px);
}

.feed-view__update-probe-panel {
  display: grid;
  gap: var(--space-3);
  width: min(100%, 360px);
  padding: var(--space-4);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sheet);
  background: var(--glass-bg-strong);
  box-shadow: var(--shadow-floating);
}

.feed-view__update-probe-kicker,
.feed-view__update-probe-panel h2,
.feed-view__update-probe-panel p {
  margin: 0;
}

.feed-view__update-probe-kicker {
  color: var(--lian-primary-deep);
  font-size: 12px;
  font-weight: 900;
}

.feed-view__update-probe-panel h2 {
  color: var(--lian-ink);
  font-size: 18px;
  line-height: 1.35;
}

.feed-view__update-probe-panel p {
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.55;
  word-break: break-all;
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

.feed-view__card-transition {
  position: fixed;
  top: var(--card-top);
  left: var(--card-left);
  z-index: 160;
  display: grid;
  overflow: hidden;
  width: var(--card-width);
  height: var(--card-height);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-floating);
  pointer-events: none;
  transition: top 300ms var(--motion-ease-standard), left 300ms var(--motion-ease-standard), width 300ms var(--motion-ease-standard), height 300ms var(--motion-ease-standard), border-radius 300ms var(--motion-ease-standard), opacity 220ms ease, filter 300ms ease;
}

.feed-view__card-transition.is-active {
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  border-radius: 0;
  opacity: 0;
  filter: blur(5px);
}

.feed-view__card-transition img {
  width: 100%;
  min-height: 58%;
  object-fit: cover;
}

.feed-view__card-transition strong {
  align-self: end;
  padding: var(--space-4);
  color: var(--lian-ink);
  font-size: 18px;
  line-height: 1.34;
}

.feed-view__card-transition-tag {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
  padding: 5px 8px;
  border-radius: var(--radius-chip);
  background: rgba(17, 24, 39, 0.64);
  color: #fff;
  font-size: 11px;
  font-weight: 900;
}

.feed-update-probe-motion-enter-active,
.feed-update-probe-motion-leave-active {
  transition: opacity 180ms ease, transform 180ms ease, filter 180ms ease;
}

.feed-update-probe-motion-enter-from,
.feed-update-probe-motion-leave-to {
  opacity: 0;
  transform: scale(0.98);
  filter: blur(6px);
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

@media (prefers-reduced-motion: reduce) {
  .feed-view__content,
  .feed-view__card-transition,
  .feed-update-probe-motion-enter-active,
  .feed-update-probe-motion-leave-active {
    transition: none;
  }

  .feed-update-probe-motion-enter-from,
  .feed-update-probe-motion-leave-to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}
</style>
