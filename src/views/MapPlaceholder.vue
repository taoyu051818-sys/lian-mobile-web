<script setup lang="ts">
import { GlassPanel, LianButton, LocationChip, TrustBadge, TypeChip } from "../ui";
</script>

<template>
  <section class="app-view-placeholder" aria-labelledby="map-placeholder-title">
    <GlassPanel class="app-view-placeholder__card">
      <div class="vue-shell__row">
        <TypeChip type="place" icon="⌖">地点</TypeChip>
        <LocationChip>校园地图</LocationChip>
        <TrustBadge tone="pending">占位</TrustBadge>
      </div>
      <h2 id="map-placeholder-title">探索页迁移入口</h2>
      <p>这里将承载 Vue 版 MapView。MapV2 和 Leaflet 生命周期暂不迁移，等 AppShell 稳定后再处理。</p>
      <LianButton variant="tonal">查看地点原型</LianButton>
    </GlassPanel>
  </section>
</template>
