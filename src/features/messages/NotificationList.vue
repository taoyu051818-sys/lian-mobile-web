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
  NOTIFICATION_CHANNELS_LABEL,
  NOTIFICATION_CHANNELS_HINT,
  NOTIFICATION_CHANNEL_STATUS_CONNECTED,
  NOTIFICATION_CHANNEL_STATUS_PENDING,
  NOTIFICATION_CHANNEL_ISSUE_LINK_LABEL,
  NOTIFICATION_EMPTY_NEXT_STEP,
} from "../../config/brand";
import { actorDisplayName } from "../../domain/actor";
import type { NotificationItem } from "../../types/messages";
import { formatRelativeTime } from "../../utils/time";
import { NOTIFICATION_CHANNELS, type NotificationChannelInfo } from "./notificationChannels";

interface NotificationGapLink {
  label: string;
  issueUrl: string;
}

const props = withDefaults(
  defineProps<{
    items: NotificationItem[];
    loading: boolean;
    error: string;
    title?: string;
    hint?: string;
    emptyTitle?: string;
    emptyBody?: string;
    channels?: readonly NotificationChannelInfo[];
    gapLinks?: readonly NotificationGapLink[];
  }>(),
  {
    title: NOTIFICATION_CHANNELS_LABEL,
    hint: NOTIFICATION_CHANNELS_HINT,
    emptyTitle: EMPTY_NOTIFICATION,
    emptyBody: "",
    channels: () => NOTIFICATION_CHANNELS,
    gapLinks: () => [],
  },
);

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
    case "event-completed":
    case "event-reward-settled":
    case "event-expired":
      return "活动通知";
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
    <section
      v-if="props.channels.length"
      class="messages-view__channels"
      :aria-label="props.title"
      data-testid="notification-channel-readout"
    >
      <header class="messages-view__channels-header">
        <strong>{{ props.title }}</strong>
        <p>{{ props.hint }}</p>
      </header>
      <ul class="messages-view__channels-list">
        <li
          v-for="channel in props.channels"
          :key="channel.id"
          class="messages-view__channel"
          :class="{ 'is-pending': channel.status === 'pending' }"
          data-testid="notification-channel-row"
          :data-channel-id="channel.id"
          :data-channel-status="channel.status"
        >
          <div class="messages-view__channel-heading">
            <span class="messages-view__channel-title">{{ channel.title }}</span>
            <TrustBadge :tone="channel.status === 'connected' ? 'confirmed' : 'pending'">
              {{
                channel.status === "connected"
                  ? NOTIFICATION_CHANNEL_STATUS_CONNECTED
                  : NOTIFICATION_CHANNEL_STATUS_PENDING
              }}
            </TrustBadge>
          </div>
          <p class="messages-view__channel-desc">{{ channel.description }}</p>
          <a
            v-if="channel.issueUrl"
            class="messages-view__channel-link"
            :href="channel.issueUrl"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="notification-channel-issue-link"
          >
            {{ NOTIFICATION_CHANNEL_ISSUE_LINK_LABEL }}
          </a>
        </li>
      </ul>
    </section>

    <InlineError v-if="props.error">
      {{ props.error }}
      <button type="button" @click="emit('retry')">{{ CHANNEL_RELOAD }}</button>
    </InlineError>

    <div v-if="props.loading && !props.items.length" class="messages-view__state" role="status">
      {{ LOADING_NOTIFICATION }}
    </div>
    <div
      v-else-if="!props.items.length"
      class="messages-view__state"
      data-testid="notification-empty-state"
    >
      <strong>{{ props.emptyTitle || EMPTY_NOTIFICATION }}</strong>
      <p v-if="props.emptyBody">{{ props.emptyBody }}</p>
      <div v-if="props.gapLinks.length" class="messages-view__state-links">
        <span>{{ NOTIFICATION_EMPTY_NEXT_STEP }}</span>
        <a
          v-for="link in props.gapLinks"
          :key="link.issueUrl"
          :href="link.issueUrl"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="notification-gap-link"
        >
          {{ link.label }}
        </a>
      </div>
    </div>
    <div v-else class="messages-view__list" aria-live="polite">
      <article
        v-for="item in props.items"
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

.messages-view__channels {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px dashed rgba(31, 41, 51, 0.16);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.62);
}

.messages-view__channels-header {
  display: grid;
  gap: 4px;
}

.messages-view__channels-header strong {
  color: var(--lian-ink);
  font-size: 13px;
  font-weight: 850;
  letter-spacing: 0.02em;
}

.messages-view__channels-header p {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.6;
}

.messages-view__channels-list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.messages-view__channel {
  display: grid;
  gap: 4px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.74);
}

.messages-view__channel.is-pending {
  border-style: dashed;
  background: rgba(255, 255, 255, 0.44);
}

.messages-view__channel-heading {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.messages-view__channel-title {
  color: var(--lian-ink);
  font-size: 13px;
  font-weight: 800;
}

.messages-view__channel-desc {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.6;
}

.messages-view__channel-link {
  justify-self: start;
  color: var(--lian-primary, #1fa7a0);
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
}

.messages-view__channel-link:hover,
.messages-view__channel-link:focus-visible {
  text-decoration: underline;
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
  gap: var(--space-2);
  min-height: 112px;
  place-items: center;
  color: var(--lian-muted);
  text-align: center;
}

.messages-view__state strong {
  color: var(--lian-ink);
  font-size: 15px;
}

.messages-view__state p {
  max-width: 36ch;
  margin: 0;
  line-height: 1.6;
}

.messages-view__state-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.messages-view__state-links a {
  color: var(--lian-primary, #1fa7a0);
  font-weight: 800;
  text-decoration: none;
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
