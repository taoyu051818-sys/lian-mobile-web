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
import { fetchAdminLaMerchants } from "../../api/adminLaPlatform";
import type { PageChromeSpec } from "../../shell/page-model";
import type {
  AdminPostAction,
  AdminReportStatus,
  AdminReportTransitionStatus,
  AdminUserStatus,
} from "../../types/admin";
import AdminAuditBlock from "./AdminAuditBlock.vue";
import AdminAuthLinkBlock from "./AdminAuthLinkBlock.vue";
import AdminLaMerchantsBlock from "./AdminLaMerchantsBlock.vue";
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
import { useAdminMerchants } from "./useAdminMerchants";
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

const merchants = useAdminMerchants({
  authEpoch,
  isSessionLane: () => access.lane.value === "session-merchants",
  fetchMerchants: (query, signal) => fetchAdminLaMerchants(query, signal),
  onAuthorizationLost: (status) => access.loseSessionAuthorization(status),
});

const adminConsole = useAdminConsole({
  token,
  lane: consoleLane,
  authEpoch,
  onTokenInvalid: exitAdminAccess,
});

access = useAdminAccess({
  token,
  authEpoch,
  setToken,
  clearToken,
  advanceAuthEpoch,
  probeMerchants: (signal) => fetchAdminLaMerchants({ limit: 20, offset: 0 }, signal),
  adoptMerchants: merchants.adoptInitial,
  retireMerchants: merchants.retire,
  clearMerchants: merchants.clear,
  loadReports: () => adminConsole.loadReports(statusFilter.value),
});

const tabs: Array<{ key: AdminTabKey; label: string }> = [
  { key: "reports", label: ADMIN_TAB_REPORTS },
  { key: "verifications", label: ADMIN_VERIFICATION_TAB_LABEL },
  { key: "auth-links", label: ADMIN_AUTH_LINK_TAB_LABEL },
  { key: "audit", label: ADMIN_TAB_AUDIT },
];

const nonRetryProbeCodes = new Set([
  "REQUEST_CONTRACT",
  "BFF_NOT_DEPLOYED",
  "PREREQUISITE_UNAVAILABLE",
]);

const probeCanRetry = computed(() => {
  const code = access.probeError.value?.code;
  return access.lane.value === "probe-error" && Boolean(code) && !nonRetryProbeCodes.has(code!);
});

const accessCode = computed(
  () => access.reason.value || access.probeError.value?.code || "HTTP_FAILURE",
);

const safeAccessCopy = computed(() => {
  switch (accessCode.value) {
    case "AUTH_REQUIRED":
      return "请先登录后再访问商户目录。";
    case "CAPABILITY_REQUIRED":
      return "当前账号没有商户目录访问权限。";
    case "REQUEST_CONTRACT":
      return "商户目录请求与服务约定不一致。";
    case "BFF_NOT_DEPLOYED":
      return "商户目录服务尚未部署。";
    case "PREREQUISITE_UNAVAILABLE":
      return "商户目录依赖服务暂不可用。";
    case "RATE_LIMITED":
      return "请求过于频繁，请稍后重试。";
    case "INTEGRATION_UNAVAILABLE":
      return "商户目录集成暂不可用。";
    case "MALFORMED_RESPONSE":
      return "商户目录返回了无法识别的数据。";
    default:
      return "商户目录暂不可用，请稍后重试。";
  }
});

const pageChrome = computed<PageChromeSpec>(() => {
  if (access.lane.value === "session-merchants") {
    return {
      top: {
        visible: true,
        identity: { avatarText: ADMIN_AVATAR_TEXT, name: ADMIN_SECTION_LABEL },
        tabs: {
          kind: "tabs",
          items: [{ id: "merchants", label: "商户目录" }],
          activeKey: "merchants",
          ariaLabel: ADMIN_TAB_LABEL,
        },
        onTabSelect: () => undefined,
        onButtonClick: handleChromeButtonClick,
      },
    };
  }

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

function handleMerchantDraft(value: string) {
  merchants.draftQ.value = value;
}

watch(pageChrome, (spec) => emit("chrome", spec), { deep: true, immediate: false });

onMounted(() => {
  emit("chrome", pageChrome.value);
  void access.initialize();
});

onBeforeUnmount(() => {
  access.dispose();
  merchants.dispose();
  adminConsole.dispose();
});
</script>

<template>
  <section class="admin-view" :aria-label="ADMIN_SECTION_LABEL">
    <button
      v-if="access.lane.value === 'session-merchants' || access.lane.value === 'ops'"
      type="button"
      class="admin-view__exit"
      @click="handleChromeButtonClick('admin:exit')"
    >
      {{ ADMIN_EXIT_LABEL }}
    </button>

    <p
      v-if="access.lane.value === 'probing'"
      class="admin-view__probe-state"
      data-testid="admin-access-probing"
      role="status"
    >
      正在确认商户目录访问权限…
    </p>

    <template v-else-if="access.lane.value === 'gate'">
      <p
        class="admin-view__access-state is-error"
        data-testid="admin-access-reason"
        :data-code="accessCode"
        role="alert"
      >
        {{ safeAccessCopy }}
      </p>
      <AdminTokenGate :error-message="''" @submit="handleTokenSubmit" />
    </template>

    <template v-else-if="access.lane.value === 'probe-error'">
      <div
        class="admin-view__access-state is-error"
        data-testid="admin-probe-error"
        :data-code="accessCode"
        role="alert"
      >
        <p>{{ safeAccessCopy }}</p>
        <button
          v-if="probeCanRetry"
          type="button"
          data-testid="admin-merchants-retry"
          :disabled="access.retryBlocked.value"
          @click="access.retryProbe()"
        >
          重试
        </button>
      </div>
      <AdminTokenGate :error-message="''" @submit="handleTokenSubmit" />
    </template>

    <AdminLaMerchantsBlock
      v-else-if="access.lane.value === 'session-merchants'"
      :rows="merchants.rows.value"
      :limit="merchants.page.value.limit"
      :offset="merchants.page.value.offset"
      :total="merchants.page.value.total"
      :request-id="merchants.requestId.value"
      :loading="merchants.loading.value"
      :empty="merchants.empty.value"
      :error-code="merchants.error.value?.code || ''"
      :draft-q="merchants.draftQ.value"
      :status="merchants.status.value"
      :can-previous="merchants.canPrevious.value"
      :can-next="merchants.canNext.value"
      :can-retry="merchants.canRetry.value"
      :retry-blocked="merchants.retryBlocked.value"
      @draft-change="handleMerchantDraft"
      @search="merchants.submitSearch()"
      @status="merchants.selectStatus"
      @previous="merchants.previousPage()"
      @next="merchants.nextPage()"
      @refresh="merchants.refresh()"
      @retry="merchants.retry()"
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

.admin-view__feedback,
.admin-view__access-state {
  margin: 0;
  padding: var(--space-3);
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

.admin-view__access-state {
  display: grid;
  gap: var(--space-3);
  justify-items: center;
  margin: var(--space-6) auto 0;
  text-align: center;
}

.admin-view__access-state p {
  margin: 0;
}

.admin-view__access-state button {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid currentColor;
  border-radius: var(--radius-pill);
  background: transparent;
  color: inherit;
  font: inherit;
}

.admin-view__feedback.is-error,
.admin-view__access-state.is-error {
  background: rgba(239, 68, 68, 0.12);
  color: rgb(185, 28, 28);
}
</style>
