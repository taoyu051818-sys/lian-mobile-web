<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  ADMIN_AUTH_LINK_TAB_LABEL,
  ADMIN_AVATAR_TEXT,
  ADMIN_BACK_TO_PROFILE,
  ADMIN_EXIT_LABEL,
  ADMIN_PROBE_LOADING,
  ADMIN_SECTION_LABEL,
  ADMIN_SESSION_FALLBACK,
  ADMIN_SESSION_PROBE_FAIL,
  ADMIN_TAB_AUDIT,
  ADMIN_TAB_LABEL,
  ADMIN_TAB_REPORTS,
  ADMIN_VERIFICATION_TAB_LABEL,
} from "../../config/brand";
import type { PageChromeSpec } from "../../shell/page-model";
import { fetchAdminMe, isAdminMeRoleEligible } from "../../api/admin";
import { LianApiError } from "../../api/http";
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
import { useAdminConsole } from "./useAdminConsole";
import { useAdminToken } from "./useAdminToken";
import type {
  AdminVerificationDecisionStatus,
  AdminVerificationRequest,
  AdminVerificationStatus,
} from "./admin-verification";

type AdminTabKey = "reports" | "verifications" | "auth-links" | "audit";

const emit = defineEmits<{
  chrome: [spec: PageChromeSpec];
  close: [];
}>();

const { token, sessionAdmin, setToken, clearToken, setSessionAdmin, clearSessionAdmin } =
  useAdminToken();
const tokenError = ref("");
const probing = ref(false);
const activeTab = ref<AdminTabKey>("reports");
const statusFilter = ref<AdminReportStatus | "">("pending");
const verificationStatusFilter = ref<AdminVerificationStatus | "">("pending");
const verificationNotes = ref<Record<string, string>>({});

const consoleEnabled = computed(() => Boolean(token.value) || sessionAdmin.value);

const console = useAdminConsole({
  token,
  onTokenInvalid: () => {
    if (sessionAdmin.value) {
      clearSessionAdmin();
      tokenError.value = ADMIN_SESSION_FALLBACK;
      return;
    }
    tokenError.value = "";
    clearToken();
  },
});

const tabs: Array<{ key: AdminTabKey; label: string }> = [
  { key: "reports", label: ADMIN_TAB_REPORTS },
  { key: "verifications", label: ADMIN_VERIFICATION_TAB_LABEL },
  { key: "auth-links", label: ADMIN_AUTH_LINK_TAB_LABEL },
  { key: "audit", label: ADMIN_TAB_AUDIT },
];

const pageChrome = computed<PageChromeSpec>(() => {
  if (!consoleEnabled.value) {
    return {
      top: {
        visible: true,
        identity: { avatarText: ADMIN_AVATAR_TEXT, name: ADMIN_SECTION_LABEL },
        buttons: [{ id: "admin:close", label: ADMIN_BACK_TO_PROFILE, variant: "ghost" }],
        onButtonClick: handleChromeButtonClick,
      },
    };
  }
  return {
    top: {
      visible: true,
      identity: { avatarText: ADMIN_AVATAR_TEXT, name: ADMIN_SECTION_LABEL },
      tabs: {
        kind: "tabs",
        items: tabs.map((t) => ({ id: t.key, label: t.label })),
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
  if (buttonId === "admin:close") emit("close");
  else if (buttonId === "admin:exit") {
    clearToken();
    clearSessionAdmin();
    emit("close");
  }
}

function selectTab(key: AdminTabKey) {
  activeTab.value = key;
  if (key === "audit") void console.loadAuditLog();
  else if (key === "verifications") {
    void console.loadVerificationRequests(verificationStatusFilter.value);
  } else if (key === "auth-links") {
    void console.loadAuthLinks();
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
  request: AdminVerificationRequest,
  status: AdminVerificationDecisionStatus,
) {
  void console.reviewVerificationRequest(request, {
    status,
    reviewerNote: verificationNotes.value[request.verificationId]?.trim() || null,
  });
}

function handleVerificationReveal(request: AdminVerificationRequest) {
  void console.revealVerificationRequest(request);
}

function handleVerificationNoteUpdate(verificationId: string, value: string) {
  verificationNotes.value = { ...verificationNotes.value, [verificationId]: value };
}

async function probeAdminSession() {
  if (token.value) return;
  probing.value = true;
  try {
    const response = await fetchAdminMe();
    if (isAdminMeRoleEligible(response)) {
      setSessionAdmin(true);
      void console.loadReports(statusFilter.value);
    } else {
      clearSessionAdmin();
    }
  } catch (error) {
    clearSessionAdmin();
    if (error instanceof LianApiError && error.status !== 401 && error.status !== 403) {
      tokenError.value = ADMIN_SESSION_PROBE_FAIL;
    }
  } finally {
    probing.value = false;
  }
}

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true, immediate: false });

onMounted(() => {
  emit("chrome", pageChrome.value);
  if (token.value) {
    void console.loadReports(statusFilter.value);
  } else {
    void probeAdminSession();
  }
});
</script>

<template>
  <section class="admin-view" :aria-label="ADMIN_SECTION_LABEL">
    <p v-if="probing && !consoleEnabled" class="admin-view__probe-state" role="status">
      {{ ADMIN_PROBE_LOADING }}
    </p>

    <AdminTokenGate
      v-else-if="!consoleEnabled"
      :error-message="tokenError"
      @submit="handleTokenSubmit"
    />

    <template v-else>
      <p
        v-if="console.actionMessage.value || console.actionError.value"
        class="admin-view__feedback"
        :class="{ 'is-error': console.actionError.value }"
        role="status"
      >
        {{ console.actionError.value || console.actionMessage.value }}
      </p>

      <AdminReportsBlock
        v-if="activeTab === 'reports'"
        :reports="console.reports.value"
        :loading="console.reportsLoading.value"
        :error-message="console.reportsError.value"
        :status-filter="statusFilter"
        @filter-change="handleFilterChange"
        @reload="() => console.loadReports(statusFilter)"
        @transition="handleTransition"
        @post-action="handlePostAction"
        @user-action="handleUserAction"
      />

      <AdminVerificationBlock
        v-else-if="activeTab === 'verifications'"
        :requests="console.verificationRequests.value"
        :loading="console.verificationLoading.value"
        :error-message="console.verificationError.value"
        :reveal-error="console.verificationRevealError.value"
        :status-filter="verificationStatusFilter"
        :revealing-verification-id="console.revealingVerificationId.value"
        :revealed-details="console.revealedVerificationDetails.value"
        :notes="verificationNotes"
        @filter-change="handleVerificationFilterChange"
        @reload="() => console.loadVerificationRequests(verificationStatusFilter)"
        @review="handleVerificationReview"
        @reveal="handleVerificationReveal"
        @note-update="handleVerificationNoteUpdate"
      />

      <AdminAuthLinkBlock
        v-else-if="activeTab === 'auth-links'"
        :links="console.authLinks.value"
        :loading="console.authLinksLoading.value"
        :error-message="console.authLinksError.value"
        :creating="console.authLinkCreating.value"
        :create-error="console.authLinkCreateError.value"
        @reload="() => console.loadAuthLinks()"
        @create="(payload) => console.createAuthLink(payload)"
        @revoke="(token) => console.revokeAuthLink(token)"
        @copy-url="() => {}"
      />

      <AdminAuditBlock
        v-else
        :events="console.auditEvents.value"
        :loading="console.auditLoading.value"
        :error-message="console.auditError.value"
        @refresh="() => console.loadAuditLog()"
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
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-card);
  background: rgba(34, 197, 94, 0.12);
  color: rgb(21, 128, 61);
  font-size: 13px;
  font-weight: 900;
}

.admin-view__probe-state {
  margin: var(--space-6) auto 0;
  padding: var(--space-3);
  color: var(--lian-muted);
  font-size: 13px;
  text-align: center;
}

.admin-view__feedback.is-error {
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
}
</style>
