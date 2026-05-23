<script setup lang="ts">
import { LianButton } from "../../ui";
import {
  LOADING_NOTIFICATION,
  NOTIFICATION_SECTION_LABEL,
  NOTIFICATION_READ,
  NOTIFICATION_UNREAD,
  NOTIFICATION_DEFAULT_TITLE,
  NOTIFICATION_REPLY_LABEL,
  NOTIFICATION_ACTOR_LABEL,
  NOTIFICATION_KIND_REPLY,
  NOTIFICATION_KIND_VERIFICATION,
  NOTIFICATION_KIND_ORDER,
  NOTIFICATION_KIND_EVENT,
  NOTIFICATION_KIND_MODERATION,
  NOTIFICATION_KIND_SYSTEM,
  MESSAGES_AUTH_REQUIRED_TITLE,
  MESSAGES_AUTH_REQUIRED_BODY,
  MESSAGES_AUTH_REQUIRED_CTA,
  MESSAGES_ERROR_TITLE,
  MESSAGES_ERROR_BODY,
  MESSAGES_ERROR_RETRY,
} from "../../config/brand";
import { actorDisplayName } from "../../domain/actor";
import { TrustBadge } from "../../ui";
import type { NotificationItem } from "../../types/messages";
import { formatRelativeTime } from "../../utils/time";
import type { NotificationFetchState } from "./useNotifications";

const props = withDefaults(
  defineProps<{
    items: NotificationItem[];
    loading: boolean;
    /**
     * Discriminated fetch state from `useNotifications`. The view renders
     * three different surfaces depending on this:
     *   - "auth-required": session expired (401/403) — we route to login.
     *   - "error": 5xx / timeout / JSON malformed — fail-loud, distinct
     *     from empty so a 5xx can never silently look like "暂无通知".
     *   - "idle": ready, possibly empty.
     */
    fetchState?: NotificationFetchState;
    title?: string;
    hint?: string;
    emptyTitle?: string;
    emptyBody?: string;
  }>(),
  {
    fetchState: "idle",
    title: "",
    hint: "",
    emptyTitle: "",
    emptyBody: "",
  },
);

const emit = defineEmits<{
  retry: [];
  "open-item": [item: NotificationItem];
  "auth-required": [];
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
      return NOTIFICATION_KIND_REPLY;
    case "verification":
      return NOTIFICATION_KIND_VERIFICATION;
    case "order":
      return NOTIFICATION_KIND_ORDER;
    case "event-completed":
    case "event-reward-settled":
    case "event-expired":
      return NOTIFICATION_KIND_EVENT;
    case "moderation":
      return NOTIFICATION_KIND_MODERATION;
    default:
      return NOTIFICATION_KIND_SYSTEM;
  }
}

function notificationHint(item: NotificationItem) {
  return item.fallbackText || item.actionLabel || "";
}

function isClickable(item: NotificationItem) {
  return (
    item.target?.kind === "detail" ||
    item.target?.kind === "verification" ||
    item.target?.kind === "errand-order"
  );
}

function openNotification(item: NotificationItem) {
  if (isClickable(item)) emit("open-item", item);
}
</script>

<template>
  <section class="messages-view__pane" :aria-label="NOTIFICATION_SECTION_LABEL">
    <header v-if="props.title || props.hint" class="messages-view__pane-header">
      <h2 v-if="props.title">{{ props.title }}</h2>
      <p v-if="props.hint">{{ props.hint }}</p>
    </header>

    <!--
      Auth-required surface (#828) — 401/403. Distinct from both error and
      empty: a session-expired user must see a re-login CTA, never a quiet
      "暂无通知" landing that hides the fact that auth dropped.
    -->
    <div
      v-if="props.fetchState === 'auth-required'"
      class="messages-view__state messages-view__state--auth"
      data-testid="messages-auth-required"
      role="alert"
    >
      <strong>{{ MESSAGES_AUTH_REQUIRED_TITLE }}</strong>
      <p>{{ MESSAGES_AUTH_REQUIRED_BODY }}</p>
      <LianButton variant="primary" @click="emit('auth-required')">{{
        MESSAGES_AUTH_REQUIRED_CTA
      }}</LianButton>
    </div>

    <!--
      Error surface (#828) — 5xx / timeout / JSON malformed. Fail-loud:
      the data layer also keeps `console.error("messages fetch failed", err)`
      so the contract is observable both in DOM and in devtools. Never
      silently downgrade to the empty branch below.
    -->
    <div
      v-else-if="props.fetchState === 'error'"
      class="messages-view__state messages-view__state--error"
      data-testid="messages-error"
      role="alert"
    >
      <strong>{{ MESSAGES_ERROR_TITLE }}</strong>
      <p>{{ MESSAGES_ERROR_BODY }}</p>
      <LianButton variant="ghost" @click="emit('retry')">{{ MESSAGES_ERROR_RETRY }}</LianButton>
    </div>

    <div
      v-else-if="props.loading && !props.items.length"
      class="messages-view__state"
      role="status"
    >
      {{ LOADING_NOTIFICATION }}
    </div>

    <div v-else-if="!props.items.length" class="messages-view__state" data-testid="messages-empty">
      <strong v-if="props.emptyTitle">{{ props.emptyTitle }}</strong>
      <p v-if="props.emptyBody">{{ props.emptyBody }}</p>
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

.messages-view__pane-header {
  display: grid;
  gap: 4px;
}

.messages-view__pane-header h2 {
  margin: 0;
  color: var(--lian-ink);
  font-size: 15px;
  font-weight: 850;
  letter-spacing: 0.01em;
}

.messages-view__pane-header p {
  margin: 0;
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.6;
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
  padding: var(--space-4);
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

.messages-view__state--auth,
.messages-view__state--error {
  border: 1px solid rgba(31, 41, 51, 0.1);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.62);
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
</style>
