<script setup lang="ts">
import { onMounted } from "vue";
import { GlassPanel, InlineError, LianButton, LocationChip, TagChip, TrustBadge, TypeChip } from "../ui";
import { useFeedItems } from "./feed/useFeedItems";

const {
  dataSource,
  error,
  feedMode,
  hasMore,
  itemKey,
  itemMeta,
  itemTitle,
  items,
  load,
  loading,
  pageNote
} = useFeedItems();

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="feed-view" aria-labelledby="feed-view-title">
    <GlassPanel class="feed-view__card feed-view__hero">
      <div class="vue-shell__row feed-view__header-row">
        <TypeChip type="hot">校园信息流</TypeChip>
        <TrustBadge tone="confirmed">Vue API Preview</TrustBadge>
      </div>
      <div>
        <h2 id="feed-view-title">今天校园里发生什么</h2>
        <p>Vue Feed 正在接入真实 `/api/feed` 只读数据。发布、点赞、详情等交互仍由 legacy feed 承担。</p>
      </div>
      <div class="vue-shell__row feed-view__meta-row">
        <LocationChip>校园</LocationChip>
        <span v-if="feedMode" class="feed-view__meta">模式：{{ feedMode }}</span>
        <span v-if="dataSource" class="feed-view__meta">来源：{{ dataSource }}</span>
      </div>
      <p v-if="pageNote" class="feed-view__note">{{ pageNote }}</p>
      <div class="vue-shell__row">
        <LianButton variant="primary" :loading="loading" @click="load">刷新 Feed</LianButton>
        <LianButton variant="ghost" disabled>筛选地点（legacy）</LianButton>
      </div>
    </GlassPanel>

    <InlineError v-if="error">{{ error }}</InlineError>

    <div v-if="loading && !items.length" class="feed-view__loading" aria-live="polite">
      正在加载校园信息流…
    </div>

    <div v-else-if="!items.length && !error" class="feed-view__empty" aria-live="polite">
      暂时没有可展示的 Feed 内容。
    </div>

    <article
      v-for="(item, index) in items"
      :key="itemKey(item, index)"
      class="feed-view__item"
    >
      <img
        v-if="item.cover"
        class="feed-view__cover"
        :src="item.cover"
        :alt="`${itemTitle(item)} 封面图`"
        loading="lazy"
      />
      <div class="feed-view__item-body">
        <div class="vue-shell__row feed-view__item-tags">
          <TagChip v-if="item.tag" :tag="item.tag" />
          <TagChip v-for="tag in item.tags?.slice(0, 2) || []" :key="tag" :tag="tag" />
        </div>
        <h3>{{ itemTitle(item) }}</h3>
        <p v-if="item.summary">{{ item.summary }}</p>
        <p v-if="itemMeta(item)" class="feed-view__meta">{{ itemMeta(item) }}</p>
        <div class="vue-shell__row feed-view__stats">
          <span>👍 {{ item.likeCount || 0 }}</span>
          <span>💬 {{ item.replyCount || 0 }}</span>
        </div>
      </div>
    </article>

    <p v-if="hasMore" class="feed-view__note">还有更多内容，分页加载会在后续迁移切片接入。</p>
  </section>
</template>

<style scoped>
.feed-view,
.feed-view__card,
.feed-view__item-body {
  display: grid;
  gap: var(--space-4);
}

.feed-view__hero {
  gap: var(--space-5);
}

.feed-view__header-row,
.feed-view__meta-row,
.feed-view__item-tags,
.feed-view__stats {
  align-items: center;
  flex-wrap: wrap;
}

.feed-view__card h2,
.feed-view__card p,
.feed-view__item h3,
.feed-view__item p,
.feed-view__note,
.feed-view__empty,
.feed-view__loading {
  margin: 0;
}

.feed-view__card p,
.feed-view__item p,
.feed-view__meta,
.feed-view__note,
.feed-view__empty,
.feed-view__loading {
  color: var(--lian-muted);
  line-height: 1.6;
}

.feed-view__item {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-2xl);
  background: var(--lian-surface);
  box-shadow: var(--shadow-soft);
}

.feed-view__cover {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: var(--radius-xl);
  background: var(--lian-surface-muted);
}

.feed-view__item h3 {
  font-size: 1rem;
}

.feed-view__stats {
  font-size: 0.875rem;
}
</style>
