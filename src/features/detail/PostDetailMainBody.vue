<script setup lang="ts">
import { SafeHtml } from "../../ui";

defineProps<{
  title?: string;
  bodyHtml?: string;
}>();
</script>

<template>
  <section class="post-detail-main-body">
    <h2 v-if="title" id="post-detail-title" data-testid="post-detail-title">{{ title }}</h2>
    <SafeHtml v-if="bodyHtml" :html="bodyHtml" as="div" class="lian-html" />
  </section>
</template>

<style scoped>
.post-detail-main-body {
  display: grid;
  gap: var(--space-3);
}

.post-detail-main-body :deep(h2),
.post-detail-main-body :deep(h3),
.post-detail-main-body :deep(p) {
  margin: 0;
}

.post-detail-main-body :deep(h2) {
  color: var(--lian-ink);
  font-size: 22px;
  line-height: 1.32;
}

:deep(.lian-html) {
  color: var(--lian-ink);
  line-height: 1.68;
}

:deep(.lian-html img) {
  display: none;
}
</style>
