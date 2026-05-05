<script setup lang="ts">
import { GlassPanel, IdentityBadge, LianButton, TrustBadge, TypeChip } from "../ui";

const lanes = [
  { key: "channel", label: "频道", description: "校园频道入口已由 Vue 承载，后续接入真实列表。", status: "Vue" },
  { key: "notice", label: "通知", description: "回复、收藏和系统提醒会在这里聚合。", status: "Next" },
  { key: "archive", label: "归档", description: "保留历史信息入口，方便后续做搜索和沉淀。", status: "Ready" }
] as const;
</script>

<template>
  <section class="messages-view" aria-labelledby="messages-view-title">
    <GlassPanel class="messages-view__card">
      <div class="vue-shell__row">
        <TypeChip type="discussion" icon="✉">消息中心</TypeChip>
        <TrustBadge tone="confirmed">Vue 替换中</TrustBadge>
      </div>

      <h2 id="messages-view-title">消息中心</h2>
      <p>旧消息占位页已替换为 Vue 结构。开发模式下先推进可见页面，再接入真实数据和状态。</p>

      <IdentityBadge avatar-text="同" label="校园消息" meta="频道、通知、归档" />

      <div class="messages-view__lanes" aria-label="消息入口">
        <article v-for="lane in lanes" :key="lane.key" class="messages-view__lane">
          <div>
            <h3>{{ lane.label }}</h3>
            <p>{{ lane.description }}</p>
          </div>
          <TrustBadge tone="pending">{{ lane.status }}</TrustBadge>
        </article>
      </div>

      <div class="vue-shell__row">
        <LianButton variant="tonal">频道</LianButton>
        <LianButton variant="ghost">通知</LianButton>
      </div>
    </GlassPanel>
  </section>
</template>

<style scoped>
.messages-view,
.messages-view__card,
.messages-view__lanes {
  display: grid;
  gap: var(--space-4);
}

.messages-view__card h2,
.messages-view__lane h3,
.messages-view__card p,
.messages-view__lane p {
  margin: 0;
}

.messages-view__card p,
.messages-view__lane p {
  color: var(--lian-muted);
  line-height: 1.6;
}

.messages-view__lane {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.52);
}
</style>
