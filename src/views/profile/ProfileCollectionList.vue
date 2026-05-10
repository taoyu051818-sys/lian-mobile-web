<script setup lang="ts">
import { InlineError } from "../../ui";
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
}>();
</script>

<template>
  <div class="profile-collection">
    <InlineError v-if="error">
      {{ error }}
      <button type="button" @click="emit('retry')">重新加载</button>
    </InlineError>

    <div v-if="loading" class="profile-collection__state" role="status">正在加载列表…</div>
    <div v-else-if="!items.length" class="profile-collection__state">{{ emptyText }}</div>
    <div v-else class="profile-collection__list" aria-live="polite">
      <article v-for="item in items" :key="String(item.tid)" class="profile-collection__item">
        <img v-if="item.cover" :src="item.cover" :alt="item.title || '内容封面'" loading="lazy" />
        <div v-else class="profile-collection__thumb" aria-hidden="true">{{ (item.title || '内').slice(0, 1) }}</div>
        <div>
          <h3>{{ item.title || "未命名内容" }}</h3>
          <p>{{ formatRelativeTime(item.lastViewedAt || item.timestampISO) || "时间未知" }}</p>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.profile-collection {
  display: grid;
  gap: var(--space-4);
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
  text-align: center;
}

.profile-collection__list {
  display: grid;
  gap: var(--space-4);
}

.profile-collection__item {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
}

.profile-collection__item p {
  color: var(--lian-muted);
  line-height: 1.6;
}

.profile-collection__item img,
.profile-collection__thumb {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-3);
  object-fit: cover;
}

.profile-collection__thumb {
  display: grid;
  place-items: center;
  background: rgba(31, 41, 51, 0.06);
  color: var(--lian-muted);
  font-weight: 900;
}

.profile-collection__item h3 {
  margin-bottom: 4px;
  font-size: 15px;
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
