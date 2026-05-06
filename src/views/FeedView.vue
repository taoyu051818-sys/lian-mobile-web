<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { fetchFeed } from "../api/feed";
import { fetchPostDetail } from "../api/posts";
import { InlineError, LianButton } from "../ui";
import type { FeedItem, FeedItemId, FeedTab } from "../types/feed";
import type { PostDetail } from "../types/post";
import FeedItemCard from "./feed/FeedItemCard.vue";
import PostDetailPanel from "./detail/PostDetailPanel.vue";

interface CardOpenPayload {
  item: FeedItem;
  rect: { top: number; left: number; width: number; height: number };
}

interface CardTransitionSnapshot extends CardOpenPayload {}

interface DetailHistoryState {
  lianDetail?: boolean;
  tid?: string;
}

const DEFAULT_TABS: FeedTab[] = [
  { id: "此刻", label: "此刻" },
  { id: "精选", label: "精选" },
];
const PAGE_SIZE = 12;
const HOME_UPDATE_PROBE_VERSION = "home-ui-main-2026-05-05-01";
const HOME_UPDATE_PROBE_KEY = `lian.homeUpdateProbe.${HOME_UPDATE_PROBE_VERSION}`;
const SWIPE_THRESHOLD = 86;
const SWIPE_VERTICAL_GUARD = 52;
const CARDIFY_DISTANCE = 220;

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
const selectedPostId = ref<FeedItemId | null>(null);
const selectedPost = ref<PostDetail | null>(null);
const detailLoading = ref(false);
const detailError = ref("");
const showUpdateProbe = ref(false);
const cardTransition = ref<CardTransitionSnapshot | null>(null);
const lastOpenSnapshot = ref<CardTransitionSnapshot | null>(null);
const cardTransitionActive = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
const detailDragX = ref(0);
const detailDragging = ref(false);
const detailReturning = ref(false);
const detailPointerId = ref<number | null>(null);
const detailGestureLocked = ref<"horizontal" | "vertical" | null>(null);
const detailHistoryActive = ref(false);
const ignoreNextPopState = ref(false);
const viewportWidth = ref(390);
const viewportHeight = ref(844);

const detailOpen = computed(() => selectedPostId.value !== null);
const isEmpty = computed(() => !loading.value && !errorMessage.value && items.value.length === 0);
const masonryColumns = computed(() => splitIntoMasonryColumns(items.value));
const detailCardifyProgress = computed(() => Math.min(1, Math.max(0, Math.abs(detailDragX.value) / CARDIFY_DISTANCE)));
const detailTargetScale = computed(() => {
  const snapshot = lastOpenSnapshot.value;
  if (!snapshot) return 0.5;
  const scaleByWidth = snapshot.rect.width / Math.max(1, viewportWidth.value);
  const scaleByHeight = snapshot.rect.height / Math.max(1, viewportHeight.value);
  return Math.max(0.34, Math.min(0.72, Math.max(scaleByWidth, scaleByHeight)));
});
const detailTargetX = computed(() => {
  const snapshot = lastOpenSnapshot.value;
  if (!snapshot) return 0;
  return snapshot.rect.left + snapshot.rect.width / 2 - viewportWidth.value / 2;
});
const detailTargetY = computed(() => {
  const snapshot = lastOpenSnapshot.value;
  if (!snapshot) return 0;
  return snapshot.rect.top + snapshot.rect.height / 2 - viewportHeight.value / 2;
});
const detailDragStyle = computed(() => {
  const progress = detailCardifyProgress.value;
  const scale = 1 - (1 - detailTargetScale.value) * progress;
  const dragTranslateX = detailReturning.value ? detailTargetX.value * progress : detailDragX.value;
  const dragTranslateY = detailReturning.value ? detailTargetY.value * progress : 0;
  const feedOpacity = detailOpen.value ? Math.max(0.12, progress * 0.96) : 1;
  const feedScale = detailOpen.value ? 0.985 + progress * 0.015 : 1;
  return {
    "--detail-card-progress": String(progress),
    "--detail-card-scale": String(scale),
    "--detail-card-translate-x": `${dragTranslateX}px`,
    "--detail-card-translate-y": `${dragTranslateY}px`,
    "--detail-card-radius": `${Math.round(progress * 18)}px`,
    "--detail-bar-opacity": String(Math.max(0, 1 - progress * 1.12)),
    "--detail-bar-scale": String(1 - progress * 0.18),
    "--detail-bar-drag-x": `${dragTranslateX * 0.18}px`,
    "--feed-under-detail-opacity": String(feedOpacity),
    "--feed-under-detail-scale": String(feedScale),
  };
});
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

function estimateCardWeight(item: FeedItem) {
  const coverWeight = item.cover ? 1.32 : 0.72;
  const titleWeight = Math.min(0.44, Math.max(0.18, item.title.length / 80));
  const bodyWeight = item.bodyPreview ? Math.min(0.62, Math.max(0.22, item.bodyPreview.length / 120)) : 0;
  const metaWeight = 0.34;
  return coverWeight + titleWeight + bodyWeight + metaWeight;
}

function splitIntoMasonryColumns(sourceItems: FeedItem[]) {
  const columns: FeedItem[][] = [[], []];
  const weights = [0, 0];
  sourceItems.forEach((item) => {
    const columnIndex = weights[0] <= weights[1] ? 0 : 1;
    columns[columnIndex].push(item);
    weights[columnIndex] += estimateCardWeight(item);
  });
  return columns;
}

function updateViewport() {
  if (typeof window === "undefined") return;
  viewportWidth.value = window.innerWidth || 390;
  viewportHeight.value = window.innerHeight || 844;
}

function readHistoryQuery() {
  try {
    const history = JSON.parse(localStorage.getItem("lian.readHistory") || "[]") as Array<{ tid: FeedItemId }>;
    return history.map((entry) => entry.tid).join(",");
  } catch {
    return "";
  }
}

function rememberReadItem(id: FeedItemId) {
  try {
    const history = JSON.parse(localStorage.getItem("lian.readHistory") || "[]") as Array<{ tid: FeedItemId; lastViewedAt: string }>;
    const nextHistory = history.filter((entry) => Number(entry.tid) !== Number(id));
    nextHistory.push({ tid: id, lastViewedAt: new Date().toISOString() });
    localStorage.setItem("lian.readHistory", JSON.stringify(nextHistory.slice(-500)));
  } catch {
    // Reading history should never block opening a card.
  }
}

function openUpdateProbe() {
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

function currentHistoryState() {
  if (typeof window === "undefined") return {} as DetailHistoryState;
  return (window.history.state || {}) as DetailHistoryState;
}

function pushDetailHistory(id: FeedItemId) {
  if (typeof window === "undefined" || detailHistoryActive.value) return;
  try {
    window.history.pushState({ ...currentHistoryState(), lianDetail: true, tid: String(id) }, "", window.location.href);
    detailHistoryActive.value = true;
  } catch {
    detailHistoryActive.value = false;
  }
}

function clearDetailHistory() {
  if (typeof window === "undefined" || !detailHistoryActive.value) return;
  detailHistoryActive.value = false;
  try {
    if (currentHistoryState().lianDetail) {
      ignoreNextPopState.value = true;
      window.history.back();
    }
  } catch {
    ignoreNextPopState.value = false;
  }
}

function startCardTransition(payload?: CardOpenPayload) {
  if (!payload || typeof window === "undefined" || prefersReducedMotion()) return;
  cardTransition.value = payload;
  lastOpenSnapshot.value = payload;
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
}

function resetDetailState() {
  selectedPostId.value = null;
  selectedPost.value = null;
  detailLoading.value = false;
  detailError.value = "";
  detailDragX.value = 0;
  detailDragging.value = false;
  detailReturning.value = false;
  detailPointerId.value = null;
  detailGestureLocked.value = null;
  detailHistoryActive.value = false;
  emit("chrome", false);
}

function closeDetailWithCardify(options: { syncHistory?: boolean; direction?: number } = {}) {
  const syncHistory = options.syncHistory !== false;
  const direction = options.direction ?? (detailDragX.value < 0 ? -1 : 1);
  if (syncHistory) clearDetailHistory();
  if (prefersReducedMotion()) {
    resetDetailState();
    return;
  }
  updateViewport();
  detailDragging.value = false;
  detailReturning.value = true;
  detailPointerId.value = null;
  detailGestureLocked.value = null;
  detailDragX.value = Math.sign(direction || 1) * CARDIFY_DISTANCE;
  window.setTimeout(() => {
    resetDetailState();
  }, 280);
}

function onWindowPopState() {
  if (ignoreNextPopState.value) {
    ignoreNextPopState.value = false;
    return;
  }
  if (!detailOpen.value && !detailHistoryActive.value) return;
  detailHistoryActive.value = false;
  closeDetailWithCardify({ syncHistory: false, direction: detailDragX.value || -1 });
}

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

async function openItem(id: FeedItemId, payload?: CardOpenPayload) {
  updateViewport();
  startCardTransition(payload);
  rememberReadItem(id);
  selectedPostId.value = id;
  selectedPost.value = null;
  detailError.value = "";
  detailLoading.value = true;
  detailDragX.value = 0;
  detailDragging.value = false;
  detailReturning.value = false;
  pushDetailHistory(id);
  emit("chrome", true);

  try {
    const detail = await fetchPostDetail(id);
    if (Number(selectedPostId.value) === Number(id)) {
      selectedPost.value = detail;
    }
  } catch (error) {
    detailError.value = error instanceof Error
      ? error.message
      : "详情暂时没加载出来，可以稍后再试。";
  } finally {
    if (Number(selectedPostId.value) === Number(id)) {
      detailLoading.value = false;
    }
  }
}

function retryDetail() {
  if (selectedPostId.value == null) return;
  void openItem(selectedPostId.value);
}

function closeDetail() {
  closeDetailWithCardify();
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest(".post-detail-panel__gallery-item")) return false;
  return Boolean(target.closest(".post-detail-panel__topbar, .post-detail-panel__dock, .post-detail-panel__report, .post-detail-panel__lightbox, a, button, input, textarea, select, [role='button']"));
}

function onDetailPointerDown(event: PointerEvent) {
  if (!detailOpen.value || detailLoading.value || detailReturning.value || isInteractiveTarget(event.target)) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  updateViewport();
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
    } else if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY) * 1.05) {
      detailGestureLocked.value = "horizontal";
    }
  }
  if (detailGestureLocked.value !== "horizontal") return;
  event.preventDefault();
  detailDragX.value = Math.max(-CARDIFY_DISTANCE, Math.min(CARDIFY_DISTANCE, deltaX));
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
  detailDragging.value = false;
  detailPointerId.value = null;
  detailGestureLocked.value = null;
  detailDragX.value = 0;
}

onMounted(() => {
  updateViewport();
  window.addEventListener("resize", updateViewport);
  window.addEventListener("popstate", onWindowPopState);
  emit("chrome", false);
  openUpdateProbe();
  void loadFeed(true);
});

onBeforeUnmount(() => {
  clearDetailHistory();
  window.removeEventListener("resize", updateViewport);
  window.removeEventListener("popstate", onWindowPopState);
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

    <Transition name="feed-tabs-motion">
      <nav v-if="!detailOpen || detailReturning || detailDragging" class="feed-view__tabs" aria-label="信息分类">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="feed-view__tab"
          :class="{ 'is-active': tab.id === activeTab }"
          :aria-pressed="tab.id === activeTab"
          @click="switchTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </nav>
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
      <div v-if="!loading && !isEmpty" class="feed-view__masonry" aria-live="polite">
        <div
          v-for="(column, columnIndex) in masonryColumns"
          :key="columnIndex"
          class="feed-view__masonry-column"
        >
          <FeedItemCard
            v-for="item in column"
            :key="String(item.tid)"
            :item="item"
            @open="openItem"
          />
        </div>
      </div>

      <div v-if="items.length" class="feed-view__load-more">
        <LianButton
          v-if="hasMore"
          :loading="loadingMore"
          variant="ghost"
          @click="loadFeed(false)"
        >
          加载更多
        </LianButton>
        <span v-else>已经看到这里啦</span>
      </div>
    </div>

    <Transition name="feed-detail-motion">
      <PostDetailPanel
        v-if="detailOpen"
        key="feed-detail"
        class="feed-view__detail"
        :class="{ 'is-dragging': detailDragging }"
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
    </Transition>

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

.feed-view__tabs {
  position: fixed;
  top: var(--floating-bar-top-offset);
  right: max(var(--floating-bar-side-inset), env(safe-area-inset-right));
  left: max(var(--floating-bar-side-inset), env(safe-area-inset-left));
  z-index: var(--floating-bar-z);
  display: flex;
  gap: var(--space-1);
  width: min(calc(100vw - var(--space-6)), var(--floating-bar-max-width));
  min-height: var(--floating-bar-height);
  margin: 0 auto;
  padding: var(--floating-bar-padding);
  overflow-x: auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--floating-bar-radius);
  background: var(--glass-bg-strong);
  box-shadow: var(--shadow-floating);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  opacity: var(--feed-under-detail-opacity, 1);
  scrollbar-width: none;
  transition: opacity var(--motion-standard) var(--motion-ease-standard);
}

.feed-view__tabs::-webkit-scrollbar {
  display: none;
}

.feed-view__tab {
  flex: 0 0 auto;
  min-height: var(--floating-bar-button-height);
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-chip);
  background: transparent;
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 850;
  white-space: nowrap;
  transition: background 160ms ease, color 160ms ease, transform 160ms ease;
}

.feed-view__tab.is-active {
  background: var(--lian-ink);
  color: #fff;
  transform: translateY(-1px);
}

.feed-view__tab:disabled {
  cursor: wait;
  opacity: 0.6;
}

.feed-view__tab:focus-visible {
  outline: 3px solid rgba(31, 167, 160, 0.32);
  outline-offset: 2px;
}

.feed-view__content {
  display: grid;
  gap: var(--space-3);
  transition: opacity var(--motion-standard) var(--motion-ease-standard), transform var(--motion-standard) var(--motion-ease-standard), filter var(--motion-standard) var(--motion-ease-standard);
}

.feed-view__content.is-under-detail {
  opacity: var(--feed-under-detail-opacity, 0.12);
  transform: scale(var(--feed-under-detail-scale, 0.985));
  filter: saturate(0.96);
}

.feed-view__masonry {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  align-items: start;
}

.feed-view__masonry-column {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
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

.feed-view__load-more {
  display: grid;
  place-items: center;
  padding-bottom: var(--space-2);
  color: var(--lian-muted);
  font-size: 13px;
}

.feed-view__detail {
  min-height: calc(100vh - var(--space-6));
  overscroll-behavior-x: contain;
  touch-action: pan-y;
}

.feed-view__detail.is-dragging {
  cursor: grabbing;
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
.feed-update-probe-motion-leave-active,
.feed-tabs-motion-enter-active,
.feed-tabs-motion-leave-active,
.feed-detail-motion-enter-active,
.feed-detail-motion-leave-active {
  transition: opacity 180ms ease, transform 180ms ease, filter 180ms ease;
}

.feed-update-probe-motion-enter-from,
.feed-update-probe-motion-leave-to {
  opacity: 0;
  transform: scale(0.98);
  filter: blur(6px);
}

.feed-tabs-motion-enter-from,
.feed-tabs-motion-leave-to {
  opacity: 0;
  transform: translateY(-16px) scale(0.98);
  filter: blur(6px);
}

.feed-detail-motion-enter-from {
  opacity: 0;
  transform: translateY(-18px) scale(0.992);
  filter: blur(5px);
}

.feed-detail-motion-leave-to {
  opacity: 0;
  transform: translateY(-26px) scale(0.988);
  filter: blur(5px);
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
  .feed-view__tab,
  .feed-view__content,
  .feed-view__tabs,
  .feed-view__card-transition,
  .feed-update-probe-motion-enter-active,
  .feed-update-probe-motion-leave-active,
  .feed-tabs-motion-enter-active,
  .feed-tabs-motion-leave-active,
  .feed-detail-motion-enter-active,
  .feed-detail-motion-leave-active {
    transition: none;
  }

  .feed-update-probe-motion-enter-from,
  .feed-update-probe-motion-leave-to,
  .feed-tabs-motion-enter-from,
  .feed-tabs-motion-leave-to,
  .feed-detail-motion-enter-from,
  .feed-detail-motion-leave-to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}
</style>
