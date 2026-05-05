<script setup lang="ts">
import { GlassPanel, LianButton, LocationChip, TrustBadge, TypeChip } from "../ui";

const places = [
  { name: "三食堂", status: "晚餐排队", tone: "confirmed" },
  { name: "图书馆", status: "自习座位", tone: "pending" },
  { name: "北门", status: "出行动线", tone: "confirmed" }
] as const;
</script>

<template>
  <section class="map-view" aria-labelledby="map-view-title">
    <GlassPanel class="map-view__card">
      <div class="vue-shell__row">
        <TypeChip type="place">校园地图</TypeChip>
        <TrustBadge tone="confirmed">Vue View</TrustBadge>
      </div>
      <h2 id="map-view-title">按地点探索校园信息</h2>
      <p>Map 已切到 Vue View。下一步接入 MapV2 数据、地图容器和地点详情抽屉。</p>
      <div class="map-view__places" aria-label="地点入口">
        <article v-for="place in places" :key="place.name" class="map-view__place">
          <LocationChip>{{ place.name }}</LocationChip>
          <TrustBadge :tone="place.tone">{{ place.status }}</TrustBadge>
        </article>
      </div>
      <div class="vue-shell__row">
        <LianButton variant="primary">定位附近</LianButton>
        <LianButton variant="ghost">筛选地点</LianButton>
      </div>
    </GlassPanel>
  </section>
</template>

<style scoped>
.map-view,
.map-view__card,
.map-view__places {
  display: grid;
  gap: var(--space-4);
}

.map-view__card h2,
.map-view__card p {
  margin: 0;
}

.map-view__card p {
  color: var(--lian-muted);
  line-height: 1.6;
}

.map-view__place {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.52);
}
</style>
