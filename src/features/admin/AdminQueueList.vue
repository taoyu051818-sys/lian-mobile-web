<script setup lang="ts">
import { LianButton, InlineError } from "../../ui";
import {
  ADMIN_QUEUE_EMPTY,
  ADMIN_QUEUE_EMPTY_HINT,
  ADMIN_QUEUE_FILTER_ALL,
  ADMIN_QUEUE_FILTER_DISMISSED,
  ADMIN_QUEUE_FILTER_PENDING,
  ADMIN_QUEUE_FILTER_RESOLVED,
  ADMIN_QUEUE_FILTER_REVIEWING,
  ADMIN_QUEUE_LOADING,
  ADMIN_QUEUE_RELOAD,
} from "../../config/brand";
import type {
  AdminPostAction,
  AdminReport,
  AdminReportStatus,
  AdminReportTransitionStatus,
} from "../../types/admin";
import AdminQueueItem from "./AdminQueueItem.vue";

defineProps<{
  reports: AdminReport[];
  loading: boolean;
  errorMessage: string;
  statusFilter: AdminReportStatus | "";
}>();

const emit = defineEmits<{
  filterChange: [value: AdminReportStatus | ""];
  reload: [];
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

const filters: Array<{ value: AdminReportStatus | ""; label: string }> = [
  { value: "", label: ADMIN_QUEUE_FILTER_ALL },
  { value: "pending", label: ADMIN_QUEUE_FILTER_PENDING },
  { value: "reviewing", label: ADMIN_QUEUE_FILTER_REVIEWING },
  { value: "resolved", label: ADMIN_QUEUE_FILTER_RESOLVED },
  { value: "dismissed", label: ADMIN_QUEUE_FILTER_DISMISSED },
];
</script>

<template>
  <section class="admin-queue-list">
    <nav class="admin-queue-list__filters" aria-label="举报状态筛选">
      <button
        v-for="opt in filters"
        :key="opt.value || 'all'"
        type="button"
        class="admin-queue-list__filter"
        :class="{ 'is-active': opt.value === statusFilter }"
        :aria-pressed="opt.value === statusFilter"
        @click="emit('filterChange', opt.value)"
      >
        {{ opt.label }}
      </button>
      <LianButton size="sm" variant="ghost" @click="emit('reload')">{{
        ADMIN_QUEUE_RELOAD
      }}</LianButton>
    </nav>

    <InlineError v-if="errorMessage">{{ errorMessage }}</InlineError>

    <div v-if="loading" class="admin-queue-list__state" role="status">
      {{ ADMIN_QUEUE_LOADING }}
    </div>

    <p v-else-if="!reports.length" class="admin-queue-list__state" data-testid="admin-queue-empty">
      <span class="admin-queue-list__empty-headline">{{ ADMIN_QUEUE_EMPTY }}</span>
      <span class="admin-queue-list__empty-hint">{{ ADMIN_QUEUE_EMPTY_HINT }}</span>
    </p>

    <div v-else class="admin-queue-list__items">
      <AdminQueueItem
        v-for="report in reports"
        :key="report.reportId"
        :report="report"
        @transition="(id, payload) => emit('transition', id, payload)"
        @post-action="(tid, action) => emit('postAction', tid, action)"
      />
    </div>
  </section>
</template>

<style scoped>
.admin-queue-list {
  display: grid;
  gap: var(--space-3);
}

.admin-queue-list__filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.admin-queue-list__filter {
  min-height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-muted);
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.admin-queue-list__filter.is-active {
  border-color: var(--lian-primary-deep);
  background: var(--lian-primary-soft);
  color: var(--lian-primary-deep);
}

.admin-queue-list__state {
  margin: 0;
  padding: var(--space-4);
  color: var(--lian-muted);
  text-align: center;
}

.admin-queue-list__empty-headline {
  display: block;
  color: var(--lian-ink);
  font-size: 14px;
  font-weight: 800;
}

.admin-queue-list__empty-hint {
  display: block;
  margin-top: var(--space-1);
  color: var(--lian-muted);
  font-size: 13px;
  line-height: 1.5;
}

.admin-queue-list__items {
  display: grid;
  gap: var(--space-3);
}
</style>
