<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { prefersReducedMotion } from "../../composables/useReducedMotion";
import type { PageChromeSpec } from "../../shell/page-model";
import { useFloatingChromeState } from "../../shell/floatingChromeState";
import type { FeedItemId } from "../../types/feed";
import { InlineError } from "../../ui";
import { PostDetailPanel } from "../detail";
import FeedList from "./FeedList.vue";
import FeedLoadMore from "./FeedLoadMore.vue";
import { useFeedDetail } from "./useFeedDetail";
import { useFeedData } from "./useFeedData";
import { useDetailDragGesture } from "./useDetailDragGesture";
import { CHANNEL_RELOAD, FEED_FILTER_LABEL, FEED_VIEW_TITLE } from "../../config/brand";

const CARDIFY_DISTANCE = 320;
const DRAG_STAGE_MIN_SCALE = 0.9;
const RETURN_ANIMATION_MS = 380;

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
}>();

const viewportWidth = ref(390);
const viewportHeight = ref(844);

function updateViewport() {
  if (typeof window === "undefined") return;
  viewportWidth.value = window.innerWidth || 390;
  viewportHeight.value = window.innerHeight || 844;
}

// Detail lifecycle composable
const {
  selectedPostId: _selectedPostId,
  selectedPost,
  detailLoading,
  detailError,
  detailOpen,
  detailPhase,
  detailDragging,
  detailReturning,
  detailDragX,
  detailPointerId,
  detailGestureLocked,
  dragStartX,
  dragStartY,
  detailCardifyProgress: _detailCardifyProgress,
  detailDragStyle,
  openItem,
  retryDetail,
  closeDetail,
  closeDetailWithCardify,
  resetDetailState,
} = useFeedDetail({
  rememberReadItem(id: FeedItemId) {
    feedData.rememberReadItem(id);
  },
  updateViewport,
  prefersReducedMotion,
  viewportWidth,
  viewportHeight,
  cardifyDistance: CARDIFY_DISTANCE,
  dragStageMinScale: DRAG_STAGE_MIN_SCALE,
  returnAnimationMs: RETURN_ANIMATION_MS,
});

// Feed data composable
const feedData = useFeedData({
  detailOpen: () => detailOpen.value,
  closeDetailWithCardify: () => closeDetailWithCardify(),
  resetDetailState,
});

// Detail drag gesture composable
const { onDetailPointerDown, onDetailPointerMove, onDetailPointerUp, onDetailPointerCancel } =
  useDetailDragGesture({
    detailOpen,
    detailLoading,
    detailReturning,
    detailDragging,
    detailDragX,
    detailPointerId,
    detailGestureLocked,
    dragStartX,
    dragStartY,
    viewportWidth,
    updateViewport,
    closeDetailWithCardify,
    cardifyDistance: CARDIFY_DISTANCE,
  });

// Unified chrome state — write detailPhase so shell can derive visibility
const { setDetailPhase } = useFloatingChromeState();
watch(detailPhase, (p) => setDetailPhase(p), { immediate: true });

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
  updateViewport();
  window.addEventListener("resize", updateViewport);
  emit("chrome", pageChrome.value);
  void feedData.loadFeed(true);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateViewport);
});
</script>

<template>
  <section
    class="feed-view"
    :class="{
      'is-detail-open': detailOpen,
      'is-detail-dragging': detailDragging,
      'is-detail-returning': detailReturning,
    }"
    :style="detailDragStyle"
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

    <div
      v-show="!detailOpen || detailReturning || detailDragging"
      class="feed-view__content"
      :class="{ 'is-under-detail': detailOpen }"
    >
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
  transition:
    opacity var(--motion-standard) var(--motion-ease-standard),
    transform var(--motion-standard) var(--motion-ease-standard),
    filter var(--motion-standard) var(--motion-ease-standard);
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
