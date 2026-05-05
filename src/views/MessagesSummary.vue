<script setup lang="ts">
import { GlassPanel, IdentityBadge, LianButton, TrustBadge, TypeChip } from "../ui";

interface MessageLane {
  key: string;
  label: string;
  description: string;
  status: string;
  tone: "pending" | "confirmed" | "official";
}

const lanes: MessageLane[] = [
  {
    key: "channel",
    label: "频道消息",
    description: "保留 legacy 里的频道列表、底部滚动和旧消息加载，Vue 先展示入口边界。",
    status: "legacy 承载",
    tone: "pending"
  },
  {
    key: "notifications",
    label: "通知",
    description: "后续承载回复、收藏、系统提醒等通知聚合，当前不接真实接口。",
    status: "待接入",
    tone: "pending"
  },
  {
    key: "direct",
    label: "私信预留",
    description: "先保留信息架构位置，不提前实现私信状态或未读计数。",
    status: "预留",
    tone: "official"
  }
];
</script>

<template>
  <section class="messages-summary" aria-labelledby="messages-summary-title">
    <GlassPanel class="messages-summary__card">
      <header class="messages-summary__header">
        <div class="vue-shell__row">
          <TypeChip type="discussion" icon="✉">消息中心</TypeChip>
          <TrustBadge tone="pending">只读试点</TrustBadge>
        </div>
        <IdentityBadge avatar-text="同" label="频道消息" meta="频道、通知和后续私信入口" />
      </header>

      <div class="messages-summary__copy">
        <p class="messages-summary__eyebrow">Messages Migration Pilot</p>
        <h2 id="messages-summary-title">消息页迁移边界</h2>
        <p>
          先把消息中心的信息架构迁入 Vue。真实频道消息、底部滚动、旧消息加载和通知切换仍由 legacy 页面验证。
        </p>
      </div>

      <div class="messages-summary__lanes" aria-label="消息入口概览">
        <article v-for="lane in lanes" :key="lane.key" class="messages-summary__lane">
          <div>
            <h3>{{ lane.label }}</h3>
            <p>{{ lane.description }}</p>
          </div>
          <TrustBadge :tone="lane.tone">{{ lane.status }}</TrustBadge>
        </article>
      </div>

      <section class="messages-summary__notice" aria-labelledby="messages-summary-notice-title">
        <h3 id="messages-summary-notice-title">暂不接管的行为</h3>
        <p>
          不在本试点里迁移消息滚动定位、分页加载、未读计数、通知切换和实时刷新，避免破坏当前 legacy 体验。
        </p>
      </section>

      <div class="vue-shell__row">
        <LianButton variant="tonal" disabled>频道仍走 legacy</LianButton>
        <LianButton variant="ghost" disabled>通知稍后接入</LianButton>
      </div>
    </GlassPanel>
  </section>
</template>

<style scoped>
.messages-summary {
  display: grid;
}

.messages-summary__card {
  display: grid;
  gap: var(--space-4);
}

.messages-summary__header {
  display: grid;
  gap: var(--space-3);
}

.messages-summary__copy,
.messages-summary__notice {
  display: grid;
  gap: var(--space-2);
}

.messages-summary__copy h2,
.messages-summary__lane h3,
.messages-summary__notice h3 {
  margin: 0;
}

.messages-summary__copy p,
.messages-summary__lane p,
.messages-summary__notice p {
  margin: 0;
  color: var(--lian-muted);
  line-height: 1.6;
}

.messages-summary__eyebrow {
  color: var(--lian-primary-deep) !important;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.messages-summary__lanes {
  display: grid;
  gap: var(--space-3);
}

.messages-summary__lane {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.52);
}

.messages-summary__notice {
  padding: var(--space-3);
  border: 1px dashed var(--lian-border-strong);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.34);
}

@media (max-width: 640px) {
  .messages-summary__lane {
    display: grid;
  }
}
</style>
