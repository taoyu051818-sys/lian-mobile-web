<script setup lang="ts">
import { IdentityBadge, InlineError, LianButton } from "../../ui";
import type { DisplayActor } from "../../types/feed";
import type { ChannelMessage, ChannelMessageActor } from "../../types/messages";
import { formatRelativeTime } from "../../utils/time";

const props = defineProps<{
  items: ChannelMessage[];
  loading: boolean;
  error: string;
  hasMore: boolean;
}>();

const emit = defineEmits<{
  retry: [];
  loadMore: [];
}>();

function stripHtml(html?: string) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function actorDisplayName(actor?: DisplayActor | null, fallback = "") {
  return actor?.displayName || actor?.username || actor?.name || fallback || "同学";
}

function actorAvatarText(actor?: DisplayActor | null, fallback = "") {
  return actor?.avatarText || actorDisplayName(actor, fallback).slice(0, 2) || "同";
}

function messageText(item: ChannelMessage) {
  return item.content || stripHtml(item.contentHtml) || "这条消息暂时没有内容。";
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
  return actor.identityTag || "校园频道";
}
</script>

<template>
  <section class="messages-view__pane" aria-label="校园频道">
    <InlineError v-if="error">
      {{ error }}
      <button type="button" @click="emit('retry')">重新加载</button>
    </InlineError>

    <div v-if="loading && !items.length" class="messages-view__state" role="status">正在加载频道消息…</div>
    <div v-else-if="!items.length" class="messages-view__state">还没有消息</div>
    <div v-else class="messages-view__list" aria-live="polite">
      <article v-for="item in items" :key="String(item.id)" class="messages-view__message" :class="{ 'is-self': item.isSelf }">
        <IdentityBadge :avatar-text="messageAvatarText(item)" :label="messageAuthor(item)" :meta="messageMeta(item)" />
        <p>{{ messageText(item) }}</p>
        <footer>
          <span>{{ formatRelativeTime(item.timestampISO || item.time) || "刚刚" }}</span>
          <span v-if="item.isSelf && item.deliveryState === 'sending'">发送中…</span>
          <span v-else-if="item.isSelf && item.deliveryState === 'failed'">发送失败</span>
          <span v-else-if="item.readCount">{{ item.readCount }} 次已读</span>
        </footer>
      </article>
    </div>

    <div class="messages-view__load-more">
      <LianButton v-if="hasMore" variant="ghost" :loading="loading" @click="emit('loadMore')">加载更早消息</LianButton>
    </div>
  </section>
</template>

<style scoped>
.messages-view__pane,
.messages-view__list {
  display: grid;
  gap: var(--space-4);
}

.messages-view__message footer,
.messages-view__load-more {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.messages-view__load-more {
  justify-content: flex-start;
}

.messages-view__message p {
  margin: 0;
}

.messages-view__message p,
.messages-view__message footer {
  color: var(--lian-muted);
  line-height: 1.6;
}

.messages-view__message {
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

.messages-view__message.is-self {
  border-color: rgba(31, 167, 160, 0.18);
  background: rgba(31, 167, 160, 0.06);
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
