<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchFeed } from "../api/feed";
import { fetchPostDetail } from "../api/posts";
import { InlineError, LianButton } from "../ui";
import type { FeedItem, FeedItemId } from "../types/feed";
import type { PostDetail } from "../types/post";
import FeedItemCard from "./feed/FeedItemCard.vue";
import PostDetailPanel from "./detail/PostDetailPanel.vue";

const DEFAULT_TABS = ["推荐", "热帖", "经验", "讨论", "饭堂", "附近"];
const LEGACY_TAB_LABELS: Record<string, string> = {
  此刻: "推荐",
  精选: "热帖",
  校园活动: "经验",
  报名机会: "讨论",
  图书馆学习: "附近",
  周边玩乐: "附近",
  安全通知: "讨论",
  试验区社团: "经验",
  美食菜单: "饭堂",
};
const PAGE_SIZE = 12;

const tabs = ref<string[]>(DEFAULT_TABS);
const activeTab = ref(DEFAULT_TABS[0]);
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

function normalizeTabs(rawTabs?: string[]) {
  const labels = (rawTabs?.length ? rawTabs : DEFAULT_TABS)
    .map((tab) => LEGACY_TAB_LABELS[tab] || tab)
    .filter((tab) => DEFAULT_TABS.includes(tab));
  return Array.from(new Set(labels)).slice(0, DEFAULT_TABS.length).concat(
    DEFAULT_TABS.filter((tab) => !labels.includes(tab)),
  ).slice(0, DEFAULT_TABS.length);
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
    const nextHistory = history.filter((entry) => String(entry.tid) !== String(id));
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

    tabs.value = normalizeTabs(response.tabs);
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

function switchTab(tab: string) {
  if (activeTab.value === tab) return;
  activeTab.value = tab;
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
    if (String(selectedPostId.value) === String(id)) {
      selectedPost.value = detail;
    }
  } catch (error) {
    detailError.value = error instanceof Error
      ? error.message
      : "详情暂时没加载出来，可以稍后再试。";
  } finally {
    if (String(selectedPostId.value) === String(id)) {
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

    <nav class="feed-view__tabs" aria-label="Feed 分类">
      <button
        v-for="tab in tabs"
        :key="tab"
        type="button"
        class="feed-view__tab"
        :class="{ 'is-active': tab === activeTab }"
        :aria-pressed="tab === activeTab"
        @click="switchTab(tab)"
      >
        {{ tab }}
      </button>
      <button
        type="button"
        class="feed-view__tab feed-view__tab--refresh"
        :disabled="loading"
        @click="loadFeed(true)"
      >
        {{ loading ? "刷新中" : "刷新" }}
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

    <div v-else class="feed-view__list" aria-live="polite">
      <FeedItemCard
        v-for="item in items"
        :key="String(item.tid)"
        :item="item"
        @open="openItem"
      />
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
  position: sticky;
  top: calc(var(--space-2) + env(safe-area-inset-top));
  z-index: 40;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--space-1);
  padding: var(--space-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sheet);
  background: var(--glass-bg-strong);
  box-shadow: var(--shadow-floating);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}

.feed-view__tab {
  min-height: 40px;
  padding: 0 var(--space-2);
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

.feed-view__tab--refresh {
  grid-column: 1 / -1;
  min-height: 36px;
  background: rgba(255, 255, 255, 0.54);
  color: var(--lian-primary-deep);
}

.feed-view__tab:disabled {
  cursor: wait;
  opacity: 0.6;
}

.feed-view__tab:focus-visible {
  outline: 3px solid rgba(31, 167, 160, 0.32);
  outline-offset: 2px;
}

.feed-view__list {
  display: grid;
  gap: var(--space-3);
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

@media (min-width: 720px) {
  .feed-view__tabs {
    grid-template-columns: repeat(6, max-content) minmax(80px, 1fr);
    justify-content: start;
  }

  .feed-view__tab {
    padding: 0 var(--space-3);
  }

  .feed-view__tab--refresh {
    grid-column: auto;
    justify-self: end;
  }
}
</style>
