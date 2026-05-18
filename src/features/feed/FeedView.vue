<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import type { PageChromeSpec } from "../../shell/page-model";
import { useFloatingChromeState } from "../../shell/floatingChromeState";
import type { FeedItemId } from "../../types/feed";
import { InlineError } from "../../ui";
import { PostDetailPanel } from "../detail";
import FeedList from "./FeedList.vue";
import FeedLoadMore from "./FeedLoadMore.vue";
import { useFeedDetail } from "./useFeedDetail";
import { useFeedData } from "./useFeedData";
import { CHANNEL_RELOAD, FEED_FILTER_LABEL, FEED_VIEW_TITLE } from "../../config/brand";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

const {
  selectedPostId: _selectedPostId,
  selectedPost,
  detailLoading,
  detailError,
  detailOpen,
  openItem,
  retryDetail,
  closeDetail,
  resetDetailState,
} = useFeedDetail({
  rememberReadItem(id: FeedItemId) {
    feedData.rememberReadItem(id);
  },
});

const feedData = useFeedData({
  detailOpen: () => detailOpen.value,
  closeDetail: () => closeDetail(),
  resetDetailState,
});

const { setDetailPhase } = useFloatingChromeState();
watch(detailOpen, (open) => setDetailPhase(open ? "open" : "idle"), { immediate: true });

const pageChrome = computed<PageChromeSpec>(() => ({
  top: {
    tabs: {
      kind: "tabs",
      items: feedData.tabs.value,
      activeKey: feedData.activeTab.value,
      ariaLabel: FEED_FILTER_LABEL,
    },
    onTabSelect: feedData.switchTab,
  },
}));

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true });

onMounted(() => {
  emit("chrome", pageChrome.value);
  void feedData.loadFeed(true);
});
</script>

<template>
  <section
    class="feed-view"
    :class="{ 'is-detail-open': detailOpen }"
    aria-labelledby="feed-view-title"
  >
    <h1 id="feed-view-title" class="feed-view__sr-title">{{ FEED_VIEW_TITLE }}</h1>

    <InlineError v-if="feedData.errorMessage.value">
      {{ feedData.errorMessage.value }}
      <button type="button" @click="feedData.loadFeed(true)">{{ CHANNEL_RELOAD }}</button>
    </InlineError>

    <div v-if="feedData.loading.value" class="feed-view__state" role="status">
      {{ feedData.LOADING_FEED }}
    </div>

    <div v-else-if="feedData.isEmpty.value" class="feed-view__state feed-view__state--empty">
      <strong>{{ feedData.EMPTY_FEED }}</strong>
      <span>{{ feedData.FEED_EMPTY_HINT }}</span>
    </div>

    <div v-show="!detailOpen" class="feed-view__content">
      <FeedList
        v-if="!feedData.loading.value && !feedData.isEmpty.value"
        :items="feedData.items.value"
        @open="openItem"
      />

      <FeedLoadMore
        v-if="feedData.items.value.length"
        :has-more="feedData.hasMore.value"
        :loading-more="feedData.loadingMore.value"
        :can-auto-load-more="feedData.canAutoLoadMore.value"
        @load-more="feedData.triggerLoadMore"
      />
    </div>

    <PostDetailPanel
      v-if="detailOpen"
      key="feed-detail"
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
