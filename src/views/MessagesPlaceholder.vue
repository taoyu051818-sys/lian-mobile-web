<script setup lang="ts">
import { GlassPanel, IdentityBadge, LianButton, TrustBadge, TypeChip } from "../ui";
</script>

<template>
  <section class="app-view-placeholder" aria-labelledby="messages-placeholder-title">
    <GlassPanel class="app-view-placeholder__card">
      <div class="vue-shell__row">
        <TypeChip type="discussion" icon="✉">频道</TypeChip>
        <TrustBadge tone="pending">待迁移</TrustBadge>
      </div>
      <h2 id="messages-placeholder-title">消息页迁移入口</h2>
      <p>这里将承载 Vue 版 MessagesView。消息页默认底部滚动和旧消息加载逻辑需要单独验证。</p>
      <IdentityBadge avatar-text="同" label="频道消息" meta="后续接入频道与通知" />
      <div class="vue-shell__row">
        <LianButton variant="tonal">频道</LianButton>
        <LianButton variant="ghost">通知</LianButton>
      </div>
    </GlassPanel>
  </section>
</template>
