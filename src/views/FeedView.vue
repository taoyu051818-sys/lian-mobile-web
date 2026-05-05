<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchFeed } from "../api/feed";
import { fetchPostDetail } from "../api/posts";
import { GlassPanel, InlineError, LianButton, TrustBadge, TypeChip } from "../ui";
import type { FeedItem, FeedItemId } from "../types/feed";
import type { PostDetail } from "../types/post";
import FeedItemCard from "./feed/FeedItemCard.vue";
import PostDetailPanel from "./detail/PostDetailPanel.vue";

const DEFAULT_TABS = ["此刻", "精选"];
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

    tabs.value = response.tabs?.length ? response.tabs : DEFAULT_TABS;
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
    <GlassPanel class="feed-view__hero">
      <div class="feed-view__hero-row">
        <TypeChip type="hot">校园信息流</TypeChip>
        <TrustBadge tone="pending">Vue canary</TrustBadge>
      </div>
      <div class="feed-view__hero-copy">
        <h2 id="feed-view-title">今天校园里发生什么</h2>
        <p>先迁移真实 Feed 浏览路径：内容、身份、地点和状态优先展示；互动和发布随后补齐。</p>
      </div>
      <div class="feed-view__hero-actions">
        <LianButton size="sm" :loading="loading" @click="loadFeed(true)">刷新</LianButton>
        <LianButton size="sm" variant="ghost">发布稍后迁移</LianButton>
      </div>
    </GlassPanel>

    <nav class="feed-view__tabs" aria-label="Feed 分类">
      <button
        v-for="tab in tabs"
        :key="tab"
        type="button"
        class="feed-view__tab"
        :class="{ 'is-active': tab === activeTab }"
        @click="switchTab(tab)"
      >
        {{ tab }}
      </button>
    </nav>

    <InlineError v-if="errorMessage">
      {{ errorMessage }}
      <button type="button" @click="loadFeed(true)">重新加载</button>
    </InlineError>

    <div v-if="loading" class="feed-view__state" role="status">
      正在加载校园内容…
    </div>

    <GlassPanel v-else-if="isEmpty" class="feed-view__state">
      <strong>暂时没有内容</strong>
      <span>可以换个分类，或稍后再来看看。</span>
    </GlassPanel>

    <div v-else class="feed-view__grid" aria-live="polite">
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
  gap: var(--space-4);
}

.feed-view__hero {
  display: grid;
  gap: var(--space-3);
}

.feed-view__hero-row,
.feed-view__hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.feed-view__hero-copy {
  display: grid;
  gap: var(--space-2);
}

.feed-view h2,
.feed-view h3,
.feed-view p {
  margin: 0;
}

.feed-view__hero-copy p {
  color: var(--lian-muted);
  line-height: 1.6;
}

.feed-view__tabs {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding: 2px 0;
}

.feed-view__tab {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.54);
  color: var(--lian-muted);
  font-weight: 850;
  white-space: nowrap;
}

.feed-view__tab.is-active {
  background: var(--lian-ink);
  color: #fff;
}

.feed-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: var(--space-4);
}

.feed-view__state {
  display: grid;
  gap: var(--space-2);
  min-height: 132px;
  place-items: center;
  color: var(--lian-muted);
  text-align: center;
}

.feed-view__load-more {
  display: grid;
  place-items: center;
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
