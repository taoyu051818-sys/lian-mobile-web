<script setup lang="ts">
import { computed } from "vue";
import { InlineError, VisibilityBadge } from "../../ui";
import {
  UNTITLED_CONTENT,
  CHANNEL_RELOAD,
  LOADING_LIST,
  CONTENT_COVER_ALT,
  CONTENT_AVATAR_FALLBACK,
  TIME_UNKNOWN,
  AVAILABLE_ACTION_CLAIM_REWARD,
  AVAILABLE_ACTION_COMPLETE_ERRAND,
  AVAILABLE_ACTION_MARK_SOLVED,
  PROFILE_RELATION_TYPE_EVENT_RECAP_TAG,
  PROFILE_RELATION_TYPE_EVENT_REWARD_TAG,
  PROFILE_RELATION_TYPE_HELP_EVENT_LINK_TAG,
  PROFILE_RELATION_TYPE_MERCHANT_ERRAND_TAG,
  PROFILE_RELATION_TYPE_PROJECT_SUBMISSION_TAG,
  PROFILE_RELATION_TYPE_SOLUTION_EVENT_TAG,
} from "../../config/brand";
import type { FeedItemId } from "../../types/feed";
import type { ProfileActivityStatus, ProfileListItem } from "../../types/profile";
import { formatRelativeTime } from "../../utils/time";

const props = defineProps<{
  items: ProfileListItem[];
  loading: boolean;
  emptyText: string;
  error: string;
}>();

const emit = defineEmits<{
  retry: [];
  "open-item": [tid: FeedItemId];
}>();

const STATUS_LABELS: Record<ProfileActivityStatus, string> = {
  published: "已发布",
  draft: "草稿",
  pending: "待审核",
  hidden: "仅自己可见",
};

const RELATION_TYPE_LABELS: Record<string, string> = {
  event_recap: PROFILE_RELATION_TYPE_EVENT_RECAP_TAG,
  event_reward: PROFILE_RELATION_TYPE_EVENT_REWARD_TAG,
  help_event_link: PROFILE_RELATION_TYPE_HELP_EVENT_LINK_TAG,
  solution_event: PROFILE_RELATION_TYPE_SOLUTION_EVENT_TAG,
  merchant_errand: PROFILE_RELATION_TYPE_MERCHANT_ERRAND_TAG,
  project_submission: PROFILE_RELATION_TYPE_PROJECT_SUBMISSION_TAG,
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  mark_solved: AVAILABLE_ACTION_MARK_SOLVED,
  claim_reward: AVAILABLE_ACTION_CLAIM_REWARD,
  complete_errand: AVAILABLE_ACTION_COMPLETE_ERRAND,
};

function uniqueLabels(types: string[], labels: Record<string, string>) {
  return Array.from(new Set(types.filter(Boolean))).map((type) => labels[type] ?? type);
}

function itemContextLabels(item: ProfileListItem) {
  const relations = Array.isArray(item.relations) ? item.relations : [];
  const availableActions = Array.isArray(item.availableActions) ? item.availableActions : [];
  return [
    ...uniqueLabels(
      relations.map((relation) => relation.type),
      RELATION_TYPE_LABELS,
    ),
    ...uniqueLabels(
      availableActions.map((action) => action.type),
      ACTION_TYPE_LABELS,
    ),
  ];
}

function canOpen(item: ProfileListItem) {
  return typeof item.tid === "number" && item.tid > 0;
}

function openItem(item: ProfileListItem) {
  if (!canOpen(item) || item.tid == null) return;
  emit("open-item", item.tid);
}

function itemStatusLabel(item: ProfileListItem) {
  if (!item.status || item.status === "published") return "";
  return STATUS_LABELS[item.status] || "";
}

function itemMeta(item: ProfileListItem) {
  const parts = [
    formatRelativeTime(item.lastViewedAt || item.timestampISO) || item.timeLabel || TIME_UNKNOWN,
  ];
  if (item.locationArea) parts.push(item.locationArea);
  return parts.filter(Boolean).join(" · ");
}

const itemStates = computed(() =>
  props.items.map((item) => ({
    key:
      item.id || String(item.tid || `${item.title || UNTITLED_CONTENT}-${item.timestampISO || ""}`),
    dataTid: item.tid != null ? String(item.tid) : "",
    statusLabel: itemStatusLabel(item),
    meta: itemMeta(item),
    contextLabels: itemContextLabels(item),
    canOpen: canOpen(item),
    visibility: item.visibility,
  })),
);
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
      <!--
        Performance: v-memo skips re-rendering collection items when their
        key properties haven't changed. Collection items are typically static
        once loaded, so we only need to re-render when the item data changes.
      -->
      <article
        v-for="(item, index) in items"
        :key="itemStates[index]?.key"
        v-memo="[
          itemStates[index]?.key,
          item.title,
          item.cover,
          item.status,
          item.visibility,
          itemStates[index]?.contextLabels,
        ]"
        class="profile-collection__item"
        :class="{ 'is-static': !itemStates[index]?.canOpen }"
        data-testid="profile-liked-item"
        :data-tid="itemStates[index]?.dataTid"
        :role="itemStates[index]?.canOpen ? 'button' : undefined"
        :tabindex="itemStates[index]?.canOpen ? 0 : undefined"
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
          <div class="profile-collection__title-row">
            <h3>{{ item.title || UNTITLED_CONTENT }}</h3>
            <span v-if="itemStates[index]?.statusLabel" class="profile-collection__badge">
              {{ itemStates[index]?.statusLabel }}
            </span>
            <VisibilityBadge
              v-if="itemStates[index]?.visibility"
              :visibility="itemStates[index]?.visibility"
              :show-icon="true"
              class="profile-collection__visibility"
            />
            <span
              v-for="label in itemStates[index]?.contextLabels"
              :key="label"
              class="profile-collection__context"
              data-testid="profile-collection-context"
            >
              {{ label }}
            </span>
          </div>
          <p>{{ itemStates[index]?.meta }}</p>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.profile-collection {
  display: grid;
  gap: var(--space-3);
  /* issue #829: stable min-height prevents layout jump when switching tabs */
  min-height: 180px;
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

.profile-collection__item.is-static {
  cursor: default;
}

.profile-collection__item:hover {
  box-shadow:
    var(--shadow-card),
    0 2px 8px rgba(31, 167, 160, 0.12);
}

.profile-collection__item.is-static:hover {
  box-shadow: var(--shadow-card);
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

.profile-collection__content {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.profile-collection__title-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.profile-collection__item h3 {
  color: var(--lian-ink);
  font-size: 14px;
  font-weight: 850;
  line-height: 1.4;
}

.profile-collection__badge {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(31, 167, 160, 0.12);
  color: var(--lian-primary-deep);
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.profile-collection__visibility,
.profile-collection__context {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(31, 41, 51, 0.06);
  color: var(--lian-muted);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.profile-collection__context {
  background: rgba(31, 167, 160, 0.1);
  color: var(--lian-primary-deep);
  font-weight: 800;
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
