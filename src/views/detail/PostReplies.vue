<script setup lang="ts">
import { SafeHtml } from "../../ui";
import { EMPTY_REPLIES } from "../../config/brand";
import { actorDisplayName } from "../../domain/actor";
import type { PostReply } from "../../types/post";
import { formatRelativeTime } from "../../utils/time";

defineProps<{
  replies?: PostReply[];
}>();

function sanitizeReplyHtml(value: string) {
  return String(value || "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<p[^>]*>\s*<strong>\s*#+[^<]+\s*<\/strong>\s*<\/p>/gi, "")
    .replace(/<p[^>]*>\s*#+[^<]+\s*<\/p>/gi, "")
    .trim();
}
</script>

<template>
  <section class="post-replies" aria-labelledby="post-detail-replies-title">
    <div class="post-replies__section-title">
      <h3 id="post-detail-replies-title">回复</h3>
      <span>{{ replies?.length ? `${replies.length} 条` : EMPTY_REPLIES }}</span>
    </div>
    <article v-for="reply in replies" :key="String(reply.id)" class="post-replies__item">
      <div class="post-replies__meta">
        <strong v-if="actorDisplayName(reply.actor)">{{ actorDisplayName(reply.actor) }}</strong>
        <span v-if="formatRelativeTime(reply.timestampISO)">{{ formatRelativeTime(reply.timestampISO) }}</span>
      </div>
      <SafeHtml
        :html="sanitizeReplyHtml(reply.content || '')"
        as="div"
        class="post-replies__content"
      />
    </article>
    <p v-if="!replies?.length" class="post-replies__empty">还没有回复，来写第一条。</p>
  </section>
</template>

<style scoped>
.post-replies {
  display: grid;
  gap: var(--space-3);
}

.post-replies__section-title {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.post-replies__section-title h3 {
  margin: 0;
}

.post-replies__section-title span {
  color: var(--lian-muted);
  font-size: 12px;
}

.post-replies__item {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.46);
}

.post-replies__meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.post-replies__meta span {
  color: var(--lian-muted);
  font-size: 12px;
}

.post-replies__content {
  color: var(--lian-muted);
  line-height: 1.62;
}

.post-replies__empty {
  color: var(--lian-muted);
  text-align: center;
}
</style>
