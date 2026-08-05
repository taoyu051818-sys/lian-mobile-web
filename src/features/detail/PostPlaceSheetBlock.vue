<script setup lang="ts">
import { computed } from "vue";
import { InlineError } from "../../ui";
import {
  LOADING_PLACE,
  PLACE_SHEET_COLLAPSE,
  PLACE_SHEET_RETRY,
  PLACE_SHEET_SETTLING,
  DETAIL_PLACE_SHEET_LABEL,
  PLACE_SHEET_STATS_LABEL,
  PLACE_SHEET_UPDATED_PREFIX,
  PLACE_SHEET_POST_COUNT_SUFFIX,
  PLACE_SHEET_CORRECTION_SUFFIX,
  PLACE_SHEET_SAVED_SUFFIX,
} from "../../config/brand";
import { actorDisplayName } from "../../domain/actor";
import { placeTypeLabel } from "../../domain/place";
import type { PlaceRef, PlaceSheet } from "../../types/place";
import { formatRelativeTime } from "../../utils/time";

const props = defineProps<{
  placeSheetOpen?: boolean;
  structuredPlace?: PlaceRef | null;
  placeSheet?: PlaceSheet | null;
  placeSheetLoading?: boolean;
  placeSheetError?: string;
  placeLabel?: string;
  placeStatusText?: string;
}>();

const emit = defineEmits<{
  openPlaceSheet: [];
  "update:placeSheetOpen": [value: boolean];
}>();

const placeTypeText = computed(() => {
  const primary = props.placeSheet?.type;
  const secondary = props.structuredPlace?.type;
  if (!primary && !secondary) return "";
  return placeTypeLabel(primary, secondary);
});
</script>

<template>
  <section
    v-if="placeSheetOpen"
    class="post-place-sheet"
    :aria-label="DETAIL_PLACE_SHEET_LABEL"
    @click.stop
  >
    <div class="post-place-sheet__title">
      <h3>{{ placeSheet?.name || structuredPlace?.name || placeLabel }}</h3>
      <button type="button" @click="emit('update:placeSheetOpen', false)">
        {{ PLACE_SHEET_COLLAPSE }}
      </button>
    </div>
    <p v-if="placeSheetLoading" class="post-place-sheet__state">{{ LOADING_PLACE }}</p>
    <InlineError
      v-else-if="placeSheetError"
      :action-label="PLACE_SHEET_RETRY"
      :action-loading="placeSheetLoading"
      @action="emit('openPlaceSheet')"
    >
      {{ placeSheetError }}
    </InlineError>
    <template v-else>
      <div class="post-place-sheet__meta">
        <span>{{ placeStatusText }}</span>
        <span v-if="placeTypeText">{{ placeTypeText }}</span>
        <span v-if="placeSheet?.updatedAt"
          >{{ PLACE_SHEET_UPDATED_PREFIX }}
          {{ formatRelativeTime(placeSheet.updatedAt) || placeSheet.updatedAt }}</span
        >
      </div>
      <p v-if="placeSheet?.summary?.text" class="post-place-sheet__summary">
        {{ placeSheet.summary.text }}
      </p>
      <p v-else class="post-place-sheet__empty">{{ PLACE_SHEET_SETTLING }}</p>
      <div
        v-if="placeSheet?.stats"
        class="post-place-sheet__stats"
        :aria-label="PLACE_SHEET_STATS_LABEL"
      >
        <span v-if="placeSheet.stats.postCount != null"
          >{{ placeSheet.stats.postCount }} {{ PLACE_SHEET_POST_COUNT_SUFFIX }}</span
        >
        <span v-if="placeSheet.stats.correctionCount != null"
          >{{ placeSheet.stats.correctionCount }} {{ PLACE_SHEET_CORRECTION_SUFFIX }}</span
        >
        <span v-if="placeSheet.stats.savedCount != null"
          >{{ placeSheet.stats.savedCount }} {{ PLACE_SHEET_SAVED_SUFFIX }}</span
        >
      </div>
      <div v-if="placeSheet?.recentPosts?.length" class="post-place-sheet__posts">
        <article v-for="recent in placeSheet.recentPosts.slice(0, 3)" :key="String(recent.tid)">
          <strong v-if="recent.title">{{ recent.title }}</strong>
          <p v-if="recent.excerpt">{{ recent.excerpt }}</p>
          <small
            v-if="actorDisplayName(recent.actor) || formatRelativeTime(recent.timestampISO || '')"
          >
            <span v-if="actorDisplayName(recent.actor)">{{ actorDisplayName(recent.actor) }}</span>
            <span
              v-if="actorDisplayName(recent.actor) && formatRelativeTime(recent.timestampISO || '')"
            >
              ·
            </span>
            <span v-if="formatRelativeTime(recent.timestampISO || '')">{{
              formatRelativeTime(recent.timestampISO || "")
            }}</span>
          </small>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.post-place-sheet {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid rgba(31, 167, 160, 0.18);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.52);
}

.post-place-sheet__title {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.post-place-sheet__title :deep(h3) {
  margin: 0;
}

.post-place-sheet__title button {
  border: 0;
  background: transparent;
  color: var(--lian-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 900;
}

.post-place-sheet__state {
  color: var(--lian-muted);
  text-align: center;
}

.post-place-sheet__empty {
  color: var(--lian-muted);
  text-align: center;
}

.post-place-sheet__meta,
.post-place-sheet__stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
}

.post-place-sheet__meta span,
.post-place-sheet__stats span {
  padding: 4px 8px;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.62);
}

.post-place-sheet__summary,
.post-place-sheet__posts :deep(p),
.post-place-sheet__posts :deep(small) {
  color: var(--lian-muted);
  line-height: 1.6;
}

.post-place-sheet__posts :deep(article) {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.46);
}
</style>
