<script setup lang="ts">
import { InlineError, TrustBadge } from "../../ui";
import {
  LOADING_NOTIFICATION,
  EMPTY_NOTIFICATION,
  NOTIFICATION_SECTION_LABEL,
  CHANNEL_RELOAD,
  NOTIFICATION_READ,
  NOTIFICATION_UNREAD,
  NOTIFICATION_DEFAULT_TITLE,
  NOTIFICATION_REPLY_LABEL,
  NOTIFICATION_ACTOR_LABEL,
} from "../../config/brand";
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
  "open-item": [item: NotificationItem];
}>();

function isReplyNotification(item: NotificationItem) {
  return (
    item.kind === "reply" ||
    ["new-reply", "reply", "new-post", "post-reply"].includes(String(item.type || ""))
  );
}

function notificationActor(item: NotificationItem) {
  return actorDisplayName(
    item.actor,
    isReplyNotification(item) ? NOTIFICATION_REPLY_LABEL : NOTIFICATION_ACTOR_LABEL,
  );
}

function notificationKindLabel(item: NotificationItem) {
  switch (item.kind) {
    case "reply":
      return "回复通知";
    case "verification":
      return "认证结果";
    case "order":
      return "订单提醒";
    default:
      return "系统通知";
  }
}

function notificationHint(item: NotificationItem) {
  return item.fallbackText || item.actionLabel || "";
}

function isClickable(item: NotificationItem) {
  return item.target?.kind === "detail" || item.target?.kind === "verification";
}

function openNotification(item: NotificationItem) {
  if (isClickable(item)) emit("open-item", item);
}
</script>

<template>
  <section class="messages-view__pane" :aria-label="NOTIFICATION_SECTION_LABEL">
    <InlineError v-if="error">
      {{ error }}
      <button type="button" @click="emit('retry')">{{ CHANNEL_RELOAD }}</button>
    </InlineError>

    <div v-if="loading && !items.length" class="messages-view__state" role="status">
      {{ LOADING_NOTIFICATION }}
    </div>
    <div v-else-if="!items.length" class="messages-view__state">{{ EMPTY_NOTIFICATION }}</div>
    <div v-else class="messages-view__list" aria-live="polite">
      <article
        v-for="item in items"
        :key="String(item.id || item.tid || item.title)"
        class="messages-view__notification"
        :class="{
          'is-unread': !item.read,
          'is-clickable': isClickable(item),
          'is-fallback': item.target?.kind === 'none',
        }"
        :role="isClickable(item) ? 'button' : undefined"
        :tabindex="isClickable(item) ? 0 : undefined"
        data-testid="notification-item"
        :data-notification-kind="item.kind || 'generic'"
        :data-target-kind="item.target?.kind || 'none'"
        @click="openNotification(item)"
        @keydown.enter="openNotification(item)"
        @keydown.space.prevent="openNotification(item)"
      >
        <header>
          <div class="messages-view__notification-heading">
            <strong>{{ notificationActor(item) }}</strong>
            <small>{{ notificationKindLabel(item) }}</small>
          </div>
          <TrustBadge :tone="item.read ? 'confirmed' : 'pending'">
            {{ item.read ? NOTIFICATION_READ : NOTIFICATION_UNREAD }}
          </TrustBadge>
        </header>
        <h3>{{ item.title || NOTIFICATION_DEFAULT_TITLE }}</h3>
        <p v-if="item.excerpt && item.excerpt !== item.title">{{ item.excerpt }}</p>
        <p v-if="notificationHint(item)" class="messages-view__notification-hint">
          {{ notificationHint(item) }}
        </p>
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

.messages-view__notification-heading {
  display: grid;
  gap: 2px;
}

.messages-view__notification-heading small {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 700;
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

.messages-view__notification-hint {
  color: var(--lian-ink);
  font-size: 12px;
  font-weight: 700;
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

.messages-view__notification.is-fallback {
  border-style: dashed;
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
