<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { LianButton } from "../../ui";
import {
  ADMIN_BACK_TO_PROFILE,
  ADMIN_EXIT_LABEL,
  ADMIN_SECTION_LABEL,
  ADMIN_TAB_AUDIT,
  ADMIN_TAB_LABEL,
  ADMIN_TAB_REPORTS,
  ADMIN_TAB_VERIFICATIONS,
} from "../../config/brand";
import type { PageChromeSpec } from "../../shell/page-model";
import type {
  AdminPostAction,
  AdminReportStatus,
  AdminReportTransitionStatus,
  AdminUserStatus,
  AdminVerificationDecisionStatus,
  AdminVerificationRecord,
  AdminVerificationStatus,
} from "../../types/admin";
import AdminAuditLogList from "./AdminAuditLogList.vue";
import AdminQueueList from "./AdminQueueList.vue";
import AdminTokenGate from "./AdminTokenGate.vue";
import AdminUserActionPanel from "./AdminUserActionPanel.vue";
import AdminVerificationQueueList from "./AdminVerificationQueueList.vue";
import { useAdminConsole } from "./useAdminConsole";
import { useAdminToken } from "./useAdminToken";

type AdminTabKey = "reports" | "verifications" | "audit";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
  close: [];
}>();

const { token, setToken, clearToken } = useAdminToken();
const tokenError = ref("");
const activeTab = ref<AdminTabKey>("reports");
const statusFilter = ref<AdminReportStatus | "">("pending");
const verificationStatusFilter = ref<AdminVerificationStatus | "">("pending");

const console = useAdminConsole({
  token,
  onTokenInvalid: () => {
    tokenError.value = "";
    clearToken();
  },
});

const tabs: Array<{ key: AdminTabKey; label: string }> = [
  { key: "reports", label: ADMIN_TAB_REPORTS },
  { key: "verifications", label: ADMIN_TAB_VERIFICATIONS },
  { key: "audit", label: ADMIN_TAB_AUDIT },
];

const pageChrome = computed<PageChromeSpec>(() => {
  if (!token.value) {
    return {
      top: {
        visible: true,
        identity: { avatarText: "管", name: ADMIN_SECTION_LABEL },
        buttons: [{ id: "admin:close", label: ADMIN_BACK_TO_PROFILE, variant: "ghost" }],
        onButtonClick: handleChromeButtonClick,
      },
    };
  }
  return {
    top: {
      visible: true,
      identity: { avatarText: "管", name: ADMIN_SECTION_LABEL },
      tabs: {
        kind: "tabs",
        items: tabs.map((tab) => ({ id: tab.key, label: tab.label })),
        activeKey: activeTab.value,
        ariaLabel: ADMIN_TAB_LABEL,
      },
      buttons: [{ id: "admin:exit", label: ADMIN_EXIT_LABEL, variant: "ghost" }],
      onTabSelect: (id) => selectTab(id as AdminTabKey),
      onButtonClick: handleChromeButtonClick,
    },
  };
});

function handleChromeButtonClick(buttonId: string) {
  if (buttonId === "admin:close") {
    emit("close");
  } else if (buttonId === "admin:exit") {
    clearToken();
    emit("close");
  }
}

function selectTab(key: AdminTabKey) {
  activeTab.value = key;
  if (key === "audit") {
    void console.loadAuditLog();
  } else if (key === "verifications") {
    void console.loadVerificationRequests(verificationStatusFilter.value);
  } else {
    void console.loadReports(statusFilter.value);
  }
}

function handleTokenSubmit(value: string) {
  tokenError.value = "";
  setToken(value);
  void console.loadReports(statusFilter.value);
}

function handleFilterChange(value: AdminReportStatus | "") {
  statusFilter.value = value;
  void console.loadReports(value);
}

function handleVerificationFilterChange(value: AdminVerificationStatus | "") {
  verificationStatusFilter.value = value;
  void console.loadVerificationRequests(value);
}

function handleTransition(
  reportId: string,
  payload: {
    status: AdminReportTransitionStatus;
    action?: string | null;
    note?: string | null;
  },
) {
  void console.transitionReport(reportId, payload);
}

function handlePostAction(tid: number, action: AdminPostAction) {
  void console.applyPostAction(tid, action);
}

function handleUserAction(target: string, payload: { status: AdminUserStatus; reason?: string }) {
  void console.applyUserStatus(target, payload);
}

function handleVerificationReview(
  request: AdminVerificationRecord,
  payload: {
    status: AdminVerificationDecisionStatus;
    reviewerNote?: string | null;
  },
) {
  void console.reviewVerificationRequest(request, payload, verificationStatusFilter.value);
}

function handleVerificationReveal(verificationId: string) {
  void console.loadRealnameReveal(verificationId);
}

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true, immediate: false });

onMounted(() => {
  emit("chrome", pageChrome.value);
  if (token.value) {
    void console.loadReports(statusFilter.value);
  }
});
</script>

<template>
  <section class="admin-view" :aria-label="ADMIN_SECTION_LABEL">
    <AdminTokenGate v-if="!token" :error-message="tokenError" @submit="handleTokenSubmit" />

    <template v-else>
      <p
        v-if="console.actionMessage.value || console.actionError.value"
        class="admin-view__feedback"
        :class="{ 'is-error': console.actionError.value }"
        role="status"
      >
        {{ console.actionError.value || console.actionMessage.value }}
      </p>

      <template v-if="activeTab === 'reports'">
        <AdminQueueList
          :reports="console.reports.value"
          :loading="console.reportsLoading.value"
          :error-message="console.reportsError.value"
          :status-filter="statusFilter"
          @filter-change="handleFilterChange"
          @reload="() => console.loadReports(statusFilter)"
          @transition="handleTransition"
          @post-action="handlePostAction"
        />
        <AdminUserActionPanel @apply="handleUserAction" />
      </template>

      <template v-else-if="activeTab === 'verifications'">
        <AdminVerificationQueueList
          :requests="console.verificationRequests.value"
          :loading="console.verificationLoading.value"
          :error-message="console.verificationError.value"
          :status-filter="verificationStatusFilter"
          :revealed-realnames="console.revealedRealnames.value"
          :reveal-loading-ids="console.revealLoadingIds.value"
          @filter-change="handleVerificationFilterChange"
          @reload="() => console.loadVerificationRequests(verificationStatusFilter)"
          @review="handleVerificationReview"
          @reveal="handleVerificationReveal"
        />
      </template>

      <template v-else>
        <div class="admin-view__audit-toolbar">
          <LianButton size="sm" variant="ghost" @click="console.loadAuditLog">刷新日志</LianButton>
        </div>
        <AdminAuditLogList
          :events="console.auditEvents.value"
          :loading="console.auditLoading.value"
          :error-message="console.auditError.value"
        />
      </template>
    </template>
  </section>
</template>

<style scoped>
.admin-view {
  display: grid;
  gap: var(--space-4);
  padding: calc(var(--floating-bar-height) + var(--space-3)) var(--space-3) var(--space-6);
}

.admin-view__feedback {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-card);
  background: rgba(34, 197, 94, 0.12);
  color: rgb(21, 128, 61);
  font-size: 13px;
  font-weight: 900;
}

.admin-view__feedback.is-error {
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
}

.admin-view__audit-toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>
