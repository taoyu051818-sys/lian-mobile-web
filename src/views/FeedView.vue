<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchFeed } from "../api/feed";
import { fetchPostDetail } from "../api/posts";
import { InlineError, LianButton } from "../ui";
import type { FeedItem, FeedItemId, FeedTab } from "../types/feed";
import type { PostDetail } from "../types/post";
import FeedItemCard from "./feed/FeedItemCard.vue";
import PostDetailPanel from "./detail/PostDetailPanel.vue";

const DEFAULT_TABS: FeedTab[] = [
  { id: "此刻", label: "此刻" },
  { id: "精选", label: "精选" },
];
const PAGE_SIZE = 12;
const HOME_UPDATE_PROBE_VERSION = "home-ui-main-2026-05-05-01";
const HOME_UPDATE_PROBE_KEY = `lian.homeUpdateProbe.${HOME_UPDATE_PROBE_VERSION}`;

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

const detailOpen = computed(() => selectedPostId.value !== null);
const isEmpty = computed(() => !loading.value && !errorMessage.value && items.value.length === 0);
const masonryColumns = computed(() => splitIntoMasonryColumns(items.value));

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

async function loadFeed(reset = false) {
  if (loading.value || loadingMore.value) return;
  if (!reset && !hasMore.value) return;

  errorMessage.value = "";
  if (reset) {
    loading.value = true;
    page.value = 1;
    hasMore.value = true;
    closeDetail();
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

async function openItem(id: FeedItemId) {
  rememberReadItem(id);
  selectedPostId.value = id;
  selectedPost.value = null;
  detailError.value = "";
  detailLoading.value = true;
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
  selectedPostId.value = null;
  selectedPost.value = null;
  detailLoading.value = false;
  detailError.value = "";
  emit("chrome", false);
}

onMounted(() => {
  emit("chrome", false);
  openUpdateProbe();
  void loadFeed(true);
});
</script>

<template>
  <section class="feed-view" :class="{ 'is-detail-open': detailOpen }" aria-labelledby="feed-view-title">
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
      <nav v-if="!detailOpen" class="feed-view__tabs" aria-label="信息分类">
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

    <Transition name="feed-content-motion" mode="out-in">
      <div v-if="!detailOpen" class="feed-view__content" key="feed-list">
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

      <PostDetailPanel
        v-else
        key="feed-detail"
        class="feed-view__detail"
        :post="selectedPost"
        :loading="detailLoading"
        :error="detailError"
        @close="closeDetail"
        @retry="retryDetail"
      />
    </Transition>
  </section>
</template>

<style scoped>
.feed-view {
  display: grid;
  gap: var(--space-3);
  padding-top: calc(58px + env(safe-area-inset-top));
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
  top: calc(var(--space-2) + env(safe-area-inset-top));
  right: max(var(--space-3), env(safe-area-inset-right));
  left: max(var(--space-3), env(safe-area-inset-left));
  z-index: 70;
  display: flex;
  gap: var(--space-1);
  width: min(calc(100vw - var(--space-6)), 760px);
  margin: 0 auto;
  padding: var(--space-2);
  overflow-x: auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sheet);
  background: var(--glass-bg-strong);
  box-shadow: var(--shadow-floating);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  scrollbar-width: none;
}

.feed-view__tabs::-webkit-scrollbar {
  display: none;
}

.feed-view__tab {
  flex: 0 0 auto;
  min-height: 40px;
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
}

.feed-update-probe-motion-enter-active,
.feed-update-probe-motion-leave-active,
.feed-tabs-motion-enter-active,
.feed-tabs-motion-leave-active,
.feed-content-motion-enter-active,
.feed-content-motion-leave-active {
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

.feed-content-motion-enter-from,
.feed-content-motion-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.992);
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
  .feed-update-probe-motion-enter-active,
  .feed-update-probe-motion-leave-active,
  .feed-tabs-motion-enter-active,
  .feed-tabs-motion-leave-active,
  .feed-content-motion-enter-active,
  .feed-content-motion-leave-active {
    transition: none;
  }

  .feed-update-probe-motion-enter-from,
  .feed-update-probe-motion-leave-to,
  .feed-tabs-motion-enter-from,
  .feed-tabs-motion-leave-to,
  .feed-content-motion-enter-from,
  .feed-content-motion-leave-to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}
</style>
