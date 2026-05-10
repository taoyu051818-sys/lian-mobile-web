<script setup lang="ts">
defineProps<{
  localPreviewUrls: string[];
  imageStatus: string;
  title: string;
  body: string;
  uploading: boolean;
  publishing: boolean;
}>();

const emit = defineEmits<{
  "update:title": [value: string];
  "update:body": [value: string];
  handleFiles: [event: Event];
  removeImage: [index: number];
}>();
</script>

<template>
  <section class="publish-composer__section">
    <div class="publish-composer__section-title">
      <strong>图片</strong>
      <span>{{ imageStatus }}</span>
    </div>
    <div v-if="localPreviewUrls.length" class="publish-composer__image-grid" aria-label="已选图片">
      <div v-for="(url, index) in localPreviewUrls" :key="url" class="publish-composer__image">
        <img :src="url" alt="待发布图片" />
        <button type="button" aria-label="移除图片" @click="emit('removeImage', index)">&times;</button>
      </div>
    </div>
    <label class="publish-composer__upload">
      <span>选择图片</span>
      <input type="file" accept="image/*" multiple @change="emit('handleFiles', $event)" />
    </label>
  </section>

  <label class="publish-composer__field">
    <span>标题</span>
    <input :value="title" maxlength="40" placeholder="发生了什么？" @input="emit('update:title', ($event.target as HTMLInputElement).value)" />
  </label>

  <label class="publish-composer__field">
    <span>正文</span>
    <textarea :value="body" rows="6" maxlength="300" placeholder="写清楚内容、时间、限制或下一步。" @input="emit('update:body', ($event.target as HTMLTextAreaElement).value)" />
  </label>
</template>

<style scoped>
.publish-composer__section {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
}

.publish-composer__section-title {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.publish-composer__section-title span {
  color: var(--lian-muted);
  line-height: 1.6;
}

.publish-composer__field {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 800;
}

.publish-composer__field input,
.publish-composer__field textarea {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
}

.publish-composer__field input {
  padding: 0 var(--space-3);
}

.publish-composer__field textarea {
  resize: vertical;
  padding: var(--space-3);
  line-height: 1.5;
}

.publish-composer__upload {
  position: relative;
  display: grid;
  min-height: 72px;
  place-items: center;
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  border-style: dashed;
  background: rgba(255, 255, 255, 0.48);
  color: var(--lian-ink);
  cursor: pointer;
}

.publish-composer__upload input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
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
  width: 100%;
  aspect-ratio: 1;
  display: block;
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
  border-radius: var(--radius-orb);
  background: rgba(255, 255, 255, 0.82);
  color: var(--lian-ink);
  font-size: 18px;
  font-weight: 900;
}
</style>
