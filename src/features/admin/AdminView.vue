<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { InlineError, LianButton } from "../../ui";
import {
  ADMIN_AUDIT_REFRESH,
  ADMIN_AVATAR_TEXT,
  ADMIN_BACK_TO_PROFILE,
  ADMIN_EXIT_LABEL,
  ADMIN_PROBE_LOADING,
  ADMIN_QUEUE_RELOAD,
  ADMIN_SECTION_LABEL,
  ADMIN_SESSION_FALLBACK,
  ADMIN_SESSION_PROBE_FAIL,
  ADMIN_TAB_AUDIT,
  ADMIN_TAB_LABEL,
  ADMIN_TAB_REPORTS,
  ADMIN_VERIFICATION_DECISION_APPROVE,
  ADMIN_VERIFICATION_DECISION_REJECT,
  ADMIN_VERIFICATION_EMPTY_ALL_BODY,
  ADMIN_VERIFICATION_EMPTY_ALL_TITLE,
  ADMIN_VERIFICATION_EMPTY_APPROVED_BODY,
  ADMIN_VERIFICATION_EMPTY_APPROVED_TITLE,
  ADMIN_VERIFICATION_EMPTY_PENDING_BODY,
  ADMIN_VERIFICATION_EMPTY_PENDING_TITLE,
  ADMIN_VERIFICATION_EMPTY_REJECTED_BODY,
  ADMIN_VERIFICATION_EMPTY_REJECTED_TITLE,
  ADMIN_VERIFICATION_FILTER_GROUP_LABEL,
  ADMIN_VERIFICATION_LIST_LOADING,
  ADMIN_VERIFICATION_REALNAME_MASKED_HINT,
  ADMIN_VERIFICATION_REVEAL_AGAIN,
  ADMIN_VERIFICATION_REVEAL_FIRST,
  ADMIN_VERIFICATION_REVEAL_PENDING,
  ADMIN_VERIFICATION_REVIEWED_AT_LABEL,
  ADMIN_VERIFICATION_REVIEWER_LABEL,
  ADMIN_VERIFICATION_REVIEWER_NOTE_LABEL,
  ADMIN_VERIFICATION_REVIEWER_NOTE_PLACEHOLDER,
  ADMIN_VERIFICATION_REVIEWER_NOTE_PREFIX,
  ADMIN_VERIFICATION_STATUS_ALL,
  ADMIN_VERIFICATION_STATUS_APPROVED,
  ADMIN_VERIFICATION_STATUS_PENDING,
  ADMIN_VERIFICATION_STATUS_REJECTED,
  ADMIN_VERIFICATION_SUBMITTED_AT_LABEL,
  ADMIN_VERIFICATION_SUMMARY_CONTACT,
  ADMIN_VERIFICATION_SUMMARY_ID_NUMBER,
  ADMIN_VERIFICATION_SUMMARY_ID_TYPE,
  ADMIN_VERIFICATION_SUMMARY_MERCHANT_NAME,
  ADMIN_VERIFICATION_SUMMARY_NOTE,
  ADMIN_VERIFICATION_SUMMARY_ORG_ID,
  ADMIN_VERIFICATION_SUMMARY_ORG_NAME,
  ADMIN_VERIFICATION_SUMMARY_REAL_NAME,
  ADMIN_VERIFICATION_TAB_LABEL,
  ADMIN_VERIFICATION_TYPE_MERCHANT,
  ADMIN_VERIFICATION_TYPE_ORG_JOIN,
  ADMIN_VERIFICATION_TYPE_REALNAME,
  ADMIN_VERIFICATION_TYPE_RUNNER,
  ADMIN_VERIFICATION_USER_ID_LABEL,
} from "../../config/brand";
import type { PageChromeSpec } from "../../shell/page-model";
import {
  fetchAdminMe,
  isAdminMeRoleEligible,
  type AdminVerificationDecisionStatus,
  type AdminVerificationDetail,
  type AdminVerificationRequest,
  type AdminVerificationStatus,
  type AdminVerificationType,
} from "../../api/admin";
import { LianApiError } from "../../api/http";
import type {
  AdminPostAction,
  AdminReportStatus,
  AdminReportTransitionStatus,
  AdminUserStatus,
} from "../../types/admin";
import AdminAuditLogList from "./AdminAuditLogList.vue";
import AdminQueueList from "./AdminQueueList.vue";
import AdminTokenGate from "./AdminTokenGate.vue";
import AdminUserActionPanel from "./AdminUserActionPanel.vue";
import { formatAdminTime } from "./admin-format";
import { useAdminConsole } from "./useAdminConsole";
import { useAdminToken } from "./useAdminToken";

type AdminTabKey = "reports" | "verifications" | "audit";
type SummaryRow = { label: string; value: string };

const VERIFICATION_STATUS_LABELS: Record<AdminVerificationStatus | "", string> = {
  "": ADMIN_VERIFICATION_STATUS_ALL,
  pending: ADMIN_VERIFICATION_STATUS_PENDING,
  approved: ADMIN_VERIFICATION_STATUS_APPROVED,
  rejected: ADMIN_VERIFICATION_STATUS_REJECTED,
};
const VERIFICATION_TYPE_LABELS: Record<AdminVerificationType, string> = {
  "org-join": ADMIN_VERIFICATION_TYPE_ORG_JOIN,
  realname: ADMIN_VERIFICATION_TYPE_REALNAME,
  merchant: ADMIN_VERIFICATION_TYPE_MERCHANT,
  runner: ADMIN_VERIFICATION_TYPE_RUNNER,
};
const verificationFilters: Array<{ value: AdminVerificationStatus | ""; label: string }> = [
  { value: "", label: VERIFICATION_STATUS_LABELS[""] },
  { value: "pending", label: VERIFICATION_STATUS_LABELS.pending },
  { value: "approved", label: VERIFICATION_STATUS_LABELS.approved },
  { value: "rejected", label: VERIFICATION_STATUS_LABELS.rejected },
];

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
  { key: "audit", label: ADMIN_TAB_AUDIT },
];

const verificationEmptyState = computed(() => {
  switch (verificationStatusFilter.value) {
    case "pending":
      return {
        title: ADMIN_VERIFICATION_EMPTY_PENDING_TITLE,
        body: ADMIN_VERIFICATION_EMPTY_PENDING_BODY,
      };
    case "approved":
      return {
        title: ADMIN_VERIFICATION_EMPTY_APPROVED_TITLE,
        body: ADMIN_VERIFICATION_EMPTY_APPROVED_BODY,
      };
    case "rejected":
      return {
        title: ADMIN_VERIFICATION_EMPTY_REJECTED_TITLE,
        body: ADMIN_VERIFICATION_EMPTY_REJECTED_BODY,
      };
    default:
      return {
        title: ADMIN_VERIFICATION_EMPTY_ALL_TITLE,
        body: ADMIN_VERIFICATION_EMPTY_ALL_BODY,
      };
  }
});

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

function verificationTypeLabel(type: AdminVerificationType) {
  return VERIFICATION_TYPE_LABELS[type] || type;
}

function verificationStatusLabel(status: AdminVerificationStatus | string) {
  return VERIFICATION_STATUS_LABELS[status as AdminVerificationStatus] || status;
}

function summaryRecord(request: AdminVerificationRequest) {
  const { publicSummary } = request;
  if (!publicSummary || typeof publicSummary !== "object" || Array.isArray(publicSummary)) {
    return {} as Record<string, unknown>;
  }
  return publicSummary as Record<string, unknown>;
}

function formatSummaryValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function verificationSummaryRows(request: AdminVerificationRequest): SummaryRow[] {
  const summary = summaryRecord(request);
  if (request.verificationType === "org-join") {
    return [
      {
        label: ADMIN_VERIFICATION_SUMMARY_ORG_NAME,
        value: formatSummaryValue(summary.orgName) || formatSummaryValue(summary.orgId),
      },
      { label: ADMIN_VERIFICATION_SUMMARY_ORG_ID, value: formatSummaryValue(summary.orgId) },
      { label: ADMIN_VERIFICATION_SUMMARY_NOTE, value: formatSummaryValue(summary.note) },
    ].filter((row) => row.value);
  }
  if (request.verificationType === "realname") {
    return [
      { label: ADMIN_VERIFICATION_SUMMARY_ID_TYPE, value: formatSummaryValue(summary.idType) },
      { label: ADMIN_VERIFICATION_SUMMARY_REAL_NAME, value: formatSummaryValue(summary.realName) },
      { label: ADMIN_VERIFICATION_SUMMARY_ID_NUMBER, value: formatSummaryValue(summary.idNumber) },
      { label: ADMIN_VERIFICATION_SUMMARY_CONTACT, value: formatSummaryValue(summary.contact) },
    ].filter((row) => row.value);
  }
  if (request.verificationType === "merchant") {
    return [
      {
        label: ADMIN_VERIFICATION_SUMMARY_MERCHANT_NAME,
        value: formatSummaryValue(summary.merchantName),
      },
      { label: ADMIN_VERIFICATION_SUMMARY_NOTE, value: formatSummaryValue(summary.note) },
    ].filter((row) => row.value);
  }
  return [
    { label: ADMIN_VERIFICATION_SUMMARY_NOTE, value: formatSummaryValue(summary.note) },
  ].filter((row) => row.value);
}

function revealedRealnameRows(detail: AdminVerificationDetail | undefined): SummaryRow[] {
  if (!detail) return [];
  return [
    { label: ADMIN_VERIFICATION_SUMMARY_ID_TYPE, value: detail.idType?.trim() || "" },
    { label: ADMIN_VERIFICATION_SUMMARY_REAL_NAME, value: detail.realName?.trim() || "" },
    { label: ADMIN_VERIFICATION_SUMMARY_ID_NUMBER, value: detail.idNumber?.trim() || "" },
    { label: ADMIN_VERIFICATION_SUMMARY_CONTACT, value: detail.contact?.trim() || "" },
  ].filter((row) => row.value);
}

function canRevealRealname(request: AdminVerificationRequest) {
  return request.verificationType === "realname";
}

function canReviewRequest(request: AdminVerificationRequest) {
  return request.status === "pending";
}

function revealedDetail(request: AdminVerificationRequest) {
  return console.revealedVerificationDetails.value[request.verificationId];
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
        <section class="admin-view__verification-list">
          <nav
            class="admin-view__verification-filters"
            :aria-label="ADMIN_VERIFICATION_FILTER_GROUP_LABEL"
          >
            <button
              v-for="opt in verificationFilters"
              :key="opt.value || 'all'"
              type="button"
              class="admin-view__verification-filter"
              :class="{ 'is-active': opt.value === verificationStatusFilter }"
              :aria-pressed="opt.value === verificationStatusFilter"
              @click="handleVerificationFilterChange(opt.value)"
            >
              {{ opt.label }}
            </button>
            <LianButton
              size="sm"
              variant="ghost"
              @click="console.loadVerificationRequests(verificationStatusFilter)"
            >
              {{ ADMIN_QUEUE_RELOAD }}
            </LianButton>
          </nav>

          <InlineError v-if="console.verificationError.value">
            {{ console.verificationError.value }}
          </InlineError>
          <InlineError v-else-if="console.verificationRevealError.value">
            {{ console.verificationRevealError.value }}
          </InlineError>

          <div
            v-if="console.verificationLoading.value"
            class="admin-view__verification-state"
            role="status"
          >
            {{ ADMIN_VERIFICATION_LIST_LOADING }}
          </div>

          <section
            v-else-if="!console.verificationRequests.value.length"
            class="admin-view__verification-state admin-view__verification-state-card"
            data-testid="admin-verification-empty"
          >
            <strong>{{ verificationEmptyState.title }}</strong>
            <p>{{ verificationEmptyState.body }}</p>
          </section>

          <div v-else class="admin-view__verification-items">
            <article
              v-for="request in console.verificationRequests.value"
              :key="request.verificationId"
              class="admin-view__verification-item"
              :data-status="request.status"
            >
              <header class="admin-view__verification-header">
                <span class="admin-view__verification-type">
                  {{ verificationTypeLabel(request.verificationType) }}
                </span>
                <span class="admin-view__verification-status">
                  {{ verificationStatusLabel(request.status) }}
                </span>
              </header>

              <dl class="admin-view__verification-meta">
                <div>
                  <dt>{{ ADMIN_VERIFICATION_USER_ID_LABEL }}</dt>
                  <dd>{{ request.userId }}</dd>
                </div>
                <div>
                  <dt>{{ ADMIN_VERIFICATION_SUBMITTED_AT_LABEL }}</dt>
                  <dd>{{ formatAdminTime(request.createdAt || request.updatedAt) }}</dd>
                </div>
                <div v-if="request.reviewerId">
                  <dt>{{ ADMIN_VERIFICATION_REVIEWER_LABEL }}</dt>
                  <dd>{{ request.reviewerId }}</dd>
                </div>
                <div v-if="request.reviewedAt">
                  <dt>{{ ADMIN_VERIFICATION_REVIEWED_AT_LABEL }}</dt>
                  <dd>{{ formatAdminTime(request.reviewedAt) }}</dd>
                </div>
              </dl>

              <dl
                v-if="verificationSummaryRows(request).length"
                class="admin-view__verification-summary"
              >
                <div
                  v-for="row in verificationSummaryRows(request)"
                  :key="`${request.verificationId}:${row.label}`"
                >
                  <dt>{{ row.label }}</dt>
                  <dd>{{ row.value }}</dd>
                </div>
              </dl>

              <p
                v-if="request.verificationType === 'realname'"
                class="admin-view__verification-note admin-view__verification-note--muted"
              >
                {{ ADMIN_VERIFICATION_REALNAME_MASKED_HINT }}
              </p>

              <div v-if="canRevealRealname(request)" class="admin-view__verification-reveal">
                <LianButton
                  size="sm"
                  variant="ghost"
                  :disabled="console.revealingVerificationId.value === request.verificationId"
                  @click="handleVerificationReveal(request)"
                >
                  {{
                    console.revealingVerificationId.value === request.verificationId
                      ? ADMIN_VERIFICATION_REVEAL_PENDING
                      : revealedDetail(request)
                        ? ADMIN_VERIFICATION_REVEAL_AGAIN
                        : ADMIN_VERIFICATION_REVEAL_FIRST
                  }}
                </LianButton>
              </div>

              <dl
                v-if="revealedRealnameRows(revealedDetail(request)).length"
                class="admin-view__verification-detail"
              >
                <div
                  v-for="row in revealedRealnameRows(revealedDetail(request))"
                  :key="`${request.verificationId}:detail:${row.label}`"
                >
                  <dt>{{ row.label }}</dt>
                  <dd>{{ row.value }}</dd>
                </div>
              </dl>

              <p v-if="request.reviewerNote" class="admin-view__verification-note">
                {{ ADMIN_VERIFICATION_REVIEWER_NOTE_PREFIX }}{{ request.reviewerNote }}
              </p>

              <template v-if="canReviewRequest(request)">
                <label class="admin-view__verification-editor">
                  <span>{{ ADMIN_VERIFICATION_REVIEWER_NOTE_LABEL }}</span>
                  <textarea
                    v-model="verificationNotes[request.verificationId]"
                    rows="2"
                    maxlength="240"
                    :placeholder="ADMIN_VERIFICATION_REVIEWER_NOTE_PLACEHOLDER"
                  ></textarea>
                </label>

                <div class="admin-view__verification-actions">
                  <LianButton
                    size="sm"
                    variant="primary"
                    @click="handleVerificationReview(request, 'approved')"
                  >
                    {{ ADMIN_VERIFICATION_DECISION_APPROVE }}
                  </LianButton>
                  <LianButton
                    size="sm"
                    variant="danger"
                    @click="handleVerificationReview(request, 'rejected')"
                  >
                    {{ ADMIN_VERIFICATION_DECISION_REJECT }}
                  </LianButton>
                </div>
              </template>
            </article>
          </div>
        </section>
      </template>

      <template v-else>
        <div class="admin-view__audit-toolbar">
          <LianButton size="sm" variant="ghost" @click="console.loadAuditLog">{{
            ADMIN_AUDIT_REFRESH
          }}</LianButton>
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

.admin-view__audit-toolbar {
  display: flex;
  justify-content: flex-end;
}

.admin-view__verification-list {
  display: grid;
  gap: var(--space-3);
}

.admin-view__verification-filters,
.admin-view__verification-actions,
.admin-view__verification-reveal {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.admin-view__verification-filter {
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

.admin-view__verification-filter.is-active {
  border-color: var(--lian-primary-deep);
  background: var(--lian-primary-soft);
  color: var(--lian-primary-deep);
}

.admin-view__verification-state {
  margin: 0;
  padding: var(--space-4);
  color: var(--lian-muted);
  text-align: center;
}

.admin-view__verification-state-card {
  display: grid;
  gap: var(--space-2);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.82);
}

.admin-view__verification-state-card strong {
  color: var(--lian-ink);
  font-size: 15px;
  font-weight: 900;
}

.admin-view__verification-state-card p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

.admin-view__verification-items {
  display: grid;
  gap: var(--space-3);
}

.admin-view__verification-item {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--lian-line);
  border-radius: var(--radius-card);
  background: var(--lian-card-strong);
  box-shadow: var(--shadow-card);
}

.admin-view__verification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.admin-view__verification-type,
.admin-view__verification-status {
  font-size: 13px;
  font-weight: 900;
}

.admin-view__verification-status {
  padding: 2px var(--space-2);
  border-radius: var(--radius-chip);
  background: rgba(31, 167, 160, 0.16);
  color: var(--lian-primary-deep);
}

.admin-view__verification-item[data-status="approved"] .admin-view__verification-status {
  background: rgba(34, 197, 94, 0.18);
  color: rgb(21, 128, 61);
}

.admin-view__verification-item[data-status="rejected"] .admin-view__verification-status {
  background: rgba(148, 163, 184, 0.22);
  color: rgb(71, 85, 105);
}

.admin-view__verification-meta,
.admin-view__verification-summary,
.admin-view__verification-detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-2) var(--space-3);
  margin: 0;
}

.admin-view__verification-meta div,
.admin-view__verification-summary div,
.admin-view__verification-detail div,
.admin-view__verification-editor {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.admin-view__verification-meta dt,
.admin-view__verification-summary dt,
.admin-view__verification-detail dt,
.admin-view__verification-editor span {
  color: var(--lian-muted);
  font-size: 11px;
  font-weight: 900;
}

.admin-view__verification-meta dd,
.admin-view__verification-summary dd,
.admin-view__verification-detail dd {
  margin: 0;
  color: var(--lian-ink);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.admin-view__verification-note {
  margin: 0;
  color: var(--lian-ink);
  font-size: 12px;
  line-height: 1.5;
}

.admin-view__verification-note--muted {
  color: var(--lian-muted);
}

.admin-view__verification-editor textarea {
  width: 100%;
  min-height: 64px;
  box-sizing: border-box;
  padding: var(--space-2);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.72);
  color: var(--lian-ink);
  font: inherit;
  resize: vertical;
}
</style>
