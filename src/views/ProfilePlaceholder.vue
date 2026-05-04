<script setup lang="ts">
import { GlassPanel, IdentityBadge, LianButton } from "../ui";
</script>

<template>
  <section class="app-view-placeholder" aria-labelledby="profile-placeholder-title">
    <GlassPanel class="app-view-placeholder__card">
      <IdentityBadge avatar-text="蓝" label="小蓝鲸" meta="饭堂观察员" />
      <h2 id="profile-placeholder-title">个人资料迁移入口</h2>
      <p>这里将承载 Vue 版 ProfileView，涉及到用户信息与历史发布记录。</p>
      <div class="vue-shell__row">
        <LianButton variant="tonal">查看我的发布</LianButton>
        <LianButton variant="ghost">编辑资料</LianButton>
      </div>
    </GlassPanel>
  </section>
</template>
