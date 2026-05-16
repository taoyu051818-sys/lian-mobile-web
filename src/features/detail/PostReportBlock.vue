<script setup lang="ts">
import { LianButton } from "../../ui";
import {
  REPORT_SECTION_LABEL,
  REPORT_REASON_LABEL,
  REPORT_REASON_NOTE,
  REPORT_REASON_HINT,
  REPORT_SUBMIT,
  REPORT_HIDE_LABEL,
  REPORT_HIDE_HINT,
} from "../../config/brand";

defineProps<{
  reportOpen?: boolean;
  reportBusy?: boolean;
  reportCategory?: string;
  reportCategories?: Array<{ value: string; label: string }>;
  reportReason?: string;
  reportReasonVisible?: boolean;
  reportReasonPlaceholder?: string;
  reportFollowUpVisible?: boolean;
}>();

const emit = defineEmits<{
  submitReport: [];
  hideReportedPost: [];
  "update:reportCategory": [value: string];
  "update:reportReason": [value: string];
}>();
</script>

<template>
  <div class="post-report-block">
    <section
      v-if="reportOpen"
      class="post-report-block__form"
      :aria-label="REPORT_SECTION_LABEL"
      @click.stop
    >
      <label>
        <span>{{ REPORT_REASON_LABEL }}</span>
        <select
          :value="reportCategory"
          :disabled="reportBusy"
          @input="emit('update:reportCategory', ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="category in reportCategories || []"
            :key="category.value"
            :value="category.value"
          >
            {{ category.label }}
          </option>
        </select>
      </label>
      <label v-if="reportReasonVisible">
        <span>{{ REPORT_REASON_NOTE }}</span>
        <textarea
          :value="reportReason"
          :disabled="reportBusy"
          :placeholder="reportReasonPlaceholder"
          rows="3"
          maxlength="160"
          @input="emit('update:reportReason', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>
      <p v-if="reportReasonVisible" class="post-report-block__hint">
        {{ REPORT_REASON_HINT }}
      </p>
      <LianButton size="sm" variant="danger" :loading="reportBusy" @click="emit('submitReport')">{{
        REPORT_SUBMIT
      }}</LianButton>
    </section>

    <div v-if="reportFollowUpVisible" class="post-report-block__follow-up">
      <p>{{ REPORT_HIDE_HINT }}</p>
      <LianButton size="sm" variant="ghost" @click="emit('hideReportedPost')">{{
        REPORT_HIDE_LABEL
      }}</LianButton>
    </div>
  </div>
</template>

<style scoped>
.post-report-block__form {
  display: grid;
  gap: var(--space-3);
  justify-items: end;
  padding: var(--space-3);
  border: 1px solid rgba(239, 68, 68, 0.16);
  border-radius: var(--radius-card);
  background: rgba(239, 68, 68, 0.06);
}

.post-report-block__follow-up {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid rgba(239, 68, 68, 0.12);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.62);
}

.post-report-block__follow-up p {
  margin: 0;
  color: var(--lian-muted);
  line-height: 1.6;
}

.post-report-block__form label {
  display: grid;
  width: 100%;
  gap: var(--space-2);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 850;
}

.post-report-block__form select,
.post-report-block__form textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
  padding: 0 var(--space-2);
}

.post-report-block__form select {
  min-height: 36px;
}

.post-report-block__form textarea {
  min-height: 88px;
  padding-block: var(--space-2);
  resize: vertical;
}

.post-report-block__hint {
  width: 100%;
  margin: 0;
  color: var(--lian-muted);
  font-size: 13px;
  font-weight: 850;
  line-height: 1.5;
}
</style>
