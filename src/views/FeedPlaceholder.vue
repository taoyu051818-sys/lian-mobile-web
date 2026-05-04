<script setup lang="ts">
import { GlassPanel, LocationChip, TrustBadge, TypeChip } from "../ui";
</script>

<template>
  <section class="app-view-placeholder" aria-labelledby="feed-placeholder-title">
    <GlassPanel class="app-view-placeholder__card">
      <div class="vue-shell__row">
        <TypeChip type="experience" icon="✓">经验</TypeChip>
        <LocationChip>三食堂</LocationChip>
        <TrustBadge tone="confirmed">已沉淀</TrustBadge>
      </div>
      <h2 id="feed-placeholder-title">信息流迁移入口</h2>
      <p>这里将承载 Vue 版 FeedView。先保留 legacy 信息流，后续再迁移 FeedCard、TypeChip、LocationChip 和 TrustBadge。</p>
    </GlassPanel>
  </section>
</template>
