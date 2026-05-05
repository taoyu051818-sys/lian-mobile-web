<script setup lang="ts">
import { GlassPanel, LianButton, LocationChip, TrustBadge, TypeChip } from "../ui";

const places = [
  {
    id: "canteen",
    name: "三食堂",
    category: "饭堂",
    signal: "晚餐排队缩短",
    status: "高相关"
  },
  {
    id: "library",
    name: "图书馆",
    category: "学习",
    signal: "东侧插座紧张",
    status: "待确认"
  },
  {
    id: "gate",
    name: "北门",
    category: "出行",
    signal: "晚高峰拥堵",
    status: "实时线索"
  }
] as const;
</script>

<template>
  <section class="map-view" aria-labelledby="map-view-title">
    <GlassPanel class="map-view__hero">
      <div class="vue-shell__row">
        <TypeChip type="place" icon="⌖">校园地图</TypeChip>
        <TrustBadge tone="confirmed">Vue 替换中</TrustBadge>
      </div>
      <h2 id="map-view-title">按地点探索校园信息</h2>
      <p>旧 Map placeholder 已替换为 Vue 地点视图骨架。下一步接入 MapV2 数据、地图容器和地点详情抽屉。</p>
      <div class="vue-shell__row">
        <LianButton variant="primary">定位附近</LianButton>
        <LianButton variant="ghost">筛选地点</LianButton>
      </div>
    </GlassPanel>

    <GlassPanel class="map-view__canvas" aria-label="校园地图原型">
      <div class="map-view__grid">
        <button v-for="place in places" :key="place.id" class="map-view__pin" type="button">
          <span class="map-view__pin-dot" aria-hidden="true"></span>
          <strong>{{ place.name }}</strong>
          <small>{{ place.signal }}</small>
        </button>
      </div>
    </GlassPanel>

    <div class="map-view__places" aria-label="地点列表">
      <GlassPanel v-for="place in places" :key="place.id" class="map-view__place-card">
        <div class="vue-shell__row">
          <LocationChip>{{ place.name }}</LocationChip>
          <TypeChip type="place">{{ place.category }}</TypeChip>
          <TrustBadge :tone="place.status === '待确认' ? 'pending' : 'confirmed'">{{ place.status }}</TrustBadge>
        </div>
        <p>{{ place.signal }}</p>
      </GlassPanel>
    </div>
  </section>
</template>

<style scoped>
.map-view,
.map-view__hero,
.map-view__places,
.map-view__place-card {
  display: grid;
  gap: var(--space-4);
}

.map-view__hero h2,
.map-view__place-card p {
  margin: 0;
}

.map-view__hero p,
.map-view__place-card p {
  color: var(--lian-muted);
  line-height: 1.6;
}

.map-view__canvas {
  min-height: 320px;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgba(31, 167, 160, 0.12), transparent 40%),
    linear-gradient(45deg, rgba(91, 184, 214, 0.16), transparent 46%),
    rgba(255, 255, 255, 0.5);
}

.map-view__grid {
  position: relative;
  min-height: 280px;
  border: 1px dashed var(--lian-border-strong);
  border-radius: var(--radius-4);
}

.map-view__pin {
  position: absolute;
  display: grid;
  gap: 2px;
  min-width: 132px;
  padding: var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.78);
  color: var(--lian-ink);
  text-align: left;
  box-shadow: var(--shadow-soft);
}

.map-view__pin:nth-child(1) {
  top: 18%;
  left: 14%;
}

.map-view__pin:nth-child(2) {
  top: 42%;
  right: 14%;
}

.map-view__pin:nth-child(3) {
  right: 28%;
  bottom: 12%;
}

.map-view__pin-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--lian-primary);
}

.map-view__pin small {
  color: var(--lian-muted);
}
</style>
