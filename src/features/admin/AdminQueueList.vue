<script setup lang="ts">
import { computed } from "vue";
import { LianButton, InlineError } from "../../ui";
import {
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

const props = defineProps<{
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

const emptyState = computed(() => {
  switch (props.statusFilter) {
    case "pending":
      return {
        title: "当前没有待处理举报",
        body: "新举报进入队列后会先显示在这里，便于你从最急的条目开始处理。",
      };
    case "reviewing":
      return {
        title: "现在没有审核中的举报",
        body: "需要继续跟进或等待补充信息的条目转入审核中后，会集中显示在这里。",
      };
    case "resolved":
      return {
        title: "还没有已处理记录",
        body: "完成处置后的举报会归档到这里，方便回看最近的处理结论。",
      };
    case "dismissed":
      return {
        title: "还没有已驳回记录",
        body: "无需继续处理或判定为误报的条目，会在这里留下驳回结果。",
      };
    default:
      return {
        title: "当前还没有举报记录",
        body: "当用户提交新的内容举报后，管理队列会从这里开始汇总。",
      };
  }
});
</script>

<template>
  <section class="admin-queue-list">
    <nav class="admin-queue-list__filters" aria-label="举报状态筛选">
      <button
        v-for="opt in filters"
        :key="opt.value || 'all'"
        type="button"
        class="admin-queue-list__filter"
        :class="{ 'is-active': opt.value === props.statusFilter }"
        :aria-pressed="opt.value === props.statusFilter"
        @click="emit('filterChange', opt.value)"
      >
        {{ opt.label }}
      </button>
      <LianButton size="sm" variant="ghost" @click="emit('reload')">{{
        ADMIN_QUEUE_RELOAD
      }}</LianButton>
    </nav>

    <InlineError v-if="props.errorMessage">{{ props.errorMessage }}</InlineError>

    <div v-if="props.loading" class="admin-queue-list__state" role="status">
      {{ ADMIN_QUEUE_LOADING }}
    </div>

    <section
      v-else-if="!props.reports.length"
      class="admin-queue-list__state admin-queue-list__state-card"
      data-testid="admin-queue-empty"
    >
      <strong>{{ emptyState.title }}</strong>
      <p>{{ emptyState.body }}</p>
    </section>

    <div v-else class="admin-queue-list__items">
      <AdminQueueItem
        v-for="report in props.reports"
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

.admin-queue-list__state-card {
  display: grid;
  gap: var(--space-2);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.82);
}

.admin-queue-list__state-card strong {
  color: var(--lian-ink);
  font-size: 15px;
  font-weight: 900;
}

.admin-queue-list__state-card p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

.admin-queue-list__items {
  display: grid;
  gap: var(--space-3);
}
</style>