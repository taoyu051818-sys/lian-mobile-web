<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";
import { EmptyState, InlineError, LianButton } from "../../ui";
import { actorAvatarText, actorDisplayName } from "../../domain/actor";
import type { ChannelMessage, ChannelMessageActor } from "../../types/messages";
import { formatRelativeTime } from "../../utils/time";
import {
  CHANNEL_DEFAULT_TAG,
  MESSAGE_EMPTY_CONTENT,
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

const EMPTY_CHANNEL_HINT = "发送第一条消息开始聊天";
const SKELETON_COUNT = 4;

const props = defineProps<{
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

const listRef = ref<HTMLElement | null>(null);

// Auto-scroll to bottom when new messages arrive
watch(
  () => props.items.length,
  async (newLen, oldLen) => {
    if (newLen > oldLen) {
      await nextTick();
      scrollToBottom();
    }
  },
);

onMounted(() => {
  if (props.items.length) {
    scrollToBottom();
  }
});

function scrollToBottom() {
  if (!listRef.value) return;
  const lastMessage = listRef.value.lastElementChild;
  if (lastMessage) {
    lastMessage.scrollIntoView({ behavior: "smooth", block: "end" });
  }
}

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

    <!-- Skeleton loading state -->
    <div v-if="loading && !items.length" class="messages-view__list" role="status" aria-busy="true">
      <div
        v-for="n in SKELETON_COUNT"
        :key="`skeleton-${n}`"
        class="messages-view__message messages-view__skeleton"
        :class="{ 'messages-view__message--self': n % 3 === 0 }"
      >
        <span v-if="n % 3 !== 0" class="messages-view__skeleton-avatar" aria-hidden="true"></span>
        <div class="messages-view__message-body">
          <span v-if="n % 3 !== 0" class="messages-view__skeleton-author"></span>
          <div class="messages-view__skeleton-bubble">
            <span class="messages-view__skeleton-line"></span>
            <span class="messages-view__skeleton-line messages-view__skeleton-line--short"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <EmptyState
      v-else-if="!items.length"
      class="messages-view__empty"
      :title="EMPTY_CHANNEL"
      :description="EMPTY_CHANNEL_HINT"
    />

    <!-- Message list -->
    <div v-else ref="listRef" class="messages-view__list" aria-live="polite">
      <article
        v-for="item in items"
        :key="String(item.id)"
        class="messages-view__message"
        :class="{
          'messages-view__message--self': item.isSelf,
          'is-loading': String(item.id).startsWith('pending-'),
        }"
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

.messages-view__message--self {
  align-self: flex-end;
  grid-template-columns: minmax(0, 1fr);
}

.messages-view__message:not(.messages-view__message--self) {
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

.messages-view__message--self .messages-view__message-body {
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

.messages-view__message--self .messages-view__bubble {
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

.messages-view__message--self .messages-view__bubble footer {
  justify-content: flex-end;
}

.messages-view__state {
  display: grid;
  min-height: 112px;
  place-items: center;
  color: var(--lian-muted);
  text-align: center;
}

.messages-view__empty {
  min-height: 160px;
  padding: var(--space-6) var(--space-4);
}

/* Skeleton loading styles */
.messages-view__skeleton {
  pointer-events: none;
}

.messages-view__skeleton-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(
    90deg,
    rgba(31, 41, 51, 0.06) 25%,
    rgba(31, 41, 51, 0.12) 50%,
    rgba(31, 41, 51, 0.06) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.messages-view__skeleton-author {
  width: 80px;
  height: 14px;
  border-radius: var(--radius-chip);
  background: linear-gradient(
    90deg,
    rgba(31, 41, 51, 0.06) 25%,
    rgba(31, 41, 51, 0.12) 50%,
    rgba(31, 41, 51, 0.06) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.messages-view__skeleton-bubble {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-card);
  background: rgba(31, 41, 51, 0.04);
}

.messages-view__skeleton-line {
  width: 100%;
  max-width: 180px;
  height: 14px;
  border-radius: var(--radius-chip);
  background: linear-gradient(
    90deg,
    rgba(31, 41, 51, 0.06) 25%,
    rgba(31, 41, 51, 0.12) 50%,
    rgba(31, 41, 51, 0.06) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.messages-view__skeleton-line--short {
  max-width: 120px;
}

.messages-view__message--self .messages-view__skeleton-bubble {
  background: rgba(31, 167, 160, 0.04);
}

.messages-view__message--self .messages-view__skeleton-line {
  margin-left: auto;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .messages-view__skeleton-avatar,
  .messages-view__skeleton-author,
  .messages-view__skeleton-line {
    animation: none;
    background: rgba(31, 41, 51, 0.08);
  }
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

.messages-view__message.is-loading {
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
