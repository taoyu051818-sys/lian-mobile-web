<script setup lang="ts">
import { InlineError } from "../../ui";
import {
  CHANNEL_RELOAD,
  CONTENT_AVATAR_FALLBACK,
  CONTENT_COVER_ALT,
  LOADING_LIST,
  TIME_UNKNOWN,
  UNTITLED_CONTENT,
} from "../../config/brand";
import type { FeedItemId } from "../../types/feed";
import type { ProfileActivityStatus, ProfileListItem } from "../../types/profile";
import { formatRelativeTime } from "../../utils/time";

defineProps<{
  items: ProfileListItem[];
  loading: boolean;
  emptyText: string;
  error: string;
}>();

const emit = defineEmits<{
  retry: [];
  "open-item": [tid: FeedItemId];
}>();

const PROFILE_ACTIVITY_LABELS: Record<ProfileActivityStatus, string> = {
  published: "已发布",
  draft: "草稿",
  pending: "待处理",
  hidden: "隐藏",
};

function canOpenItem(item: ProfileListItem) {
  return typeof item.tid === "number" && item.tid > 0;
}

function itemKey(item: ProfileListItem, index: number) {
  if (item.id !== undefined && item.id !== "") return `profile-item:${String(item.id)}`;
  if (item.tid) return `profile-item:${String(item.tid)}`;
  return `profile-item:${index}`;
}

function itemTime(item: ProfileListItem) {
  return formatRelativeTime(item.lastViewedAt || item.timestampISO) || item.timeLabel || TIME_UNKNOWN;
}

function statusLabel(status?: ProfileActivityStatus) {
  return status ? PROFILE_ACTIVITY_LABELS[status] : undefined;
}

function openItem(item: ProfileListItem) {
  if (!canOpenItem(item) || item.tid === undefined) return;
  emit("open-item", item.tid);
}
</script>

<template>
  <div class="profile-collection">
    <InlineError v-if="error">
      {{ error }}
      <button type="button" @click="emit('retry')">{{ CHANNEL_RELOAD }}</button>
    </InlineError>

    <div v-if="loading" class="profile-collection__state" role="status">{{ LOADING_LIST }}</div>
    <div v-else-if="!items.length" class="profile-collection__state">{{ emptyText }}</div>
    <div v-else class="profile-collection__list" aria-live="polite">
      <article
        v-for="(item, index) in items"
        :key="itemKey(item, index)"
        class="profile-collection__item"
        :class="{ 'is-openable': canOpenItem(item) }"
        :role="canOpenItem(item) ? 'button' : undefined"
        :tabindex="canOpenItem(item) ? 0 : undefined"
        :aria-disabled="canOpenItem(item) ? undefined : true"
        @click="openItem(item)"
        @keydown.enter="openItem(item)"
        @keydown.space.prevent="openItem(item)"
      >
        <img
          v-if="item.cover"
          :src="item.cover"
          :alt="item.title || CONTENT_COVER_ALT"
          loading="lazy"
        />
        <div v-else class="profile-collection__thumb" aria-hidden="true">
          {{ (item.title || CONTENT_AVATAR_FALLBACK).slice(0, 1) }}
        </div>
        <div class="profile-collection__content">
          <h3>{{ item.title || UNTITLED_CONTENT }}</h3>
          <div class="profile-collection__meta">
            <span>{{ itemTime(item) }}</span>
            <span v-if="item.status">{{ statusLabel(item.status) }}</span>
            <span v-if="item.locationArea">{{ item.locationArea }}</span>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.profile-collection {
  display: grid;
  gap: var(--space-3);
}

.profile-collection h3,
.profile-collection p {
  margin: 0;
}

.profile-collection__state {
  display: grid;
  min-height: 112px;
  place-items: center;
  color: var(--lian-muted);
  font-size: 13px;
  text-align: center;
}

.profile-collection__list {
  display: grid;
  gap: var(--space-3);
}

.profile-collection__item {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-3);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.6);
  box-shadow: var(--shadow-card);
}

.profile-collection__item.is-openable {
  cursor: pointer;
  transition:
    box-shadow var(--motion-fast) var(--motion-ease-standard),
    transform var(--motion-fast) var(--motion-ease-standard);
}

.profile-collection__item.is-openable:hover {
  box-shadow:
    var(--shadow-card),
    0 2px 8px rgba(31, 167, 160, 0.12);
}

.profile-collection__item.is-openable:focus-visible {
  outline: 2px solid var(--lian-primary);
  outline-offset: 2px;
}

.profile-collection__item.is-openable:active {
  transform: scale(0.99);
}

.profile-collection__content {
  display: grid;
  gap: 6px;
}

.profile-collection__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.5;
}

.profile-collection__meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.profile-collection__item img,
.profile-collection__thumb {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-3);
  object-fit: cover;
}

.profile-collection__thumb {
  display: grid;
  place-items: center;
  background: var(--lian-primary-soft);
  color: var(--lian-primary-deep);
  font-size: 18px;
  font-weight: 900;
}

.profile-collection__item h3 {
  color: var(--lian-ink);
  font-size: 14px;
  font-weight: 850;
  line-height: 1.4;
}

.profile-collection :deep(.inline-error button) {
  min-height: 32px;
  margin-left: var(--space-2);
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: currentColor;
  font-weight: 900;
}
</style>