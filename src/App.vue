<script setup lang="ts">
import {
  BottomTabBar,
  GlassPanel,
  IdentityBadge,
  InlineError,
  LianButton,
  LocationChip,
  TagChip,
  Toast,
  TopBar,
  TrustBadge,
  TypeChip
} from "./ui";

const tabs = [
  { key: "feed", label: "首页", icon: "⌂" },
  { key: "map", label: "探索", icon: "⌖" },
  { key: "messages", label: "消息", icon: "✉" },
  { key: "profile", label: "我的", icon: "○" }
];
</script>

<template>
  <main class="vue-shell" aria-labelledby="vue-shell-title">
    <div class="vue-shell__grid">
      <GlassPanel class="vue-shell__hero">
        <p class="vue-shell__eyebrow">LIAN UI Architecture</p>
        <h1 id="vue-shell-title">Vue UI primitives foundation</h1>
        <p class="vue-shell__summary">
          Vue 3 + Vite + TypeScript is now the long-term UI entry. These primitives define the first reusable boundary before page migration.
        </p>
        <div class="vue-shell__row">
          <LianButton variant="primary">发布到 LIAN</LianButton>
          <LianButton variant="tonal">保存草稿</LianButton>
          <LianButton variant="ghost">重新生成</LianButton>
        </div>
      </GlassPanel>

      <section class="vue-shell__section">
        <h2>Cards, chips and trust</h2>
        <GlassPanel class="vue-shell__sample-card">
          <div class="vue-shell__row">
            <TypeChip type="experience" icon="✓">经验</TypeChip>
            <LocationChip>三食堂</LocationChip>
            <TrustBadge tone="confirmed">已确认</TrustBadge>
            <TagChip tag="校园晚饭" />
          </div>
          <h3 class="vue-shell__sample-title">三食堂二楼哪家适合晚饭便宜吃饱？</h3>
          <p class="vue-shell__summary">
            卡片保持统一底色，类型依靠 chip、图标、状态和内容结构区分，颜色只做辅助提示。
          </p>
          <div class="vue-shell__sample-meta">
            <IdentityBadge avatar-text="蓝" label="小蓝鲸" meta="饭堂观察员" />
            <span>12 分钟前 · 18 评论 · 已沉淀到地点页</span>
          </div>
        </GlassPanel>
      </section>

      <section class="vue-shell__section">
        <h2>Feedback</h2>
        <Toast tone="success">发布成功，已关联到「三食堂」。</Toast>
        <InlineError>标签只能包含文字、数字、下划线或连字符，最多 5 个。</InlineError>
      </section>

      <section class="vue-shell__section">
        <h2>Navigation</h2>
        <TopBar title="探索" subtitle="地点组织沉淀，地图负责定位" />
        <BottomTabBar :items="tabs" active-key="feed" />
      </section>
    </div>
  </main>
</template>
