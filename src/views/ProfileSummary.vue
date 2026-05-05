<script setup lang="ts">
import { GlassPanel, IdentityBadge, LianButton, TagChip, TrustBadge } from "../ui";

interface ProfileMetric {
  label: string;
  value: string;
  meta: string;
}

const profile = {
  avatarText: "蓝",
  displayName: "小蓝鲸",
  identity: "饭堂观察员",
  contribution: "地点沉淀者",
  status: "只读试点",
  summary: "先把身份、贡献、标签和可信状态迁入 Vue；编辑资料、头像裁剪和发布历史仍留在 legacy 体验里验证。",
  tags: ["饭堂", "校园生活", "地点观察"],
  metrics: [
    { label: "沉淀地点", value: "3", meta: "示例数据" },
    { label: "发布记录", value: "12", meta: "待接入真实接口" },
    { label: "可信状态", value: "已展示", meta: "非生产事实" }
  ] satisfies ProfileMetric[]
};
</script>

<template>
  <section class="profile-summary" aria-labelledby="profile-summary-title">
    <GlassPanel class="profile-summary__card">
      <header class="profile-summary__header">
        <IdentityBadge
          :avatar-text="profile.avatarText"
          :label="profile.displayName"
          :meta="profile.identity"
        />
        <TrustBadge tone="pending">{{ profile.status }}</TrustBadge>
      </header>

      <div class="profile-summary__copy">
        <p class="profile-summary__eyebrow">Profile Migration Pilot</p>
        <h2 id="profile-summary-title">我的校园身份</h2>
        <p>{{ profile.summary }}</p>
      </div>

      <div class="profile-summary__chips" aria-label="个人资料标签">
        <TagChip v-for="tag in profile.tags" :key="tag" :tag="tag" />
      </div>

      <dl class="profile-summary__metrics" aria-label="个人资料概览">
        <div v-for="metric in profile.metrics" :key="metric.label" class="profile-summary__metric">
          <dt>{{ metric.label }}</dt>
          <dd>{{ metric.value }}</dd>
          <span>{{ metric.meta }}</span>
        </div>
      </dl>

      <section class="profile-summary__notice" aria-labelledby="profile-summary-notice-title">
        <h3 id="profile-summary-notice-title">迁移边界</h3>
        <p>
          当前只迁移低风险展示层。资料编辑、头像上传裁剪、历史发布列表和账号状态仍不在这个试点里接管。
        </p>
      </section>

      <div class="vue-shell__row">
        <LianButton variant="tonal" disabled>查看我的发布稍后接入</LianButton>
        <LianButton variant="ghost" disabled>编辑资料仍走 legacy</LianButton>
      </div>
    </GlassPanel>
  </section>
</template>

<style scoped>
.profile-summary {
  display: grid;
}

.profile-summary__card {
  display: grid;
  gap: var(--space-4);
}

.profile-summary__header,
.profile-summary__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.profile-summary__copy {
  display: grid;
  gap: var(--space-2);
}

.profile-summary__copy h2,
.profile-summary__notice h3 {
  margin: 0;
}

.profile-summary__copy p,
.profile-summary__notice p {
  margin: 0;
  color: var(--lian-muted);
  line-height: 1.6;
}

.profile-summary__eyebrow {
  color: var(--lian-primary-deep) !important;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.profile-summary__chips {
  justify-content: flex-start;
}

.profile-summary__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
}

.profile-summary__metric {
  display: grid;
  gap: 2px;
  padding: var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.52);
}

.profile-summary__metric dt {
  color: var(--lian-muted);
  font-size: 12px;
}

.profile-summary__metric dd {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
}

.profile-summary__metric span {
  color: var(--lian-muted);
  font-size: 11px;
}

.profile-summary__notice {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px dashed var(--lian-border-strong);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.34);
}

@media (max-width: 640px) {
  .profile-summary__metrics {
    grid-template-columns: 1fr;
  }
}
</style>
