<script setup lang="ts">
import { ref } from "vue";
import { LocationChip, TagChip } from "../../ui";
import type { MapLocation } from "../../types/map";

const MAX_TITLE_LENGTH = 40;
const MAX_BODY_LENGTH = 300;

defineProps<{
  localPreviewUrls: string[];
  imageStatus: string;
  title: string;
  body: string;
  uploading: boolean;
  publishing: boolean;
  titleCount: number;
  bodyCount: number;
  selectedFilesCount: number;
  selectedMapLocation: MapLocation | null;
  placeName: string;
  normalizedTag: string;
  normalizedIdentityTag: string;
  locationPreviewLabel: string;
  locationToolLabel: string;
  locationPanelOpen: boolean;
  tagPanelOpen: boolean;
  visibilityPanelOpen: boolean;
  visibilityLabel: string;
}>();

const emit = defineEmits<{
  "update:title": [value: string];
  "update:body": [value: string];
  handleFiles: [event: Event];
  removeImage: [index: number];
  toggleLocationPanel: [];
  toggleTagPanel: [];
  toggleVisibilityPanel: [];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);

function openFilePicker() {
  fileInputRef.value?.click();
}
</script>

<template>
  <section class="publish-composer" aria-label="发布内容">
    <label class="publish-composer__headline">
      <span>标题</span>
      <strong>{{ titleCount }}/{{ MAX_TITLE_LENGTH }}</strong>
      <input :value="title" maxlength="40" placeholder="发生了什么？" @input="emit('update:title', ($event.target as HTMLInputElement).value)" />
    </label>

    <label class="publish-composer__body-field">
      <span class="publish-composer__body-label">正文</span>
      <textarea :value="body" rows="7" maxlength="300" placeholder="写清楚内容、时间、限制或下一步。" @input="emit('update:body', ($event.target as HTMLTextAreaElement).value)" />
      <strong>{{ bodyCount }}/{{ MAX_BODY_LENGTH }}</strong>
    </label>

    <div
      v-if="selectedFilesCount || selectedMapLocation || placeName.trim() || normalizedTag || normalizedIdentityTag"
      class="publish-composer__summary-row"
      aria-label="发布摘要"
    >
      <span v-if="selectedFilesCount" class="publish-composer__summary-pill">{{ selectedFilesCount }} 张图片</span>
      <LocationChip v-if="selectedMapLocation || placeName.trim()">{{ locationPreviewLabel }}</LocationChip>
      <TagChip v-if="normalizedTag" :tag="normalizedTag" />
      <span v-if="normalizedIdentityTag" class="publish-composer__summary-pill">身份：{{ normalizedIdentityTag }}</span>
    </div>

    <div class="publish-composer__toolbar" aria-label="发布附加设置">
      <button type="button" class="publish-composer__tool" @click="openFilePicker">
        <strong>图片</strong>
        <span>{{ imageStatus }}</span>
      </button>
      <button
        type="button"
        class="publish-composer__tool"
        :class="{ 'is-active': locationPanelOpen || !!selectedMapLocation || !!placeName.trim() }"
        @click="emit('toggleLocationPanel')"
      >
        <strong>地点</strong>
        <span>{{ locationToolLabel }}</span>
      </button>
      <button
        type="button"
        class="publish-composer__tool"
        :class="{ 'is-active': tagPanelOpen || !!normalizedTag || !!normalizedIdentityTag }"
        @click="emit('toggleTagPanel')"
      >
        <strong>标签</strong>
        <span>{{ normalizedTag || normalizedIdentityTag || "可选" }}</span>
      </button>
      <button
        type="button"
        class="publish-composer__tool"
        :class="{ 'is-active': visibilityPanelOpen }"
        @click="emit('toggleVisibilityPanel')"
      >
        <strong>可见范围</strong>
        <span>{{ visibilityLabel }}</span>
      </button>
      <input ref="fileInputRef" type="file" accept="image/*" multiple class="publish-composer__hidden-input" @change="emit('handleFiles', $event)" />
    </div>
  </section>

  <section v-if="localPreviewUrls.length" class="publish-composer__image-panel" aria-label="图片预览">
    <div class="publish-composer__panel-header">
      <strong>图片</strong>
      <span>{{ imageStatus }}</span>
    </div>
    <div class="publish-composer__image-grid">
      <div v-for="(url, index) in localPreviewUrls" :key="url" class="publish-composer__image">
        <img :src="url" alt="待发布图片" />
        <button type="button" aria-label="移除图片" @click="emit('removeImage', index)">&times;</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.publish-composer {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: calc(var(--radius-card) + 2px);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.68)),
    radial-gradient(circle at top right, rgba(31, 167, 160, 0.12), transparent 36%);
}

.publish-composer__headline,
.publish-composer__body-field {
  display: grid;
  gap: var(--space-2);
  position: relative;
  color: var(--lian-muted);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid rgba(31, 41, 51, 0.08);
}

.publish-composer__headline span,
.publish-composer__body-label {
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.publish-composer__headline strong,
.publish-composer__body-field strong {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 800;
  justify-self: end;
}

.publish-composer__headline input,
.publish-composer__body-field textarea {
  width: 100%;
  box-sizing: border-box;
  border: 0;
  border-radius: var(--radius-3);
  background: transparent;
  color: var(--lian-ink);
  font: inherit;
}

.publish-composer__headline input {
  padding: 0;
  font-size: clamp(22px, 5vw, 30px);
  font-weight: 900;
  line-height: 1.15;
}

.publish-composer__body-field textarea {
  min-height: 180px;
  padding: 0;
  resize: vertical;
  font-size: 16px;
  line-height: 1.7;
}

.publish-composer__summary-row,
.publish-composer__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.publish-composer__summary-row {
  justify-content: flex-start;
}

.publish-composer__summary-pill,
.publish-composer__tool {
  min-height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.84);
  color: var(--lian-ink);
}

.publish-composer__summary-pill {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  font-weight: 800;
}

.publish-composer__toolbar {
  justify-content: flex-start;
}

.publish-composer__tool {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  font: inherit;
  text-align: left;
}

.publish-composer__tool strong {
  font-size: 13px;
  font-weight: 900;
}

.publish-composer__tool span {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 800;
}

.publish-composer__tool.is-active {
  border-color: rgba(31, 167, 160, 0.28);
  background: rgba(31, 167, 160, 0.12);
}

.publish-composer__hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.publish-composer__image-panel {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: calc(var(--radius-card) + 2px);
  background: rgba(255, 255, 255, 0.56);
}

.publish-composer__panel-header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.publish-composer__panel-header span {
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 800;
}

.publish-composer__image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: var(--space-2);
}

.publish-composer__image {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-3);
  background: rgba(31, 41, 51, 0.06);
}

.publish-composer__image img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.publish-composer__image button {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  width: 32px;
  height: 32px;
  min-width: 32px;
  place-items: center;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: var(--lian-ink);
  font-size: 18px;
  font-weight: 900;
}
</style>
