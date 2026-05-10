<script setup lang="ts">
import { TagChip } from "../../ui";
import type { PublishVisibility } from "../../types/publish";

defineProps<{
  tagInput: string;
  normalizedTag: string;
  identityTag: string;
  identityTagOptions: string[];
  visibility: PublishVisibility;
  visibilityOptions: Array<{ value: PublishVisibility; label: string }>;
}>();

const emit = defineEmits<{
  "update:tagInput": [value: string];
  "update:identityTag": [value: string];
  "update:visibility": [value: PublishVisibility];
}>();
</script>

<template>
  <label class="publish-meta__field">
    <span>帖子标签</span>
    <input :value="tagInput" maxlength="18" placeholder="一个标签，例如 #晚霞" @input="emit('update:tagInput', ($event.target as HTMLInputElement).value)" />
  </label>

  <div v-if="normalizedTag" class="publish-meta__tags" aria-label="帖子标签预览">
    <TagChip :tag="normalizedTag" />
  </div>

  <label v-if="identityTagOptions.length" class="publish-meta__field">
    <span>身份标签</span>
    <select :value="identityTag" @change="emit('update:identityTag', ($event.target as HTMLSelectElement).value)">
      <option value="">不使用身份标签</option>
      <option v-for="tag in identityTagOptions" :key="tag" :value="tag">{{ tag }}</option>
    </select>
  </label>

  <section class="publish-meta__section" aria-labelledby="publish-visibility-title">
    <div class="publish-meta__section-title">
      <strong id="publish-visibility-title">可见范围</strong>
      <span>{{ visibilityOptions.find((item) => item.value === visibility)?.label }}</span>
    </div>
    <div class="publish-meta__visibility-grid">
      <button
        v-for="option in visibilityOptions"
        :key="option.value"
        type="button"
        class="publish-meta__visibility"
        :class="{ 'is-active': visibility === option.value }"
        @click="emit('update:visibility', option.value)"
      >
        <strong>{{ option.label }}</strong>
      </button>
    </div>
  </section>
</template>

<style scoped>
.publish-meta__section {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
}

.publish-meta__section-title {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.publish-meta__section-title span {
  color: var(--lian-muted);
  line-height: 1.6;
}

.publish-meta__field {
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

.publish-meta__field input,
.publish-meta__field select {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  padding: 0 var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
}

.publish-meta__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: flex-start;
}

.publish-meta__visibility-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}

.publish-meta__visibility {
  display: grid;
  min-height: 48px;
  place-items: center;
  padding: var(--space-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.54);
  color: var(--lian-ink);
  text-align: center;
}

.publish-meta__visibility.is-active {
  border-color: rgba(31, 167, 160, 0.34);
  background: rgba(31, 167, 160, 0.12);
}

@media (max-width: 640px) {
  .publish-meta__visibility-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
