<script setup lang="ts">
import { GlassPanel, LianButton, LocationChip, TrustBadge, TypeChip } from "../ui";
</script>

<template>
  <section class="feed-view" aria-labelledby="feed-view-title">
    <GlassPanel class="feed-view__card">
      <div class="vue-shell__row">
        <TypeChip type="hot">校园信息流</TypeChip>
        <TrustBadge tone="confirmed">Vue View</TrustBadge>
      </div>
      <h2 id="feed-view-title">今天校园里发生什么</h2>
      <p>Feed 已切到 Vue View。下一步接入真实 feed API、互动状态和分页。</p>
      <LocationChip>校园</LocationChip>
      <div class="vue-shell__row">
        <LianButton variant="primary">新建内容</LianButton>
        <LianButton variant="ghost">筛选地点</LianButton>
      </div>
    </GlassPanel>
  </section>
</template>

<style scoped>
.feed-view,
.feed-view__card {
  display: grid;
  gap: var(--space-4);
}

.feed-view__card h2,
.feed-view__card p {
  margin: 0;
}

.feed-view__card p {
  color: var(--lian-muted);
  line-height: 1.6;
}
</style>
