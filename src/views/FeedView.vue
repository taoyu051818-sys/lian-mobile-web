<script setup lang="ts">
import { GlassPanel, IdentityBadge, LianButton, LocationChip, TagChip, TrustBadge, TypeChip } from "../ui";

const cards = [
  {
    id: "canteen",
    type: "experience",
    title: "三食堂晚餐排队明显变短",
    summary: "18:30 后二楼窗口更空，适合下课晚到的同学。",
    location: "三食堂",
    trust: "已确认",
    tags: ["饭堂", "晚餐"]
  },
  {
    id: "library",
    type: "discussion",
    title: "图书馆东侧自习区插座不足",
    summary: "靠窗位置下午满员较快，建议先看三楼中区。",
    location: "图书馆",
    trust: "待补充",
    tags: ["自习", "设施"]
  }
] as const;
</script>

<template>
  <section class="feed-view" aria-labelledby="feed-view-title">
    <GlassPanel class="feed-view__hero">
      <div class="vue-shell__row">
        <TypeChip type="hot">校园信息流</TypeChip>
        <TrustBadge tone="confirmed">Vue View</TrustBadge>
      </div>
      <h2 id="feed-view-title">今天校园里发生什么</h2>
      <p>Feed 已切到 Vue View。下一步接入真实 feed API、互动状态和分页。</p>
      <div class="vue-shell__row">
        <LianButton variant="primary">发布线索</LianButton>
        <LianButton variant="ghost">筛选地点</LianButton>
      </div>
    </GlassPanel>

    <div class="feed-view__list" aria-label="信息流示例">
      <GlassPanel v-for="card in cards" :key="card.id" class="feed-view__card">
        <div class="vue-shell__row">
          <TypeChip :type="card.type">{{ card.type === "experience" ? "经验" : "讨论" }}</TypeChip>
          <LocationChip>{{ card.location }}</LocationChip>
          <TrustBadge :tone="card.trust === '已确认' ? 'confirmed' : 'pending'">{{ card.trust }}</TrustBadge>
        </div>
        <h3>{{ card.title }}</h3>
        <p>{{ card.summary }}</p>
        <div class="feed-view__tags">
          <TagChip v-for="tag in card.tags" :key="tag" :tag="tag" />
        </div>
        <IdentityBadge avatar-text="同" label="校园同学" meta="地点贡献" />
      </GlassPanel>
    </div>
  </section>
</template>

<style scoped>
.feed-view,
.feed-view__hero,
.feed-view__list,
.feed-view__card {
  display: grid;
  gap: var(--space-4);
}

.feed-view__hero h2,
.feed-view__card h3,
.feed-view__hero p,
.feed-view__card p {
  margin: 0;
}

.feed-view__hero p,
.feed-view__card p {
  color: var(--lian-muted);
  line-height: 1.6;
}

.feed-view__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
