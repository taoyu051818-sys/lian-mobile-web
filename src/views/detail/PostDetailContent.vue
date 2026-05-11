<script setup lang="ts">
import { InlineError, LianButton, SafeHtml } from "../../ui";
import type { DisplayActor } from "../../types/feed";
import type { PlaceSheet, PlaceStatus } from "../../types/place";
import { formatRelativeTime } from "../../utils/time";

const props = defineProps<{
  title?: string;
  bodyHtml?: string;
  images?: string[];
  primaryTag?: string;
  timeLabel?: string;
  placeLabel?: string;
  placeStatusText?: string;
  structuredPlace?: { id?: string; name?: string; type?: string; status?: PlaceStatus } | null;
  placeSheetOpen?: boolean;
  placeSheet?: PlaceSheet | null;
  placeSheetLoading?: boolean;
  placeSheetError?: string;
  reportOpen?: boolean;
  reportBusy?: boolean;
  reportCategory?: string;
  reportCategories?: Array<{ value: string; label: string }>;
  reportReason?: string;
  reportReasonVisible?: boolean;
  reportReasonPlaceholder?: string;
  reportFollowUpVisible?: boolean;
  actionError?: string;
  actionMessage?: string;
}>();

const emit = defineEmits<{
  galleryPointerDown: [event: PointerEvent];
  galleryPointerMove: [event: PointerEvent];
  openGalleryImage: [index: number];
  openPlaceSheet: [];
  toggleReport: [];
  submitReport: [];
  hideReportedPost: [];
  "update:reportCategory": [value: string];
  "update:reportReason": [value: string];
  "update:placeSheetOpen": [value: boolean];
}>();

function placeRecentPostActorLabel(actor?: DisplayActor) {
  return actor?.displayName || actor?.username || actor?.name || "";
}
</script>

<template>
  <div class="post-detail-content__body">
    <section
      v-if="images?.length"
      class="post-detail-content__gallery"
      :class="{ 'is-single': images.length === 1 }"
      aria-label="图片"
    >
      <button
        v-for="(url, index) in images"
        :key="url"
        class="post-detail-content__gallery-item"
        type="button"
        @pointerdown="emit('galleryPointerDown', $event)"
        @pointermove="emit('galleryPointerMove', $event)"
        @click="emit('openGalleryImage', index)"
      >
        <img :src="url" :alt="title" loading="eager" decoding="async" />
      </button>
    </section>

    <section class="post-detail-content__content">
      <h2 v-if="title" id="post-detail-title">{{ title }}</h2>
      <SafeHtml v-if="bodyHtml" :html="bodyHtml" as="div" class="lian-html" />
    </section>

    <section class="post-detail-content__info-strip" aria-label="帖子属性">
      <div class="post-detail-content__info-left">
        <span v-if="primaryTag" class="post-detail-content__pill post-detail-content__pill--tag">{{ primaryTag }}</span>
        <span v-if="timeLabel" class="post-detail-content__pill">{{ timeLabel }}</span>
        <button
          v-if="structuredPlace?.id"
          class="post-detail-content__pill post-detail-content__pill-button"
          type="button"
          :aria-expanded="placeSheetOpen"
          @click.stop="emit('openPlaceSheet')"
        >
          {{ placeLabel }} · {{ placeStatusText }}
        </button>
        <span v-else-if="placeLabel" class="post-detail-content__pill">{{ placeLabel }}</span>
      </div>
      <button class="post-detail-content__report-entry" type="button" :disabled="reportBusy" @click.stop="emit('toggleReport')">
        {{ reportOpen ? "收起" : "举报" }}
      </button>
    </section>

    <section v-if="placeSheetOpen" class="post-detail-content__place-sheet" aria-label="地点信息" @click.stop>
      <div class="post-detail-content__section-title">
        <h3>{{ placeSheet?.name || structuredPlace?.name || placeLabel }}</h3>
        <button type="button" @click="emit('update:placeSheetOpen', false)">收起</button>
      </div>
      <p v-if="placeSheetLoading" class="post-detail-content__state">正在加载地点信息…</p>
      <InlineError v-else-if="placeSheetError">
        {{ placeSheetError }}
        <button type="button" @click="emit('openPlaceSheet')">重试</button>
      </InlineError>
      <template v-else>
        <div class="post-detail-content__place-meta">
          <span>{{ placeStatusText }}</span>
          <span v-if="placeSheet?.type || structuredPlace?.type">{{ placeSheet?.type || structuredPlace?.type }}</span>
          <span v-if="placeSheet?.updatedAt">更新于 {{ formatRelativeTime(placeSheet.updatedAt) || placeSheet.updatedAt }}</span>
        </div>
        <p v-if="placeSheet?.summary?.text" class="post-detail-content__place-summary">{{ placeSheet.summary.text }}</p>
        <p v-else class="post-detail-content__empty">这个地点还在沉淀信息。</p>
        <div v-if="placeSheet?.stats" class="post-detail-content__place-stats" aria-label="地点统计">
          <span v-if="placeSheet.stats.postCount != null">{{ placeSheet.stats.postCount }} 条内容</span>
          <span v-if="placeSheet.stats.correctionCount != null">{{ placeSheet.stats.correctionCount }} 条修正</span>
          <span v-if="placeSheet.stats.savedCount != null">{{ placeSheet.stats.savedCount }} 次收藏</span>
        </div>
        <div v-if="placeSheet?.recentPosts?.length" class="post-detail-content__place-posts">
          <article v-for="recent in placeSheet.recentPosts.slice(0, 3)" :key="String(recent.tid)">
            <strong v-if="recent.title">{{ recent.title }}</strong>
            <p v-if="recent.excerpt">{{ recent.excerpt }}</p>
            <small v-if="placeRecentPostActorLabel(recent.actor) || formatRelativeTime(recent.timestampISO || '')">
              <span v-if="placeRecentPostActorLabel(recent.actor)">{{ placeRecentPostActorLabel(recent.actor) }}</span>
              <span v-if="placeRecentPostActorLabel(recent.actor) && formatRelativeTime(recent.timestampISO || '')"> · </span>
              <span v-if="formatRelativeTime(recent.timestampISO || '')">{{ formatRelativeTime(recent.timestampISO || '') }}</span>
            </small>
          </article>
        </div>
      </template>
    </section>

    <section v-if="reportOpen" class="post-detail-content__report" aria-label="举报原因" @click.stop>
      <label>
        <span>举报原因</span>
        <select :value="reportCategory" :disabled="reportBusy" @input="emit('update:reportCategory', ($event.target as HTMLSelectElement).value)">
          <option v-for="category in reportCategories || []" :key="category.value" :value="category.value">{{ category.label }}</option>
        </select>
      </label>
      <label v-if="reportReasonVisible">
        <span>补充说明（可选）</span>
        <textarea
          :value="reportReason"
          :disabled="reportBusy"
          :placeholder="reportReasonPlaceholder"
          rows="3"
          maxlength="160"
          @input="emit('update:reportReason', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>
      <p v-if="reportReasonVisible" class="post-detail-content__report-hint">补充说明只会跟随这次举报一起提交，不会公开显示。</p>
      <LianButton size="sm" variant="danger" :loading="reportBusy" @click="emit('submitReport')">提交举报</LianButton>
    </section>

    <div v-if="reportFollowUpVisible" class="post-detail-content__report-follow-up">
      <p>如果你现在不想继续看到这条内容，可以先在当前会话里把它隐藏。</p>
      <LianButton size="sm" variant="ghost" @click="emit('hideReportedPost')">暂时隐藏</LianButton>
    </div>

    <InlineError v-if="actionError">{{ actionError }}</InlineError>
    <p v-if="actionMessage" class="post-detail-content__success">{{ actionMessage }}</p>
  </div>
</template>

<style scoped>
.post-detail-content__gallery {
  display: flex;
  gap: var(--space-3);
  overflow: hidden;
  margin-inline: calc(var(--space-3) * -1);
  padding-inline: max(var(--space-3), 6vw);
  touch-action: pan-y;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}

.post-detail-content__gallery::-webkit-scrollbar {
  display: none;
}

.post-detail-content__gallery.is-single {
  justify-content: center;
}

.post-detail-content__gallery-item {
  flex: 0 0 min(88vw, 420px);
  overflow: hidden;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--lian-ink);
  font: inherit;
  border-radius: var(--radius-card);
  touch-action: pan-y;
  user-select: none;
  -webkit-user-drag: none;
}

.post-detail-content__gallery img {
  display: block;
  width: 100%;
  height: min(62vh, 460px);
  aspect-ratio: 0.9;
  object-fit: cover;
  pointer-events: none;
}

.post-detail-content__content,
.post-detail-content__report,
.post-detail-content__place-sheet,
.post-detail-content__place-posts {
  display: grid;
  gap: var(--space-3);
}

.post-detail-content__content :deep(h2),
.post-detail-content__content :deep(h3),
.post-detail-content__content :deep(p) {
  margin: 0;
}

.post-detail-content__content :deep(h2) {
  color: var(--lian-ink);
  font-size: 22px;
  line-height: 1.32;
}

.post-detail-content__empty,
.post-detail-content__state {
  color: var(--lian-muted);
  text-align: center;
}

.post-detail-content__info-strip {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sheet);
  background: var(--glass-bg);
}

.post-detail-content__info-left {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
}

.post-detail-content__pill,
.post-detail-content__report-entry {
  min-height: 32px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-chip);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
}

.post-detail-content__pill {
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.58);
}

.post-detail-content__pill-button {
  border: 0;
  background: transparent;
  color: var(--lian-ink);
  font: inherit;
  cursor: pointer;
}

.post-detail-content__pill-button:hover {
  color: var(--lian-primary-deep);
}

.post-detail-content__pill--tag {
  color: var(--lian-primary-deep);
  font-weight: 900;
}

.post-detail-content__report-entry {
  border: 0;
  background: transparent;
  color: var(--lian-ink);
  font: inherit;
}

.post-detail-content__report,
.post-detail-content__place-sheet,
.post-detail-content__report-follow-up {
  padding: var(--space-3);
  border-radius: var(--radius-card);
}

.post-detail-content__report {
  justify-items: end;
  border: 1px solid rgba(239, 68, 68, 0.16);
  background: rgba(239, 68, 68, 0.06);
}

.post-detail-content__report-follow-up {
  display: grid;
  gap: var(--space-2);
  border: 1px solid rgba(239, 68, 68, 0.12);
  background: rgba(255, 255, 255, 0.62);
}

.post-detail-content__report-follow-up p {
  margin: 0;
  color: var(--lian-muted);
  line-height: 1.6;
}

.post-detail-content__place-sheet {
  border: 1px solid rgba(31, 167, 160, 0.18);
  background: rgba(255, 255, 255, 0.52);
}

.post-detail-content__place-meta,
.post-detail-content__place-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
}

.post-detail-content__place-meta span,
.post-detail-content__place-stats span {
  padding: 4px 8px;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.62);
}

.post-detail-content__place-summary,
.post-detail-content__place-posts :deep(p),
.post-detail-content__place-posts :deep(small) {
  color: var(--lian-muted);
  line-height: 1.6;
}

.post-detail-content__place-posts :deep(article) {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.46);
}

.post-detail-content__report label {
  display: grid;
  width: 100%;
  gap: var(--space-2);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
}

.post-detail-content__report select,
.post-detail-content__report textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
  padding: 0 var(--space-2);
}

.post-detail-content__report select {
  min-height: 36px;
}

.post-detail-content__report textarea {
  min-height: 88px;
  padding-block: var(--space-2);
  resize: vertical;
}

.post-detail-content__report-hint,
.post-detail-content__success {
  font-size: 13px;
  font-weight: 850;
}

.post-detail-content__report-hint {
  width: 100%;
  margin: 0;
  color: var(--lian-muted);
  line-height: 1.5;
}

.post-detail-content__success {
  color: var(--lian-primary);
  font-size: 13px;
  font-weight: 850;
}

.post-detail-content__section-title {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.post-detail-content__section-title :deep(h3) {
  margin: 0;
}

.post-detail-content__section-title button {
  border: 0;
  background: transparent;
  color: var(--lian-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 900;
}

.post-detail-content__body :deep(.inline-error) {
  color: var(--lian-muted);
}

.post-detail-content__body :deep(.inline-error button) {
  min-height: 32px;
  margin-left: var(--space-2);
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: currentColor;
  font-weight: 900;
}

:deep(.lian-html) {
  color: var(--lian-ink);
  line-height: 1.68;
}

:deep(.lian-html img) {
  display: none;
}
</style>
