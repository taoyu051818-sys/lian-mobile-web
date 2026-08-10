<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { PageChromeSpec } from "../../shell/page-model";
import type { FeedItemId } from "../../types/feed";
import type { AudienceVisibility } from "../../types/audience";
import { InlineError } from "../../ui";
import FeedList from "./FeedList.vue";
import FeedLoadMore from "./FeedLoadMore.vue";
import PullToRefreshIndicator from "./PullToRefreshIndicator.vue";

import FeedFilterBar, { type FeedFilterState } from "./FeedFilterBar.vue";
import { useFeedData } from "./useFeedData";
import { useDetailNavigation } from "../../app/detail-navigation";
import { usePullToRefresh } from "../../composables/usePullToRefresh";
import { useShellChrome } from "../../shell/useShellChrome";
import { useFloatingChromeState } from "../../shell/floatingChromeState";
import { CHANNEL_RELOAD, FEED_VIEW_TITLE } from "../../config/brand";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

// FeedView is the list surface only. The detail panel is mounted once at the
// App level by DetailSurface (see src/app/DetailSurface.vue, issue #636) so a
// `#/post/:tid` deep link no longer depends on FeedView's mount lifecycle.
// We still consult the FSM here so card taps can call `detail.open(...)` and
// auto-load-more / tab-switch can defer to the detail-open state.
const detail = useDetailNavigation();

const feedData = useFeedData({
  detailOpen: () => detail.detailOpen.value,
  closeDetail: () => detail.close("tab-switch"),
});

// Pull-to-refresh integration
const pullToRefresh = usePullToRefresh({
  threshold: 80,
  maxPull: 150,
  onRefresh: async () => {
    await feedData.loadFeed(true);
  },
});

// Dual-state filter bar (option C): defaults to visibility chips. Toggle
// to "tabs" via the [...] button to expose the feed tabs (此刻/精选/...).
const filterState = ref<FeedFilterState>("visibility");

// The feed page owns no typed `tabs` spec on the chrome anymore — tabs are
// rendered inside the teleported FeedFilterBar under the `feed-filter` slot.
// The detail FSM still flips the slot to `detail-topbar` when a post is
// open; we only claim the slot when the FSM is closed.
const pageChrome = computed<PageChromeSpec>(() => ({
  top: detail.detailOpen.value
    ? {
        // Detail-open: do not touch slot — the FSM owns it ("detail-topbar").
        tabs: null,
      }
    : {
        tabs: null,
        slot: "feed-filter",
      },
}));

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true });

const { shellVisible } = useFloatingChromeState();
const chrome = useShellChrome();

// When detail closes, the FSM clears the slot back to null. Re-stake our
// claim so the filter bar re-mounts in the top region.
watch(
  () => detail.detailOpen.value,
  (open, wasOpen) => {
    if (wasOpen && !open) {
      chrome.setSlot("top", "feed-filter");
    }
  },
);

onMounted(() => {
  emit("chrome", pageChrome.value);
  // Set the slot eagerly so the teleport target carries the floating-chrome
  // surface on first paint (the page-chrome merge runs through applyPageChrome
  // which only writes `slot` when the spec includes it).
  if (!detail.detailOpen.value) {
    chrome.setSlot("top", "feed-filter");
  }
  void feedData.initialize();
});

onUnmounted(() => {
  feedData.dispose();
});

function openItem(id: FeedItemId) {
  feedData.rememberReadItem(id);
  detail.open(Number(id), "card");
}

function handleVisibilityChange(visibilities: Set<AudienceVisibility>) {
  feedData.setSelectedVisibilities(visibilities);
}

function handleTabChange(tabId: string) {
  feedData.switchTab(tabId);
}

function handleFilterStateChange(next: FeedFilterState) {
  filterState.value = next;
}

// Only mount the teleported filter bar while the page actually owns the
// top slot. During detail-open the FSM flips it to "detail-topbar"; we
// must withdraw or two components race for the same teleport target.
const filterBarMounted = computed(() => !detail.detailOpen.value && shellVisible.value);
</script>

<template>
  <section class="feed-view" aria-labelledby="feed-view-title" v-bind="pullToRefresh.handlers">
    <h1 id="feed-view-title" class="feed-view__sr-title">{{ FEED_VIEW_TITLE }}</h1>

    <!-- Pull-to-refresh indicator -->
    <PullToRefreshIndicator
      :progress="pullToRefresh.state.progress.value"
      :is-refreshing="pullToRefresh.state.isRefreshing.value"
      :can-refresh="pullToRefresh.state.canRefresh.value"
      :pull-distance="pullToRefresh.state.pullDistance.value"
    />

    <!--
      Dual-state filter bar lives in the top floating chrome via the
      `feed-filter` slot. Teleport target is the stable `#lian-shell-top-slot`
      div ShellChrome always renders for the top region.
    -->
    <Teleport v-if="filterBarMounted" defer to="#lian-shell-top-slot">
      <FeedFilterBar
        :filter-state="filterState"
        :selected-visibilities="feedData.selectedVisibilities.value"
        :tabs="feedData.tabs.value"
        :active-tab-id="feedData.activeTab.value"
        @update:filter-state="handleFilterStateChange"
        @update:selected-visibilities="handleVisibilityChange"
        @update:active-tab-id="handleTabChange"
      />
    </Teleport>

    <InlineError
      v-if="feedData.errorMessage.value"
      :action-label="CHANNEL_RELOAD"
      :action-loading="feedData.loading.value"
      @action="feedData.loadFeed(true)"
    >
      {{ feedData.errorMessage.value }}
    </InlineError>

    <div v-if="feedData.loading.value" class="feed-view__state" role="status">
      {{ feedData.LOADING_FEED }}
    </div>

    <div v-else-if="feedData.isEmpty.value" class="feed-view__state feed-view__state--empty">
      <strong>{{ feedData.EMPTY_FEED }}</strong>
      <span>{{ feedData.FEED_EMPTY_HINT }}</span>
    </div>

    <div class="feed-view__content">
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
  </section>
</template>

<style scoped>
.feed-view {
  position: relative;
  display: grid;
  gap: var(--space-3);
  padding-top: calc(var(--floating-bar-height) + env(safe-area-inset-top));
  touch-action: pan-y;
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
</style>
