<script setup lang="ts">
import { InlineError } from "../../ui";
import {
  UNTITLED_CONTENT,
  CHANNEL_RELOAD,
  LOADING_LIST,
  CONTENT_COVER_ALT,
  CONTENT_AVATAR_FALLBACK,
  TIME_UNKNOWN,
} from "../../config/brand";
import type { FeedItemId } from "../../types/feed";
import type { ProfileListItem } from "../../types/profile";
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
        v-for="item in items"
        :key="String(item.tid)"
        class="profile-collection__item"
        role="button"
        tabindex="0"
        @click="emit('open-item', item.tid)"
        @keydown.enter="emit('open-item', item.tid)"
        @keydown.space.prevent="emit('open-item', item.tid)"
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
        <div>
          <h3>{{ item.title || UNTITLED_CONTENT }}</h3>
          <p>{{ formatRelativeTime(item.lastViewedAt || item.timestampISO) || TIME_UNKNOWN }}</p>
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
  cursor: pointer;
  transition:
    box-shadow var(--motion-fast) var(--motion-ease-standard),
    transform var(--motion-fast) var(--motion-ease-standard);
}

.profile-collection__item:hover {
  box-shadow:
    var(--shadow-card),
    0 2px 8px rgba(31, 167, 160, 0.12);
}

.profile-collection__item:focus-visible {
  outline: 2px solid var(--lian-primary);
  outline-offset: 2px;
}

.profile-collection__item:active {
  transform: scale(0.99);
}

.profile-collection__item p {
  color: var(--lian-muted);
  font-size: 12px;
  line-height: 1.5;
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
  margin-bottom: 2px;
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
