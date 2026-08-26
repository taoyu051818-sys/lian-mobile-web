<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  ADMIN_AUTH_LINK_TAB_LABEL,
  ADMIN_AVATAR_TEXT,
  ADMIN_BACK_TO_PROFILE,
  ADMIN_EXIT_LABEL,
  ADMIN_SECTION_LABEL,
  ADMIN_TAB_AUDIT,
  ADMIN_TAB_LABEL,
  ADMIN_TAB_REPORTS,
  ADMIN_VERIFICATION_TAB_LABEL,
} from "../../config/brand";
import type { PageChromeSpec } from "../../shell/page-model";
import type {
  AdminPostAction,
  AdminReportStatus,
  AdminReportTransitionStatus,
  AdminUserStatus,
} from "../../types/admin";
import AdminAuditBlock from "./AdminAuditBlock.vue";
import AdminAuthLinkBlock from "./AdminAuthLinkBlock.vue";
import AdminReportsBlock from "./AdminReportsBlock.vue";
import AdminTokenGate from "./AdminTokenGate.vue";
import AdminVerificationBlock from "./AdminVerificationBlock.vue";
import type {
  AdminVerificationDecisionStatus,
  AdminVerificationRequest,
  AdminVerificationStatus,
} from "./admin-verification";
import { useAdminAccess } from "./useAdminAccess";
import { useAdminConsole } from "./useAdminConsole";
import { useAdminToken } from "./useAdminToken";

type AdminTabKey = "reports" | "verifications" | "auth-links" | "audit";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
  close: [];
}>();

const { token, authEpoch, setToken, clearToken, advanceAuthEpoch } = useAdminToken();
const activeTab = ref<AdminTabKey>("reports");
const statusFilter = ref<AdminReportStatus | "">("pending");
const verificationStatusFilter = ref<AdminVerificationStatus | "">("pending");
const verificationNotes = ref<Record<string, string>>({});

let access!: ReturnType<typeof useAdminAccess>;
const consoleLane = computed(() => access.lane.value);

const adminConsole = useAdminConsole({
  token,
  lane: consoleLane,
  authEpoch,
  onTokenInvalid: exitAdminAccess,
});

access = useAdminAccess({
  token,
  setToken,
  clearToken,
  advanceAuthEpoch,
  retireConsole: adminConsole.retire,
  loadReports: () => adminConsole.loadReports(statusFilter.value),
});

const tabs: Array<{ key: AdminTabKey; label: string }> = [
  { key: "reports", label: ADMIN_TAB_REPORTS },
  { key: "verifications", label: ADMIN_VERIFICATION_TAB_LABEL },
  { key: "auth-links", label: ADMIN_AUTH_LINK_TAB_LABEL },
  { key: "audit", label: ADMIN_TAB_AUDIT },
];

const pageChrome = computed<PageChromeSpec>(() => {
  if (access.lane.value === "ops") {
    return {
      top: {
        visible: true,
        identity: { avatarText: ADMIN_AVATAR_TEXT, name: ADMIN_SECTION_LABEL },
        tabs: {
          kind: "tabs",
          items: tabs.map((tab) => ({ id: tab.key, label: tab.label })),
          activeKey: activeTab.value,
          ariaLabel: ADMIN_TAB_LABEL,
        },
        onTabSelect: (id) => selectTab(id as AdminTabKey),
        onButtonClick: handleChromeButtonClick,
      },
    };
  }

  return {
    top: {
      visible: true,
      identity: { avatarText: ADMIN_AVATAR_TEXT, name: ADMIN_SECTION_LABEL },
      buttons: [{ id: "admin:close", label: ADMIN_BACK_TO_PROFILE, variant: "ghost" }],
      onButtonClick: handleChromeButtonClick,
    },
  };
});

function handleChromeButtonClick(buttonId: string) {
  if (buttonId === "admin:exit") exitAdminAccess();
  if (buttonId === "admin:close" || buttonId === "admin:exit") emit("close");
}

function exitAdminAccess() {
  verificationNotes.value = {};
  access.exit();
}

function selectTab(key: AdminTabKey) {
  if (access.lane.value !== "ops") return;
  activeTab.value = key;
  if (key === "audit") void adminConsole.loadAuditLog();
  else if (key === "verifications") {
    void adminConsole.loadVerificationRequests(verificationStatusFilter.value);
  } else if (key === "auth-links") {
    void adminConsole.loadAuthLinks();
  } else {
    void adminConsole.loadReports(statusFilter.value);
  }
}

function handleTokenSubmit(value: string) {
  verificationNotes.value = {};
  void access.submitOpsToken(value);
}

function handleFilterChange(value: AdminReportStatus | "") {
  statusFilter.value = value;
  void adminConsole.loadReports(value);
}

function handleVerificationFilterChange(value: AdminVerificationStatus | "") {
  verificationStatusFilter.value = value;
  void adminConsole.loadVerificationRequests(value);
}

function handleTransition(
  reportId: string,
  payload: {
    status: AdminReportTransitionStatus;
    action?: string | null;
    note?: string | null;
  },
) {
  void adminConsole.transitionReport(reportId, payload);
}

function handlePostAction(tid: number, action: AdminPostAction) {
  void adminConsole.applyPostAction(tid, action);
}

function handleUserAction(target: string, payload: { status: AdminUserStatus; reason?: string }) {
  void adminConsole.applyUserStatus(target, payload);
}

function handleVerificationReview(
  request: AdminVerificationRequest,
  status: AdminVerificationDecisionStatus,
) {
  void adminConsole.reviewVerificationRequest(request, {
    status,
    reviewerNote: verificationNotes.value[request.verificationId]?.trim() || null,
  });
}

function handleVerificationReveal(request: AdminVerificationRequest) {
  void adminConsole.revealVerificationRequest(request);
}

function handleVerificationNoteUpdate(verificationId: string, value: string) {
  verificationNotes.value = { ...verificationNotes.value, [verificationId]: value };
}

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true, immediate: false });

onMounted(() => {
  emit("chrome", pageChrome.value);
  void access.initialize();
});

onBeforeUnmount(() => {
  access.dispose();
  adminConsole.dispose();
});
</script>

<template>
  <section class="admin-view" :aria-label="ADMIN_SECTION_LABEL">
    <button
      v-if="access.lane.value === 'ops'"
      type="button"
      class="admin-view__exit"
      @click="handleChromeButtonClick('admin:exit')"
    >
      {{ ADMIN_EXIT_LABEL }}
    </button>

    <AdminTokenGate
      v-if="access.lane.value === 'gate'"
      :error-message="''"
      @submit="handleTokenSubmit"
    />

    <template v-else-if="access.lane.value === 'ops'">
      <p
        v-if="adminConsole.actionMessage.value || adminConsole.actionError.value"
        class="admin-view__feedback"
        :class="{ 'is-error': adminConsole.actionError.value }"
        role="status"
      >
        {{ adminConsole.actionError.value || adminConsole.actionMessage.value }}
      </p>

      <AdminReportsBlock
        v-if="activeTab === 'reports'"
        :reports="adminConsole.reports.value"
        :loading="adminConsole.reportsLoading.value"
        :error-message="adminConsole.reportsError.value"
        :status-filter="statusFilter"
        @filter-change="handleFilterChange"
        @reload="() => adminConsole.loadReports(statusFilter)"
        @transition="handleTransition"
        @post-action="handlePostAction"
        @user-action="handleUserAction"
      />

      <AdminVerificationBlock
        v-else-if="activeTab === 'verifications'"
        :requests="adminConsole.verificationRequests.value"
        :loading="adminConsole.verificationLoading.value"
        :error-message="adminConsole.verificationError.value"
        :reveal-error="adminConsole.verificationRevealError.value"
        :status-filter="verificationStatusFilter"
        :revealing-verification-id="adminConsole.revealingVerificationId.value"
        :revealed-details="adminConsole.revealedVerificationDetails.value"
        :notes="verificationNotes"
        @filter-change="handleVerificationFilterChange"
        @reload="() => adminConsole.loadVerificationRequests(verificationStatusFilter)"
        @review="handleVerificationReview"
        @reveal="handleVerificationReveal"
        @note-update="handleVerificationNoteUpdate"
      />

      <AdminAuthLinkBlock
        v-else-if="activeTab === 'auth-links'"
        :links="adminConsole.authLinks.value"
        :loading="adminConsole.authLinksLoading.value"
        :error-message="adminConsole.authLinksError.value"
        :creating="adminConsole.authLinkCreating.value"
        :create-error="adminConsole.authLinkCreateError.value"
        @reload="() => adminConsole.loadAuthLinks()"
        @create="(payload) => adminConsole.createAuthLink(payload)"
        @revoke="(linkToken) => adminConsole.revokeAuthLink(linkToken)"
        @copy-url="() => {}"
      />

      <AdminAuditBlock
        v-else
        :events="adminConsole.auditEvents.value"
        :loading="adminConsole.auditLoading.value"
        :error-message="adminConsole.auditError.value"
        @refresh="() => adminConsole.loadAuditLog()"
      />
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
  padding: var(--space-3);
  border-radius: var(--radius-card);
  background: rgba(34, 197, 94, 0.12);
  color: rgb(21, 128, 61);
  font-size: 13px;
  font-weight: 900;
}

.admin-view__exit {
  justify-self: end;
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-pill);
  background: var(--lian-card-strong);
  color: var(--lian-ink);
  font: inherit;
  font-weight: 800;
}

.admin-view__feedback.is-error {
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
}
</style>
