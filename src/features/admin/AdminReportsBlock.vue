<script setup lang="ts">
import AdminQueueList from "./AdminQueueList.vue";
import AdminUserActionPanel from "./AdminUserActionPanel.vue";
import type {
  AdminPostAction,
  AdminReport,
  AdminReportStatus,
  AdminReportTransitionStatus,
  AdminUserStatus,
} from "../../types/admin";

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
  userAction: [target: string, payload: { status: AdminUserStatus; reason?: string }];
}>();
</script>

<template>
  <section class="admin-reports-block">
    <AdminQueueList
      :reports="reports"
      :loading="loading"
      :error-message="errorMessage"
      :status-filter="statusFilter"
      @filter-change="(value) => emit('filterChange', value)"
      @reload="emit('reload')"
      @transition="(id, payload) => emit('transition', id, payload)"
      @post-action="(tid, action) => emit('postAction', tid, action)"
    />
    <AdminUserActionPanel @apply="(target, payload) => emit('userAction', target, payload)" />
  </section>
</template>

<style scoped>
.admin-reports-block {
  display: grid;
  gap: var(--space-4);
}
</style>
