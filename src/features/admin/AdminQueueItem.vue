<script setup lang="ts">
import { computed, ref } from "vue";
import { LianButton } from "../../ui";
import {
  ADMIN_ACTION_POST_HIDE,
  ADMIN_ACTION_POST_LOCK,
  ADMIN_ACTION_POST_UNLOCK,
  ADMIN_ACTION_TITLE,
  ADMIN_ACTION_TRANSITION_LABEL,
  ADMIN_ACTION_TRANSITION_SUBMIT,
  ADMIN_REPORT_NOTE_LABEL,
  ADMIN_REPORT_NOTE_PLACEHOLDER,
  ADMIN_REPORT_REASON_LABEL,
  ADMIN_REPORT_REPORTER_LABEL,
  ADMIN_REPORT_TARGET_LABEL,
  ADMIN_REPORT_TIME_LABEL,
  ADMIN_STATUS_DISMISSED,
  ADMIN_STATUS_PENDING,
  ADMIN_STATUS_RESOLVED,
  ADMIN_STATUS_REVIEWING,
} from "../../config/brand";
import type { AdminPostAction, AdminReport, AdminReportTransitionStatus } from "../../types/admin";
import { adminStatusLabel, formatAdminTime } from "./admin-format";

const props = defineProps<{ report: AdminReport }>();

const emit = defineEmits<{
  transition: [
    reportId: string,
    payload: {
      status: AdminReportTransitionStatus;
      action?: string | null;
      note?: string | null;
    },
  ];
  postAction: [tid: number, action: AdminPostAction];
}>();

const expanded = ref(false);
const noteDraft = ref(props.report.note || "");
const nextStatus = ref<AdminReportTransitionStatus>("reviewing");

const targetTid = computed(() => {
  if (props.report.targetType !== "post") return null;
  const n = Number(props.report.targetId);
  return Number.isFinite(n) ? n : null;
});

const transitionOptions: Array<{ value: AdminReportTransitionStatus; label: string }> = [
  { value: "pending", label: ADMIN_STATUS_PENDING },
  { value: "reviewing", label: ADMIN_STATUS_REVIEWING },
  { value: "resolved", label: ADMIN_STATUS_RESOLVED },
  { value: "dismissed", label: ADMIN_STATUS_DISMISSED },
];

function submitTransition() {
  emit("transition", props.report.reportId, {
    status: nextStatus.value,
    note: noteDraft.value || null,
  });
}

function handlePostAction(action: AdminPostAction) {
  if (targetTid.value == null) return;
  emit("postAction", targetTid.value, action);
}
</script>

<template>
  <article class="admin-queue-item" :data-status="report.status">
    <header class="admin-queue-item__header">
      <span class="admin-queue-item__status">{{ adminStatusLabel(report.status) }}</span>
      <span class="admin-queue-item__time">{{ formatAdminTime(report.updatedAt) }}</span>
    </header>

    <dl class="admin-queue-item__meta">
      <div>
        <dt>{{ ADMIN_REPORT_TARGET_LABEL }}</dt>
        <dd>{{ report.targetType }} #{{ report.targetId }}</dd>
      </div>
      <div>
        <dt>{{ ADMIN_REPORT_REPORTER_LABEL }}</dt>
        <dd>{{ report.actorId }}</dd>
      </div>
      <div>
        <dt>{{ ADMIN_REPORT_REASON_LABEL }}</dt>
        <dd>{{ report.reason }}</dd>
      </div>
      <div>
        <dt>{{ ADMIN_REPORT_TIME_LABEL }}</dt>
        <dd>{{ formatAdminTime(report.createdAt) }}</dd>
      </div>
    </dl>

    <button
      type="button"
      class="admin-queue-item__toggle"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ expanded ? "收起" : "展开操作" }}
    </button>

    <section v-if="expanded" class="admin-queue-item__panel" :aria-label="ADMIN_ACTION_TITLE">
      <div class="admin-queue-item__row">
        <label>
          <span>{{ ADMIN_ACTION_TRANSITION_LABEL }}</span>
          <select v-model="nextStatus">
            <option v-for="opt in transitionOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>
      </div>
      <label class="admin-queue-item__note">
        <span>{{ ADMIN_REPORT_NOTE_LABEL }}</span>
        <textarea
          v-model="noteDraft"
          rows="2"
          maxlength="240"
          :placeholder="ADMIN_REPORT_NOTE_PLACEHOLDER"
        ></textarea>
      </label>
      <div class="admin-queue-item__actions">
        <LianButton size="sm" variant="primary" @click="submitTransition">{{
          ADMIN_ACTION_TRANSITION_SUBMIT
        }}</LianButton>
      </div>

      <div v-if="targetTid != null" class="admin-queue-item__post-actions">
        <LianButton size="sm" variant="danger" @click="handlePostAction('hide')">{{
          ADMIN_ACTION_POST_HIDE
        }}</LianButton>
        <LianButton size="sm" variant="ghost" @click="handlePostAction('lock')">{{
          ADMIN_ACTION_POST_LOCK
        }}</LianButton>
        <LianButton size="sm" variant="ghost" @click="handlePostAction('unlock')">{{
          ADMIN_ACTION_POST_UNLOCK
        }}</LianButton>
      </div>
    </section>
  </article>
</template>

<style scoped>
.admin-queue-item {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
}

.admin-queue-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.admin-queue-item__status {
  display: inline-block;
  padding: 2px var(--space-2);
  border-radius: var(--radius-chip);
  background: rgba(31, 167, 160, 0.16);
  color: var(--lian-primary-deep);
  font-size: 12px;
  font-weight: 900;
}

.admin-queue-item[data-status="resolved"] .admin-queue-item__status,
.admin-queue-item[data-status="handled"] .admin-queue-item__status {
  background: rgba(34, 197, 94, 0.18);
  color: rgb(21, 128, 61);
}

.admin-queue-item[data-status="dismissed"] .admin-queue-item__status,
.admin-queue-item[data-status="ignored"] .admin-queue-item__status,
.admin-queue-item[data-status="false_report"] .admin-queue-item__status {
  background: rgba(148, 163, 184, 0.22);
  color: rgb(71, 85, 105);
}

.admin-queue-item__time {
  color: var(--lian-muted);
  font-size: 12px;
}

.admin-queue-item__meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-2) var(--space-3);
  margin: 0;
}

.admin-queue-item__meta div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.admin-queue-item__meta dt {
  color: var(--lian-muted);
  font-size: 11px;
  font-weight: 900;
}

.admin-queue-item__meta dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 13px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.admin-queue-item__toggle {
  justify-self: start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--lian-primary-deep);
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.admin-queue-item__panel {
  display: grid;
  gap: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--lian-line);
}

.admin-queue-item__row label,
.admin-queue-item__note {
  display: grid;
  gap: var(--space-2);
  color: var(--lian-muted);
  font-size: 12px;
  font-weight: 900;
}

.admin-queue-item__row select,
.admin-queue-item__note textarea {
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-2);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
}

.admin-queue-item__row select {
  min-height: 36px;
}

.admin-queue-item__note textarea {
  min-height: 64px;
  resize: vertical;
}

.admin-queue-item__actions,
.admin-queue-item__post-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
