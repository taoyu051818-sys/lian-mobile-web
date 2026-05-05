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
}

onMounted(() => {
  void loadFeed(true);
});
</script>

<template>
  <section class="feed-view" aria-labelledby="feed-view-title">
    <h1 id="feed-view-title" class="feed-view__sr-title">首页</h1>

    <nav class="feed-view__tabs" aria-label="信息分类">
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

    <div v-else class="feed-view__masonry" aria-live="polite">
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

    <PostDetailPanel
      v-if="selectedPostId !== null"
      class="feed-view__detail"
      :post="selectedPost"
      :loading="detailLoading"
      :error="detailError"
      @close="closeDetail"
      @retry="retryDetail"
    />
  </section>
</template>

<style scoped>
.feed-view {
  display: grid;
  gap: var(--space-3);
  padding-top: calc(58px + env(safe-area-inset-top));
}

.feed-view__sr-title {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
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
}

.feed-view__tab.is-active {
  background: var(--lian-ink);
  color: #fff;
}

.feed-view__tab:disabled {
  cursor: wait;
  opacity: 0.6;
}

.feed-view__tab:focus-visible {
  outline: 3px solid rgba(31, 167, 160, 0.32);
  outline-offset: 2px;
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
  position: sticky;
  bottom: calc(92px + env(safe-area-inset-bottom));
  z-index: 20;
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
