<script setup lang="ts">
import { LianButton } from "../../ui";

defineEmits<{
  undoHide: [];
}>();
</script>

<template>
  <section class="post-detail-hidden-state" aria-label="当前会话已隐藏内容" @click.stop>
    <h2>这条内容已在当前会话中隐藏</h2>
    <p>这只是当前设备上的临时隐藏，不会替代平台审核，也不会同步到其他设备。</p>
    <LianButton size="sm" variant="ghost" @click="$emit('undoHide')">撤销隐藏</LianButton>
  </section>
</template>

<style scoped>
.post-detail-hidden-state {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid rgba(239, 68, 68, 0.18);
  border-radius: var(--radius-card);
  background: rgba(239, 68, 68, 0.06);
}

.post-detail-hidden-state h2,
.post-detail-hidden-state p {
  margin: 0;
}

.post-detail-hidden-state p {
  color: var(--lian-muted);
  line-height: 1.6;
}
</style>
