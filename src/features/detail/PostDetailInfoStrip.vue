<script setup lang="ts">
import type { PlaceRef } from "../../types/place";

defineProps<{
  primaryTag?: string;
  timeLabel?: string;
  placeLabel?: string;
  placeStatusText?: string;
  structuredPlace?: PlaceRef | null;
  placeSheetOpen?: boolean;
  reportOpen?: boolean;
  reportBusy?: boolean;
}>();

const emit = defineEmits<{
  openPlaceSheet: [];
  toggleReport: [];
}>();
</script>

<template>
  <section class="post-detail-info-strip" aria-label="帖子属性">
    <div class="post-detail-info-strip__left">
      <span
        v-if="primaryTag"
        class="post-detail-info-strip__pill post-detail-info-strip__pill--tag"
        >{{ primaryTag }}</span
      >
      <span v-if="timeLabel" class="post-detail-info-strip__pill">{{ timeLabel }}</span>
      <button
        v-if="structuredPlace?.id"
        class="post-detail-info-strip__pill post-detail-info-strip__pill-button"
        type="button"
        :aria-expanded="placeSheetOpen"
        @click.stop="emit('openPlaceSheet')"
      >
        {{ placeLabel }} · {{ placeStatusText }}
      </button>
      <span v-else-if="placeLabel" class="post-detail-info-strip__pill">{{ placeLabel }}</span>
    </div>
    <button
      class="post-detail-info-strip__report-entry"
      type="button"
      :disabled="reportBusy"
      @click.stop="emit('toggleReport')"
    >
      {{ reportOpen ? "收起" : "举报" }}
    </button>
  </section>
</template>

<style scoped>
.post-detail-info-strip {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sheet);
  background: var(--glass-bg);
}

.post-detail-info-strip__left {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
}

.post-detail-info-strip__pill,
.post-detail-info-strip__report-entry {
  min-height: 32px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-chip);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
}

.post-detail-info-strip__pill {
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.58);
}

.post-detail-info-strip__pill-button {
  border: 0;
  background: transparent;
  color: var(--lian-ink);
  font: inherit;
  cursor: pointer;
}

.post-detail-info-strip__pill-button:hover {
  color: var(--lian-primary-deep);
}

.post-detail-info-strip__pill--tag {
  color: var(--lian-primary-deep);
  font-weight: 900;
}

.post-detail-info-strip__report-entry {
  border: 0;
  background: transparent;
  color: var(--lian-ink);
  font: inherit;
}
</style>
