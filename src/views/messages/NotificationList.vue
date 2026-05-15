<script setup lang="ts">
import { InlineError, TrustBadge } from "../../ui";
import { actorDisplayName } from "../../domain/actor";
import type { NotificationItem } from "../../types/messages";
import { formatRelativeTime } from "../../utils/time";

defineProps<{
  items: NotificationItem[];
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{
  retry: [];
  "open-item": [tid: number];
}>();

function isReplyNotification(item: NotificationItem) {
  return ["new-reply", "reply", "new-post", "post-reply"].includes(String(item.type || ""));
}

function notificationActor(item: NotificationItem) {
  return actorDisplayName(item.actor, isReplyNotification(item) ? "回复" : "通知");
}

function openNotification(item: NotificationItem) {
  const tid = Number(item.tid);
  if (Number.isFinite(tid) && tid > 0) emit("open-item", tid);
}
</script>

<template>
  <section class="messages-view__pane" aria-label="通知">
    <InlineError v-if="error">
      {{ error }}
      <button type="button" @click="emit('retry')">重新加载</button>
    </InlineError>

    <div v-if="loading && !items.length" class="messages-view__state" role="status">正在加载通知…</div>
    <div v-else-if="!items.length" class="messages-view__state">暂无通知</div>
    <div v-else class="messages-view__list" aria-live="polite">
      <article
        v-for="item in items"
        :key="String(item.id || item.tid || item.title)"
        class="messages-view__notification"
        :class="{ 'is-unread': !item.read, 'is-clickable': Number(item.tid) > 0 }"
        role="button"
        :tabindex="Number(item.tid) > 0 ? 0 : undefined"
        @click="openNotification(item)"
        @keydown.enter="openNotification(item)"
      >
        <header>
          <strong>{{ notificationActor(item) }}</strong>
          <TrustBadge :tone="item.read ? 'confirmed' : 'pending'">{{ item.read ? "已读" : "未读" }}</TrustBadge>
        </header>
        <h3>{{ item.title || "新通知" }}</h3>
        <p v-if="item.excerpt && item.excerpt !== item.title">{{ item.excerpt }}</p>
        <time>{{ formatRelativeTime(item.timestampISO || item.time) }}</time>
      </article>
    </div>
  </section>
</template>

<style scoped>
.messages-view__pane,
.messages-view__list {
  display: grid;
  gap: var(--space-4);
}

.messages-view__notification header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.messages-view__notification p {
  margin: 0;
}

.messages-view__notification p,
.messages-view__notification time {
  color: var(--lian-muted);
  line-height: 1.6;
}

.messages-view__notification {
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
}

.messages-view__state {
  display: grid;
  min-height: 112px;
  place-items: center;
  color: var(--lian-muted);
  text-align: center;
}

.messages-view__notification.is-unread {
  border-color: rgba(31, 167, 160, 0.28);
}

.messages-view__notification.is-clickable {
  cursor: pointer;
}

.messages-view__notification.is-clickable:focus-visible {
  outline: 2px solid var(--lian-primary, #1fa7a0);
  outline-offset: 2px;
}

.inline-error button {
  min-height: 32px;
  margin-left: var(--space-2);
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: currentColor;
  font-weight: 900;
}
</style>
