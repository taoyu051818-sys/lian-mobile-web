<script setup lang="ts">
import { InlineError, LianButton } from "../../ui";
import { actorAvatarText, actorDisplayName } from "../../domain/actor";
import type { ChannelMessage, ChannelMessageActor } from "../../types/messages";
import { formatRelativeTime } from "../../utils/time";
import {
  CHANNEL_DEFAULT_TAG,
  MESSAGE_EMPTY_CONTENT,
  LOADING_CHANNEL,
  EMPTY_CHANNEL,
  CHANNEL_RELOAD,
  CHANNEL_LOAD_MORE,
  CHANNEL_SENDING,
  CHANNEL_SEND_FAILED,
  CHANNEL_RETRY,
  CHANNEL_READ_COUNT,
  CHANNEL_THREAD_LABEL,
  FEED_TIME_JUST_NOW,
} from "../../config/brand";

defineProps<{
  items: ChannelMessage[];
  loading: boolean;
  error: string;
  hasMore: boolean;
}>();

const emit = defineEmits<{
  retry: [];
  loadMore: [];
  retryMessage: [pendingId: string];
}>();

function stripHtml(html?: string) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function messageText(item: ChannelMessage) {
  return item.content || stripHtml(item.contentHtml) || MESSAGE_EMPTY_CONTENT;
}

function messageActor(item: ChannelMessage): ChannelMessageActor {
  return item.actor || { id: "" };
}

function messageAuthor(item: ChannelMessage) {
  return actorDisplayName(messageActor(item));
}

function messageAvatarText(item: ChannelMessage) {
  return actorAvatarText(messageActor(item), messageAuthor(item));
}

function messageMeta(item: ChannelMessage) {
  const actor = messageActor(item);
  return actor.identityTag || CHANNEL_DEFAULT_TAG;
}
</script>

<template>
  <section class="messages-view__pane" :aria-label="CHANNEL_THREAD_LABEL">
    <InlineError v-if="error">
      {{ error }}
      <button type="button" @click="emit('retry')">{{ CHANNEL_RELOAD }}</button>
    </InlineError>

    <div class="messages-view__load-more">
      <LianButton v-if="hasMore" variant="ghost" :loading="loading" @click="emit('loadMore')">{{
        CHANNEL_LOAD_MORE
      }}</LianButton>
    </div>

    <div v-if="loading && !items.length" class="messages-view__state" role="status">
      {{ LOADING_CHANNEL }}
    </div>
    <div v-else-if="!items.length" class="messages-view__state">{{ EMPTY_CHANNEL }}</div>
    <div v-else class="messages-view__list" aria-live="polite">
      <article
        v-for="item in items"
        :key="String(item.id)"
        class="messages-view__message"
        :class="{ 'is-self': item.isSelf, 'is-pending': String(item.id).startsWith('pending-') }"
      >
        <span
          v-if="!item.isSelf"
          class="messages-view__message-avatar identity-badge__avatar"
          aria-hidden="true"
          >{{ messageAvatarText(item) }}</span
        >
        <div class="messages-view__message-body">
          <span v-if="!item.isSelf" class="messages-view__message-author identity-badge__text">
            <strong>{{ messageAuthor(item) }}</strong>
            <small>{{ messageMeta(item) }}</small>
          </span>
          <div class="messages-view__bubble">
            <p>{{ messageText(item) }}</p>
            <footer>
              <span>{{
                formatRelativeTime(item.timestampISO || item.time) || FEED_TIME_JUST_NOW
              }}</span>
              <span v-if="item.isSelf && item.deliveryState === 'sending'">{{
                CHANNEL_SENDING
              }}</span>
              <span v-else-if="item.isSelf && item.deliveryState === 'failed'">
                {{ CHANNEL_SEND_FAILED }}
                <button
                  type="button"
                  class="messages-view__retry-btn"
                  @click="emit('retryMessage', String(item.id))"
                >
                  {{ CHANNEL_RETRY }}
                </button>
              </span>
              <span v-else-if="item.readCount">{{ item.readCount }} {{ CHANNEL_READ_COUNT }}</span>
            </footer>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.messages-view__pane {
  display: grid;
  gap: var(--space-4);
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom) + var(--keyboard-inset-bottom));
}

.messages-view__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.messages-view__message {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  column-gap: var(--space-2);
  row-gap: var(--space-1);
  align-items: flex-start;
  max-width: 85%;
}

.messages-view__message.is-self {
  align-self: flex-end;
  grid-template-columns: minmax(0, 1fr);
}

.messages-view__message:not(.is-self) {
  align-self: flex-start;
}

.messages-view__message-avatar {
  grid-column: 1;
  grid-row: 1;
  flex-shrink: 0;
}

.messages-view__message-body {
  display: grid;
  grid-column: 2;
  gap: var(--space-1);
  min-width: 0;
}

.messages-view__message.is-self .messages-view__message-body {
  grid-column: 1;
}

.messages-view__message-author.identity-badge__text {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: baseline;
  padding-inline: var(--space-1);
  min-width: 0;
  line-height: 1.2;
}

.messages-view__message-author strong,
.messages-view__message-author small {
  line-height: inherit;
}

.messages-view__bubble {
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
  min-width: 0;
}

.messages-view__message.is-self .messages-view__bubble {
  border-color: rgba(31, 167, 160, 0.18);
  background: rgba(31, 167, 160, 0.06);
}

.messages-view__bubble p {
  margin: 0;
  color: var(--lian-ink);
  line-height: 1.6;
  word-break: break-word;
}

.messages-view__bubble footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  margin-top: var(--space-1);
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.4;
}

.messages-view__message.is-self .messages-view__bubble footer {
  justify-content: flex-end;
}

.messages-view__state {
  display: grid;
  min-height: 112px;
  place-items: center;
  color: var(--lian-muted);
  text-align: center;
}

.messages-view__load-more {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: flex-start;
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

.messages-view__message.is-pending {
  opacity: 0.7;
}

.messages-view__retry-btn {
  min-height: 44px;
  margin-left: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border: 1px solid rgba(31, 167, 160, 0.24);
  border-radius: var(--radius-chip);
  background: rgba(31, 167, 160, 0.08);
  color: var(--lian-accent, #1fa7a0);
  font-size: 12px;
  font-weight: 800;
}
</style>
